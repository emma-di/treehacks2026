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


# --- Final Allocation (one schema for patient view and nurse view) ---

class FinalAllocationOutput(BaseModel):
    """
    Centralized allocation output: one schema for both patient view and nurse view.
    Use status to distinguish assigned vs waitlisted; optional fields apply per status.
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
    # Waitlisted
    waitlist_position: int | None = Field(
        default=None,
        description="Position in waitlist (1 = next to place); set when status=waitlisted.",
    )
    # Optional for both views
    duration_of_stay: str | None = Field(
        default=None,
        description="Predicted duration of stay from Risk Agent (e.g. 24–48 hours).",
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
