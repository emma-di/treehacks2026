"""
Test Models 1 and 2 on Demo Patients Data
Tests both classification (Task 1) and regression (Task 2) models on demo_patients.csv
"""

import pandas as pd
import numpy as np
import os
import json
from model_inference import ModelInference


class FederatedEnsemble:
    """Ensemble model that averages predictions from multiple models.
    This class must be defined here for proper unpickling of saved FL models.
    """
    def __init__(self, models):
        self.models = models
    
    def predict(self, X):
        predictions = np.array([model.predict(X) for model in self.models])
        return np.mean(predictions, axis=0)


def test_demo_patients():
    """Test both models on demo patients data."""
    
    print("="*80)
    print("Testing Models on Demo Patients Data")
    print("="*80)
    
    # Initialize inference utility
    print("\n1. Loading models...")
    inference = ModelInference()
    
    # Load all models
    inference.load_all_models()
    print("   ✓ All models loaded successfully")
    
    # Load feature lists for each task
    print("\n2. Loading feature configurations...")
    with open('task1_features.json', 'r') as f:
        task1_features = json.load(f)
    with open('task2_features.json', 'r') as f:
        task2_features = json.load(f)
    print(f"   ✓ Task 1 uses {len(task1_features)} features")
    print(f"   ✓ Task 2 uses {len(task2_features)} features")
    
    # Load demo patients data
    print("\n3. Loading demo patients data...")
    data_path = 'data/demo_patients.csv'
    if not os.path.exists(data_path):
        data_path = 'models/data/demo_patients.csv'
    
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Could not find demo_patients.csv. Tried: {data_path}")
    
    df_demo = pd.read_csv(data_path)
    print(f"   ✓ Loaded {len(df_demo)} demo patients")
    print(f"   ✓ Total features in file: {len(df_demo.columns) - 1} (excluding encounter_id)")
    
    # Prepare results storage
    results = []
    
    print("\n4. Making predictions for each patient...")
    print("-" * 80)
    
    for idx, row in df_demo.iterrows():
        encounter_id = row['encounter_id']
        
        # Task 1: Binary Classification (Probability of label=1)
        # Filter to only Task 1 features
        try:
            features_task1 = row[task1_features].to_dict()
            prob_client1_task1 = inference.predict_task1(features_task1, 'client1')
            prob_client2_task1 = inference.predict_task1(features_task1, 'client2')
            prob_fl_task1 = inference.predict_task1(features_task1, 'fl')
            
            # Convert probability to binary prediction (threshold = 0.5)
            pred_client1_task1 = 1 if prob_client1_task1 >= 0.5 else 0
            pred_client2_task1 = 1 if prob_client2_task1 >= 0.5 else 0
            pred_fl_task1 = 1 if prob_fl_task1 >= 0.5 else 0
        except Exception as e:
            print(f"   ⚠ Error predicting Task 1 for {encounter_id}: {e}")
            prob_client1_task1 = prob_client2_task1 = prob_fl_task1 = np.nan
            pred_client1_task1 = pred_client2_task1 = pred_fl_task1 = np.nan
        
        # Task 2: Regression (Length of Stay)
        # Filter to only Task 2 features
        try:
            features_task2 = row[task2_features].to_dict()
            los_client1_task2 = inference.predict_task2(features_task2, 'client1')
            los_client2_task2 = inference.predict_task2(features_task2, 'client2')
            los_fl_task2 = inference.predict_task2(features_task2, 'fl')
        except Exception as e:
            print(f"   ⚠ Error predicting Task 2 for {encounter_id}: {e}")
            los_client1_task2 = los_client2_task2 = los_fl_task2 = np.nan
        
        # Store results
        results.append({
            'encounter_id': encounter_id,
            # Task 1 results
            'task1_client1_prob': prob_client1_task1,
            'task1_client1_pred': pred_client1_task1,
            'task1_client2_prob': prob_client2_task1,
            'task1_client2_pred': pred_client2_task1,
            'task1_fl_prob': prob_fl_task1,
            'task1_fl_pred': pred_fl_task1,
            # Task 2 results
            'task2_client1_los': los_client1_task2,
            'task2_client2_los': los_client2_task2,
            'task2_fl_los': los_fl_task2,
        })
        
        # Print progress for first few patients
        if idx < 3:
            print(f"\n   Patient {idx + 1}: {encounter_id}")
            print(f"     Task 1 (Classification):")
            print(f"       Client 1: P(label=1) = {prob_client1_task1:.4f} → Predicted: {pred_client1_task1}")
            print(f"       Client 2: P(label=1) = {prob_client2_task1:.4f} → Predicted: {pred_client2_task1}")
            print(f"       FL Model: P(label=1) = {prob_fl_task1:.4f} → Predicted: {pred_fl_task1}")
            print(f"     Task 2 (Regression - LoS):")
            print(f"       Client 1: {los_client1_task2:.2f} days")
            print(f"       Client 2: {los_client2_task2:.2f} days")
            print(f"       FL Model: {los_fl_task2:.2f} days")
    
    if len(df_demo) > 3:
        print(f"\n   ... (processed {len(df_demo)} patients total)")
    
    # Convert results to DataFrame
    results_df = pd.DataFrame(results)
    
    # Save results to CSV
    output_path = 'demo_patients_predictions.csv'
    results_df.to_csv(output_path, index=False)
    print(f"\n5. Results saved to: {output_path}")
    
    # Print summary statistics
    print("\n6. Summary Statistics")
    print("-" * 80)
    
    print("\n   Task 1 (Classification) - Probability Statistics:")
    print(f"     Client 1 - Mean: {results_df['task1_client1_prob'].mean():.4f}, "
          f"Std: {results_df['task1_client1_prob'].std():.4f}")
    print(f"     Client 2 - Mean: {results_df['task1_client2_prob'].mean():.4f}, "
          f"Std: {results_df['task1_client2_prob'].std():.4f}")
    print(f"     FL Model - Mean: {results_df['task1_fl_prob'].mean():.4f}, "
          f"Std: {results_df['task1_fl_prob'].std():.4f}")
    
    print("\n   Task 1 (Classification) - Binary Predictions:")
    print(f"     Client 1 - Label=1: {(results_df['task1_client1_pred'] == 1).sum()}, "
          f"Label=0: {(results_df['task1_client1_pred'] == 0).sum()}")
    print(f"     Client 2 - Label=1: {(results_df['task1_client2_pred'] == 1).sum()}, "
          f"Label=0: {(results_df['task1_client2_pred'] == 0).sum()}")
    print(f"     FL Model - Label=1: {(results_df['task1_fl_pred'] == 1).sum()}, "
          f"Label=0: {(results_df['task1_fl_pred'] == 0).sum()}")
    
    print("\n   Task 2 (Regression - LoS) - Statistics:")
    print(f"     Client 1 - Mean: {results_df['task2_client1_los'].mean():.2f} days, "
          f"Std: {results_df['task2_client1_los'].std():.2f} days")
    print(f"     Client 2 - Mean: {results_df['task2_client2_los'].mean():.2f} days, "
          f"Std: {results_df['task2_client2_los'].std():.2f} days")
    print(f"     FL Model - Mean: {results_df['task2_fl_los'].mean():.2f} days, "
          f"Std: {results_df['task2_fl_los'].std():.2f} days")
    
    print(f"\n   Task 2 (Regression - LoS) - Range:")
    print(f"     Client 1 - Min: {results_df['task2_client1_los'].min():.2f}, "
          f"Max: {results_df['task2_client1_los'].max():.2f} days")
    print(f"     Client 2 - Min: {results_df['task2_client2_los'].min():.2f}, "
          f"Max: {results_df['task2_client2_los'].max():.2f} days")
    print(f"     FL Model - Min: {results_df['task2_fl_los'].min():.2f}, "
          f"Max: {results_df['task2_fl_los'].max():.2f} days")
    
    # Model agreement analysis
    print("\n7. Model Agreement Analysis")
    print("-" * 80)
    
    # Task 1 agreement
    task1_agreement = (
        (results_df['task1_client1_pred'] == results_df['task1_client2_pred']) &
        (results_df['task1_client2_pred'] == results_df['task1_fl_pred'])
    ).sum()
    print(f"   Task 1 - All 3 models agree: {task1_agreement}/{len(results_df)} ({100*task1_agreement/len(results_df):.1f}%)")
    
    # Task 2 correlation
    corr_12 = results_df['task2_client1_los'].corr(results_df['task2_client2_los'])
    corr_1f = results_df['task2_client1_los'].corr(results_df['task2_fl_los'])
    corr_2f = results_df['task2_client2_los'].corr(results_df['task2_fl_los'])
    print(f"   Task 2 - Correlation between models:")
    print(f"     Client 1 ↔ Client 2: {corr_12:.4f}")
    print(f"     Client 1 ↔ FL Model: {corr_1f:.4f}")
    print(f"     Client 2 ↔ FL Model: {corr_2f:.4f}")
    
    print("\n" + "="*80)
    print("Testing Complete!")
    print("="*80)
    
    return results_df


if __name__ == "__main__":
    try:
        results = test_demo_patients()
        print(f"\n✓ Successfully tested {len(results)} demo patients")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
