"""
Task 2: Regression Training Script (LightGBM)
Trains models to predict Length of Stay (LoS) from medical codes.
Creates 3 models: client_1_model, client_2_model, and fl_model (federated learning).
"""

import pandas as pd
import numpy as np
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib
import os

# Configuration
RANDOM_STATE = 42
FL_ROUNDS = 10
MODEL_DIR = "saved_models"

# LightGBM parameters
LGBM_PARAMS = {
    'n_estimators': 100,
    'learning_rate': 0.1,
    'max_depth': 6,
    'num_leaves': 31,
    'min_child_samples': 20,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'random_state': RANDOM_STATE,
    'verbose': -1
}

# Create model directory if it doesn't exist
os.makedirs(MODEL_DIR, exist_ok=True)


class FederatedEnsemble:
    """Ensemble model that averages predictions from multiple models."""
    def __init__(self, models):
        self.models = models
    
    def predict(self, X):
        predictions = np.array([model.predict(X) for model in self.models])
        return np.mean(predictions, axis=0)


def load_data(filepath, clip_outliers=True, outlier_threshold=100):
    """Load and preprocess data with outlier handling."""
    df = pd.read_csv(filepath)
    
    # Separate features and target
    X = df.drop(columns=['encounter_id', 'LoS'])
    y = df['LoS'].copy()
    
    # Handle extreme outliers in LoS
    if clip_outliers:
        original_max = y.max()
        y = y.clip(upper=outlier_threshold)
        clipped_count = (df['LoS'] > outlier_threshold).sum()
        if clipped_count > 0:
            print(f"  Clipped {clipped_count} outliers (max was {original_max:.2f}, now {outlier_threshold})")
    
    # Handle categorical columns
    # For categorical features, we'll use label encoding
    for col in X.columns:
        if X[col].dtype == 'object':
            # Fill NaN first
            X[col] = X[col].fillna('missing')
            # Label encode
            X[col] = pd.Categorical(X[col]).codes
    
    # Fill remaining NaN values with 0
    X = X.fillna(0)
    
    # Convert to float
    X = X.astype(float)
    
    return X, y


def train_client_model(X_train, y_train, client_name):
    """Train a LightGBM model for a single client."""
    print(f"\n{'='*60}")
    print(f"Training {client_name} Model (LightGBM)")
    print(f"{'='*60}")
    
    model = LGBMRegressor(**LGBM_PARAMS)
    model.fit(X_train, y_train)
    
    # Evaluate on training data
    y_pred = model.predict(X_train)
    
    mse = mean_squared_error(y_train, y_pred)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_train, y_pred)
    r2 = r2_score(y_train, y_pred)
    
    print(f"Training RMSE: {rmse:.4f}")
    print(f"Training MAE: {mae:.4f}")
    print(f"Training R²: {r2:.4f}")
    
    return model


def federated_averaging_boosting(models, X_sample):
    """
    Federated Averaging for boosting models: Average predictions.
    For tree-based models, we create an ensemble that averages predictions.
    """
    return FederatedEnsemble(models)


def train_federated_model(client_datasets):
    """
    Train a federated learning model using model averaging.
    The FL model NEVER accesses raw data directly.
    """
    print(f"\n{'='*60}")
    print(f"Training Federated Learning Model (LightGBM)")
    print(f"{'='*60}")
    print(f"FL Rounds: {FL_ROUNDS}")
    
    # For tree-based models, we'll train models on each client
    # and aggregate by averaging predictions (ensemble approach)
    all_client_models = []
    
    for round_num in range(FL_ROUNDS):
        print(f"\nFL Round {round_num + 1}/{FL_ROUNDS}")
        
        round_models = []
        for i, (X_client, y_client) in enumerate(client_datasets):
            # Train local model with fewer trees per round
            local_model = LGBMRegressor(
                n_estimators=10,  # Fewer trees per round
                learning_rate=0.1,
                max_depth=6,
                num_leaves=31,
                min_child_samples=20,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=RANDOM_STATE + round_num,
                verbose=-1
            )
            
            local_model.fit(X_client, y_client)
            round_models.append(local_model)
            all_client_models.append(local_model)
            
            print(f"  Client {i+1} trained")
    
    # Create federated ensemble that averages all models
    X_sample, _ = client_datasets[0]
    fl_model = federated_averaging_boosting(all_client_models, X_sample)
    
    print(f"\nFederated Learning completed!")
    print(f"Created ensemble of {len(all_client_models)} models")
    
    return fl_model


def evaluate_on_test(model, X_test, y_test, model_name):
    """Evaluate model on test set."""
    y_pred = model.predict(X_test)
    
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"\n{model_name} - Test Set Performance:")
    print(f"  RMSE: {rmse:.4f}")
    print(f"  MAE: {mae:.4f}")
    print(f"  R²: {r2:.4f}")
    
    return rmse, mae, r2


def main():
    print("="*60)
    print("Task 2: Regression Training (LoS Prediction - LightGBM)")
    print("="*60)
    
    # Load client data (with outlier clipping at 100 - covers 97% of data)
    print("\nLoading client data...")
    X_client1, y_client1 = load_data('data/train_client_1_task_2.csv', clip_outliers=True, outlier_threshold=100)
    print(f"Client 1: {len(X_client1)} samples, {X_client1.shape[1]} features")
    X_client2, y_client2 = load_data('data/train_client_2_task_2.csv', clip_outliers=True, outlier_threshold=100)
    print(f"Client 2: {len(X_client2)} samples, {X_client2.shape[1]} features")
    
    # Load test data (without clipping to evaluate on real values)
    print("\nLoading test data...")
    X_test, y_test = load_data('data/test_task_2.csv', clip_outliers=False)
    print(f"Test set: {len(X_test)} samples")
    
    # Train individual client models
    model_client1 = train_client_model(X_client1, y_client1, "Client 1")
    model_client2 = train_client_model(X_client2, y_client2, "Client 2")
    
    # Train federated learning model
    client_datasets = [(X_client1, y_client1), (X_client2, y_client2)]
    model_fl = train_federated_model(client_datasets)
    
    # Evaluate all models on test set
    print("\n" + "="*60)
    print("Test Set Evaluation - Summary Metrics")
    print("="*60)
    
    evaluate_on_test(model_client1, X_test, y_test, "Client 1 Model")
    evaluate_on_test(model_client2, X_test, y_test, "Client 2 Model")
    evaluate_on_test(model_fl, X_test, y_test, "Federated Learning Model")
    
    # Detailed predictions for all test samples
    print("\n" + "="*60)
    print("Detailed Predictions on ALL Test Samples")
    print("="*60)
    
    # Load test data with encounter IDs
    df_test = pd.read_csv('data/test_task_2.csv')
    
    # Get predictions from all models
    pred_client1 = model_client1.predict(X_test)
    pred_client2 = model_client2.predict(X_test)
    pred_fl = model_fl.predict(X_test)
    
    # Create results dataframe
    results_df = pd.DataFrame({
        'Encounter_ID': df_test['encounter_id'].values,
        'Actual_LoS': y_test.values,
        'Client_1_Pred': pred_client1,
        'Client_2_Pred': pred_client2,
        'FL_Pred': pred_fl,
        'Client_1_Error': np.abs(pred_client1 - y_test.values),
        'Client_2_Error': np.abs(pred_client2 - y_test.values),
        'FL_Error': np.abs(pred_fl - y_test.values)
    })
    
    # Print header
    print(f"\n{'#':<4} {'Encounter_ID':<38} {'Actual':<8} {'Client1':<10} {'Client2':<10} {'FL':<10} {'C1_Err':<8} {'C2_Err':<8} {'FL_Err':<8}")
    print("-" * 120)
    
    # Print each row (show first 20 and last 10 if more than 30 samples)
    total_samples = len(results_df)
    if total_samples > 30:
        # Show first 20
        for idx, row in results_df.head(20).iterrows():
            print(f"{idx+1:<4} {row['Encounter_ID']:<38} {row['Actual_LoS']:<8.2f} "
                  f"{row['Client_1_Pred']:<10.2f} {row['Client_2_Pred']:<10.2f} {row['FL_Pred']:<10.2f} "
                  f"{row['Client_1_Error']:<8.2f} {row['Client_2_Error']:<8.2f} {row['FL_Error']:<8.2f}")
        
        print(f"{'...':<4} {'...':<38} {'...':<8} {'...':<10} {'...':<10} {'...':<10} {'...':<8} {'...':<8} {'...':<8}")
        
        # Show last 10
        for idx, row in results_df.tail(10).iterrows():
            print(f"{idx+1:<4} {row['Encounter_ID']:<38} {row['Actual_LoS']:<8.2f} "
                  f"{row['Client_1_Pred']:<10.2f} {row['Client_2_Pred']:<10.2f} {row['FL_Pred']:<10.2f} "
                  f"{row['Client_1_Error']:<8.2f} {row['Client_2_Error']:<8.2f} {row['FL_Error']:<8.2f}")
    else:
        # Show all
        for idx, row in results_df.iterrows():
            print(f"{idx+1:<4} {row['Encounter_ID']:<38} {row['Actual_LoS']:<8.2f} "
                  f"{row['Client_1_Pred']:<10.2f} {row['Client_2_Pred']:<10.2f} {row['FL_Pred']:<10.2f} "
                  f"{row['Client_1_Error']:<8.2f} {row['Client_2_Error']:<8.2f} {row['FL_Error']:<8.2f}")
    
    # Summary statistics
    print("\n" + "-" * 120)
    print(f"{'Mean Absolute Error:':<43} "
          f"{results_df['Client_1_Error'].mean():<10.2f} "
          f"{results_df['Client_2_Error'].mean():<10.2f} "
          f"{results_df['FL_Error'].mean():<10.2f}")
    print(f"{'Median Absolute Error:':<43} "
          f"{results_df['Client_1_Error'].median():<10.2f} "
          f"{results_df['Client_2_Error'].median():<10.2f} "
          f"{results_df['FL_Error'].median():<10.2f}")
    print(f"{'RMSE:':<43} "
          f"{np.sqrt((results_df['Client_1_Error']**2).mean()):<10.2f} "
          f"{np.sqrt((results_df['Client_2_Error']**2).mean()):<10.2f} "
          f"{np.sqrt((results_df['FL_Error']**2).mean()):<10.2f}")
    
    # Break down performance by LoS range
    print("\n" + "-" * 120)
    print("Performance by LoS Range:")
    
    # Typical range (LoS <= 50)
    typical = results_df[results_df['Actual_LoS'] <= 50]
    if len(typical) > 0:
        print(f"\n  Typical LoS (≤50, n={len(typical)}):")
        print(f"    MAE: C1={typical['Client_1_Error'].mean():.2f}, "
              f"C2={typical['Client_2_Error'].mean():.2f}, "
              f"FL={typical['FL_Error'].mean():.2f}")
    
    # High range (50 < LoS <= 100)
    high = results_df[(results_df['Actual_LoS'] > 50) & (results_df['Actual_LoS'] <= 100)]
    if len(high) > 0:
        print(f"\n  High LoS (50-100, n={len(high)}):")
        print(f"    MAE: C1={high['Client_1_Error'].mean():.2f}, "
              f"C2={high['Client_2_Error'].mean():.2f}, "
              f"FL={high['FL_Error'].mean():.2f}")
    
    # Extreme range (LoS > 100)
    extreme = results_df[results_df['Actual_LoS'] > 100]
    if len(extreme) > 0:
        print(f"\n  Extreme LoS (>100, n={len(extreme)}):")
        print(f"    MAE: C1={extreme['Client_1_Error'].mean():.2f}, "
              f"C2={extreme['Client_2_Error'].mean():.2f}, "
              f"FL={extreme['FL_Error'].mean():.2f}")
    
    # Save detailed results to CSV
    results_df.to_csv('task2_detailed_predictions.csv', index=False)
    print(f"\n✓ Detailed predictions saved to: task2_detailed_predictions.csv")
    
    # Save models
    print("\n" + "="*60)
    print("Saving Models")
    print("="*60)
    
    joblib.dump(model_client1, f'{MODEL_DIR}/task2_client1_model.pkl')
    print(f"✓ Saved: {MODEL_DIR}/task2_client1_model.pkl")
    
    joblib.dump(model_client2, f'{MODEL_DIR}/task2_client2_model.pkl')
    print(f"✓ Saved: {MODEL_DIR}/task2_client2_model.pkl")
    
    joblib.dump(model_fl, f'{MODEL_DIR}/task2_fl_model.pkl')
    print(f"✓ Saved: {MODEL_DIR}/task2_fl_model.pkl")
    
    print("\n" + "="*60)
    print("Task 2 Training Complete!")
    print("="*60)


if __name__ == "__main__":
    main()
