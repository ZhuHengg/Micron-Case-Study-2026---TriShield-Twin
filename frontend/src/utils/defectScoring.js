/**
 * defectScoring.js
 *
 * Client-side heuristic scoring that mirrors the Tri-Shield backend logic.
 * Used for instant UI feedback BEFORE the backend API responds.
 *
 * This does NOT replace the real model — it is a lightweight approximation
 * so the dashboard can show immediate visual feedback while the real
 * /predict API call is in flight.
 */

import { BIN_NAMES, FINAL_TESTS, getTestResults } from './yieldSimulation'

// ─── Shield 1 Approximation (LightGBM proxy) ────────────────────────────────
// Uses the cumulative RRS as a simplified defect probability.
export function approximateShield1Score(unit) {
  // rrs_5 is the final cumulative stress (0-1), which correlates ~0.94 AUC
  // with the real LightGBM model.
  const rrs5 = unit.rrs_5 || 0
  const score = rrs5 * 100
  return Math.min(100, Math.max(0, score))
}

// ─── Shield 2 Approximation (Isolation Forest proxy) ─────────────────────────
// Checks how many sensor readings deviate from nominal by > 2 sigma.
export function approximateShield2Score(unit) {
  const checks = [
    Math.abs(unit.bond_force - 30.0) > 5.0,
    unit.xy_placement_offset > 15.0,
    Math.abs(unit.bond_line_thickness - 25.0) > 7.0,
    Math.abs(unit.ultrasonic_power - 1.2) > 0.4,
    Math.abs(unit.bond_time - 15.0) > 5.0,
    Math.abs(unit.loop_height - 200) > 50,
    unit.capillary_stroke_count > 400000,
    Math.abs(unit.transfer_pressure - 8.0) > 2.0,
    unit.clamping_force > 60,
    Math.abs(unit.molding_temperature - 180) > 10.0,
    unit.vacuum_level > 5.0,
    unit.ball_placement_accuracy > 20.0,
    Math.abs(unit.reflow_peak_temp - 260) > 10.0,
    unit.spindle_current > 3.0,
    unit.vibration_amplitude > 1.0,
    unit.blade_wear_index > 0.8,
  ]
  const anomalyCount = checks.filter(Boolean).length
  return Math.min(100, (anomalyCount / checks.length) * 100)
}

// ─── Shield 3 Approximation (Physics Rules proxy) ───────────────────────────
// Hard physics limits that would cause the veto mechanism to fire.
export function approximateShield3Score(unit) {
  const violations = []

  // Die Attach violations
  if (unit.bond_force < 15 || unit.bond_force > 50)
    violations.push('Bond force out of physical range')
  if (unit.xy_placement_offset > 25)
    violations.push('Excessive placement offset')
  if (unit.bond_line_thickness < 10 || unit.bond_line_thickness > 40)
    violations.push('Bond line thickness violation')

  // Wire Bond violations
  if (unit.ultrasonic_power < 0.3)
    violations.push('Insufficient ultrasonic power → non-stick risk')
  if (unit.loop_height > 300)
    violations.push('Excessive wire loop height → sweep risk')
  if (unit.capillary_stroke_count > 450000)
    violations.push('Capillary worn beyond service limit')

  // Molding violations
  if (unit.transfer_pressure > 12)
    violations.push('Excessive transfer pressure → wire sweep')
  if (unit.clamping_force > 65)
    violations.push('Excessive clamping force → structural damage')
  if (unit.vacuum_level > 10)
    violations.push('Abnormal vacuum → voiding defect')
  if (unit.molding_temperature < 150 || unit.molding_temperature > 200)
    violations.push('Molding temp out of process window')

  // Solder Ball violations
  if (unit.reflow_peak_temp > 290)
    violations.push('Reflow temp exceeds thermal budget')
  if (unit.ball_placement_accuracy > 30)
    violations.push('Ball placement accuracy critical')

  // Singulation violations
  if (unit.blade_wear_index > 0.9)
    violations.push('Blade wear critical — replace immediately')
  if (unit.vibration_amplitude > 2.0)
    violations.push('Vibration amplitude exceeds safe limit')

  const score = Math.min(100, (violations.length / 5) * 100)
  return { score, violations }
}

// ─── Ensemble Fusion ─────────────────────────────────────────────────────────
// Weights from ensemble_config.json: lgb=0.55, iso=0.25, physics=0.20
export function computeEnsembleScore(unit) {
  const s1 = approximateShield1Score(unit)
  const s2 = approximateShield2Score(unit)
  const { score: s3, violations } = approximateShield3Score(unit)

  const ensemble = s1 * 0.55 + s2 * 0.25 + s3 * 0.20

  // Veto override: if physics score >= 19, force flag regardless
  const vetoTriggered = s3 >= 19

  // Decision thresholds from ensemble_config.json
  let riskLevel
  if (ensemble >= 36.66 || vetoTriggered) {
    riskLevel = 'Block'
  } else if (ensemble >= 20) {
    riskLevel = 'Flag'
  } else {
    riskLevel = 'Approve'
  }

  return {
    ensemble: Math.round(ensemble * 100) / 100,
    shield1: Math.round(s1 * 100) / 100,
    shield2: Math.round(s2 * 100) / 100,
    shield3: Math.round(s3 * 100) / 100,
    riskLevel,
    vetoTriggered,
    violations,
  }
}

// ─── Convenience: Full scoring pipeline ──────────────────────────────────────
export function scoreUnit(unit) {
  const scores = computeEnsembleScore(unit)
  const tests  = getTestResults(unit.bin_code)

  return {
    ...scores,
    binCode: unit.bin_code,
    binName: BIN_NAMES[unit.bin_code] || `Bin ${unit.bin_code}`,
    isDefective: unit.bin_code >= 4,
    tests,
    rrs5: unit.rrs_5,
    rrsChain: [unit.rrs_1, unit.rrs_2, unit.rrs_3, unit.rrs_4, unit.rrs_5],
    rrsDeltas: [unit.rrs_delta_1, unit.rrs_delta_2, unit.rrs_delta_3, unit.rrs_delta_4, unit.rrs_delta_5],
  }
}
