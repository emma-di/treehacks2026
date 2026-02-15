"""Greedy algorithm tool for final allocation: best (nurse, room) match given risk profile and feasibility options."""

import json
import re
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from my_crew.output_schemas import (
    FinalAllocationBatchOutput,
    FinalAllocationOutput,
    NurseCheckRound,
    NurseCheckSchedule,
)


class GreedyAllocationToolInput(BaseModel):
    """Input schema for GreedyAllocationTool."""

    patient_id: str = Field(
        ...,
        description="Patient identifier (e.g. 'Patient A' or 'P-001').",
    )
    risk_profile: str = Field(
        ...,
        description="JSON string with risk_profile from Risk Agent: object with 'numeric_score' (0-1), 'risk_category' (e.g. Critical, Observation, Stable), and optional 'predicted_duration_of_stay'.",
    )
    feasibility_options: str = Field(
        ...,
        description="JSON string: array of options, each with 'nurse_name', 'room_id', 'room_type', 'nurse_load', and optional 'certifications' (list of strings). Nurses with certifications that match the patient's risk get higher priority.",
    )


# Risk category → preferred room types (higher score = better match)
ROOM_FIT: dict[str, list[str]] = {
    "Critical": ["Negative Pressure", "Isolation", "General"],
    "High": ["Isolation", "Negative Pressure", "General"],
    "Observation": ["Isolation", "General", "Negative Pressure"],
    "Stable": ["General", "Isolation", "Negative Pressure"],
    "Low": ["General"],
}
DEFAULT_ORDER = ["Negative Pressure", "Isolation", "General"]

# Risk category → preferred/required certifications (patient who needs it most gets best-certified nurse)
RISK_CATEGORY_REQUIRED_CERTS: dict[str, list[str]] = {
    "Critical": ["ICU-certified", "ACLS"],
    "High": ["ICU-certified"],
    "Observation": ["ICU-certified", "ER-specialist"],
    "Stable": ["ER-specialist", "General"],
    "Low": ["General"],
}
DEFAULT_REQUIRED_CERTS = ["General"]


def _cert_match_score(required_certs: list[str], nurse_certs: list[str]) -> float:
    """Higher = better match. Prefer nurses who have more of the required certifications."""
    if not required_certs:
        return 0.0
    nurse_set = {c.strip() for c in nurse_certs if isinstance(c, str)}
    matches = sum(1 for c in required_certs if c.strip() in nurse_set)
    return matches / max(len(required_certs), 1)


def _room_match_score(risk_category: str, room_type: str) -> float:
    """Higher = better fit. Critical prefers Negative Pressure/Isolation; Stable prefers General."""
    order = ROOM_FIT.get(risk_category, DEFAULT_ORDER)
    try:
        idx = order.index(room_type)
        return 1.0 - (idx / max(len(order), 1))  # 1.0 for first, lower for later
    except ValueError:
        return 0.0


def _load_score(nurse_load: int, max_load: int = 6) -> float:
    """Higher = better (lower load preferred)."""
    if max_load <= 0:
        return 1.0
    return max(0.0, 1.0 - (nurse_load / max_load))


def _build_nurse_check_schedule(primary_nurse: str, options: list[dict[str, Any]]) -> NurseCheckSchedule:
    """Nurses who will rotate checks: primary assigned nurse first, then others from feasibility list (order preserved, up to 4). Rotation for checks is based on this list."""
    seen: set[str] = set()
    nurses: list[str] = []
    if primary_nurse and primary_nurse not in seen:
        seen.add(primary_nurse)
        nurses.append(primary_nurse)
    for opt in options:
        name = opt.get("nurse_name") or opt.get("nurse")
        if name and name not in seen:
            seen.add(name)
            nurses.append(name)
            if len(nurses) >= 4:
                break
    return NurseCheckSchedule(
        interval_hours=4,
        duration_minutes="20-30",
        nurse_names=nurses if nurses else [primary_nurse] if primary_nurse else [],
    )


def _parse_duration_to_hours(duration_of_stay: str | None) -> float:
    """Parse duration string to approximate hours (e.g. '5-7 days' -> 144, '24-48 hours' -> 36)."""
    if not duration_of_stay or not isinstance(duration_of_stay, str):
        return 72.0  # default 3 days
    s = duration_of_stay.strip().lower()
    # "5-7 days" -> 6 days; "3 days" -> 3; "24-48 hours" -> 36
    days_match = re.search(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*day", s)
    if days_match:
        lo, hi = float(days_match.group(1)), float(days_match.group(2))
        return (lo + hi) / 2 * 24
    days_match = re.search(r"(\d+(?:\.\d+)?)\s*day", s)
    if days_match:
        return float(days_match.group(1)) * 24
    hours_match = re.search(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*hour", s)
    if hours_match:
        lo, hi = float(hours_match.group(1)), float(hours_match.group(2))
        return (lo + hi) / 2
    hours_match = re.search(r"(\d+(?:\.\d+)?)\s*hour", s)
    if hours_match:
        return float(hours_match.group(1))
    return 72.0


def _build_conflict_free_nurse_rounds(
    allocations: list[FinalAllocationOutput],
) -> list[list[NurseCheckRound]]:
    """Assign (nurse, start, stop) per round. Nurses rotate based on each patient's feasibility list (nurse_check_schedule.nurse_names); no nurse used twice in the same round."""
    assigned = [a for a in allocations if a.status == "assigned" and a.nurse_check_schedule]
    if not assigned:
        return []
    interval_hours = 4
    max_rounds = 0
    for a in assigned:
        hours = _parse_duration_to_hours(a.duration_of_stay)
        max_rounds = max(max_rounds, max(1, int(hours / interval_hours)))
    result: list[list[NurseCheckRound]] = []
    for a in assigned:
        nurses = list(a.nurse_check_schedule.nurse_names) if a.nurse_check_schedule else []
        if not nurses:
            nurses = [a.nurse_name or "Unknown"]
        result.append([])
    # Each round: assign each patient a nurse from their feasibility-list pool, rotating by round index; no double-book
    for round_idx in range(max_rounds):
        used_this_round: set[str] = set()
        start_h = float(round_idx * interval_hours)
        stop_h = start_h + 0.5  # 30 min = 0.5 h
        for i, a in enumerate(assigned):
            nurses = list(a.nurse_check_schedule.nurse_names) if a.nurse_check_schedule else []
            if not nurses:
                nurses = [a.nurse_name or "Unknown"]
            # Rotate by feasibility list: prefer nurse at (round_idx % len); if taken, try rest in order
            preferred_idx = round_idx % len(nurses)
            nurse = None
            for k in range(len(nurses)):
                n = nurses[(preferred_idx + k) % len(nurses)]
                if n not in used_this_round:
                    nurse = n
                    break
            if nurse is None:
                nurse = nurses[0]
            used_this_round.add(nurse)
            result[i].append(NurseCheckRound(nurse=nurse, start=start_h, stop=stop_h))
    return result


def _build_single_patient_nurse_rounds(
    duration_of_stay: str | None,
    nurse_names: list[str],
) -> list[NurseCheckRound]:
    """Build nurse rounds for one patient: rotate through nurses from feasibility list (round 0 → first, round 1 → second, etc.)."""
    if not nurse_names:
        return []
    hours = _parse_duration_to_hours(duration_of_stay)
    num_rounds = max(1, int(hours / 4))
    rounds: list[NurseCheckRound] = []
    for round_idx in range(num_rounds):
        nurse = nurse_names[round_idx % len(nurse_names)]
        start_h = float(round_idx * 4)
        stop_h = start_h + 0.5  # 30 min = 0.5 h
        rounds.append(NurseCheckRound(nurse=nurse, start=start_h, stop=stop_h))
    return rounds


class GreedyAllocationTool(BaseTool):
    """Tool that picks the best (nurse, room) from feasibility options using greedy scoring: risk–room fit and nurse load."""

    name: str = "greedy_allocation"
    description: str = (
        "Chooses the best binding assignment (nurse + room) for a patient from a list of feasible options. "
        "Uses greedy scoring: matches risk category to room type (e.g. Critical → Isolation) and prefers nurses "
        "with lower current load. Call with patient_id, risk_profile (JSON from Risk Agent), and feasibility_options "
        "(JSON array of nurse_name, room_id, room_type, nurse_load). Returns Final Allocation or waitlist position if no options."
    )
    args_schema: Type[BaseModel] = GreedyAllocationToolInput

    def _run(
        self,
        patient_id: str,
        risk_profile: str,
        feasibility_options: str,
    ) -> str:
        """Run greedy selection and return final allocation or waitlist info."""
        try:
            profile = self._parse_json(risk_profile, "risk_profile")
            options = self._parse_options(feasibility_options)
        except ValueError as e:
            return f"Invalid input: {e}"

        risk_cat = self._get_risk_category(profile)
        risk_score = self._get_risk_score(profile)
        duration_of_stay = self._get_duration_of_stay(profile)

        if not options:
            pos = self._waitlist_position_from_score(risk_score)
            allocation = FinalAllocationOutput(
                patient_id=patient_id,
                status="waitlisted",
                risk_score=risk_score,
                risk_category=risk_cat,
                waitlist_position=pos,
                duration_of_stay=duration_of_stay,
            )
            return allocation.model_dump_json()

        # Greedy: score each option (room fit + load), pick max
        scored = []
        required_certs = RISK_CATEGORY_REQUIRED_CERTS.get(risk_cat, DEFAULT_REQUIRED_CERTS)
        for opt in options:
            room_type = opt.get("room_type") or opt.get("room_type") or "General"
            nurse_load = int(opt.get("nurse_load") or opt.get("current_load") or 0)
            raw_certs = opt.get("certifications") or opt.get("certs") or []
            nurse_certs = raw_certs if isinstance(raw_certs, list) else [raw_certs]
            room_score = _room_match_score(risk_cat, room_type)
            load_sc = _load_score(nurse_load)
            cert_sc = _cert_match_score(required_certs, nurse_certs)
            total = room_score + load_sc + cert_sc  # cert match: prefer nurse who best matches patient need
            scored.append((total, opt))

        scored.sort(key=lambda x: -x[0])
        best = scored[0][1]
        nurse_name = best.get("nurse_name") or best.get("nurse") or "Unknown"
        room_id = best.get("room_id") or best.get("room") or "Unknown"
        nurse_check_schedule = _build_nurse_check_schedule(nurse_name, options)
        nurse_rounds = _build_single_patient_nurse_rounds(
            duration_of_stay,
            nurse_check_schedule.nurse_names,
        )

        allocation = FinalAllocationOutput(
            patient_id=patient_id,
            status="assigned",
            risk_score=risk_score,
            risk_category=risk_cat,
            room_id=room_id,
            nurse_name=nurse_name,
            nurse_check_schedule=nurse_check_schedule,
            duration_of_stay=duration_of_stay,
            nurse_rounds=nurse_rounds,
        )
        return allocation.model_dump_json()

    @staticmethod
    def _parse_json(raw: str, label: str) -> dict[str, Any]:
        raw = raw.strip()
        if not raw:
            raise ValueError(f"{label} is empty.")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"{label} is not valid JSON: {e}") from e
        if isinstance(data, dict):
            return data
        raise ValueError(f"{label} must be a JSON object.")

    @staticmethod
    def _parse_options(raw: str) -> list[dict[str, Any]]:
        raw = raw.strip()
        if not raw:
            return []
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            raise ValueError("feasibility_options is not valid JSON.") from None
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict) and "options" in data and isinstance(data["options"], list):
            return [x for x in data["options"] if isinstance(x, dict)]
        return []

    @staticmethod
    def _get_risk_category(profile: dict[str, Any]) -> str:
        rp = profile.get("risk_profile") or profile
        if isinstance(rp, dict):
            cat = rp.get("risk_category")
            if cat:
                return str(cat)
        return str(profile.get("risk_category") or "Observation")

    @staticmethod
    def _get_risk_score(profile: dict[str, Any]) -> float:
        rp = profile.get("risk_profile") or profile
        if isinstance(rp, dict):
            s = rp.get("numeric_score")
            if s is not None:
                return float(s)
        return float(profile.get("numeric_score", 0.5))

    @staticmethod
    def _get_duration_of_stay(profile: dict[str, Any]) -> str | None:
        raw = profile.get("predicted_duration_of_stay")
        if raw:
            return str(raw)
        rp = profile.get("risk_profile") or profile
        if isinstance(rp, dict):
            raw = rp.get("predicted_duration_of_stay")
            if raw:
                return str(raw)
        return None

    @staticmethod
    def _waitlist_position_from_score(risk_score: float) -> int:
        """Higher risk → position 1 (next to place). Simple mapping."""
        if risk_score >= 0.8:
            return 1
        if risk_score >= 0.5:
            return 2
        return 3


# --- Batch allocation: one assignment per patient (serial dictatorship) ---

class GreedyAllocationBatchToolInput(BaseModel):
    """Input schema for GreedyAllocationBatchTool."""

    patients_json: str = Field(
        ...,
        description="JSON array of patients. Each element: {patient_id, risk_profile (JSON object with risk_profile.numeric_score, risk_profile.risk_category), feasibility_options (JSON array of nurse_name, room_id, room_type, nurse_load)}. Produces one assignment per patient; highest risk gets first pick (no double-booking).",
    )


class GreedyAllocationBatchTool(BaseTool):
    """Tool that allocates multiple patients in one run: one assignment per patient, no double-booking (serial dictatorship by risk)."""

    name: str = "greedy_allocation_batch"
    description: str = (
        "Produces one assignment per patient. Input: JSON array of patients, each with patient_id, risk_profile (JSON), "
        "and feasibility_options (JSON array). Patients are processed in order of risk score (highest first); each "
        "assigned (nurse, room) is removed from the pool so no nurse/room is double-booked. Call this when you have "
        "multiple patients to allocate. Returns a JSON object with 'allocations': array of allocation objects."
    )
    args_schema: Type[BaseModel] = GreedyAllocationBatchToolInput

    def _run(self, patients_json: str) -> str:
        """Run batch allocation: one assignment per patient, serial dictatorship by risk."""
        try:
            raw = patients_json.strip()
            if not raw:
                raise ValueError("patients_json is empty.")
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            return f"Invalid patients_json: {e}"

        if isinstance(data, dict) and "patients" in data:
            patients = data["patients"]
        elif isinstance(data, list):
            patients = data
        else:
            return "patients_json must be a JSON array of patients or {patients: [...]}."

        if not patients:
            batch = FinalAllocationBatchOutput(allocations=[])
            return batch.model_dump_json()

        # Resolve each item to {patient_id, profile_dict, options_list}
        resolved = []
        for i, p in enumerate(patients):
            if not isinstance(p, dict):
                continue
            pid = p.get("patient_id") or p.get("id") or f"Patient-{i+1}"
            rp_raw = p.get("risk_profile")
            if isinstance(rp_raw, dict):
                profile = rp_raw
            elif isinstance(rp_raw, str):
                try:
                    profile = json.loads(rp_raw)
                except json.JSONDecodeError:
                    continue
            else:
                continue
            opts_raw = p.get("feasibility_options")
            if isinstance(opts_raw, list):
                options = [x for x in opts_raw if isinstance(x, dict)]
            elif isinstance(opts_raw, str):
                try:
                    options = GreedyAllocationTool._parse_options(opts_raw)
                except ValueError:
                    options = []
            else:
                options = []
            resolved.append((pid, profile, options))

        # Sort by risk score descending (serial dictatorship)
        def risk_key(item: tuple) -> float:
            return -GreedyAllocationTool._get_risk_score(item[1])

        resolved.sort(key=risk_key)

        used_pairs: set[tuple[str, str]] = set()
        allocations: list[FinalAllocationOutput] = []

        for patient_id, profile, options in resolved:
            risk_cat = GreedyAllocationTool._get_risk_category(profile)
            risk_score = GreedyAllocationTool._get_risk_score(profile)
            duration_of_stay = GreedyAllocationTool._get_duration_of_stay(profile)

            # Exclude already-assigned (nurse, room) pairs
            def pair(o: dict) -> tuple[str, str]:
                return (o.get("nurse_name") or o.get("nurse") or "Unknown", o.get("room_id") or o.get("room") or "Unknown")
            available = [o for o in options if pair(o) not in used_pairs]

            if not available:
                pos = GreedyAllocationTool._waitlist_position_from_score(risk_score)
                allocations.append(
                    FinalAllocationOutput(
                        patient_id=patient_id,
                        status="waitlisted",
                        risk_score=risk_score,
                        risk_category=risk_cat,
                        waitlist_position=pos,
                        duration_of_stay=duration_of_stay,
                    )
                )
                continue

            # Greedy pick from available (room fit + load + certification match)
            required_certs = RISK_CATEGORY_REQUIRED_CERTS.get(risk_cat, DEFAULT_REQUIRED_CERTS)
            scored = []
            for opt in available:
                room_type = opt.get("room_type") or "General"
                nurse_load = int(opt.get("nurse_load") or opt.get("current_load") or 0)
                raw_certs = opt.get("certifications") or opt.get("certs") or []
                nurse_certs = raw_certs if isinstance(raw_certs, list) else [raw_certs]
                room_score = _room_match_score(risk_cat, room_type)
                load_sc = _load_score(nurse_load)
                cert_sc = _cert_match_score(required_certs, nurse_certs)
                scored.append((room_score + load_sc + cert_sc, opt))
            scored.sort(key=lambda x: -x[0])
            best = scored[0][1]
            nurse_name = best.get("nurse_name") or best.get("nurse") or "Unknown"
            room_id = best.get("room_id") or best.get("room") or "Unknown"
            nurse_check_schedule = _build_nurse_check_schedule(nurse_name, available)

            used_pairs.add((nurse_name, room_id))
            allocations.append(
                FinalAllocationOutput(
                    patient_id=patient_id,
                    status="assigned",
                    risk_score=risk_score,
                    risk_category=risk_cat,
                    room_id=room_id,
                    nurse_name=nurse_name,
                    nurse_check_schedule=nurse_check_schedule,
                    duration_of_stay=duration_of_stay,
                )
            )

        # Assign conflict-free nurse rounds so no nurse is in two places at the same time
        assigned = [a for a in allocations if a.status == "assigned"]
        if assigned:
            rounds_per = _build_conflict_free_nurse_rounds(assigned)
            for alloc, rounds in zip(assigned, rounds_per):
                alloc.nurse_rounds = rounds

        batch = FinalAllocationBatchOutput(allocations=allocations)
        return batch.model_dump_json()
