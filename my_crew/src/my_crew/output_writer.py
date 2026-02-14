"""Write final allocation output to JSON files: full output, nurse view, and patient view."""

import json
import os
from typing import Any


def _parse_output_to_dict(out: Any) -> dict[str, Any] | None:
    """Turn task output (TaskOutput, Pydantic, str, dict) into a dict with 'allocations' or None."""
    if out is None:
        return None
    # TaskOutput often has .raw (str) or .content
    raw_str = getattr(out, "raw", None) or getattr(out, "content", None)
    if isinstance(raw_str, str):
        try:
            data = json.loads(raw_str)
            return data if isinstance(data, dict) and "allocations" in data else None
        except json.JSONDecodeError:
            # Try to find a JSON object containing "allocations" in the text
            start = raw_str.find('{"allocations"')
            if start == -1:
                start = raw_str.find("{\"allocations\"")
            if start != -1:
                depth = 0
                for i in range(start, len(raw_str)):
                    if raw_str[i] == "{":
                        depth += 1
                    elif raw_str[i] == "}":
                        depth -= 1
                        if depth == 0:
                            try:
                                data = json.loads(raw_str[start : i + 1])
                                return data if isinstance(data, dict) else None
                            except json.JSONDecodeError:
                                break
            return None
    if hasattr(out, "model_dump"):
        data = out.model_dump()
        return data if isinstance(data, dict) and "allocations" in data else None
    if isinstance(out, dict) and "allocations" in out:
        return out
    if isinstance(out, str):
        try:
            data = json.loads(out)
            return data if isinstance(data, dict) and "allocations" in data else None
        except json.JSONDecodeError:
            return None
    return None


def _get_orchestrator_output(crew_result: Any) -> dict[str, Any] | None:
    """Extract orchestrator task output from CrewOutput. Returns dict with 'allocations' or None."""
    # CrewAI: result.tasks[i].output (TaskOutput with .raw or Pydantic)
    tasks = getattr(crew_result, "tasks", None)
    if tasks and len(tasks) > 0:
        last = tasks[-1]
        out = getattr(last, "output", None)
        data = _parse_output_to_dict(out)
        if data is not None:
            return data
    # tasks_output list (raw outputs)
    tasks_output = getattr(crew_result, "tasks_output", None)
    if isinstance(tasks_output, list) and len(tasks_output) > 0:
        data = _parse_output_to_dict(tasks_output[-1])
        if data is not None:
            return data
    # Top-level raw
    raw = getattr(crew_result, "raw", None)
    if raw is not None:
        data = _parse_output_to_dict(raw)
        if data is not None:
            return data
    return None


def _build_nurse_view(allocations: list[dict[str, Any]]) -> dict[str, Any]:
    """Build nurse-centric view: for each nurse, list rounds (patient_id, room_id, start, stop)."""
    by_nurse: dict[str, list[dict[str, Any]]] = {}
    for rec in allocations:
        patient = rec.get("patient") or {}
        patient_id = patient.get("id") or "unknown"
        room_id = (rec.get("room") or {}).get("id") or patient.get("room") or "unknown"
        for r in rec.get("nurse_rounds") or []:
            nurse = (r.get("nurse") or "unknown").strip()
            if nurse not in by_nurse:
                by_nurse[nurse] = []
            by_nurse[nurse].append({
                "patient_id": patient_id,
                "room_id": room_id,
                "start": r.get("start"),
                "stop": r.get("stop"),
            })
    # Sort rounds by start per nurse
    for nurse in by_nurse:
        by_nurse[nurse] = sorted(by_nurse[nurse], key=lambda x: (x.get("start") is None, x.get("start")))
    return {"nurses": [{"nurse": n, "rounds": rounds} for n, rounds in sorted(by_nurse.items())]}


def _build_patient_view(allocations: list[dict[str, Any]]) -> dict[str, Any]:
    """Build patient-centric view: for each patient, room, start, stop, nurse_rounds."""
    patients = []
    for rec in allocations:
        patient = rec.get("patient") or {}
        room = rec.get("room") or {}
        patients.append({
            "patient_id": patient.get("id") or "unknown",
            "room_id": patient.get("room") or room.get("id") or "unknown",
            "start": patient.get("start"),
            "stop": patient.get("stop"),
            "nurse_rounds": rec.get("nurse_rounds") or [],
        })
    return {"patients": patients}


def write_allocation_output(crew_result: Any, output_dir: str | None = None) -> list[str]:
    """
    Write final allocation output to three JSON files under output_dir.
    Returns list of written file paths, or empty list if no orchestrator output found.
    """
    data = _get_orchestrator_output(crew_result)
    if not data or "allocations" not in data:
        return []

    base = output_dir or os.path.join(os.getcwd(), "output")
    base = os.path.abspath(base)
    os.makedirs(base, exist_ok=True)

    allocations = data.get("allocations") or []
    if not isinstance(allocations, list):
        allocations = []

    paths = []

    # 1. Full JSON (final_allocations.json)
    full_path = os.path.join(base, "final_allocations.json")
    with open(full_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    paths.append(full_path)

    # 2. Nurse view (nurse_view.json)
    nurse_view = _build_nurse_view(allocations)
    nurse_path = os.path.join(base, "nurse_view.json")
    with open(nurse_path, "w", encoding="utf-8") as f:
        json.dump(nurse_view, f, indent=2, ensure_ascii=False)
    paths.append(nurse_path)

    # 3. Patient view (patient_view.json)
    patient_view = _build_patient_view(allocations)
    patient_path = os.path.join(base, "patient_view.json")
    with open(patient_path, "w", encoding="utf-8") as f:
        json.dump(patient_view, f, indent=2, ensure_ascii=False)
    paths.append(patient_path)

    return paths
