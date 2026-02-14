"""Structured output schemas for the Risk Assessment Agent and Final Allocation."""

from typing import Literal

from pydantic import BaseModel, Field


class RiskProfile(BaseModel):
    """Structured risk profile with numeric score and category."""

    numeric_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Risk score from 0.0 (lowest) to 1.0 (highest).",
    )
    risk_category: str = Field(
        ...,
        description="Category such as Critical, Stable, Observation, Low, High.",
    )


class RiskAssessmentOutput(BaseModel):
    """Full output of the Risk Assessment task."""

    risk_profile: RiskProfile = Field(
        ...,
        description="Structured risk profile with numeric score and category.",
    )
    nurse_briefing: str = Field(
        ...,
        description="Concise natural-language summary for nurses: why the patient is at risk and what to watch for.",
    )
    predicted_duration_of_stay: str = Field(
        ...,
        description="Predicted length of stay (e.g., '2-3 days', '24–48 hours', '1 week').",
    )
    needs_bed: bool = Field(
        ...,
        description="True if patient needs a bed (bed probability >= 35%); false otherwise. When true, Resource Agent is triggered.",
    )
    length_of_stay_bed: str | None = Field(
        default=None,
        description="How long the patient needs the bed (e.g. '4.2 days'). Set only when needs_bed is true; null otherwise.",
    )


# --- Final Allocation (one schema for patient view and nurse view) ---


class NurseCheckSchedule(BaseModel):
    """Schedule for regular nurse checks: nurses from the feasibility list rotate every 4 hours, 20–30 min per check."""

    interval_hours: int = Field(
        default=4,
        description="Nurses check on the patient every this many hours.",
    )
    duration_minutes: str = Field(
        default="20-30",
        description="Each check lasts approximately this long (e.g. '20-30' minutes).",
    )
    nurse_names: list[str] = Field(
        default_factory=list,
        description="Nurses from the feasibility list who rotate doing checks (primary assigned nurse first, then others from feasibility options; order used for rotation).",
    )


class FinalAllocationOutput(BaseModel):
    """
    Centralized allocation output: one schema for both patient view and nurse view.
    Use status to distinguish assigned vs waitlisted; optional fields apply per status.
    Room allocation is time-bound: when duration_of_stay ends, the room is immediately available for the next patient.
    """

    patient_id: str = Field(..., description="Patient identifier (e.g. Patient A, P-001).")
    status: Literal["assigned", "waitlisted"] = Field(
        ...,
        description="assigned = binding assignment; waitlisted = no room/nurse ready, position by risk.",
    )
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Risk score from Risk Agent (0.0–1.0).",
    )
    risk_category: str = Field(
        default="",
        description="Risk category (e.g. Critical, Observation, Stable).",
    )
    # Assigned: room and nurse
    room_id: str | None = Field(default=None, description="Assigned room id; set when status=assigned.")
    nurse_name: str | None = Field(default=None, description="Assigned nurse; set when status=assigned.")
    # Nurse check schedule (for assigned patients): several nurses check every 4h for 20–30 min
    nurse_check_schedule: NurseCheckSchedule | None = Field(
        default=None,
        description="When assigned: several different nurses check every 4 hours for 20–30 minutes. Set when status=assigned.",
    )
    # Waitlisted
    waitlist_position: int | None = Field(
        default=None,
        description="Position in waitlist (1 = next to place); set when status=waitlisted.",
    )
    # Optional for both views
    duration_of_stay: str | None = Field(
        default=None,
        description="Predicted duration of stay from Risk Agent (e.g. 24–48 hours). Room is released when this period ends; next patient may then claim the room.",
    )
    # Conflict-free nurse rounds (nurse, start, stop) — set by tool when multiple patients so no nurse is double-booked
    nurse_rounds: list["NurseCheckRound"] | None = Field(
        default=None,
        description="When set by allocation tool: (nurse, start, stop) per round so the same nurse is never in two places at once. Use these in the final output.",
    )

    def for_patient_view(self) -> dict:
        """Summary for patient view: my assignment or my waitlist position."""
        out = {
            "patient_id": self.patient_id,
            "status": self.status,
            "risk_score": self.risk_score,
            "risk_category": self.risk_category or None,
        }
        if self.status == "assigned":
            out["room_id"] = self.room_id
            out["nurse_name"] = self.nurse_name
            if self.nurse_check_schedule:
                out["nurse_check_schedule"] = self.nurse_check_schedule.model_dump()
        else:
            out["waitlist_position"] = self.waitlist_position
        if self.duration_of_stay:
            out["duration_of_stay"] = self.duration_of_stay
        return out

    def for_nurse_view(self) -> dict:
        """Summary for nurse view: who is assigned to me or waitlist by risk."""
        out = {
            "patient_id": self.patient_id,
            "status": self.status,
            "risk_score": self.risk_score,
            "risk_category": self.risk_category or None,
        }
        if self.status == "assigned":
            out["room_id"] = self.room_id
            out["nurse_name"] = self.nurse_name
            if self.nurse_check_schedule:
                out["nurse_check_schedule"] = self.nurse_check_schedule.model_dump()
        else:
            out["waitlist_position"] = self.waitlist_position
        if self.duration_of_stay:
            out["duration_of_stay"] = self.duration_of_stay
        return out


class FinalAllocationBatchOutput(BaseModel):
    """Batch of allocations: one assignment per patient (same schema for patient/nurse view)."""

    allocations: list[FinalAllocationOutput] = Field(
        ...,
        description="One allocation per patient, in order (e.g. by risk or input order).",
    )


# --- Orchestrator output: time-based Patient, Room, Nurse (per round) ---


class PatientInRoom(BaseModel):
    """Patient assignment with room occupancy times in hours (float): start = when patient enters room, stop = when they leave. 1 = hour 1."""

    id: str = Field(..., description="Patient identifier.")
    room: str = Field(..., description="Room id the patient is assigned to.")
    start: float = Field(..., description="Start of being in the room, in hours (float). 0 = admission, 1 = hour 1.")
    stop: float = Field(..., description="Stop: when patient leaves the room, in hours (e.g. 72 = 3 days).")


class RoomOccupancy(BaseModel):
    """Room occupancy window: start and stop in hours (float). 1 = hour 1."""

    id: str = Field(..., description="Room identifier.")
    start: float = Field(..., description="Start of occupancy in hours (same as patient start).")
    stop: float = Field(..., description="Stop of occupancy in hours (same as patient stop); room available for next patient after this.")


class NurseCheckRound(BaseModel):
    """One nurse check round: which nurse checks, and start/stop in hours (float). 1 = hour 1."""

    nurse: str = Field(..., description="Name of the nurse performing this check round.")
    start: float = Field(..., description="Start of this check round in hours (e.g. 0, 4, 8).")
    stop: float = Field(..., description="Stop of this check round in hours (e.g. 0.5, 4.5, 8.5 for 30 min).")


class AllocationTimeRecord(BaseModel):
    """One allocation with time-based Patient, Room, and Nurse check rounds."""

    patient: PatientInRoom = Field(..., description="Patient: id, room, start, stop.")
    room: RoomOccupancy = Field(..., description="Room: id, start, stop (occupied window).")
    nurse_rounds: list[NurseCheckRound] = Field(
        default_factory=list,
        description="Nurse check rounds: each has nurse name, start, and stop so you can see which nurse checks at which time (rotate through different nurses every 4h, 20–30 min per round).",
    )


class OrchestratorOutput(BaseModel):
    """Orchestrator agent output: time-based schema. Patient {id, room, start, stop}; Room {id, start, stop}; Nurse rounds {start, stop}."""

    allocations: list[AllocationTimeRecord] = Field(
        ...,
        description="One record per assigned patient: patient in room (id, room, start, stop), room occupancy (id, start, stop), nurse check rounds (start, stop per round). Waitlisted patients are omitted or have minimal entries.",
    )
