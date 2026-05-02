"""
Tri-Shield Ensemble Pipeline
Loads trained Shield 1 (LGB) and Shield 2 (IF) models,
computes Shield 3 (Physics Rules) on the fly,
tunes weights and threshold on validation set,
evaluates on held-out test set.

No model retraining. All weights and thresholds empirically derived.
"""
import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_PATH   = os.path.join(BASE_DIR, '..', '..', 'data', 'synthetic_backend_assembly.csv')
ISO_DIR     = os.path.join(BASE_DIR, '..', 'unsupervised', 'outputs', 'model')
LGB_DIR     = os.path.join(BASE_DIR, '..', 'supervised', 'outputs', 'model')
OUT_MODEL   = os.path.join(BASE_DIR, 'outputs', 'model')
OUT_PLOTS   = os.path.join(BASE_DIR, 'outputs', 'plots')
OUT_RESULTS = os.path.join(BASE_DIR, 'outputs', 'results')

for d in [OUT_MODEL, OUT_PLOTS, OUT_RESULTS]:
    os.makedirs(d, exist_ok=True)

from ensemble_model import EnsembleModel, FEATURE_COLS
from physics_rules import PhysicsRuleEngine
from score_fusion import ScoreFusion
from evaluation import evaluate_ensemble, plot_weight_heatmap


def main():
    # ================================================================
    # STEP 1: LOAD DATA
    # ================================================================
    print("=" * 60)
    print("STEP 1: LOAD DATA")
    print("=" * 60)
    if not os.path.exists(DATA_PATH):
        print(f"Error: Dataset not found at: {DATA_PATH}")
        return
    df = pd.read_csv(DATA_PATH)
    print(f"Shape: {df.shape}")
    print(f"Defect rate: {df['is_defective'].mean():.4f}")

    # ================================================================
    # STEP 2: IDENTICAL SPLIT AS BOTH TRAINED MODELS
    # ================================================================
    print("\n" + "=" * 60)
    print("STEP 2: RECREATE IDENTICAL SPLIT")
    print("=" * 60)
    # Must use same random_state=42 and stratify column as Shield 1 & 2
    df_train_full, df_test = train_test_split(
        df, test_size=0.20, random_state=42,
        stratify=df['bin_code']
    )
    df_train, df_val = train_test_split(
        df_train_full, test_size=0.20, random_state=42,
        stratify=df_train_full['bin_code']
    )
    # Must reset_index exactly as Shield 1 & 2 data_loaders do
    df_train = df_train.reset_index(drop=True)
    df_val   = df_val.reset_index(drop=True)
    df_test  = df_test.reset_index(drop=True)

    y_val  = df_val['is_defective'].values
    y_test = df_test['is_defective'].values

    print(f"Train: {len(df_train):,} | Defect rate: {df_train['is_defective'].mean():.4f}")
    print(f"Val:   {len(df_val):,}  | Defect rate: {y_val.mean():.4f}")
    print(f"Test:  {len(df_test):,} | Defect rate: {y_test.mean():.4f}")

    # ================================================================
    # STEP 3: LOAD ALL TRAINED MODELS
    # ================================================================
    print("\n" + "=" * 60)
    print("STEP 3: LOAD TRAINED MODEL ARTIFACTS")
    print("=" * 60)
    ensemble = EnsembleModel(
        iso_model_dir=ISO_DIR,
        lgb_model_dir=LGB_DIR
    )
    physics = PhysicsRuleEngine()

    # ================================================================
    # STEP 4: PREPARE FEATURES
    # ================================================================
    print("\n" + "=" * 60)
    print("STEP 4: PREPARE FEATURES")
    print("=" * 60)
    # Use canonical feature order (same as both preprocessing.py files)
    print(f"Feature count: {len(FEATURE_COLS)}")

    # Create DataFrames with column names to avoid sklearn warnings
    val_features = pd.DataFrame(df_val[FEATURE_COLS].values, columns=FEATURE_COLS)
    test_features = pd.DataFrame(df_test[FEATURE_COLS].values, columns=FEATURE_COLS)

    # Each model uses its own scaler (fitted during its own training)
    X_val_lgb = ensemble.lgb_scaler.transform(val_features)
    X_val_iso = ensemble.iso_scaler.transform(val_features)

    X_test_lgb = ensemble.lgb_scaler.transform(test_features)
    X_test_iso = ensemble.iso_scaler.transform(test_features)

    # ================================================================
    # STEP 5: SCORE VALIDATION SET (all 3 shields)
    # ================================================================
    print("\n" + "=" * 60)
    print("STEP 5: SCORE VALIDATION SET")
    print("=" * 60)

    lgb_val = ensemble.score_lgb(X_val_lgb)
    iso_val = ensemble.score_iso(X_val_iso)
    phy_val, _ = ensemble.score_physics(df_val, physics)

    print(f"LGB: mean={lgb_val.mean():.2f}  min={lgb_val.min():.2f}  max={lgb_val.max():.2f}")
    print(f"ISO: mean={iso_val.mean():.2f}  min={iso_val.min():.2f}  max={iso_val.max():.2f}")
    print(f"PHY: mean={phy_val.mean():.2f}  min={phy_val.min():.2f}  max={phy_val.max():.2f}")

    # ================================================================
    # STEP 6: TUNE WEIGHTS ON VALIDATION SET ONLY
    # ================================================================
    fusion = ScoreFusion()
    best_weights, best_weight_f1, weight_results = (
        fusion.tune_weights(y_val, lgb_val, iso_val, phy_val, step=0.10)
    )
    plot_weight_heatmap(weight_results, OUT_PLOTS)

    # ================================================================
    # STEP 7: TUNE THRESHOLD ON VALIDATION SET ONLY
    # ================================================================
    fused_val = fusion.fuse(lgb_val, iso_val, phy_val)
    best_threshold, val_precision, val_recall, val_f1 = (
        fusion.tune_threshold(y_val, fused_val, OUT_PLOTS)
    )

    # ================================================================
    # STEP 7b: SHIELD 3 VETO THRESHOLD (VALIDATION SET)
    # ================================================================
    fusion.tune_veto_threshold(y_val, phy_val, OUT_PLOTS)

    # ================================================================
    # STEP 8: SCORE TEST SET (NEVER SEEN BEFORE)
    # ================================================================
    print("\n" + "=" * 60)
    print("STEP 8: SCORE TEST SET")
    print("=" * 60)

    lgb_test = ensemble.score_lgb(X_test_lgb)
    iso_test = ensemble.score_iso(X_test_iso)
    phy_test, reasons = ensemble.score_physics(df_test, physics)
    fused_test = fusion.fuse(lgb_test, iso_test, phy_test)

    # Binary predictions (includes veto override)
    # A unit is flagged if: fused >= threshold OR physics >= veto_threshold
    y_pred_fused = (fused_test >= fusion.approve_threshold).astype(int)
    y_pred_veto = np.zeros_like(y_pred_fused)
    if fusion.veto_threshold is not None:
        y_pred_veto = (phy_test >= fusion.veto_threshold).astype(int)
    y_pred = np.maximum(y_pred_fused, y_pred_veto)

    n_veto_catches = (y_pred_veto & ~y_pred_fused.astype(bool)).sum()
    print(f"Units caught by weighted average: {y_pred_fused.sum():,}")
    print(f"Additional units caught by Shield 3 veto: {n_veto_catches:,}")
    print(f"Total flagged: {y_pred.sum():,}")

    # Build results dataframe
    df_results = df_test[['unit_id', 'is_defective', 'bin_code']].copy()
    df_results['lgb_risk_score']      = lgb_test
    df_results['iso_risk_score']      = iso_test
    df_results['phy_risk_score']      = phy_test
    df_results['ensemble_risk_score'] = fused_test
    df_results['ensemble_prediction'] = y_pred
    df_results['risk_tier']           = fusion.get_decisions(fused_test, phy_test)
    df_results['physics_reasons']     = reasons

    # Tier summary
    tier_summary = df_results.groupby('risk_tier').agg(
        unit_count=('is_defective', 'count'),
        defect_count=('is_defective', 'sum'),
        defect_rate=('is_defective', 'mean')
    ).round(4)
    print("\n=== RISK TIER SUMMARY (TEST SET) ===")
    print(tier_summary)
    tier_summary.to_csv(os.path.join(OUT_RESULTS, 'risk_tier_summary.csv'))

    # ================================================================
    # STEP 9: EVALUATE ON TEST SET
    # ================================================================
    print("\n" + "=" * 60)
    print("STEP 9: EVALUATE ON TEST SET")
    print("=" * 60)
    evaluate_ensemble(
        y_test, y_pred, df_results,
        fusion.approve_threshold,
        fusion.flag_threshold,
        OUT_PLOTS, OUT_RESULTS
    )

    # ================================================================
    # STEP 10: PER-BIN RECALL COMPARISON
    # ================================================================
    print("\n" + "=" * 60)
    print("STEP 10: PER-BIN RECALL COMPARISON")
    print("=" * 60)

    bin_names = {
        4: "Bin 4 (Fab Passthrough)",
        5: "Bin 5 (High-Temp Fail)",
        6: "Bin 6 (DC Leakage)",
        7: "Bin 7 (Open Circuit)",
        8: "Bin 8 (Short Circuit)"
    }
    # Read actual thresholds from saved configs (never hardcode)
    lgb_thresh = ensemble.lgb_config['optimal_threshold']
    iso_thresh = ensemble.iso_config['optimal_threshold']

    print(f"\n{'Bin':<30} {'S1 (LGB)':>10} {'S2 (IF)':>10} {'S3 (Phy)':>10} {'Ensemble':>10}")
    print("-" * 72)
    for b in [4, 5, 6, 7, 8]:
        subset = df_results[df_results['bin_code'] == b]
        total = len(subset)
        if total == 0:
            continue
        s1 = (subset['lgb_risk_score'] >= lgb_thresh).sum() / total
        s2 = (subset['iso_risk_score'] >= iso_thresh).sum() / total
        s3 = (subset['phy_risk_score'] >= 10).sum() / total
        ens = (subset['ensemble_prediction'] == 1).sum() / total
        print(f"{bin_names[b]:<30} {s1:>9.1%} {s2:>9.1%} {s3:>9.1%} {ens:>9.1%}")

    # ================================================================
    # STEP 11: SAVE ENSEMBLE CONFIG
    # ================================================================
    print("\n" + "=" * 60)
    print("STEP 11: SAVE ENSEMBLE CONFIG")
    print("=" * 60)
    fusion.save_config(
        path=os.path.join(OUT_MODEL, 'ensemble_config.json'),
        val_precision=val_precision,
        val_recall=val_recall,
        val_f1=val_f1
    )

    # Final summary
    print("\n" + "=" * 60)
    print("TRI-SHIELD ENSEMBLE PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Optimal weights (grid search on val set):")
    print(f"  Shield 1 (LightGBM):      {fusion.w_lgb:.2f}")
    print(f"  Shield 2 (IsoForest):      {fusion.w_iso:.2f}")
    print(f"  Shield 3 (Physics Rules):  {fusion.w_phy:.2f}")
    print(f"\nOptimal threshold: {fusion.approve_threshold:.2f} <- PR curve argmax F1 on val set")
    print(f"Flag threshold:    {fusion.flag_threshold:.2f} <- derived from optimal")
    print(f"\nAll outputs saved under: {BASE_DIR}/outputs/")


if __name__ == "__main__":
    main()
