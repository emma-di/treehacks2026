"""Greedy algorithm tool for final allocation: best (nurse, room) match given risk profile and feasibility options."""

import json
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from my_crew.output_schemas import FinalAllocationBatchOutput, FinalAllocationOutput


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
        description="JSON string: array of options, each with 'nurse_name', 'room_id', 'room_type', 'nurse_load'. From Resource Agent feasibility list in structured form.",
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
        for opt in options:
            room_type = opt.get("room_type") or opt.get("room_type") or "General"
            nurse_load = int(opt.get("nurse_load") or opt.get("current_load") or 0)
            room_score = _room_match_score(risk_cat, room_type)
            load_sc = _load_score(nurse_load)
            total = room_score + load_sc  # equal weight; can tune
            scored.append((total, opt))

        scored.sort(key=lambda x: -x[0])
        best = scored[0][1]
        nurse_name = best.get("nurse_name") or best.get("nurse") or "Unknown"
        room_id = best.get("room_id") or best.get("room") or "Unknown"

        allocation = FinalAllocationOutput(
            patient_id=patient_id,
            status="assigned",
            risk_score=risk_score,
            risk_category=risk_cat,
            room_id=room_id,
            nurse_name=nurse_name,
            duration_of_stay=duration_of_stay,
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

            # Greedy pick from available
            scored = []
            for opt in available:
                room_type = opt.get("room_type") or "General"
                nurse_load = int(opt.get("nurse_load") or opt.get("current_load") or 0)
                room_score = _room_match_score(risk_cat, room_type)
                load_sc = _load_score(nurse_load)
                scored.append((room_score + load_sc, opt))
            scored.sort(key=lambda x: -x[0])
            best = scored[0][1]
            nurse_name = best.get("nurse_name") or best.get("nurse") or "Unknown"
            room_id = best.get("room_id") or best.get("room") or "Unknown"

            used_pairs.add((nurse_name, room_id))
            allocations.append(
                FinalAllocationOutput(
                    patient_id=patient_id,
                    status="assigned",
                    risk_score=risk_score,
                    risk_category=risk_cat,
                    room_id=room_id,
                    nurse_name=nurse_name,
                    duration_of_stay=duration_of_stay,
                )
            )

        batch = FinalAllocationBatchOutput(allocations=allocations)
        return batch.model_dump_json()
