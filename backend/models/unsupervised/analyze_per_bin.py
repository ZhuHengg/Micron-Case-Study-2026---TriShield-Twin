"""
Per-Bin Recall Analysis for Isolation Forest (Shield 2)
Cross-references IF binary predictions with original bin_code
to identify which defect types the model catches vs misses.
"""
import pandas as pd
import os
import sys

# Add parent path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_loader import load_data, split_data
from preprocessing import preprocess_features
from model import IsolationForestModel
import joblib
import numpy as np

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "..", "..", "data", "synthetic_backend_assembly.csv")
MODEL_DIR = os.path.join(BASE_DIR, "outputs", "model")

def main():
    # 1. Recreate the exact same split (same random_state=42)
    df = load_data(DATA_PATH)
    df_train, df_val, df_test = split_data(df)

    # 2. Load saved model
    iso_model = IsolationForestModel()
    iso_model.model = joblib.load(os.path.join(MODEL_DIR, "isolation_forest_model.pkl"))
    iso_model.mm_scaler = joblib.load(os.path.join(MODEL_DIR, "minmax_scaler.pkl"))

    # Load threshold
    import json
    with open(os.path.join(MODEL_DIR, "threshold_config.json")) as f:
        config = json.load(f)
    iso_model.set_threshold(config['optimal_threshold'])

    # 3. Preprocess test set
    X_train, X_val, X_test, y_train, y_val, y_test, scaler, all_features = preprocess_features(df_train, df_val, df_test)

    # 4. Predict on test set
    y_pred, risk_scores = iso_model.predict(X_test)

    # 5. Build results with bin_code
    results = df_test[['unit_id', 'bin_code', 'is_defective']].copy()
    results['iso_prediction'] = y_pred
    results['iso_risk_score'] = risk_scores

    # 6. Per-bin analysis
    print("\n" + "=" * 70)
    print("PER-BIN RECALL ANALYSIS — ISOLATION FOREST (SHIELD 2)")
    print("=" * 70)

    bin_names = {
        1: "Bin 1 (Healthy - Grade A)",
        2: "Bin 2 (Healthy - Grade B)",
        3: "Bin 3 (Healthy - Grade C)",
        4: "Bin 4 (Fab Passthrough)",
        5: "Bin 5 (High-Temp Fail)",
        6: "Bin 6 (DC Leakage)",
        7: "Bin 7 (Open Circuit)",
        8: "Bin 8 (Short Circuit)",
    }

    print(f"\n{'Bin':<30} {'Total':>8} {'Caught':>8} {'Missed':>8} {'Recall':>10}")
    print("-" * 70)

    for bin_code in sorted(results['bin_code'].unique()):
        subset = results[results['bin_code'] == bin_code]
        total = len(subset)
        caught = subset['iso_prediction'].sum()
        missed = total - caught
        recall = caught / total if total > 0 else 0
        name = bin_names.get(bin_code, f"Bin {bin_code}")
        print(f"{name:<30} {total:>8,} {caught:>8,} {missed:>8,} {recall:>9.1%}")

    # 7. Defect bins only (4-8)
    print("\n" + "=" * 70)
    print("DEFECT BINS ONLY (BINS 4-8)")
    print("=" * 70)
    print(f"\n{'Bin':<30} {'Total':>8} {'Caught':>8} {'Missed':>8} {'Recall':>10} {'Avg Score':>10}")
    print("-" * 70)

    for bin_code in [4, 5, 6, 7, 8]:
        subset = results[results['bin_code'] == bin_code]
        total = len(subset)
        caught = subset['iso_prediction'].sum()
        missed = total - caught
        recall = caught / total if total > 0 else 0
        avg_score = subset['iso_risk_score'].mean()
        name = bin_names.get(bin_code, f"Bin {bin_code}")
        print(f"{name:<30} {total:>8,} {caught:>8,} {missed:>8,} {recall:>9.1%} {avg_score:>9.1f}")

    # 8. Compare with Shield 1 recall (from previous training)
    print("\n" + "=" * 70)
    print("SHIELD 1 vs SHIELD 2 — PER-BIN RECALL COMPARISON")
    print("=" * 70)

    shield1_recall = {4: 0.053, 5: 0.806, 6: 1.000, 7: 0.487, 8: 1.000}

    print(f"\n{'Bin':<30} {'Shield 1':>12} {'Shield 2':>12} {'Delta':>10} {'Winner':>10}")
    print("-" * 76)

    for bin_code in [4, 5, 6, 7, 8]:
        subset = results[results['bin_code'] == bin_code]
        s2_recall = subset['iso_prediction'].sum() / len(subset) if len(subset) > 0 else 0
        s1_recall = shield1_recall.get(bin_code, 0)
        delta = s2_recall - s1_recall
        winner = "Shield 2" if s2_recall > s1_recall else "Shield 1" if s1_recall > s2_recall else "Tie"
        name = bin_names.get(bin_code, f"Bin {bin_code}")
        print(f"{name:<30} {s1_recall:>11.1%} {s2_recall:>11.1%} {delta:>+9.1%} {winner:>10}")

    # 9. False positive analysis (healthy bins flagged)
    print("\n" + "=" * 70)
    print("FALSE POSITIVE ANALYSIS — HEALTHY BINS FLAGGED AS ANOMALOUS")
    print("=" * 70)
    print(f"\n{'Bin':<30} {'Total':>8} {'Flagged':>8} {'FP Rate':>10}")
    print("-" * 56)

    for bin_code in [1, 2, 3]:
        subset = results[results['bin_code'] == bin_code]
        total = len(subset)
        flagged = subset['iso_prediction'].sum()
        fp_rate = flagged / total if total > 0 else 0
        name = bin_names.get(bin_code, f"Bin {bin_code}")
        print(f"{name:<30} {total:>8,} {flagged:>8,} {fp_rate:>9.1%}")

if __name__ == "__main__":
    main()
