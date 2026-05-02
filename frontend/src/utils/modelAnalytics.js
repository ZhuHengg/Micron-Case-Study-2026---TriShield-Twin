/**
 * Model Analytics Utilities for Tri-Shield Insights
 * Adapted from FraudShieldAI's FraudAnalysis pattern
 */

// Pearson Correlation
export function pearsonCorrelation(x, y) {
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  const n = x.length
  if (n === 0) return 0
  for (let i = 0; i < n; i++) {
    sumX += x[i]; sumY += y[i]; sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i]
  }
  const num = (n * sumXY) - (sumX * sumY)
  const den = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)))
  return den === 0 ? 0 : num / den
}

// Model Agreement Matrix
export function calcAgreementMatrix(units) {
  let bothSafe = 0, isoFlags = 0, lgbFlags = 0, bothDefect = 0
  units.forEach(t => {
    const lgb = (t.lgbScore || 0) > 0.5
    const iso = (t.isoScore || 0) > 0.5
    if (!lgb && !iso) bothSafe++
    else if (!lgb && iso) isoFlags++
    else if (lgb && !iso) lgbFlags++
    else bothDefect++
  })
  const tot = units.length || 1
  return {
    bothSafe, isoFlags, lgbFlags, bothDefect,
    disagree: isoFlags + lgbFlags,
    pctBothSafe: (bothSafe / tot) * 100,
    pctIso: (isoFlags / tot) * 100,
    pctLgb: (lgbFlags / tot) * 100,
    pctBothDefect: (bothDefect / tot) * 100,
  }
}

// Re-score a unit with custom weights/thresholds
export function rescore(unit, w, t) {
  const lgb = ((unit.lgbScore) || 0) * 100
  const iso = ((unit.isoScore) || 0) * 100
  const beh = ((unit.behScore) || 0) * 100
  const score = Math.min(100, Math.max(0, lgb * w.lgb + iso * w.iso + beh * w.beh))
  const dec = score < t.approve ? 'PASS' : score < t.block ? 'REVIEW' : 'REJECT'
  return { score, dec }
}

// Calculate confusion matrix metrics
export function calcMetrics(units, w, t) {
  let TP = 0, FP = 0, TN = 0, FN = 0
  units.forEach(u => {
    const { dec } = rescore(u, w, t)
    const pF = dec === 'REJECT'
    const aF = !!u.isDefective
    if (pF && aF) TP++; else if (pF && !aF) FP++
    else if (!pF && !aF) TN++; else FN++
  })
  const p = TP + FP > 0 ? TP / (TP + FP) : 0
  const r = TP + FN > 0 ? TP / (TP + FN) : 0
  const f = p + r > 0 ? 2 * p * r / (p + r) : 0
  const fp = FP + TN > 0 ? FP / (FP + TN) : 0
  return { p, r, f, fp, TP, FP, TN, FN }
}

// Physics rule definitions for Tri-Shield
export const PHYSICS_RULES = [
  {
    id: 'stress', name: 'High Cumulative Stress', weight: '40%', color: '#ef4444',
    features: 'rrs_5 > 0.8 (Residual Stress)',
    trigger: t => (t.rrs_5 || 0) > 0.8
  },
  {
    id: 'machine', name: 'Machine Degradation', weight: '30%', color: '#f59e0b',
    features: 'machine_risk_score > 0.7',
    trigger: t => (t.machine_risk_score || 0) > 0.7
  },
  {
    id: 'thermal', name: 'Thermal Excursion', weight: '20%', color: '#a855f7',
    features: 'molding_temperature or reflow_peak_temp OOB',
    trigger: t => (t.molding_temperature || 180) > 188 || (t.reflow_peak_temp || 260) > 268
  },
  {
    id: 'drift', name: 'Tool Wear Drift', weight: '10%', color: '#0891b2',
    features: 'blade_wear_index > 0.8 or capillary_stroke > 400',
    trigger: t => (t.blade_wear_index || 0) > 0.8 || (t.capillary_stroke_count || 0) > 400
  },
]

// Feature correlation definitions
export const FEATURE_MAP = [
  { key: 'rrs_5', label: 'rrs_5 (Cumulative Stress)', rule: 'High Stress', color: '#ef4444' },
  { key: 'machine_risk_score', label: 'machine_risk_score', rule: 'Machine Degrad.', color: '#f59e0b' },
  { key: 'molding_temperature', label: 'molding_temperature', rule: 'Thermal Exc.', color: '#a855f7' },
  { key: 'blade_wear_index', label: 'blade_wear_index', rule: 'Tool Wear', color: '#0891b2' },
  { key: 'reflow_peak_temp', label: 'reflow_peak_temp', rule: 'Thermal Exc.', color: '#a855f7' },
  { key: 'bond_force', label: 'bond_force', rule: 'Process', color: '#2563eb' },
  { key: 'ultrasonic_power', label: 'ultrasonic_power', rule: 'Process', color: '#7c3aed' },
]
