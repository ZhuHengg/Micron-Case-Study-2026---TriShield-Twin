import os
import joblib
import pandas as pd

from data_loader import load_data, split_data
from preprocessing import preprocess_features
from model import LightGBMModel
from evaluation import tune_threshold, evaluate_predictions

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
# Data path goes up 3 levels from backend/models/supervised
DATA_PATH   = os.path.join(BASE_DIR, '..', '..', '..', 'data', 'synthetic_backend_assembly.csv')

OUT_MODEL   = os.path.join(BASE_DIR, 'outputs', 'model')
OUT_PLOTS   = os.path.join(BASE_DIR, 'outputs', 'plots')
OUT_RESULTS = os.path.join(BASE_DIR, 'outputs', 'results')

for d in [OUT_MODEL, OUT_PLOTS, OUT_RESULTS]:
    os.makedirs(d, exist_ok=True)

def main():
    # 1. LOAD
    df = load_data(DATA_PATH)

    # 2. SPLIT
    df_train, df_val, df_test = split_data(df)

    # 3. PREPROCESS
    (X_train, X_val, X_test,
     y_train, y_val, y_test,
     scaler, all_features) = preprocess_features(df_train, df_val, df_test)

    # 4. TRAIN
    lgb_model = LightGBMModel()
    lgb_model.fit(X_train, y_train, X_val, y_val)

    # 5. TUNE THRESHOLD
    val_risk_scores = lgb_model.predict_scaled(X_val)
    best_threshold, _, _, _ = tune_threshold(y_val, val_risk_scores, OUT_PLOTS)
    lgb_model.set_threshold(best_threshold)

    # 6. EVALUATE ON TEST SET
    print("\n" + "="*50)
    print("FINAL EVALUATION ON UNSEEN TEST SET")
    print("="*50)
    y_pred_binary, risk_scores_test = lgb_model.predict_with_tier(X_test)
    y_pred_classes = lgb_model.predict_classes(X_test)

    evaluate_predictions(y_test, y_pred_classes, y_pred_binary, OUT_PLOTS)

    # 7. SAVE MODEL
    print("\nSaving model artifacts...")
    joblib.dump(scaler, os.path.join(OUT_MODEL, 'scaler.pkl'))
    joblib.dump(all_features, os.path.join(OUT_MODEL, 'features.pkl'))
    
    # Save the wrapper object (which contains the fitted LGBM model and thresholds)
    joblib.dump(lgb_model, os.path.join(OUT_MODEL, 'lgb_model.pkl'))
    print(f"Model saved to {OUT_MODEL}")

if __name__ == "__main__":
    main()
