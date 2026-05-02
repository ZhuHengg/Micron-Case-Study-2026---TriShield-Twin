import os
import json
import joblib

from data_loader import load_data, split_data
from preprocessing import preprocess_features
from model import IsolationForestModel, generate_tier_summary
from evaluation import evaluate_predictions, analyze_bias, tune_threshold

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
# Data path goes up 2 levels to MicronCaseStudy/backend/data
DATA_PATH   = os.path.join(BASE_DIR, "..", "..", "data", "synthetic_backend_assembly.csv")
OUT_MODEL   = os.path.join(BASE_DIR, "outputs", "model")
OUT_PLOTS   = os.path.join(BASE_DIR, "outputs", "plots")
OUT_RESULTS = os.path.join(BASE_DIR, "outputs", "results")

for d in [OUT_MODEL, OUT_PLOTS, OUT_RESULTS]:
    os.makedirs(d, exist_ok=True)

def main():
    # STEP 1: LOAD
    try:
        df = load_data(DATA_PATH)
    except FileNotFoundError as e:
        print(f"Error loading dataset: {e}")
        return

    # STEP 2: SPLIT
    df_train, df_val, df_test = split_data(df)

    # STEP 3 & 4: PREPROCESS
    X_train, X_val, X_test, y_train, y_val, y_test, scaler, all_features = preprocess_features(df_train, df_val, df_test)

    # STEP 5: TRAIN ISOLATION FOREST
    # Compute contamination from TRAIN only (dynamic, not hardcoded)
    train_defect_rate = y_train.mean()
    contamination = min(train_defect_rate, 0.10)
    print(f"Train defect rate:    {train_defect_rate:.4f}")
    print(f"Contamination used:   {contamination:.4f}\n")

    iso_model = IsolationForestModel(
        contamination=contamination,
        n_estimators=200,
        max_samples=512,
        max_features=0.5,
    )
    iso_model.fit(X_train)

    # STEP 6: FIT MINMAXSCALER ON TRAIN RISK SCORES
    iso_model.fit_score_scaler(X_train)

    # STEP 7: THRESHOLD TUNING ON VALIDATION SET
    val_risk_scores = iso_model.get_risk_scores(X_val)
    best_threshold, best_precision, best_recall, best_f1 = tune_threshold(
        y_val,
        val_risk_scores,
        OUT_PLOTS
    )
    iso_model.set_threshold(best_threshold)

    # STEP 8: PREDICTION ON TEST SET
    y_pred_test, risk_scores_test = iso_model.predict(X_test)

    df_results_test = df_test[['unit_id', 'is_defective']].copy()
    df_results_test['iso_risk_score'] = risk_scores_test
    df_results_test['iso_prediction'] = y_pred_test
    df_results_test['risk_tier'] = df_results_test['iso_risk_score'].apply(iso_model.assign_tier)

    tier_summary = generate_tier_summary(df_results_test)
    print("\n=== RISK TIER SUMMARY (TEST SET) ===")
    print(tier_summary)

    # STEP 9: EVALUATION
    import pandas as pd
    df_model_test = pd.DataFrame(X_test, columns=all_features)
    evaluate_predictions(y_test, y_pred_test, df_results_test, df_model_test, all_features, OUT_PLOTS, OUT_RESULTS)

    # STEP 10: BIAS DETECTION
    analyze_bias(iso_model.model, X_test, all_features, OUT_PLOTS, OUT_RESULTS)

    # STEP 11: SAVE OUTPUTS
    print("\n" + "=" * 60)
    print("STEP 11: SAVE OUTPUTS")
    print("=" * 60)
    
    model_path = os.path.join(OUT_MODEL, "isolation_forest_model.pkl")
    mms_path = os.path.join(OUT_MODEL, "minmax_scaler.pkl")
    scaler_path = os.path.join(OUT_MODEL, "scaler.pkl")
    
    iso_model.save(model_path, mms_path)
    joblib.dump(scaler, scaler_path)
    
    threshold_config = {
        'optimal_threshold': float(best_threshold),
        'flag_threshold':    float(best_threshold + (100 - best_threshold) * 0.5),
        'val_precision':     float(best_precision),
        'val_recall':        float(best_recall),
        'val_f1':            float(best_f1)
    }
    threshold_path = os.path.join(OUT_MODEL, "threshold_config.json")
    with open(threshold_path, 'w') as f:
        json.dump(threshold_config, f, indent=2)

    tier_csv_path = os.path.join(OUT_RESULTS, "risk_tier_summary.csv")
    tier_summary.to_csv(tier_csv_path)

    print("\n[DONE] Pipeline complete — all outputs saved under outputs/")

if __name__ == "__main__":
    main()
