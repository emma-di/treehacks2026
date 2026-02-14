"""
Model Inference Utility
Demonstrates how to load and use the trained models for predictions.
This can be called from frontend or other applications.
"""

import pandas as pd
import joblib
import numpy as np
import os


class FederatedEnsemble:
    """Ensemble model that averages predictions from multiple models.
    This class must be defined here for proper unpickling of saved FL models.
    """
    def __init__(self, models):
        self.models = models
    
    def predict(self, X):
        predictions = np.array([model.predict(X) for model in self.models])
        return np.mean(predictions, axis=0)


class ModelInference:
    """Utility class for loading and using trained models."""
    
    def __init__(self, model_dir=None):
        if model_dir is None:
            # Try to find the models directory
            if os.path.exists('saved_models'):
                model_dir = 'saved_models'
            elif os.path.exists('models/saved_models'):
                model_dir = 'models/saved_models'
            else:
                model_dir = 'saved_models'  # Default
        self.model_dir = model_dir
        self.models = {}
    
    def load_model(self, task, model_type):
        """
        Load a specific model.
        
        Args:
            task: 1 or 2 (classification or regression)
            model_type: 'client1', 'client2', or 'fl'
        
        Returns:
            Loaded model object
        """
        model_path = f"{self.model_dir}/task{task}_{model_type}_model.pkl"
        model = joblib.load(model_path)
        
        # Cache the model
        key = f"task{task}_{model_type}"
        self.models[key] = model
        
        return model
    
    def load_all_models(self):
        """Load all 6 models."""
        print("Loading all models...")
        for task in [1, 2]:
            for model_type in ['client1', 'client2', 'fl']:
                self.load_model(task, model_type)
                print(f"  ✓ Loaded task{task}_{model_type}_model")
        print("All models loaded!")
    
    def preprocess_input(self, data_dict, task):
        """
        Preprocess input data to match training format.
        
        Args:
            data_dict: Dictionary of feature values
            task: 1 or 2
        
        Returns:
            Preprocessed feature array
        """
        # Convert to DataFrame
        df = pd.DataFrame([data_dict])
        
        # Remove ID columns
        if 'encounter_id' in df.columns:
            df = df.drop(columns=['encounter_id'])
        
        # Handle categorical columns
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].fillna('missing')
                df[col] = pd.Categorical(df[col]).codes
        
        # Fill NaN with 0
        df = df.fillna(0)
        
        return df.values
    
    def predict_task1(self, features, model_type='fl'):
        """
        Predict probability of label=1 for Task 1 (Classification).
        
        Args:
            features: Feature dictionary or preprocessed array
            model_type: 'client1', 'client2', or 'fl'
        
        Returns:
            Probability of positive class
        """
        # Load model if not cached
        key = f"task1_{model_type}"
        if key not in self.models:
            self.load_model(1, model_type)
        
        model = self.models[key]
        
        # Preprocess if needed
        if isinstance(features, dict):
            features = self.preprocess_input(features, task=1)
        
        # Predict probability
        proba = model.predict_proba(features)[:, 1]
        
        return proba[0]
    
    def predict_task2(self, features, model_type='fl'):
        """
        Predict Length of Stay (LoS) for Task 2 (Regression).
        
        Args:
            features: Feature dictionary or preprocessed array
            model_type: 'client1', 'client2', or 'fl'
        
        Returns:
            Predicted LoS value
        """
        # Load model if not cached
        key = f"task2_{model_type}"
        if key not in self.models:
            self.load_model(2, model_type)
        
        model = self.models[key]
        
        # Preprocess if needed
        if isinstance(features, dict):
            features = self.preprocess_input(features, task=2)
        
        # Predict
        prediction = model.predict(features)
        
        return prediction[0]


def example_usage():
    """Example demonstrating how to use the inference utility."""
    print("="*60)
    print("Model Inference Example")
    print("="*60)
    
    # Initialize inference utility
    inference = ModelInference()
    
    # Load all models
    inference.load_all_models()
    
    print("\n" + "="*60)
    print("Example Predictions")
    print("="*60)
    
    # Example 1: Load test data and make predictions
    print("\nTask 1 (Classification) - Predicting from test data:")
    # Try both possible paths
    if os.path.exists('data/test_task_1.csv'):
        df_test1 = pd.read_csv('data/test_task_1.csv')
    else:
        df_test1 = pd.read_csv('models/data/test_task_1.csv')
    
    # Get first sample
    sample = df_test1.iloc[0].to_dict()
    actual_label = sample.pop('label')
    encounter_id = sample.pop('encounter_id')
    
    # Predict with all three models
    prob_client1 = inference.predict_task1(sample, 'client1')
    prob_client2 = inference.predict_task1(sample, 'client2')
    prob_fl = inference.predict_task1(sample, 'fl')
    
    print(f"  Encounter ID: {encounter_id}")
    print(f"  Actual Label: {actual_label}")
    print(f"  Client 1 Prediction: {prob_client1:.4f}")
    print(f"  Client 2 Prediction: {prob_client2:.4f}")
    print(f"  FL Model Prediction: {prob_fl:.4f}")
    
    print("\nTask 2 (Regression) - Predicting LoS from test data:")
    if os.path.exists('data/test_task_2.csv'):
        df_test2 = pd.read_csv('data/test_task_2.csv')
    else:
        df_test2 = pd.read_csv('models/data/test_task_2.csv')
    
    # Get first sample
    sample = df_test2.iloc[0].to_dict()
    actual_los = sample.pop('LoS')
    encounter_id = sample.pop('encounter_id')
    
    # Predict with all three models
    los_client1 = inference.predict_task2(sample, 'client1')
    los_client2 = inference.predict_task2(sample, 'client2')
    los_fl = inference.predict_task2(sample, 'fl')
    
    print(f"  Encounter ID: {encounter_id}")
    print(f"  Actual LoS: {actual_los:.2f}")
    print(f"  Client 1 Prediction: {los_client1:.2f}")
    print(f"  Client 2 Prediction: {los_client2:.2f}")
    print(f"  FL Model Prediction: {los_fl:.2f}")
    
    print("\n" + "="*60)
    print("Inference Example Complete!")
    print("="*60)


if __name__ == "__main__":
    example_usage()
