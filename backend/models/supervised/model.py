import lightgbm as lgb
import numpy as np
import pandas as pd

class LightGBMModel:
    def __init__(self):
        self.model = lgb.LGBMClassifier(
            n_estimators=500,
            learning_rate=0.05,
            max_depth=8,
            num_leaves=127,
            class_weight='balanced',  # Handles multiclass imbalance natively without SMOTE
            objective='multiclass',
            num_class=8,
            random_state=42,
            n_jobs=-1
        )
        self.approve_threshold = None
        self.flag_threshold    = None

    def fit(self, X_train, y_train, X_val, y_val):
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            eval_metric='multi_logloss',
            callbacks=[
                lgb.early_stopping(stopping_rounds=50, verbose=True)
            ]
        )
        print(f"Training complete. Best iteration: {self.model.best_iteration_}")

    def predict_proba(self, X):
        """Returns full (N, 8) probability matrix"""
        return self.model.predict_proba(X)
        
    def predict_scaled(self, X):
        """
        Returns 0-100 risk score based on defect probability.
        Sellable Bins: 1 (index 0), 2 (index 1), 3 (index 2).
        Defect Bins: 4 through 8 (indexes 3-7).
        Risk Score = 1.0 - (P(Bin 1) + P(Bin 2) + P(Bin 3))
        """
        probs = self.predict_proba(X)
        sellable_prob = probs[:, 0] + probs[:, 1] + probs[:, 2]
        defect_prob = 1.0 - sellable_prob
        return defect_prob * 100

    def set_threshold(self, optimal_threshold: float):
        self.approve_threshold = optimal_threshold
        self.flag_threshold    = optimal_threshold + ((100 - optimal_threshold) * 0.5)
        print(f"Empirically tuned thresholds set:")
        print(f"  Approve → below {self.approve_threshold:.2f}")
        print(f"  Flag    → {self.approve_threshold:.2f} to {self.flag_threshold:.2f}")
        print(f"  Block   → above {self.flag_threshold:.2f}")

    def predict_with_tier(self, X):
        if self.approve_threshold is None:
            raise RuntimeError("Thresholds not set.")
        risk_scores = self.predict_scaled(X)
        predictions = (risk_scores >= self.approve_threshold).astype(int)
        return predictions, risk_scores

    def assign_tier(self, score: float) -> str:
        if self.approve_threshold is None:
            raise RuntimeError("Thresholds not set.")
        if score < self.approve_threshold:
            return 'Approve'
        elif score < self.flag_threshold:
            return 'Flag'
        else:
            return 'Block'

    def predict_classes(self, X):
        return self.model.predict(X)
