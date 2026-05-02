"""
Loads all three trained models and runs inference.
Does not retrain anything — models are already trained.
Handles feature preparation for each model.

Key difference from FraudShieldAI:
Both LGB and IF use the same 34 features in Micron,
so feature prep is unified through a single scaler.
"""
import numpy as np
import pandas as pd
import joblib
import json
import os

# Canonical feature order (must match both preprocessing.py files)
FEATURE_COLS = [
    'bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity', 'pick_place_speed',
    'ultrasonic_power', 'bond_time', 'loop_height', 'capillary_stroke_count', 'efo_voltage',
    'transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level',
    'ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density',
    'spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow',
    'rrs_1', 'rrs_2', 'rrs_3', 'rrs_4', 'rrs_5',
    'rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3', 'rrs_delta_4', 'rrs_delta_5',
    'machine_risk_score', 'resin_batch_risk_score'
]

class EnsembleModel:
    def __init__(self, iso_model_dir: str, lgb_model_dir: str):
        """
        Loads all trained artifacts from their directories.
        iso_model_dir: path to unsupervised/outputs/model/
        lgb_model_dir: path to supervised/outputs/model/
        """
        # Load Isolation Forest artifacts
        self.iso_model = joblib.load(
            os.path.join(iso_model_dir, 'isolation_forest_model.pkl')
        )
        self.iso_scaler = joblib.load(
            os.path.join(iso_model_dir, 'scaler.pkl')
        )
        self.iso_mms = joblib.load(
            os.path.join(iso_model_dir, 'minmax_scaler.pkl')
        )
        with open(os.path.join(iso_model_dir, 'threshold_config.json')) as f:
            self.iso_config = json.load(f)

        # Load LightGBM artifacts
        self.lgb_model = joblib.load(
            os.path.join(lgb_model_dir, 'lgb_model.pkl')
        )
        self.lgb_scaler = joblib.load(
            os.path.join(lgb_model_dir, 'scaler.pkl')
        )
        self.lgb_features = joblib.load(
            os.path.join(lgb_model_dir, 'feature_columns.pkl')
        )
        with open(os.path.join(lgb_model_dir, 'threshold_config.json')) as f:
            self.lgb_config = json.load(f)

        print("All model artifacts loaded successfully")
        print(f"IsoForest threshold: "
              f"{self.iso_config['optimal_threshold']:.2f}")
        print(f"LightGBM threshold:  "
              f"{self.lgb_config['optimal_threshold']:.2f}")

    def score_lgb(self, X: np.ndarray) -> np.ndarray:
        """
        Returns LightGBM risk scores on 0-100 scale.
        Risk = 1 - P(Sellable) = P(Defect)
        """
        # lgb_model.pkl saves the raw LGBMClassifier (not the wrapper)
        if hasattr(self.lgb_model, 'model'):
            probs = self.lgb_model.model.predict_proba(X)
        else:
            probs = self.lgb_model.predict_proba(X)

        # Sellable = Bin 1 (idx 0) + Bin 2 (idx 1) + Bin 3 (idx 2)
        sellable_prob = probs[:, 0] + probs[:, 1] + probs[:, 2]
        return (1.0 - sellable_prob) * 100

    def score_iso(self, X: np.ndarray) -> np.ndarray:
        """
        Returns Isolation Forest risk scores on 0-100 scale.
        The MinMaxScaler was fitted with feature_range=(0, 100),
        so it already outputs 0-100 scale. Do NOT multiply by 100 again.
        """
        raw_scores = -self.iso_model.decision_function(X)
        risk_scores = self.iso_mms.transform(
            raw_scores.reshape(-1, 1)
        ).flatten()
        # Clip to [0, 100] as safety net for unseen-range test scores
        return np.clip(risk_scores, 0, 100)

    def score_physics(self, df: pd.DataFrame, engine) -> tuple:
        """
        Returns physics rule scores on 0-100 scale and reasons.
        Multiplies engine output (0-1) by 100.
        """
        scores_raw, reasons = engine.predict(df)
        return np.array(scores_raw) * 100, reasons

