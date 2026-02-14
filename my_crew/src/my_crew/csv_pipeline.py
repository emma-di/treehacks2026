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
from pathlib import Path
from typing import Any

import pandas as pd

from my_crew.model_inference import ModelInference

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
) -> dict[str, Any]:
    """
    Run model 1 (bed need) on the patient row; if probability > 35%, run model 2 (length of stay).
    Returns: nurse_briefing (str), needs_bed (bool), length_of_stay (float hours, only when needs_bed).
    Uses the same method as test_demo_patients.py: row[task1_features].to_dict() / row[task2_features].to_dict().
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
    # Nurse briefing: short summary (no LLM in pipeline; can be replaced by risk agent later)
    nurse_briefing = (
        f"Patient row {row_index}: bed need probability={prob:.2%}; "
        f"needs_bed={needs_bed}; "
        + (f"length_of_stay={length_of_stay_hours:.0f}h." if needs_bed else "no bed required.")
    )
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
    """
    occupied = [r for r in rooms if r.get("stop") is not None and r.get("stop", -1) > 0]
    if not occupied or not roster:
        return []
    # Spread 4 slots over the window (e.g. 0, 3, 6, 9 hours); each slot 15, 20, or 30 min
    step = window_hours / nurses_per_room
    # Sort roster by load (ascending) so we balance; then round-robin
    roster_sorted = sorted(roster, key=lambda x: (x.get("load", 0), x.get("name", "")))
    nurse_names = [r.get("name", f"Nurse_{i}") for i, r in enumerate(roster_sorted)]
    if len(nurse_names) < nurses_per_room:
        nurse_names = nurse_names + [f"Nurse_{i}" for i in range(len(nurse_names), nurses_per_room)]
    result: list[dict[str, Any]] = []
    for room in occupied:
        room_id = room.get("id", "")
        for k in range(nurses_per_room):
            slot_start = k * step
            duration = slot_durations_hours[k % len(slot_durations_hours)]
            slot_stop = slot_start + duration
            nurse_name = nurse_names[k % len(nurse_names)]
            result.append({
                "id": nurse_name,
                "room": room_id,
                "start": round(slot_start, 2),
                "stop": round(slot_stop, 2),
            })
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

    for i in range(n_allocate):
        row_index = start_index + i
        risk = get_risk_for_row(row_index, csv_path=path, inference=inference, df=df)
        risk_per_patient.append({"row_index": row_index, "patient_id": patient_ids[i], **risk})
        if not risk["needs_bed"]:
            continue
        los = risk["length_of_stay"]
        if los <= 0:
            continue
        assigned = assign_room(hospital_space, los)
        if assigned is None:
            continue
        room_id, start, stop = assigned
        patients[i]["room"] = room_id
        patients[i]["start"] = start
        patients[i]["stop"] = stop

    nurse_roster = roster or [{"name": f"Nurse_{i+1}", "load": 0} for i in range(30)]
    nurse_assignments = schedule_nurses_next_12h(hospital_space, nurse_roster)

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
