"""Tool: predict probability of patient needing a bed (Model Task 1)."""

import json
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from my_crew.model_inference import ModelInference

BED_PROBABILITY_THRESHOLD = 0.35  # Below this: do not need bed; move to next patient


class PredictBedNeedToolInput(BaseModel):
    """Input for PredictBedNeedTool. Use encounter_id or row_index to select patient from demo_patients.csv."""

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


class PredictBedNeedTool(BaseTool):
    """Predicts probability that the patient needs a bed (classification model). If < 35%, patient does not need a bed."""

    name: str = "predict_bed_need"
    description: str = (
        "Predict the probability that this patient needs a hospital bed. "
        "Uses the Task 1 classification model and patient data from demo_patients.csv. "
        "Call with encounter_id (e.g. E001) or row_index (0-based) to select the patient. "
        "If probability is less than 35%, the patient does not need a bed; if 35% or higher, they likely need a bed and you should call predict_length_of_stay next."
    )
    args_schema: Type[BaseModel] = PredictBedNeedToolInput

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
            features = inference.get_features_from_row(row, task=1)
            prob = inference.predict_task1(features, model_type=model_type)
            needs_bed = prob >= BED_PROBABILITY_THRESHOLD
            out = {
                "probability_needs_bed": round(prob, 4),
                "needs_bed": needs_bed,
                "threshold": BED_PROBABILITY_THRESHOLD,
                "message": "Patient does not need a bed; move to next patient." if not needs_bed else "Patient likely needs a bed; call predict_length_of_stay for this patient.",
            }
            return json.dumps(out)
        except FileNotFoundError as e:
            return json.dumps({"error": str(e), "probability_needs_bed": None, "needs_bed": None})
        except Exception as e:
            return json.dumps({"error": str(e), "probability_needs_bed": None, "needs_bed": None})
