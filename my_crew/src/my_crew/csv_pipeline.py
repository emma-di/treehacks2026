"""
CSV-driven scheduler pipeline.

1. Pull data from demo_patients.csv (each row = one patient).
2. For each patient: risk (model 1 → probability; if > 35% then model 2 → length of stay).
   Risk agent returns: nurse_briefing, needs_bed, length_of_stay (hours).
3. Patient assignment: match patient to an available room; update patients array and hospital space.
4. After all patients: nurse agent assigns 4 different nurses to each occupied room for the NEXT 12 HOURS only
   (each nurse slot 15, 20, or 30 minutes).

All start/stop are floats (hours). Unassigned: room/start/stop = -1.
"""

from __future__ import annotations

import copy
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import pandas as pd

from my_crew.model_inference import ModelInference
from my_crew.event_stream import emit_event

logger = logging.getLogger(__name__)

BED_PROBABILITY_THRESHOLD = 0.35
NURSE_WINDOW_HOURS = 12.0
NURSES_PER_ROOM = 4
# Slot durations in hours: 15 min, 20 min, 30 min
NURSE_SLOT_DURATIONS_HOURS = (15 / 60, 20 / 60, 30 / 60)
DEFAULT_NUM_ROOMS = 50
MAX_PATIENTS_TO_ALLOCATE = 25


def _find_csv_path() -> str:
    for base in [Path(__file__).resolve().parent.parent.parent, Path.cwd(), Path("my_crew")]:
        for name in ["data/demo_patients.csv", "demo_patients.csv", "my_crew/data/demo_patients.csv"]:
            p = base / name
            if p.exists():
                return str(p)
    return "data/demo_patients.csv"


def get_risk_for_row(
    row_index: int,
    csv_path: str | None = None,
    inference: ModelInference | None = None,
    df: pd.DataFrame | None = None,
    voice_audio_path: str | Path | None = None,
    voice_clinical_summary: str | None = None,
) -> dict[str, Any]:
    """
    Run model 1 (bed need) on the patient row; if probability > 35%, run model 2 (length of stay).
    Returns: nurse_briefing (str), needs_bed (bool), length_of_stay (float hours, only when needs_bed).
    Uses the same method as test_demo_patients.py: row[task1_features].to_dict() / row[task2_features].to_dict().
    Optional: voice_audio_path = path to doctor–patient conversation audio; it will be transcribed and
    clinically summarized to enhance nurse_briefing. Or pass voice_clinical_summary directly.
    """
    path = csv_path or _find_csv_path()
    inf = inference or ModelInference(demo_patients_path=path)
    if df is None:
        df = pd.read_csv(path)
    row = df.iloc[row_index]
    logger.info("Patient row %s: getting features and calling model 1 (bed need)", row_index)
    features_task1 = inf.get_features_from_row(row, task=1)
    prob = inf.predict_task1(features_task1, model_type="fl")
    needs_bed = prob >= BED_PROBABILITY_THRESHOLD
    logger.info(
        "Patient row %s: model 1 -> prob=%.4f, needs_bed=%s (threshold=%.2f)",
        row_index, prob, needs_bed, BED_PROBABILITY_THRESHOLD,
    )
    length_of_stay_hours: float = -1.0
    if needs_bed:
        logger.info("Patient row %s: calling model 2 (length of stay)", row_index)
        features_task2 = inf.get_features_from_row(row, task=2)
        length_of_stay_hours = max(0.0, round(float(inf.predict_task2(features_task2, model_type="fl"))))
        logger.info(
            "Patient row %s: model 2 -> length_of_stay_hours=%.0f",
            row_index, length_of_stay_hours,
        )
    # Nurse briefing: base summary from risk models
    nurse_briefing = (
        f"Patient row {row_index}: bed need probability={prob:.2%}; "
        f"needs_bed={needs_bed}; "
        + (f"length_of_stay={length_of_stay_hours:.0f}h." if needs_bed else "no bed required.")
    )
    # Optionally enhance with voice-derived clinical context (doctor–patient conversation)
    if voice_audio_path is not None:
        try:
            from my_crew.voice_agent import get_clinical_summary_from_voice, enhance_nurse_briefing
            summary = get_clinical_summary_from_voice(voice_audio_path)
            nurse_briefing = enhance_nurse_briefing(nurse_briefing, summary)
        except Exception as e:
            logger.warning("Voice agent failed for row %s: %s; using base briefing only", row_index, e)
    elif voice_clinical_summary:
        from my_crew.voice_agent import enhance_nurse_briefing
        nurse_briefing = enhance_nurse_briefing(nurse_briefing, voice_clinical_summary)
    return {
        "nurse_briefing": nurse_briefing,
        "needs_bed": needs_bed,
        "length_of_stay": int(length_of_stay_hours) if needs_bed else -1,
    }


def assign_room(
    rooms: list[dict[str, Any]],
    length_of_stay_hours: float,
) -> tuple[str, float, float] | None:
    """
    Find an available room (smallest next_available time), book it for length_of_stay_hours.
    Room format: { "id": str, "start": float, "stop": float }. -1, -1 = available from 0.
    Updates the chosen room in place. Returns (room_id, start, stop) or None if no room.
    """
    if length_of_stay_hours <= 0:
        return None
    best_room = None
    best_next = float("inf")
    for r in rooms:
        stop = r.get("stop", -1)
        next_avail = 0.0 if (stop is None or stop == -1) else float(stop)
        if next_avail < best_next:
            best_next = next_avail
            best_room = r
    if best_room is None:
        return None
    start = best_next
    stop = start + length_of_stay_hours
    best_room["start"] = start
    best_room["stop"] = stop
    return (best_room["id"], start, stop)


def schedule_nurses_next_12h(
    rooms: list[dict[str, Any]],
    roster: list[dict[str, Any]],
    window_hours: float = NURSE_WINDOW_HOURS,
    nurses_per_room: int = NURSES_PER_ROOM,
    slot_durations_hours: tuple[float, ...] = NURSE_SLOT_DURATIONS_HOURS,
) -> list[dict[str, Any]]:
    """
    For the next 12 hours only: assign 4 DIFFERENT nurses to each occupied room.
    Each nurse gets one slot of 15, 20, or 30 minutes (we use 30 min = 0.5h for each).
    Occupied room = room with start >= 0 and stop > 0.
    roster: list of { "name": str, "load": int }.
    Returns list of nurse objects: { "id": nurse_name, "room": room_id, "start": float, "stop": float }.
    Distributes all available nurses across rooms, ensuring NO nurse is double-booked at the same time.
    """
    occupied = [r for r in rooms if r.get("stop") is not None and r.get("stop", -1) > 0]
    if not occupied or not roster:
        return []
    
    # Spread 4 slots over the window (e.g. 0, 3, 6, 9 hours); each slot 15, 20, or 30 min
    step = window_hours / nurses_per_room
    
    # Sort roster by load (ascending) so we balance
    roster_sorted = sorted(roster, key=lambda x: (x.get("load", 0), x.get("name", "")))
    nurse_names = [r.get("name", f"Nurse_{i+1}") for i, r in enumerate(roster_sorted)]
    
    # Ensure we have enough nurse names (should have 30 from roster)
    if len(nurse_names) < nurses_per_room:
        nurse_names = nurse_names + [f"Nurse_{i+1}" for i in range(len(nurse_names), nurses_per_room)]
    
    result: list[dict[str, Any]] = []
    
    # Track nurse schedules to prevent double-booking
    # nurse_schedule[nurse_name] = [(start, stop), (start, stop), ...]
    nurse_schedule: dict[str, list[tuple[float, float]]] = {name: [] for name in nurse_names}
    
    def is_nurse_available(nurse_name: str, slot_start: float, slot_stop: float) -> bool:
        """Check if nurse is available during the given time slot (no overlap with existing assignments)."""
        for assigned_start, assigned_stop in nurse_schedule[nurse_name]:
            # Check for any overlap: new slot overlaps if it starts before existing ends AND ends after existing starts
            if slot_start < assigned_stop and slot_stop > assigned_start:
                return False
        return True
    
    def find_available_nurse(slot_start: float, slot_stop: float, start_idx: int = 0) -> str | None:
        """Find the first available nurse for this time slot, starting from start_idx."""
        for i in range(len(nurse_names)):
            nurse_idx = (start_idx + i) % len(nurse_names)
            nurse_name = nurse_names[nurse_idx]
            if is_nurse_available(nurse_name, slot_start, slot_stop):
                return nurse_name
        return None
    
    nurse_counter = 0  # Start index for round-robin selection
    
    for room in occupied:
        room_id = room.get("id", "")
        for k in range(nurses_per_room):
            slot_start = k * step
            duration = slot_durations_hours[k % len(slot_durations_hours)]
            slot_stop = slot_start + duration
            
            # Find an available nurse for this time slot
            nurse_name = find_available_nurse(slot_start, slot_stop, nurse_counter)
            
            if nurse_name is None:
                # Should not happen with 30 nurses and reasonable scheduling, but log it
                print(f"Warning: Could not find available nurse for room {room_id} at time {slot_start}-{slot_stop}")
                continue
            
            # Assign this nurse and update their schedule
            nurse_schedule[nurse_name].append((slot_start, slot_stop))
            result.append({
                "id": nurse_name,
                "room": room_id,
                "start": round(slot_start, 2),
                "stop": round(slot_stop, 2),
            })
            
            # Increment counter for next assignment to distribute load
            nurse_counter += 1
    
    return result


def load_pipeline_state(output_dir: str | Path) -> dict[str, Any]:
    """
    Load pipeline state from a previous run's output folder (e.g. batch_01_first_25).
    Reads hospital_space.json. Returns dict with key "hospital_space" (list of room dicts).
    Use with run_csv_pipeline(..., initial_hospital_space=state["hospital_space"]) for the next batch.
    """
    output_dir = Path(output_dir)
    space_path = output_dir / "hospital_space.json"
    if not space_path.exists():
        raise FileNotFoundError(f"State not found: {space_path}")
    with open(space_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {"hospital_space": data.get("hospital_space", [])}


def verify_no_nurse_conflicts(nurse_assignments: list[dict[str, Any]]) -> tuple[bool, list[str]]:
    """
    Verify that no nurse is double-booked (assigned to multiple rooms at overlapping times).
    Returns (is_valid, list_of_conflicts).
    """
    conflicts = []
    nurse_schedule: dict[str, list[dict[str, Any]]] = {}
    
    # Group assignments by nurse
    for assignment in nurse_assignments:
        nurse_id = assignment.get("id", "")
        if nurse_id not in nurse_schedule:
            nurse_schedule[nurse_id] = []
        nurse_schedule[nurse_id].append(assignment)
    
    # Check each nurse's schedule for overlaps
    for nurse_id, assignments in nurse_schedule.items():
        # Sort by start time
        assignments_sorted = sorted(assignments, key=lambda x: x.get("start", 0))
        
        for i in range(len(assignments_sorted)):
            for j in range(i + 1, len(assignments_sorted)):
                a1 = assignments_sorted[i]
                a2 = assignments_sorted[j]
                start1, stop1 = a1.get("start", 0), a1.get("stop", 0)
                start2, stop2 = a2.get("start", 0), a2.get("stop", 0)
                room1, room2 = a1.get("room", ""), a2.get("room", "")
                
                # Check for overlap: a1 and a2 overlap if start1 < stop2 AND start2 < stop1
                if start1 < stop2 and start2 < stop1:
                    conflict_msg = (
                        f"CONFLICT: {nurse_id} is double-booked - "
                        f"Room {room1} ({start1}-{stop1}) overlaps with "
                        f"Room {room2} ({start2}-{stop2})"
                    )
                    conflicts.append(conflict_msg)
    
    return (len(conflicts) == 0, conflicts)


def run_csv_pipeline(
    csv_path: str | None = None,
    hospital_room_ids: list[str] | None = None,
    roster: list[dict[str, Any]] | None = None,
    max_patients: int | None = None,
    start_index: int = 0,
    initial_hospital_space: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Full pipeline:
    1. Load CSV; build patients array (id=encounter_id, room=-1, start=-1, stop=-1).
    2. Build or load hospital space: list of rooms { id, start, stop }. If initial_hospital_space
       is provided (e.g. from a previous batch), use a copy so this run continues from that state.
    3. For each row: get risk (model 1, if >35% model 2); if needs_bed, assign room and update patient + room.
    4. Schedule nurses for next 12h (4 per occupied room).
    Optional: max_patients, start_index for batched runs; initial_hospital_space to chain from previous batch.
    Returns { "patients": [...], "hospital_space": [...], "nurse_assignments": [...], "risk_per_patient": [...] }.
    """
    path = csv_path or _find_csv_path()
    if not os.path.exists(path):
        raise FileNotFoundError(f"CSV not found: {path}")
    df = pd.read_csv(path)
    encounter_col = "encounter_id" if "encounter_id" in df.columns else df.columns[0]
    all_patient_ids = df[encounter_col].astype(str).tolist()
    cap = max_patients if max_patients is not None else MAX_PATIENTS_TO_ALLOCATE
    n_allocate = min(cap, len(df) - start_index, len(df))
    n_allocate = max(0, n_allocate)
    patient_ids = all_patient_ids[start_index : start_index + n_allocate]

    if initial_hospital_space is not None:
        hospital_space = copy.deepcopy(initial_hospital_space)
    else:
        room_ids = hospital_room_ids or [f"R{i+1}" for i in range(DEFAULT_NUM_ROOMS)]
        hospital_space = [
            {"id": rid, "start": -1, "stop": -1} for rid in room_ids
        ]
    patients: list[dict[str, Any]] = [
        {"id": pid, "room": -1, "start": -1, "stop": -1} for pid in patient_ids
    ]
    risk_per_patient: list[dict[str, Any]] = []

    inference = ModelInference(demo_patients_path=path)
    
    emit_event("pipeline_start", {
        "message": f"Starting patient scheduling pipeline for {n_allocate} patients",
        "total_patients": n_allocate
    })

    for i in range(n_allocate):
        row_index = start_index + i
        patient_id = patient_ids[i]
        
        emit_event("patient_start", {
            "patient_id": patient_id,
            "index": i + 1,
            "total": n_allocate,
            "message": f"Analyzing patient {patient_id} ({i+1}/{n_allocate})"
        })
        
        # Model call with delay
        emit_event("model_call", {
            "patient_id": patient_id,
            "model": "Risk Assessment Model 1",
            "message": "Calling bed need prediction model..."
        })
        time.sleep(0.5)  # 0.5 second delay for model call
        
        risk = get_risk_for_row(row_index, csv_path=path, inference=inference, df=df)
        
        emit_event("model_result", {
            "patient_id": patient_id,
            "model": "Risk Assessment Model 1",
            "needs_bed": risk["needs_bed"],
            "probability": risk.get("bed_probability", "N/A"),
            "message": f"Model result: needs_bed={risk['needs_bed']}"
        })
        
        # If needs bed, call model 2
        if risk["needs_bed"]:
            emit_event("model_call", {
                "patient_id": patient_id,
                "model": "Length of Stay Model 2",
                "message": "Calling length of stay prediction model..."
            })
            time.sleep(0.5)  # 0.5 second delay for model call
            
            emit_event("model_result", {
                "patient_id": patient_id,
                "model": "Length of Stay Model 2",
                "length_of_stay": risk["length_of_stay"],
                "message": f"Predicted LOS: {risk['length_of_stay']} hours"
            })
        
        risk_per_patient.append({"row_index": row_index, "patient_id": patient_id, **risk})
        
        if not risk["needs_bed"]:
            emit_event("patient_complete", {
                "patient_id": patient_id,
                "status": "no_bed_needed",
                "message": f"Patient {patient_id} does not need a bed"
            })
            time.sleep(0.25)  # 0.25 second delay after patient analysis
            continue
            
        los = risk["length_of_stay"]
        if los <= 0:
            emit_event("patient_complete", {
                "patient_id": patient_id,
                "status": "invalid_los",
                "message": f"Patient {patient_id} has invalid length of stay"
            })
            time.sleep(0.25)
            continue
            
        assigned = assign_room(hospital_space, los)
        if assigned is None:
            emit_event("patient_complete", {
                "patient_id": patient_id,
                "status": "no_room_available",
                "message": f"No room available for patient {patient_id}"
            })
            time.sleep(0.25)
            continue
            
        room_id, start, stop = assigned
        patients[i]["room"] = room_id
        patients[i]["start"] = start
        patients[i]["stop"] = stop
        
        emit_event("patient_complete", {
            "patient_id": patient_id,
            "status": "assigned",
            "room": room_id,
            "start": start,
            "stop": stop,
            "los": los,
            "message": f"Patient {patient_id} assigned to {room_id} from {start} to {stop}"
        })
        time.sleep(0.25)  # 0.25 second delay after patient analysis

    emit_event("nurse_scheduling_start", {
        "message": "Starting nurse scheduling for occupied rooms",
        "total_nurses": 30
    })
    
    nurse_roster = roster or [{"name": f"Nurse_{i+1}", "load": 0} for i in range(30)]
    nurse_assignments = schedule_nurses_next_12h(hospital_space, nurse_roster)
    
    emit_event("nurse_scheduling_complete", {
        "message": f"Nurse scheduling complete: {len(nurse_assignments)} assignments",
        "total_assignments": len(nurse_assignments)
    })
    
    # Verify no nurse conflicts
    is_valid, conflicts = verify_no_nurse_conflicts(nurse_assignments)
    if not is_valid:
        print("\n⚠️  WARNING: Nurse scheduling conflicts detected:")
        for conflict in conflicts:
            print(f"  - {conflict}")
        print(f"\nTotal conflicts: {len(conflicts)}\n")
        emit_event("validation_warning", {
            "message": f"Nurse scheduling conflicts detected: {len(conflicts)} conflicts",
            "conflicts": conflicts[:5]  # Show first 5 conflicts
        })
    else:
        print(f"✓ Nurse scheduling verified: {len(nurse_assignments)} assignments, no conflicts detected.")
        emit_event("validation_success", {
            "message": f"Nurse scheduling verified: {len(nurse_assignments)} assignments, no conflicts"
        })
    
    emit_event("pipeline_complete", {
        "message": "Pipeline execution complete",
        "patients_processed": n_allocate,
        "patients_assigned": len([p for p in patients if p["room"] != -1]),
        "nurse_assignments": len(nurse_assignments)
    })

    return {
        "patients": patients,
        "hospital_space": hospital_space,
        "nurse_assignments": nurse_assignments,
        "risk_per_patient": risk_per_patient,
    }


def write_pipeline_output(result: dict[str, Any], output_dir: str) -> list[str]:
    """Write pipeline result to JSON files in output_dir. Returns list of written paths."""
    os.makedirs(output_dir, exist_ok=True)
    output_dir = os.path.abspath(output_dir)
    paths = []
    for name, key in [
        ("final_allocations", None),
        ("patient_view", "patients"),
        ("nurse_view", "nurse_assignments"),
    ]:
        if key is None:
            data = result
        else:
            data = {key: result.get(key, [])}
        path = os.path.join(output_dir, f"{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        paths.append(path)
    # Also write hospital_space alone for clarity
    path = os.path.join(output_dir, "hospital_space.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"hospital_space": result.get("hospital_space", [])}, f, indent=2, ensure_ascii=False)
    paths.append(path)
    return paths
