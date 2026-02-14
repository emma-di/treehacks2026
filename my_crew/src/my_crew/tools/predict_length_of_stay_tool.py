"""Tool: predict length of stay (Model Task 2)."""

import json
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from my_crew.model_inference import ModelInference


class PredictLengthOfStayToolInput(BaseModel):
    """Input for PredictLengthOfStayTool. Use encounter_id or row_index to select patient from demo_patients.csv."""

    encounter_id: str | None = Field(
        default=None,
        description="Encounter ID matching a row in demo_patients.csv (e.g. E001). Use this or row_index.",
    )
    row_index: int | None = Field(
        default=None,
        description="0-based row index in demo_patients.csv. Use when encounter_id is not provided.",
    )
    model_type: str = Field(
        default="fl",
        description="Model to use: 'fl', 'client1', or 'client2'.",
    )


class PredictLengthOfStayTool(BaseTool):
    """Predicts length of stay (days) for a patient who needs a bed. Uses Task 2 regression model and demo_patients.csv."""

    name: str = "predict_length_of_stay"
    description: str = (
        "Predict how long the patient will need the bed (length of stay in days). "
        "Uses the Task 2 regression model and patient data from demo_patients.csv. "
        "Call this only for patients who have probability of needing a bed >= 35% (after predict_bed_need). "
        "Call with encounter_id (e.g. E001) or row_index (0-based)."
    )
    args_schema: Type[BaseModel] = PredictLengthOfStayToolInput

    def _run(
        self,
        encounter_id: str | None = None,
        row_index: int | None = None,
        model_type: str = "fl",
    ) -> str:
        try:
            import pandas as pd
            from pathlib import Path
            inference = ModelInference()
            path = Path(inference.demo_patients_path).resolve()
            if not path.exists():
                raise FileNotFoundError(f"demo_patients.csv not found at {path}")
            df = pd.read_csv(path)
            if encounter_id is not None:
                row = df[df["encounter_id"].astype(str) == str(encounter_id)].iloc[0]
            else:
                row = df.iloc[row_index if row_index is not None else 0]
            features = inference.get_features_from_row(row, task=2)
            los_hours = inference.predict_task2(features, model_type=model_type)
            los_hours = round(los_hours)  # nearest hour
            out = {
                "length_of_stay_hours": int(los_hours),
                "length_of_stay_days": round(los_hours / 24.0, 2),
                "message": f"Predicted length of stay: {int(los_hours)} hours ({los_hours / 24.0:.2f} days).",
            }
            return json.dumps(out)
        except FileNotFoundError as e:
            return json.dumps({"error": str(e), "length_of_stay_hours": None})
        except Exception as e:
            return json.dumps({"error": str(e), "length_of_stay_hours": None})
