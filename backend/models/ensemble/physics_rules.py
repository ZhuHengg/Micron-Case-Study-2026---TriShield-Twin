import pandas as pd
import numpy as np

class PhysicsRuleEngine:
    """
    Shield 3: Physics-based heuristic rule engine.
    Catches defects that ML models cannot detect from sensor data alone,
    primarily targeting Bin 4 (Fab Passthrough) failures.

    Mirrors FraudShieldAI's BehavioralProfiler but uses
    semiconductor physics rules instead of transaction patterns.

    7 Rules (weights sum to 1.0):
      Rule 1: RRS Accumulation Anomaly     (0.20) - Silent stress from fab
      Rule 2: Machine Risk Escalation      (0.15) - Drifting equipment
      Rule 3: Thermal-Vacuum Violation     (0.15) - Mold compound integrity
      Rule 4: Stage Delta Inversion        (0.10) - Physically impossible readings
      Rule 5: Resin-Machine Compound Risk  (0.15) - Double-jeopardy material+machine
      Rule 6: Multi-Sensor Marginal Zone   (0.15) - Death by a thousand cuts
      Rule 7: Bond Geometry Deviation      (0.10) - Substrate warpage from fab
    """
    def __init__(self):
        self.rules = {
            'rrs_accumulation_anomaly': 0.20,
            'machine_risk_escalation': 0.15,
            'thermal_vacuum_violation': 0.15,
            'stage_delta_inversion': 0.10,
            'resin_machine_compound': 0.15,
            'multi_sensor_marginal': 0.15,
            'bond_geometry_deviation': 0.10,
        }

    # -----------------------------------------------------------------
    # Rule 1: RRS Accumulation Anomaly (Bin 4 primary detector)
    # -----------------------------------------------------------------
    def _score_rrs_accumulation(self, df):
        """
        If rrs_5 (final cumulative stress) is elevated but all individual
        rrs_delta values are small, the unit accumulated stress invisibly.
        This is the hallmark of a Fab Passthrough defect -- the unit arrived
        with pre-existing stress that the backend process did not cause.
        """
        score = pd.Series(0.0, index=df.index)

        required = ['rrs_5', 'rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3',
                     'rrs_delta_4', 'rrs_delta_5']
        if not all(c in df.columns for c in required):
            return score

        max_delta = df[['rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3',
                        'rrs_delta_4', 'rrs_delta_5']].max(axis=1)

        rrs5_elevated = df['rrs_5'] > df['rrs_5'].quantile(0.60)
        deltas_small = max_delta < df['rrs_5'].quantile(0.40)

        score = np.where(
            rrs5_elevated & deltas_small,
            np.clip(df['rrs_5'] / df['rrs_5'].quantile(0.95), 0, 1),
            0.0
        )
        return pd.Series(score, index=df.index)

    # -----------------------------------------------------------------
    # Rule 2: Machine Risk Escalation
    # -----------------------------------------------------------------
    def _score_machine_risk(self, df):
        """
        If machine_risk_score is high (machine is degraded/drifting)
        but the unit passed all sensor thresholds, the machine may be
        producing marginal units that sensors can't catch.
        """
        score = pd.Series(0.0, index=df.index)

        if 'machine_risk_score' not in df.columns:
            return score

        threshold = df['machine_risk_score'].quantile(0.80)
        high_risk = df['machine_risk_score'] > threshold

        score = np.where(
            high_risk,
            np.clip((df['machine_risk_score'] - threshold) / (1.0 - threshold + 1e-10), 0, 1),
            0.0
        )
        return pd.Series(score, index=df.index)

    # -----------------------------------------------------------------
    # Rule 3: Thermal-Vacuum Violation
    # -----------------------------------------------------------------
    def _score_thermal_vacuum(self, df):
        """
        If molding_temperature is low AND vacuum_level is low simultaneously,
        the mold compound may have incomplete fill, causing voids.
        These are physically correlated (r=-0.93 in our data).
        """
        score = pd.Series(0.0, index=df.index)

        required = ['molding_temperature', 'vacuum_level']
        if not all(c in df.columns for c in required):
            return score

        temp_low = df['molding_temperature'] < df['molding_temperature'].quantile(0.25)
        vacuum_low = df['vacuum_level'] < df['vacuum_level'].quantile(0.25)
        both_low = temp_low & vacuum_low

        temp_severity = np.clip(
            (df['molding_temperature'].quantile(0.25) - df['molding_temperature']) /
            (df['molding_temperature'].quantile(0.25) - df['molding_temperature'].min() + 1e-10),
            0, 1
        )
        score = np.where(both_low, temp_severity, 0.0)
        return pd.Series(score, index=df.index)

    # -----------------------------------------------------------------
    # Rule 4: Stage Delta Inversion
    # -----------------------------------------------------------------
    def _score_delta_inversion(self, df):
        """
        If any rrs_delta is negative (stress decreased between stages),
        this is physically impossible under normal processing.
        Indicates sensor calibration error or Fab Passthrough artifact.
        """
        score = pd.Series(0.0, index=df.index)

        delta_cols = ['rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3',
                      'rrs_delta_4', 'rrs_delta_5']
        if not all(c in df.columns for c in delta_cols):
            return score

        negative_count = (df[delta_cols] < 0).sum(axis=1)
        has_inversion = negative_count > 0
        score = np.where(has_inversion, np.clip(negative_count / 3.0, 0, 1), 0.0)
        return pd.Series(score, index=df.index)

    # -----------------------------------------------------------------
    # Rule 5: Resin-Machine Compound Risk (NEW)
    # -----------------------------------------------------------------
    def _score_resin_machine_compound(self, df):
        """
        If BOTH resin_batch_risk_score AND machine_risk_score are elevated,
        the unit was processed with bad material on a degraded machine.
        Each alone may be tolerable, but the combination is multiplicative risk.

        This targets Bin 4: fab-level defects are more likely to manifest
        when downstream equipment and materials are also marginal.
        """
        score = pd.Series(0.0, index=df.index)

        required = ['resin_batch_risk_score', 'machine_risk_score']
        if not all(c in df.columns for c in required):
            return score

        resin_high = df['resin_batch_risk_score'] > df['resin_batch_risk_score'].quantile(0.70)
        machine_high = df['machine_risk_score'] > df['machine_risk_score'].quantile(0.70)
        both_high = resin_high & machine_high

        # Compound score = product of both normalized risks
        resin_norm = np.clip(
            (df['resin_batch_risk_score'] - df['resin_batch_risk_score'].quantile(0.70)) /
            (df['resin_batch_risk_score'].max() - df['resin_batch_risk_score'].quantile(0.70) + 1e-10),
            0, 1
        )
        machine_norm = np.clip(
            (df['machine_risk_score'] - df['machine_risk_score'].quantile(0.70)) /
            (df['machine_risk_score'].max() - df['machine_risk_score'].quantile(0.70) + 1e-10),
            0, 1
        )

        score = np.where(both_high, (resin_norm + machine_norm) / 2.0, 0.0)
        return pd.Series(score, index=df.index)

    # -----------------------------------------------------------------
    # Rule 6: Multi-Sensor Marginal Zone (NEW - "Death by a Thousand Cuts")
    # -----------------------------------------------------------------
    def _score_multi_sensor_marginal(self, df):
        """
        Counts how many raw process sensors are in the "marginal zone"
        (between 20th and 40th percentile) simultaneously.
        If 5+ sensors are all "just barely OK", the unit is marginally
        acceptable at every individual checkpoint but cumulatively risky.

        ML models check each feature independently or in small interactions.
        This rule catches the rare case where MANY features are simultaneously
        borderline -- a pattern that is statistically unlikely for healthy units
        but characteristic of Fab Passthrough defects that subtly shift
        all downstream readings without triggering any single alarm.
        """
        score = pd.Series(0.0, index=df.index)

        raw_sensors = [
            'bond_force', 'xy_placement_offset', 'bond_line_thickness',
            'epoxy_viscosity', 'pick_place_speed', 'ultrasonic_power',
            'bond_time', 'loop_height', 'capillary_stroke_count',
            'efo_voltage', 'transfer_pressure', 'clamping_force',
            'molding_temperature', 'vacuum_level', 'ball_placement_accuracy',
            'laser_pulse_energy', 'reflow_peak_temp', 'flux_density',
            'spindle_current', 'vibration_amplitude', 'blade_wear_index',
            'cooling_water_flow'
        ]
        available = [c for c in raw_sensors if c in df.columns]
        if len(available) < 10:
            return score

        # Count how many sensors fall in the marginal zone (20th-40th percentile)
        marginal_count = pd.Series(0, index=df.index)
        for col in available:
            p20 = df[col].quantile(0.20)
            p40 = df[col].quantile(0.40)
            in_marginal = (df[col] >= p20) & (df[col] <= p40)
            marginal_count += in_marginal.astype(int)

        # 5+ sensors marginal = warning, scales up to 10+
        threshold = 5
        triggered = marginal_count >= threshold
        score = np.where(
            triggered,
            np.clip((marginal_count - threshold) / 5.0, 0, 1),
            0.0
        )
        return pd.Series(score, index=df.index)

    # -----------------------------------------------------------------
    # Rule 7: Bond Geometry Deviation (NEW)
    # -----------------------------------------------------------------
    def _score_bond_geometry(self, df):
        """
        If bond_force, xy_placement_offset, and bond_line_thickness
        all deviate significantly from their medians in the same direction,
        it suggests substrate warpage or die tilt from a pre-existing
        fab-level defect.

        Healthy units show independent random scatter on these features.
        Fab Passthrough units may show correlated deviations because the
        underlying substrate geometry is compromised.
        """
        score = pd.Series(0.0, index=df.index)

        required = ['bond_force', 'xy_placement_offset', 'bond_line_thickness']
        if not all(c in df.columns for c in required):
            return score

        # Compute z-scores relative to median
        deviations = pd.DataFrame(index=df.index)
        for col in required:
            median = df[col].median()
            mad = (df[col] - median).abs().median()  # Median Absolute Deviation
            if mad < 1e-10:
                deviations[col] = 0.0
            else:
                deviations[col] = (df[col] - median) / (mad * 1.4826)  # Scale to match std

        # All 3 deviating in the same direction (all positive or all negative)
        all_positive = (deviations > 1.0).all(axis=1)
        all_negative = (deviations < -1.0).all(axis=1)
        correlated_deviation = all_positive | all_negative

        # Score based on average absolute deviation magnitude
        avg_dev = deviations.abs().mean(axis=1)
        score = np.where(
            correlated_deviation,
            np.clip(avg_dev / 3.0, 0, 1),
            0.0
        )
        return pd.Series(score, index=df.index)

    # -----------------------------------------------------------------
    # Predict (same interface as FraudShieldAI BehavioralProfiler)
    # -----------------------------------------------------------------
    def predict(self, df):
        """
        Returns risk score [0, 1] and a list of triggered risk reasons.
        Same interface as FraudShieldAI's BehavioralProfiler.predict().
        """
        scores = pd.DataFrame(index=df.index)

        scores['r_accum']    = self._score_rrs_accumulation(df) * self.rules['rrs_accumulation_anomaly']
        scores['r_machine']  = self._score_machine_risk(df) * self.rules['machine_risk_escalation']
        scores['r_thermal']  = self._score_thermal_vacuum(df) * self.rules['thermal_vacuum_violation']
        scores['r_inversion']= self._score_delta_inversion(df) * self.rules['stage_delta_inversion']
        scores['r_compound'] = self._score_resin_machine_compound(df) * self.rules['resin_machine_compound']
        scores['r_marginal'] = self._score_multi_sensor_marginal(df) * self.rules['multi_sensor_marginal']
        scores['r_geometry'] = self._score_bond_geometry(df) * self.rules['bond_geometry_deviation']

        # Total score (0 to 1)
        total_score = scores.sum(axis=1)

        # Generate human-readable reasons
        reasons = []
        for idx in df.index:
            row_reasons = []
            if scores.loc[idx, 'r_accum'] > 0:
                row_reasons.append("Silent RRS accumulation (possible Fab Passthrough)")
            if scores.loc[idx, 'r_machine'] > 0.05:
                row_reasons.append("High machine degradation risk")
            if scores.loc[idx, 'r_thermal'] > 0:
                row_reasons.append("Thermal-vacuum mold integrity violation")
            if scores.loc[idx, 'r_inversion'] > 0:
                row_reasons.append("Physically impossible stage delta inversion")
            if scores.loc[idx, 'r_compound'] > 0:
                row_reasons.append("Resin + Machine compound risk (double jeopardy)")
            if scores.loc[idx, 'r_marginal'] > 0:
                row_reasons.append("Multiple sensors in marginal zone simultaneously")
            if scores.loc[idx, 'r_geometry'] > 0:
                row_reasons.append("Correlated bond geometry deviation (substrate warpage)")

            if not row_reasons:
                row_reasons.append("Normal physics profile")

            reasons.append(" | ".join(row_reasons))

        return total_score.values, reasons
