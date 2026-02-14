"""
Model Inference Utility for Risk Agent.
Loads trained models and runs predict_task1 (probability of needing a bed)
and predict_task2 (length of stay). Data is read from demo_patients.csv.
Optional task1_features.json / task2_features.json define which columns to pass
to each model (same approach as test_demo_patients.py: row[taskN_features].to_dict()).
"""

import json
import logging
import os
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Optional: joblib for loading .pkl models (add to pyproject.toml if missing)
try:
    import joblib
except ImportError:
    joblib = None


class FederatedEnsemble:
    """Ensemble model that averages predictions from multiple models.
    Must be defined here for proper unpickling of saved FL models.
    """

    def __init__(self, models):
        self.models = models

    def predict(self, X):
        predictions = np.array([model.predict(X) for model in self.models])
        return np.mean(predictions, axis=0)


class ModelInference:
    """Utility class for loading and using trained models. Uses demo_patients.csv for feature data.
    Task 2 preprocessing mirrors train_2.py load_data(): drop encounter_id & LoS, categorical fillna('missing'),
    label-encode, fillna(0), float. Optional task2_reference_csv uses that file's column order for features.
    """

    def __init__(self, model_dir=None, demo_patients_path=None, task2_reference_csv=None):
        if model_dir is None:
            for base in [Path(__file__).resolve().parent.parent.parent, Path.cwd(), Path("my_crew")]:
                for sub in ["saved_models", "models/saved_models"]:
                    d = base / sub
                    if d.exists():
                        model_dir = str(d)
                        break
                if model_dir:
                    break
            model_dir = model_dir or "saved_models"
        self.model_dir = model_dir
        self.models = {}
        if demo_patients_path is None:
            for base in [Path(__file__).resolve().parent.parent.parent, Path.cwd()]:
                for name in ["data/demo_patients.csv", "demo_patients.csv", "my_crew/data/demo_patients.csv"]:
                    p = base / name
                    if p.exists():
                        demo_patients_path = str(p)
                        break
                if demo_patients_path:
                    break
        self.demo_patients_path = demo_patients_path or "data/demo_patients.csv"
        self._task2_feature_columns = None  # list of feature column names in training order
        if task2_reference_csv and os.path.exists(task2_reference_csv):
            try:
                ref_df = pd.read_csv(task2_reference_csv, nrows=0)
                self._task2_feature_columns = [
                    c for c in ref_df.columns if c not in ("encounter_id", "LoS")
                ]
                logger.info(
                    "Task 2 reference CSV loaded: %s columns (order preserved)",
                    len(self._task2_feature_columns),
                )
            except Exception as e:
                logger.warning("Could not load task2 reference CSV %s: %s", task2_reference_csv, e)
        # Optional per-task feature lists (from task1_features.json / task2_features.json)
        self._task1_feature_columns = self._load_feature_json("task1_features.json")
        self._task2_feature_columns_from_json = self._load_feature_json("task2_features.json")
        if self._task2_feature_columns_from_json is not None:
            self._task2_feature_columns = self._task2_feature_columns_from_json

    @property
    def task1_feature_columns(self) -> list | None:
        """Feature list for Task 1 (from task1_features.json). Same as test_demo_patients.py."""
        return self._task1_feature_columns

    @property
    def task2_feature_columns(self) -> list | None:
        """Feature list for Task 2 (from task2_features.json). Same as test_demo_patients.py."""
        return self._task2_feature_columns

    def get_features_from_row(self, row: pd.Series, task: int) -> dict:
        """
        Build feature dict from a DataFrame row the same way as test_demo_patients.py:
          features_task1 = row[task1_features].to_dict()
          features_task2 = row[task2_features].to_dict()
        Uses task1_features.json / task2_features.json for column list; missing/NaN -> 0.
        """
        if task == 1 and self._task1_feature_columns is not None:
            return row.reindex(self._task1_feature_columns).fillna(0).to_dict()
        if task == 2 and self._task2_feature_columns is not None:
            return row.reindex(self._task2_feature_columns).fillna(0).to_dict()
        return row.to_dict()

    def _load_feature_json(self, filename: str) -> list | None:
        """Load a list of feature names from JSON (task1_features.json or task2_features.json)."""
        # Resolve to absolute paths so we find JSON when run from any cwd
        data_dir = Path(self.demo_patients_path).resolve().parent
        package_root = Path(__file__).resolve().parent.parent.parent
        for base in [
            data_dir,
            package_root,
            package_root / "my_crew" / "data",
            Path.cwd(),
            Path.cwd() / "data",
            Path.cwd() / "my_crew" / "data",
        ]:
            p = Path(base) / filename
            if not p.exists():
                continue
            try:
                with open(p, "r") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    logger.info("Loaded %s: %s features", filename, len(data))
                    return data
                if isinstance(data, dict) and "features" in data:
                    logger.info("Loaded %s: %s features", filename, len(data["features"]))
                    return data["features"]
            except Exception as e:
                logger.warning("Could not load %s from %s: %s", filename, str(p), e)
        logger.warning(
            "%s not found (tried %s, etc.). Feature count may not match model.",
            filename,
            str(data_dir / filename),
        )
        return None

    def load_model(self, task, model_type):
        """Load a specific model. task: 1 or 2; model_type: 'client1', 'client2', or 'fl'."""
        if joblib is None:
            logger.error("joblib is not installed; cannot load models")
            raise RuntimeError("joblib is required for model loading. Add joblib to dependencies.")
        import sys
        if "__main__" in sys.modules:
            sys.modules["__main__"].FederatedEnsemble = FederatedEnsemble
        model_path = os.path.join(self.model_dir, f"task{task}_{model_type}_model.pkl")
        logger.info("Loading model: task=%s model_type=%s path=%s", task, model_type, os.path.abspath(model_path))
        if not os.path.exists(model_path):
            logger.warning("Model file does not exist: %s", model_path)
        try:
            model = joblib.load(model_path)
            key = f"task{task}_{model_type}"
            self.models[key] = model
            logger.info("Model loaded successfully: %s", key)
            return model
        except Exception as e:
            err_msg = str(e)
            if "libomp" in err_msg.lower() or "lib_lightgbm" in err_msg:
                logger.error(
                    "LightGBM needs the OpenMP library (libomp). On macOS, run: brew install libomp"
                )
            logger.exception("Failed to load model %s: %s", model_path, e)
            raise

    def load_all_models(self):
        """Load all Task 1 and Task 2 models (client1, client2, fl). Used by test_demo_patients.py."""
        for task in (1, 2):
            for model_type in ("client1", "client2", "fl"):
                try:
                    self.load_model(task, model_type)
                except Exception:
                    pass

    def get_patient_features(self, encounter_id=None, row_index=None, task=None):
        """
        Get feature dict for one patient from demo_patients.csv.
        Pass either encounter_id (to match column encounter_id) or row_index (0-based).
        If task is 1 or 2 and task1_features.json / task2_features.json are loaded,
        returns only those columns in order (same as test_demo_patients.py: row[taskN_features].to_dict()).
        Missing columns in the row are filled with 0.
        """
        if not os.path.exists(self.demo_patients_path):
            raise FileNotFoundError(f"demo_patients.csv not found at {self.demo_patients_path}")
        df = pd.read_csv(self.demo_patients_path)
        if encounter_id is not None:
            if "encounter_id" not in df.columns:
                raise ValueError("demo_patients.csv must have an 'encounter_id' column when using encounter_id")
            row = df[df["encounter_id"].astype(str) == str(encounter_id)]
            if row.empty:
                raise ValueError(f"No row with encounter_id={encounter_id} in demo_patients.csv")
            row = row.iloc[0]
        elif row_index is not None:
            row = df.iloc[int(row_index)]
        else:
            row = df.iloc[0]
        feature_columns = None
        if task == 1 and self._task1_feature_columns is not None:
            feature_columns = self._task1_feature_columns
        elif task == 2 and self._task2_feature_columns is not None:
            feature_columns = self._task2_feature_columns
        if feature_columns is not None:
            out = {}
            for col in feature_columns:
                if col in row.index:
                    val = row[col]
                    out[col] = val if pd.notna(val) else 0
                else:
                    out[col] = 0
            return out
        return row.to_dict()

    def _preprocess_task2(self, data_dict):
        """
        Preprocess for Task 2 to match train_2.py load_data() exactly:
        drop encounter_id & LoS; categorical fillna('missing') then label-encode; fillna(0); float.
        If task2_reference_csv was set, build feature vector in that column order (0 for missing cols).
        """
        df = pd.DataFrame([data_dict])
        # Same drops as load_data: only encounter_id and LoS
        for drop in ("encounter_id", "LoS"):
            if drop in df.columns:
                df = df.drop(columns=[drop])
        # Optionally reorder to match training feature order
        if self._task2_feature_columns is not None:
            # Build one row with training column order; missing cols get 0
            row = {}
            for col in self._task2_feature_columns:
                if col in df.columns:
                    row[col] = df[col].iloc[0]
                else:
                    row[col] = 0
            df = pd.DataFrame([row])
        # Categorical handling: match train_2.py (fillna('missing'), then Categorical(...).codes).
        # Treat any non-numeric column as categorical (covers object, string, category from CSV).
        for col in list(df.columns):
            if not pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna("missing").astype(str)
                df[col] = pd.Categorical(df[col]).codes
        df = df.fillna(0)
        return df.astype(float).values.astype(np.float64)

    def preprocess_input(self, data_dict, task):
        """Preprocess input for inference. Task 2 uses train_2.py load_data() logic; Task 1 drops label and uses _missing_ for categoricals."""
        if task == 2:
            return self._preprocess_task2(data_dict)
        df = pd.DataFrame([data_dict])
        if "encounter_id" in df.columns:
            df = df.drop(columns=["encounter_id"])
        if "label" in df.columns:
            df = df.drop(columns=["label"])
        if "LoS" in df.columns:
            df = df.drop(columns=["LoS"])
        for col in list(df.columns):
            if not pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna("_missing_").astype(str)
                df[col] = pd.Categorical(df[col]).codes.astype(np.float64)
        df = df.apply(pd.to_numeric, errors="coerce")
        df = df.fillna(0)
        return df.values.astype(np.float64)

    @staticmethod
    def _expected_n_features(model):
        """Return the number of features the model expects. For ensembles, use max over sub-models so we align to the largest."""
        if hasattr(model, "models") and len(model.models) > 0:
            n = max(
                (ModelInference._expected_n_features(m) for m in model.models),
                default=None,
            )
            if n is not None:
                return n
        if hasattr(model, "n_features_in_") and model.n_features_in_ is not None:
            return int(model.n_features_in_)
        if hasattr(model, "coef_") and model.coef_ is not None:
            return int(model.coef_.shape[1])
        return None

    @staticmethod
    def _align_features(X: np.ndarray, expected: int) -> np.ndarray:
        """Align feature matrix to expected size: pad with zeros or truncate. X shape (n_samples, n_feat)."""
        if X.ndim != 2 or expected is None:
            return X
        _, n = X.shape
        if n == expected:
            return X
        if n < expected:
            pad = np.zeros((X.shape[0], expected - n), dtype=X.dtype)
            return np.hstack([X, pad])
        return X[:, :expected].copy()

    def predict_task1(self, features, model_type="fl"):
        """
        Predict probability of needing a bed (Task 1 classification).
        features: feature dict or preprocessed array; model_type: 'client1', 'client2', or 'fl'.
        Returns probability of positive class (needing bed).
        When model files are missing, returns 0.5 so the crew can complete (use fallback).
        """
        if joblib is None:
            logger.warning("predict_task1: joblib not installed, using fallback 0.5")
            return 0.5
        try:
            key = f"task1_{model_type}"
            if key not in self.models:
                self.load_model(1, model_type)
            model = self.models[key]
            if isinstance(features, dict):
                features = self.preprocess_input(features, task=1)
            expected = self._expected_n_features(model)
            if expected is not None and features.shape[1] != expected:
                n_orig = features.shape[1]
                features = self._align_features(features, expected)
                logger.debug("predict_task1: aligned features from %s to %s", n_orig, expected)
            elif expected is None and hasattr(model, "coef_"):
                expected = getattr(model.coef_, "shape", (None, None))[1]
                if expected is not None and features.shape[1] != expected:
                    features = self._align_features(features, int(expected))
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(features)[:, 1]
            else:
                proba = model.predict(features)
            prob = float(proba[0])
            logger.debug("predict_task1: model_type=%s -> prob=%.4f", model_type, prob)
            return prob
        except (FileNotFoundError, OSError, ValueError, TypeError) as e:
            logger.warning(
                "predict_task1 failed (%s): %s; using fallback 0.5",
                type(e).__name__, e, exc_info=True
            )
            return 0.5

    def predict_task2(self, features, model_type="fl"):
        """
        Predict Length of Stay (Task 2 regression).
        Returns length of stay in **hours** (model output is in hours).
        features: feature dict or preprocessed array; model_type: 'client1', 'client2', or 'fl'.
        When model files are missing, returns 72.0 hours (fallback).
        """
        if joblib is None:
            logger.warning("predict_task2: joblib not installed, using fallback 72h")
            return 72.0
        try:
            key = f"task2_{model_type}"
            if key not in self.models:
                self.load_model(2, model_type)
            model = self.models[key]
            if isinstance(features, dict):
                features = self.preprocess_input(features, task=2)
            expected = self._expected_n_features(model)
            if expected is not None and features.shape[1] != expected:
                n_in = features.shape[1]
                features = self._align_features(features, expected)
                logger.debug("predict_task2: aligned features from %s to %s", n_in, expected)
            prediction = model.predict(features)
            los_hours = float(prediction[0])
            # Cap to plausible range (6h to 14 days in hours)
            LOS_HOURS_MIN, LOS_HOURS_MAX = 6.0, 14.0 * 24.0
            if los_hours < LOS_HOURS_MIN or los_hours > LOS_HOURS_MAX:
                logger.debug(
                    "predict_task2: clamping los_hours %.1f to [%.1f, %.1f] (plausible range)",
                    los_hours, LOS_HOURS_MIN, LOS_HOURS_MAX,
                )
                los_hours = max(LOS_HOURS_MIN, min(LOS_HOURS_MAX, los_hours))
            los_hours = round(los_hours)  # nearest hour
            logger.debug("predict_task2: model_type=%s -> los_hours=%.0f", model_type, los_hours)
            return float(los_hours)
        except (FileNotFoundError, OSError, ValueError, TypeError) as e:
            err_msg = str(e)
            if "libomp" in err_msg.lower():
                logger.warning(
                    "Model 2 (LightGBM) failed: missing libomp. On macOS run: brew install libomp. Using fallback 72h."
                )
            else:
                logger.warning(
                    "predict_task2 failed (%s): %s; using fallback 72h",
                    type(e).__name__, e, exc_info=True
                )
            return 72.0
