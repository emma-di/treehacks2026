"""
Task 1: Binary Classification Training Script
Trains models to predict the probability of label=1 from medical codes.
Creates 3 models: client_1_model, client_2_model, and fl_model (federated learning).
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report
import joblib
import os

# Configuration
RANDOM_STATE = 42
FL_ROUNDS = 10
MODEL_DIR = "saved_models"

# Create model directory if it doesn't exist
os.makedirs(MODEL_DIR, exist_ok=True)


def load_data(filepath):
    """Load and preprocess data."""
    df = pd.read_csv(filepath)
    
    # Separate features and target
    X = df.drop(columns=['encounter_id', 'label'])
    y = df['label']
    
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
    """Train a model for a single client."""
    print(f"\n{'='*60}")
    print(f"Training {client_name} Model")
    print(f"{'='*60}")
    
    model = LogisticRegression(
        random_state=RANDOM_STATE,
        max_iter=1000,
        solver='lbfgs'
    )
    model.fit(X_train, y_train)
    
    # Evaluate on training data
    y_pred = model.predict(X_train)
    y_prob = model.predict_proba(X_train)[:, 1]
    
    accuracy = accuracy_score(y_train, y_pred)
    auc = roc_auc_score(y_train, y_prob)
    
    print(f"Training Accuracy: {accuracy:.4f}")
    print(f"Training AUC-ROC: {auc:.4f}")
    
    return model


def federated_averaging(models):
    """
    Federated Averaging: Average model parameters across clients.
    This simulates the FL server aggregating updates without accessing raw data.
    """
    # Extract coefficients and intercepts
    coef_list = [model.coef_ for model in models]
    intercept_list = [model.intercept_ for model in models]
    
    # Average parameters
    avg_coef = np.mean(coef_list, axis=0)
    avg_intercept = np.mean(intercept_list, axis=0)
    
    return avg_coef, avg_intercept


def train_federated_model(client_datasets):
    """
    Train a federated learning model using federated averaging.
    The FL model NEVER accesses raw data directly.
    """
    print(f"\n{'='*60}")
    print(f"Training Federated Learning Model")
    print(f"{'='*60}")
    print(f"FL Rounds: {FL_ROUNDS}")
    
    # Initialize global model
    global_model = LogisticRegression(
        random_state=RANDOM_STATE,
        max_iter=1000,
        solver='lbfgs'
    )
    
    # Get feature dimension from first client
    X_sample, _ = client_datasets[0]
    n_features = X_sample.shape[1]
    
    # Initialize with zeros
    global_model.coef_ = np.zeros((1, n_features))
    global_model.intercept_ = np.zeros(1)
    global_model.classes_ = np.array([0, 1])
    
    # Federated learning rounds
    for round_num in range(FL_ROUNDS):
        print(f"\nFL Round {round_num + 1}/{FL_ROUNDS}")
        
        # Train local models on each client
        local_models = []
        for i, (X_client, y_client) in enumerate(client_datasets):
            # Initialize local model with global parameters
            local_model = LogisticRegression(
                random_state=RANDOM_STATE,
                max_iter=100,
                warm_start=True,
                solver='lbfgs'
            )
            local_model.coef_ = global_model.coef_.copy()
            local_model.intercept_ = global_model.intercept_.copy()
            local_model.classes_ = global_model.classes_
            
            # Train on local data
            local_model.fit(X_client, y_client)
            local_models.append(local_model)
            
            print(f"  Client {i+1} trained")
        
        # Federated averaging (server aggregation)
        avg_coef, avg_intercept = federated_averaging(local_models)
        
        # Update global model
        global_model.coef_ = avg_coef
        global_model.intercept_ = avg_intercept
    
    print("\nFederated Learning completed!")
    return global_model


def evaluate_on_test(model, X_test, y_test, model_name):
    """Evaluate model on test set."""
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    
    print(f"\n{model_name} - Test Set Performance:")
    print(f"  Accuracy: {accuracy:.4f}")
    print(f"  AUC-ROC: {auc:.4f}")
    
    return accuracy, auc


def main():
    print("="*60)
    print("Task 1: Binary Classification Training")
    print("="*60)
    
    # Load client data
    print("\nLoading client data...")
    X_client1, y_client1 = load_data('data/train_client_1_task_1.csv')
    X_client2, y_client2 = load_data('data/train_client_2_task_1.csv')
    print(f"Client 1: {len(X_client1)} samples, {X_client1.shape[1]} features")
    print(f"Client 2: {len(X_client2)} samples, {X_client2.shape[1]} features")
    
    # Load test data
    print("\nLoading test data...")
    X_test, y_test = load_data('data/test_task_1.csv')
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
    df_test = pd.read_csv('data/test_task_1.csv')
    
    # Get predictions from all models
    pred_client1 = model_client1.predict_proba(X_test)[:, 1]
    pred_client2 = model_client2.predict_proba(X_test)[:, 1]
    pred_fl = model_fl.predict_proba(X_test)[:, 1]
    
    # Create results dataframe
    results_df = pd.DataFrame({
        'Encounter_ID': df_test['encounter_id'].values,
        'Actual': y_test.values,
        'Client_1_Prob': pred_client1,
        'Client_2_Prob': pred_client2,
        'FL_Prob': pred_fl,
        'Client_1_Pred': (pred_client1 >= 0.5).astype(int),
        'Client_2_Pred': (pred_client2 >= 0.5).astype(int),
        'FL_Pred': (pred_fl >= 0.5).astype(int)
    })
    
    # Print header
    print(f"\n{'#':<4} {'Encounter_ID':<38} {'Actual':<7} {'Client1':<8} {'Client2':<8} {'FL':<8} {'C1✓':<4} {'C2✓':<4} {'FL✓':<4}")
    print("-" * 100)
    
    # Print each row
    for idx, row in results_df.iterrows():
        c1_correct = '✓' if row['Client_1_Pred'] == row['Actual'] else '✗'
        c2_correct = '✓' if row['Client_2_Pred'] == row['Actual'] else '✗'
        fl_correct = '✓' if row['FL_Pred'] == row['Actual'] else '✗'
        
        print(f"{idx+1:<4} {row['Encounter_ID']:<38} {row['Actual']:<7} "
              f"{row['Client_1_Prob']:<8.4f} {row['Client_2_Prob']:<8.4f} {row['FL_Prob']:<8.4f} "
              f"{c1_correct:<4} {c2_correct:<4} {fl_correct:<4}")
    
    # Summary statistics
    print("\n" + "-" * 100)
    print(f"{'Total Correct:':<43} "
          f"{(results_df['Client_1_Pred'] == results_df['Actual']).sum():<8} "
          f"{(results_df['Client_2_Pred'] == results_df['Actual']).sum():<8} "
          f"{(results_df['FL_Pred'] == results_df['Actual']).sum():<8}")
    print(f"{'Accuracy:':<43} "
          f"{(results_df['Client_1_Pred'] == results_df['Actual']).mean():<8.4f} "
          f"{(results_df['Client_2_Pred'] == results_df['Actual']).mean():<8.4f} "
          f"{(results_df['FL_Pred'] == results_df['Actual']).mean():<8.4f}")
    
    # Save detailed results to CSV
    results_df.to_csv('task1_detailed_predictions.csv', index=False)
    print(f"\n✓ Detailed predictions saved to: task1_detailed_predictions.csv")
    
    # Save models
    print("\n" + "="*60)
    print("Saving Models")
    print("="*60)
    
    joblib.dump(model_client1, f'{MODEL_DIR}/task1_client1_model.pkl')
    print(f"✓ Saved: {MODEL_DIR}/task1_client1_model.pkl")
    
    joblib.dump(model_client2, f'{MODEL_DIR}/task1_client2_model.pkl')
    print(f"✓ Saved: {MODEL_DIR}/task1_client2_model.pkl")
    
    joblib.dump(model_fl, f'{MODEL_DIR}/task1_fl_model.pkl')
    print(f"✓ Saved: {MODEL_DIR}/task1_fl_model.pkl")
    
    print("\n" + "="*60)
    print("Task 1 Training Complete!")
    print("="*60)


if __name__ == "__main__":
    main()
