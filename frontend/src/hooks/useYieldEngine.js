import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { generateUnitData } from '../utils/yieldSimulation'

/**
 * useYieldEngine
 *
 * Generates synthetic semiconductor units and sends them to the Micron
 * Tri-Shield backend at POST /predict for real-time scoring.
 *
 * Architecture (mirrors FraudShieldAI):
 *   1. Frontend generates synthetic telemetry via generateUnitData()
 *   2. Sends ONLY the 34 backend-schema fields to POST /predict
 *   3. Backend returns shield scores + decision
 *   4. Frontend merges scores with UI context fields for display
 *   5. allUnits array feeds Dashboard, Model Insights, and Investigation tabs
 */

// The 34 fields the backend expects (UnitTelemetry schema)
const BACKEND_FIELDS = [
  'unit_id', 'timestamp',
  'bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity',
  'pick_place_speed', 'ultrasonic_power', 'bond_time', 'loop_height',
  'capillary_stroke_count', 'efo_voltage',
  'transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level',
  'ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density',
  'spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow',
  'rrs_1', 'rrs_2', 'rrs_3', 'rrs_4', 'rrs_5',
  'rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3', 'rrs_delta_4', 'rrs_delta_5',
  'machine_risk_score', 'resin_batch_risk_score'
]

/** Extract only the fields the backend schema expects */
function toBackendPayload(raw) {
  const payload = {}
  for (const key of BACKEND_FIELDS) {
    if (raw[key] !== undefined) payload[key] = raw[key]
  }
  return payload
}

// ── Global shared store — survives tab switches ──────────────────────────────
if (!window.__micronSentinelStore) {
  window.__micronSentinelStore = {
    unitHistory: [],
    activeWeights: { lgb: 0.55, iso: 0.25, beh: 0.20 },
    activeThresholds: { approve: 35, flag: 60 },
  }
}

function pushToGlobalStore(unit) {
  const store = window.__micronSentinelStore
  store.unitHistory.push(unit)
  if (store.unitHistory.length > 500) store.unitHistory.shift()
  window.dispatchEvent(new CustomEvent('sentinel:newunit', { detail: unit }))
}

export function useYieldEngine() {
  const [params, setParams] = useState({
    simulationSpeed: 1,   // units per second
    smoteLevel: 0.30,     // probability of high-risk features
  })

  const [allUnits, setAllUnits] = useState([])
  const [isRunning, setIsRunning] = useState(true)
  const [excursionQueue, setExcursionQueue] = useState(0)
  const [selectedUnit, setSelectedUnit] = useState(null)

  // ─── Engine Health Polling (hits /health on Micron backend) ─────────
  const [engineOnline, setEngineOnline] = useState(false)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/health')
        if (res.ok) {
          const data = await res.json()
          setEngineOnline(data.status === 'healthy')
        } else {
          setEngineOnline(false)
        }
      } catch {
        setEngineOnline(false)
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 5000)
    return () => clearInterval(interval)
  }, [])

  // ─── Config (static defaults matching ensemble_config.json) ────────
  const [backendStats, setBackendStats] = useState(null)
  const [config, setConfig] = useState({
    approve_threshold: 35,
    flag_threshold: 65,
    weights: { lgb: 0.55, iso: 0.25, beh: 0.20 }
  })

  // ─── Backend scoring loop ─────────────────────────────────────────
  useEffect(() => {
    if (!isRunning && excursionQueue === 0) return

    let timeoutId
    const tick = async () => {
      const isExcursionMode = excursionQueue > 0
      let template = 'normal'
      if (isExcursionMode) {
        template = 'excursion'
      } else {
        const rand = Math.random()
        if (rand < params.smoteLevel) {
          template = Math.random() > 0.6 ? 'drift' : 'marginal'
        }
      }

      const raw = generateUnitData(template)
      const interval = isExcursionMode ? 500 : (1000 / Math.max(params.simulationSpeed, 0.1))
      timeoutId = setTimeout(tick, interval)
      if (isExcursionMode) setExcursionQueue(q => q - 1)

      // Send ONLY schema-valid fields to the backend
      const payload = toBackendPayload(raw)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)

      try {
        const res = await fetch('http://localhost:8000/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(payload)
        })

        clearTimeout(timeout)

        if (res.ok) {
          const scored = await res.json()
          
          // Merge raw UI fields + backend scores
          const processed = {
            ...raw,
            ...scored,
            riskScore: scored.risk_score,
            riskLevel: scored.risk_level === 'Block' ? 'HIGH' : scored.risk_level === 'Flag' ? 'MEDIUM' : 'LOW',
            decision: scored.risk_level === 'Block' ? 'REJECT' : scored.risk_level === 'Flag' ? 'REVIEW' : 'PASS',
            ensembleScore: scored.risk_score / 100,
            lgbScore: scored.shield1_score / 100,
            isoScore: scored.shield2_score / 100,
            behScore: scored.shield3_score / 100,
            latencyMs: scored.latency_ms,
            scoredByBackend: true,
          }
          pushToGlobalStore(processed)
          setAllUnits(prev => [processed, ...prev].slice(0, 500))
        } else {
          console.warn(`Backend returned ${res.status}`)
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Prediction failed:', err)
        }
      }
    }

    timeoutId = setTimeout(tick, 1000 / Math.max(params.simulationSpeed, 0.1))
    return () => clearTimeout(timeoutId)
  }, [isRunning, excursionQueue, params.smoteLevel, params.simulationSpeed])

  const triggerExcursionBurst = useCallback(() => setExcursionQueue(20), [])
  const updateParam = useCallback((key, value) => setParams(p => ({ ...p, [key]: value })), [])
  const resetParams = useCallback(() => setParams({ simulationSpeed: 1, smoteLevel: 0.30 }), [])
  const clearData = useCallback(async () => { setAllUnits([]) }, [])

  const units = allUnits.slice(0, 50)
  const total = allUnits.length
  const approved = allUnits.filter(t => t.decision === 'PASS').length
  const flagged = allUnits.filter(t => t.decision === 'REVIEW').length
  const blocked = allUnits.filter(t => t.decision === 'REJECT').length

  const avgLatency = useMemo(() => {
    if (allUnits.length === 0) return 0
    return Math.round(allUnits.reduce((s, t) => s + (t.latencyMs || 0), 0) / allUnits.length)
  }, [allUnits])

  const matrix = useMemo(() => {
    let tp = 0, fp = 0, fn = 0, tn = 0
    allUnits.forEach(t => {
      const predicted = t.decision === 'REJECT'
      const actual = !!t.isDefective
      if (predicted && actual) tp++
      else if (predicted && !actual) fp++
      else if (!predicted && !actual) tn++
      else fn++
    })
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 1
    const accuracy = tp + fp + fn + tn > 0 ? (tp + tn) / (tp + fp + fn + tn) : 1
    return { tp, fp, fn, tn, precision, recall, f1, accuracy }
  }, [allUnits])

  const trends = useMemo(() => {
    const now = Date.now()
    const t30 = allUnits.filter(t => (now - new Date(t.timestamp)) <= 30000)
    const t60 = allUnits.filter(t => {
      const age = now - new Date(t.timestamp)
      return age > 30000 && age <= 60000
    })
    const rate = v => v.length ? v.filter(t => t.decision !== 'PASS').length / v.length : 0
    return {
      blockedRate: t30.length ? t30.filter(t => t.decision === 'REJECT').length / t30.length : 0,
      flaggedRate: t30.length ? t30.filter(t => t.decision === 'REVIEW').length / t30.length : 0,
      volume: t30.length,
      defectRateNow: rate(t30),
      defectRatePrev: rate(t60),
    }
  }, [allUnits])

  const lgbAvgScore = useMemo(() => {
    const scored = allUnits.filter(t => t.lgbScore != null)
    if (scored.length === 0) return 0
    return scored.reduce((s, t) => s + t.lgbScore, 0) / scored.length
  }, [allUnits])

  const isoAnomalyRate = useMemo(() => {
    const scored = allUnits.filter(t => t.isoScore != null)
    if (scored.length === 0) return 0
    return (scored.filter(t => t.isoScore > 0.5).length / scored.length) * 100
  }, [allUnits])

  const behHitRate = useMemo(() => {
    const scored = allUnits.filter(t => t.reasons)
    if (scored.length === 0) return 0
    return (scored.filter(t => !t.reasons.includes('Normal sensor profile')).length / scored.length) * 100
  }, [allUnits])

  const modelDisagreements = useMemo(() => {
    return allUnits
      .filter(t => t.lgbScore != null && t.isoScore != null)
      .filter(t => Math.abs(t.lgbScore - t.isoScore) > 0.3)
      .map(t => ({
        id: t.unit_id || t.id,
        lgbScore: t.lgbScore,
        isoScore: t.isoScore,
        behScore: t.behScore,
        ensembleScore: t.ensembleScore,
        delta: Math.abs((t.lgbScore || 0) - (t.isoScore || 0)),
        reason: t.reasons?.[0] || 'Unknown',
        _raw: t
      }))
  }, [allUnits])

  const disagreementRate = useMemo(() => {
    const scored = allUnits.filter(t => t.lgbScore != null && t.isoScore != null)
    if (scored.length === 0) return 0
    return (modelDisagreements.length / scored.length) * 100
  }, [allUnits, modelDisagreements])

  const [sparkline, setSparkline] = useState(Array.from({ length: 60 }, (_, i) => ({ time: i, rate: 0 })))
  const txRef = useRef(allUnits)
  useEffect(() => { txRef.current = allUnits }, [allUnits])

  useEffect(() => {
    if (!isRunning) return
    const intervalId = setInterval(() => {
      const now = Date.now()
      const recentUnits = txRef.current.filter(t => {
          const tTime = new Date(t.timestamp).getTime()
          return (now - tTime) <= 1000 && (now - tTime) >= 0
      })
      const newRate = recentUnits.length > 0 
        ? recentUnits.filter(t => t.decision !== 'PASS').length / recentUnits.length 
        : 0
      setSparkline(prev => {
        const next = [...prev, { time: now, rate: newRate }]
        if (next.length > 60) next.shift()
        return next
      })
    }, 1000)
    return () => clearInterval(intervalId)
  }, [isRunning])

  const histogram = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({
      bin: i * 0.1,
      label: `${(i * 0.1).toFixed(1)}-${((i + 1) * 0.1).toFixed(1)}`,
      shortLabel: `${(i * 0.1).toFixed(1)}`,
      count: 0,
    }))
    allUnits.forEach(t => {
      if (t.ensembleScore != null && !isNaN(t.ensembleScore)) {
        bins[Math.min(9, Math.max(0, Math.floor(t.ensembleScore / 0.1)))].count++
      }
    })
    return bins
  }, [allUnits])

  return {
    params, units, allUnits,
    isRunning,
    matrix, trends, sparkline, histogram,
    total, blocked, flagged, approved, avgLatency,
    selectedUnit, setSelectedUnit,
    setIsRunning, updateParam, resetParams, triggerExcursionBurst, clearData,
    engineOnline,
    backendStats,
    config,
    lgbAvgScore,
    isoAnomalyRate,
    behHitRate,
    disagreementRate,
    modelDisagreements,
    weights: config.weights,
    thresholds: { approve: config.approve_threshold, block: config.flag_threshold },
  }
}
