"""
Tri-Shield Ensemble — Runtime Inference Engine
================================================
Loads all trained artifacts and scores units in real-time.
Mirrors FraudShieldAI's api/inference.py with fallback modes.

Engine Modes:
  full            → All 3 shields active (LGB + IF + Physics + Veto)
  degraded_iso    → IF failed, re-normalize LGB + Physics
  degraded_lgb    → LGB failed, re-normalize IF + Physics
  physics_only    → Both ML models failed, physics rules only
  static_rules    → ALL models failed, ultra-lightweight hardcoded rules

SHAP explainer initialized for /explain endpoint.
"""
import numpy as np
import pandas as pd
import joblib
import json
import os
import logging
import time

logger = logging.getLogger(__name__)

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


class EnsembleEngine:
    """
    Production runtime engine for the Tri-Shield Ensemble.
    Loads all model artifacts once at startup, then scores individual
    units with sub-millisecond latency.
    """

    def __init__(self,
                 iso_model_dir: str = 'models/unsupervised/outputs/model',
                 lgb_model_dir: str = 'models/supervised/outputs/model',
                 ensemble_dir: str = 'models/ensemble/outputs/model'):
        """Loads all trained artifacts, scalers, and ensemble config."""

        # Load Isolation Forest artifacts
        self.iso_model  = joblib.load(os.path.join(iso_model_dir, 'isolation_forest_model.pkl'))
        self.iso_scaler = joblib.load(os.path.join(iso_model_dir, 'scaler.pkl'))
        self.iso_mms    = joblib.load(os.path.join(iso_model_dir, 'minmax_scaler.pkl'))

        # Load LightGBM artifacts
        self.lgb_model  = joblib.load(os.path.join(lgb_model_dir, 'lgb_model.pkl'))
        self.lgb_scaler = joblib.load(os.path.join(lgb_model_dir, 'scaler.pkl'))

        # Load Ensemble Fusion config
        with open(os.path.join(ensemble_dir, 'ensemble_config.json')) as f:
            self.config = json.load(f)

        self.w_lgb = self.config['weights']['lgb']
        self.w_iso = self.config['weights']['iso']
        self.w_phy = self.config['weights']['physics']
        self.approve_threshold = self.config['thresholds']['optimal_threshold']
        self.flag_threshold = self.config['thresholds']['flag_threshold']
        self.veto_threshold = self.config['veto']['shield3_veto_threshold']

        # Load Physics Rules Engine
        import sys
        # ensemble_dir = 'models/ensemble/outputs/model'
        # We need 'models/ensemble/' where physics_rules.py lives
        physics_dir = os.path.abspath(os.path.join(ensemble_dir, '..', '..'))
        if physics_dir not in sys.path:
            sys.path.insert(0, physics_dir)
        from physics_rules import PhysicsRuleEngine
        self.physics = PhysicsRuleEngine()

        # Initialize SHAP explainer for LightGBM
        try:
            import shap
            lgb = self.lgb_model.model if hasattr(self.lgb_model, 'model') else self.lgb_model
            self.explainer = shap.TreeExplainer(lgb)
            logger.info("SHAP explainer initialized")
        except Exception as e:
            logger.warning(f"SHAP explainer could not be initialized: {e}")
            self.explainer = None

        logger.info("EnsembleEngine initialized successfully")

    # ─── Helpers ────────────────────────────────────────────
    @staticmethod
    def _safe_float(val, default=0.0):
        try:
            v = float(val)
            return default if v != v else v
        except (ValueError, TypeError):
            return default

    # ─── Feature extraction (numpy-only, no Pandas) ─────────
    def get_features(self, unit_dict: dict) -> np.ndarray:
        """Build feature array from dict — no DataFrame on hot path."""
        vals = np.array([[self._safe_float(unit_dict.get(f, 0.0)) for f in FEATURE_COLS]])
        return vals

    def get_features_df(self, unit_dict: dict) -> pd.DataFrame:
        """DataFrame version for SHAP explain endpoint only."""
        arr = self.get_features(unit_dict)
        return pd.DataFrame(arr, columns=FEATURE_COLS)

    # ─── Model scoring ─────────────────────────────────────
    def score_lgb(self, X: np.ndarray) -> float:
        """Returns LightGBM defect probability (0-100)."""
        lgb = self.lgb_model.model if hasattr(self.lgb_model, 'model') else self.lgb_model
        probs = lgb.predict_proba(self.lgb_scaler.transform(X))
        sellable = probs[0, 0] + probs[0, 1] + probs[0, 2]
        return float((1.0 - sellable) * 100)

    def score_iso(self, X: np.ndarray) -> float:
        """Returns Isolation Forest anomaly score (0-100)."""
        raw = -self.iso_model.decision_function(self.iso_scaler.transform(X))
        scaled = self.iso_mms.transform(raw.reshape(-1, 1)).flatten()
        return float(np.clip(scaled[0], 0, 100))

    def score_physics(self, unit_dict: dict) -> tuple:
        """Returns physics rules score (0-100) and reasons list."""
        df = pd.DataFrame([unit_dict])
        scores_raw, reasons = self.physics.predict(df)
        return float(scores_raw[0] * 100), reasons[0]

    # ─── Static Rules Fallback (last resort) ────────────────
    @staticmethod
    def _static_rules_score(unit_dict: dict) -> tuple:
        """
        Ultra-lightweight rules when ALL models are down.
        Returns (score_0_100, decision, reasons).
        """
        score = 0.0
        reasons = []

        rrs5 = float(unit_dict.get('rrs_5', 0))
        machine_risk = float(unit_dict.get('machine_risk_score', 0))

        if rrs5 > 0.8:
            score += 40
            reasons.append("High cumulative stress (rrs_5 > 0.8)")
        if machine_risk > 0.7:
            score += 30
            reasons.append("Degraded machine (risk > 0.7)")

        delta_cols = ['rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3',
                      'rrs_delta_4', 'rrs_delta_5']
        neg_deltas = sum(1 for c in delta_cols if float(unit_dict.get(c, 0)) < 0)
        if neg_deltas > 0:
            score += 20
            reasons.append(f"Negative stress deltas ({neg_deltas} stages)")

        score = min(score, 100.0)
        if score < 30:
            decision = "Approve"
        elif score < 60:
            decision = "Flag"
        else:
            decision = "Block"

        if not reasons:
            reasons.append("Normal sensor profile")
        return score, decision, reasons

    # ─── Main prediction (hot path) ─────────────────────────
    def predict(self, unit_dict: dict) -> dict:
        """
        Scores a single unit through the Tri-Shield ensemble.
        Returns a dict with scores, decision, reasons, and metadata.
        """
        t0 = time.perf_counter()
        X_raw = self.get_features(unit_dict)

        lgb_score = iso_score = phy_score = None
        phy_reasons = []
        active_models = []
        engine_mode = "full"

        # Try Shield 1 (LightGBM)
        try:
            lgb_score = self.score_lgb(X_raw)
            active_models.append("lgb")
        except Exception as e:
            logger.error(f"LightGBM FAILED: {e}")

        # Try Shield 2 (IsoForest)
        try:
            iso_score = self.score_iso(X_raw)
            active_models.append("iso")
        except Exception as e:
            logger.error(f"IsolationForest FAILED: {e}")

        # Try Shield 3 (Physics — always available, pure rules)
        try:
            phy_score, phy_reasons = self.score_physics(unit_dict)
            active_models.append("physics")
        except Exception as e:
            logger.error(f"Physics Rules FAILED: {e}")

        # ── Determine engine mode and fuse ──────────────────
        if lgb_score is not None and iso_score is not None and phy_score is not None:
            engine_mode = "full"
            final_score = (lgb_score * self.w_lgb +
                          iso_score * self.w_iso +
                          phy_score * self.w_phy)

        elif lgb_score is not None and phy_score is not None and iso_score is None:
            engine_mode = "degraded_iso"
            w_sum = self.w_lgb + self.w_phy
            final_score = (lgb_score * (self.w_lgb / w_sum) +
                          phy_score * (self.w_phy / w_sum))
            logger.warning(f"Degraded mode (no ISO)")

        elif iso_score is not None and phy_score is not None and lgb_score is None:
            engine_mode = "degraded_lgb"
            w_sum = self.w_iso + self.w_phy
            final_score = (iso_score * (self.w_iso / w_sum) +
                          phy_score * (self.w_phy / w_sum))
            logger.warning(f"Degraded mode (no LGB)")

        elif phy_score is not None:
            engine_mode = "physics_only"
            final_score = phy_score
            logger.warning(f"Physics-only mode")

        else:
            engine_mode = "static_rules"
            static_score, static_decision, static_reasons = self._static_rules_score(unit_dict)
            logger.error(f"ALL MODELS DOWN -> static rules")
            latency = (time.perf_counter() - t0) * 1000
            return {
                'risk_score': static_score,
                'risk_level': static_decision,
                'shield1_score': 0.0,
                'shield2_score': 0.0,
                'shield3_score': 0.0,
                'reasons': static_reasons,
                'engine_mode': engine_mode,
                'active_models': [],
                'latency_ms': round(latency, 2),
            }

        final_score = float(np.clip(final_score, 0.0, 100.0))

        # ── Decision (with veto) ────────────────────────────
        if final_score < self.approve_threshold:
            decision = "Approve"
        elif final_score < self.flag_threshold:
            decision = "Flag"
        else:
            decision = "Block"

        # Shield 3 Veto Override
        if (self.veto_threshold is not None and
                phy_score is not None and
                phy_score >= self.veto_threshold and
                decision == "Approve"):
            decision = "Flag"
            if isinstance(phy_reasons, str):
                phy_reasons = [phy_reasons]
            phy_reasons = ["[VETO OVERRIDE] Physics rules triggered auto-flag"] + (
                phy_reasons if isinstance(phy_reasons, list) else [phy_reasons]
            )

        # Clean reasons
        reasons = phy_reasons if isinstance(phy_reasons, list) else [phy_reasons]
        reasons = [r for r in reasons if "Normal" not in r]
        if not reasons:
            reasons = ["Normal sensor profile"]
        if engine_mode != "full":
            reasons.insert(0, f"[{engine_mode.upper()}] Some models unavailable")

        latency = (time.perf_counter() - t0) * 1000

        return {
            'risk_score': round(final_score, 2),
            'risk_level': decision,
            'shield1_score': round(lgb_score or 0.0, 2),
            'shield2_score': round(iso_score or 0.0, 2),
            'shield3_score': round(phy_score or 0.0, 2),
            'reasons': reasons,
            'engine_mode': engine_mode,
            'active_models': active_models,
            'latency_ms': round(latency, 2),
        }

    # ─── SHAP Explain (for /explain endpoint) ───────────────
    def explain(self, unit_dict: dict) -> dict:
        """
        Returns SHAP feature attributions for a single unit.
        Only uses LightGBM explainer (tree-based SHAP).
        """
        if self.explainer is None:
            return {'error': 'SHAP explainer not available'}

        X_df = self.get_features_df(unit_dict)
        X_scaled = pd.DataFrame(
            self.lgb_scaler.transform(X_df),
            columns=FEATURE_COLS
        )

        shap_values = self.explainer.shap_values(X_scaled)

        # For multiclass: sum SHAP for defect classes (3-7 = Bins 4-8)
        if isinstance(shap_values, list) and len(shap_values) > 3:
            defect_shap = sum(shap_values[3:])  # Bins 4-8
            shap_row = defect_shap[0]
        elif isinstance(shap_values, list):
            shap_row = shap_values[-1][0]
        else:
            shap_row = shap_values[0]

        # Build sorted attribution dict
        attributions = sorted(
            zip(FEATURE_COLS, shap_row.tolist()),
            key=lambda x: abs(x[1]),
            reverse=True
        )

        return {
            'top_features': [
                {'feature': f, 'shap_value': round(v, 6),
                 'direction': 'risk_increase' if v > 0 else 'risk_decrease'}
                for f, v in attributions[:10]
            ],
            'all_features': {f: round(v, 6) for f, v in attributions},
        }
