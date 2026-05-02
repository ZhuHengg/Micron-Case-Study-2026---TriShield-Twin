import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler
import joblib
import time

class IsolationForestModel:
    def __init__(self, contamination: float = 0.08, n_estimators: int = 200,
                 max_samples: int = 512, max_features: float = 0.5,
                 random_state: int = 42):
        self.model = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            max_samples=max_samples,
            max_features=max_features,
            random_state=random_state,
            n_jobs=-1,
        )
        self.mm_scaler = MinMaxScaler(feature_range=(0, 100))
        self.approve_threshold = None
        self.flag_threshold    = None

    def fit(self, X_train: np.ndarray):
        print("=" * 60)
        print("STEP 5: TRAIN ISOLATION FOREST")
        print("=" * 60)

        start = time.time()
        self.model.fit(X_train)
        print(f"Training complete in {time.time()-start:.1f}s\n")

    def fit_score_scaler(self, X_train: np.ndarray):
        raw_scores_train = -self.model.decision_function(X_train)
        self.mm_scaler.fit(raw_scores_train.reshape(-1, 1))
        print("MinMaxScaler fitted on train scores.")

    def get_risk_scores(self, X: np.ndarray) -> np.ndarray:
        raw_scores = -self.model.decision_function(X)
        return self.mm_scaler.transform(
            raw_scores.reshape(-1, 1)
        ).flatten()

    def set_threshold(self, optimal_threshold: float):
        self.approve_threshold = optimal_threshold
        self.flag_threshold    = optimal_threshold + (
            (100 - optimal_threshold) * 0.5
        )
        print(f"Thresholds set from validation tuning:")
        print(f"  Approve -> below {self.approve_threshold:.2f}")
        print(f"  Flag    -> {self.approve_threshold:.2f} to {self.flag_threshold:.2f}")
        print(f"  Block   -> above {self.flag_threshold:.2f}")

    def predict(self, X: np.ndarray):
        if self.approve_threshold is None or self.flag_threshold is None:
            raise RuntimeError(
                "Thresholds not set. Call set_threshold() "
                "after tune_threshold() before calling predict()."
            )

        risk_scores = self.get_risk_scores(X)
        iso_predictions = (risk_scores >= self.approve_threshold).astype(int)
        return iso_predictions, risk_scores

    def assign_tier(self, score: float) -> str:
        if self.approve_threshold is None:
            raise RuntimeError("Thresholds not set.")
        if score < self.approve_threshold:
            return "Approve"
        elif score < self.flag_threshold:
            return "Flag"
        else:
            return "Block"

    def save(self, model_path: str, mms_path: str):
        joblib.dump(self.model, model_path)
        joblib.dump(self.mm_scaler, mms_path)
        print(f"Model saved to:         {model_path}")
        print(f"MinMaxScaler saved to:  {mms_path}")

def generate_tier_summary(df_results: pd.DataFrame) -> pd.DataFrame:
    tier_summary = df_results.groupby('risk_tier').agg(
        unit_count = ('is_defective', 'count'),
        defect_count = ('is_defective', 'sum'),
        defect_rate = ('is_defective', 'mean')
    ).round(4)
    return tier_summary
