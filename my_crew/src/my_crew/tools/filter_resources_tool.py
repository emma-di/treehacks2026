"""Constraint-based filtering tool for matching staff and rooms to risk profile."""

import json
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class FilterResourcesToolInput(BaseModel):
    """Input schema for FilterResourcesTool."""

    staff_roster: str = Field(
        ...,
        description="JSON string: list of nurses, each with 'name', 'certifications' (list of strings, e.g. ICU-certified, ER-specialist), and 'current_load' (int).",
    )
    hospital_map: str = Field(
        ...,
        description="JSON string: list of rooms/beds, each with 'room_id', 'room_type' (e.g. Negative Pressure, Isolation, General), 'available' (bool), and optional 'equipment' (list or string).",
    )
    required_certifications: str = Field(
        ...,
        description="Comma-separated certifications required for this risk profile (e.g. 'ICU-certified' or 'ICU-certified,ER-specialist').",
    )
    allowed_room_types: str = Field(
        ...,
        description="Comma-separated room types that are acceptable (e.g. 'Negative Pressure,Isolation' or 'General').",
    )
    max_nurse_load: int = Field(
        default=6,
        description="Maximum current_load a nurse can have to be considered (default 6). Lower = prefer less loaded nurses.",
    )


class FilterResourcesTool(BaseTool):
    """Tool that filters staff and hospital map by certifications, room type, and load, then returns a feasibility list of best-match (nurse, room) options."""

    name: str = "filter_resources"
    description: str = (
        "Filters the staff roster and hospital map by required certifications, allowed room types, and nurse load. "
        "Returns a feasibility list of best-match resources: nurses with the right certs and lowest load paired with "
        "available rooms of the right type. Use this when you have staff_roster, hospital_map, and know the required "
        "certifications and room types for the risk profile (e.g. Critical → ICU-certified, Isolation/Negative Pressure)."
    )
    args_schema: Type[BaseModel] = FilterResourcesToolInput

    def _run(
        self,
        staff_roster: str,
        hospital_map: str,
        required_certifications: str,
        allowed_room_types: str,
        max_nurse_load: int = 6,
    ) -> str:
        """Filter nurses and rooms by constraints and return a feasibility list of best matches."""
        try:
            roster = self._parse_json_list(staff_roster, "staff_roster")
            rooms = self._parse_json_list(hospital_map, "hospital_map")
        except ValueError as e:
            return f"Invalid input: {e}"

        certs = [c.strip() for c in required_certifications.split(",") if c.strip()]
        room_types = [r.strip() for r in allowed_room_types.split(",") if r.strip()]

        # Filter nurses: has at least one required cert and load under max
        nurses = []
        for n in roster:
            if not isinstance(n, dict):
                continue
            name = n.get("name") or n.get("id") or "Unknown"
            raw_certs = n.get("certifications") or n.get("certs") or []
            cert_list = raw_certs if isinstance(raw_certs, list) else [raw_certs]
            load = n.get("current_load") or n.get("load") or 0
            try:
                load = int(load)
            except (TypeError, ValueError):
                load = 0
            if not certs or any(c in cert_list for c in certs):
                if load < max_nurse_load:
                    nurses.append({"name": name, "certifications": cert_list, "current_load": load})

        # Sort by load ascending (lowest first)
        nurses.sort(key=lambda x: x["current_load"])

        # Filter rooms: available and type in allowed
        available_rooms = []
        for r in rooms:
            if not isinstance(r, dict):
                continue
            room_id = r.get("room_id") or r.get("id") or r.get("room") or "Unknown"
            rtype = r.get("room_type") or r.get("type") or "General"
            avail = r.get("available")
            if avail is None:
                avail = True
            if not room_types or rtype in room_types:
                if avail:
                    available_rooms.append({"room_id": room_id, "room_type": rtype, "equipment": r.get("equipment", "")})

        # Build feasibility list: pair nurses (by load order) with rooms
        lines = []
        if not nurses:
            lines.append("No nurses match the required certifications and load limit.")
        if not available_rooms:
            lines.append("No rooms are available for the allowed room types.")
        if nurses and available_rooms:
            lines.append("Feasibility list (best match first by lowest nurse load and correct certification):")
            for i, nurse in enumerate(nurses):
                room = available_rooms[i % len(available_rooms)]
                room_id = room["room_id"]
                room_type = room["room_type"]
                lines.append(
                    f"- Room {room_id} ({room_type}) is open and Nurse {nurse['name']} has "
                    f"current load {nurse['current_load']} and the correct certification for this risk profile."
                )
            if len(nurses) > len(available_rooms):
                lines.append(f"(Additional {len(nurses) - len(available_rooms)} nurse(s) match but no extra rooms.)")
            elif len(available_rooms) > len(nurses):
                lines.append(f"(Additional {len(available_rooms) - len(nurses)} room(s) available.)")

        return "\n".join(lines) if lines else "No feasible (nurse, room) matches with the given constraints."

    @staticmethod
    def _parse_json_list(raw: str, label: str) -> list[Any]:
        """Parse a JSON string into a list; accept wrapped in list or as object with a list key."""
        raw = raw.strip()
        if not raw:
            raise ValueError(f"{label} is empty.")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"{label} is not valid JSON: {e}") from e
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("nurses", "staff", "roster", "rooms", "beds", "map"):
                if key in data and isinstance(data[key], list):
                    return data[key]
            if "data" in data and isinstance(data["data"], list):
                return data["data"]
        raise ValueError(f"{label} must be a JSON array or object containing a list.")
