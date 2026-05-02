"""
Supervised LightGBM Pipeline — Shield 1
Mirrors structure of FraudShieldAI supervised/train.py
All thresholds empirically derived from PR curve on validation set
No threshold values are hardcoded anywhere in this pipeline
"""
import os
import json
import joblib

from data_loader import load_data, split_data
from preprocessing import preprocess_features
from model import LightGBMModel
from evaluation import (
    evaluate_predictions,
    tune_threshold,
    plot_feature_importance
)

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
# Data path goes up 2 levels from backend/models/supervised to backend/
DATA_PATH   = os.path.join(BASE_DIR, '..', '..', 'data', 'synthetic_backend_assembly.csv')

OUT_MODEL   = os.path.join(BASE_DIR, 'outputs', 'model')
OUT_PLOTS   = os.path.join(BASE_DIR, 'outputs', 'plots')
OUT_RESULTS = os.path.join(BASE_DIR, 'outputs', 'results')

for d in [OUT_MODEL, OUT_PLOTS, OUT_RESULTS]:
    os.makedirs(d, exist_ok=True)

def main():

    # STEP 1: LOAD
    try:
        df = load_data(DATA_PATH)
    except FileNotFoundError as e:
        print(f"Error loading dataset: {e}")
        return

    # STEP 2: WALL — split before everything else
    df_train, df_val, df_test = split_data(df)

    # STEP 3: PREPROCESS
    (X_train, X_val, X_test,
     y_train, y_val, y_test,
     scaler, all_features) = preprocess_features(df_train, df_val, df_test)

    # STEP 4: TRAIN LIGHTGBM ON TRAIN ONLY
    lgb_model = LightGBMModel()
    lgb_model.fit(X_train, y_train, X_val, y_val)

    # STEP 5: EMPIRICAL THRESHOLD TUNING ON VALIDATION SET ONLY
    val_risk_scores = lgb_model.predict_scaled(X_val)
    best_threshold, best_precision, best_recall, best_f1 = (
        tune_threshold(y_val, val_risk_scores, OUT_PLOTS)
    )
    lgb_model.set_threshold(best_threshold)

    # STEP 6: PREDICT ON TEST SET ONLY
    print("\n" + "="*50)
    print("STEP 6: PREDICTION ON TEST SET")
    print("="*50)
    y_pred_binary, risk_scores_test = lgb_model.predict_with_tier(X_test)
    y_pred_classes = lgb_model.predict_classes(X_test)

    df_results = df_test[['unit_id', 'is_defective']].copy()
    df_results['lgb_risk_score'] = risk_scores_test
    df_results['lgb_prediction'] = y_pred_binary
    df_results['risk_tier']      = (
        df_results['lgb_risk_score'].apply(lgb_model.assign_tier)
    )

    tier_summary = df_results.groupby('risk_tier').agg(
        unit_count=('is_defective', 'count'),
        defect_count=('is_defective', 'sum'),
        defect_rate=('is_defective', 'mean')
    ).round(4)
    print("\n=== RISK TIER SUMMARY (TEST SET) ===")
    print(tier_summary)
    tier_summary.to_csv(
        os.path.join(OUT_RESULTS, 'risk_tier_summary.csv')
    )

    # STEP 7: EVALUATION ON TEST SET ONLY
    evaluate_predictions(
        y_test, y_pred_classes, y_pred_binary,
        df_results, all_features, OUT_PLOTS, OUT_RESULTS
    )

    # STEP 8: FEATURE IMPORTANCE
    importance = lgb_model.get_feature_importance(all_features)
    plot_feature_importance(importance, OUT_PLOTS)
    print("\nTop 5 most important features:")
    print(importance.head(5).to_string())

    # STEP 9: SAVE ALL OUTPUTS
    print("\n" + "="*60)
    print("STEP 9: SAVE OUTPUTS")
    print("="*60)

    lgb_model.save(
        os.path.join(OUT_MODEL, 'lgb_model.pkl'),
        os.path.join(OUT_MODEL, 'feature_columns.pkl')
    )
    joblib.dump(scaler, os.path.join(OUT_MODEL, 'scaler.pkl'))
    joblib.dump(
        all_features,
        os.path.join(OUT_MODEL, 'feature_columns.pkl')
    )

    # threshold_config.json stores empirically tuned values only
    threshold_config = {
        'optimal_threshold': float(best_threshold),
        'flag_threshold':    float(lgb_model.flag_threshold),
        'val_precision':     float(best_precision),
        'val_recall':        float(best_recall),
        'val_f1':            float(best_f1)
    }
    threshold_path = os.path.join(OUT_MODEL, 'threshold_config.json')
    with open(threshold_path, 'w') as f:
        json.dump(threshold_config, f, indent=2)
    print(f"Threshold config saved: {threshold_path}")
    print(f"  optimal_threshold: {best_threshold:.2f} "
          f"<- empirically derived from PR curve")
    print(f"  flag_threshold:    {lgb_model.flag_threshold:.2f} "
          f"<- derived from optimal")

    print("\nSupervised pipeline complete")
    print(f"All outputs saved under: {BASE_DIR}/outputs/")

if __name__ == "__main__":
    main()
