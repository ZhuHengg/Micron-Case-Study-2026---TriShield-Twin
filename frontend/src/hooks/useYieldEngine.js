import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { generateUnitData } from '../utils/yieldSimulation'
import { scoreUnit } from '../utils/defectScoring'

/**
 * useYieldEngine
 *
 * Generates synthetic units and sends them to the real backend
 * at POST /predict for scoring.  NO frontend scoring fallback.
 * If the backend is offline, units are silently discarded.
 */

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
    smoteLevel: 0.30,     // augments probability of high-risk features
  })

  const [allUnits, setAllUnits] = useState([])
  const [isRunning, setIsRunning] = useState(true)
  const [excursionQueue, setExcursionQueue] = useState(0)
  const [selectedUnit, setSelectedUnit] = useState(null)

  // ─── Engine health polling ──────────────────────────────────────────
  const [engineOnline, setEngineOnline] = useState(false)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/health')
        if (res.ok) {
          const data = await res.json()
          setEngineOnline(data.engine_loaded === true)
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

  // ─── Backend stats polling ─────────────────────────────────────────
  const [backendStats, setBackendStats] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      if (!isRunning && excursionQueue === 0) return

      try {
        const res = await fetch('http://localhost:8000/api/v1/stats')
        if (res.ok) setBackendStats(await res.json())
        else setBackendStats(null)
      } catch {
        setBackendStats(null)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 2000)
    return () => clearInterval(interval)
  }, [isRunning, excursionQueue])

  // ─── Fetch config from backend ──────────────
  const [config, setConfig] = useState({
    approve_threshold: 0.35,
    flag_threshold: 0.70,
    weights: { lgb: 0.55, iso: 0.25, beh: 0.20 }
  })

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/config')
        if (res.ok) setConfig(await res.json())
      } catch { }
    }
    fetchConfig()
  }, [])

  // ─── Initial Fetch ──────────────────────────────────────────
  useEffect(() => {
    const fetchInitialUnits = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/transactions');
        if (res.ok) {
          const data = await res.json();
          const mappedUnits = data.map(dbTx => {
            const riskScore = dbTx.ml_risk_score * 100;
            let riskLevel = 'LOW';
            if (dbTx.action_taken === 'BLOCK') riskLevel = 'HIGH';
            else if (dbTx.action_taken === 'FLAG') riskLevel = 'MEDIUM';

            return {
              unit_id: dbTx.transaction_id,
              id: dbTx.transaction_id,
              name_sender: dbTx.user_hash,
              userId: dbTx.user_hash,
              name_recipient: dbTx.recipient_hash,
              receiverId: dbTx.recipient_hash,
              transfer_type: dbTx.transfer_type,
              amount: dbTx.amount,
              avg_transaction_amount_30d: dbTx.avg_transaction_amount_30d,
              amount_vs_avg_ratio: dbTx.amount_vs_avg_ratio,
              transaction_hour: dbTx.transaction_hour,
              is_weekend: dbTx.is_weekend,
              sender_account_fully_drained: dbTx.sender_account_fully_drained,
              is_new_device: dbTx.is_new_device,
              isNewDevice: dbTx.is_new_device,
              session_duration_seconds: dbTx.session_duration_seconds,
              sessionDurationSeconds: dbTx.session_duration_seconds,
              failed_login_attempts: dbTx.failed_login_attempts,
              is_proxy_ip: dbTx.is_proxy_ip,
              isProxyIp: dbTx.is_proxy_ip,
              ip_risk_score: dbTx.ip_risk_score,
              ipRiskScore: dbTx.ip_risk_score,
              country_mismatch: dbTx.country_mismatch,
              countryMismatch: dbTx.country_mismatch,
              account_age_days: dbTx.account_age_days,
              accountAgeDays: dbTx.account_age_days,
              tx_count_24h: dbTx.tx_count_24h,
              txCount24h: dbTx.tx_count_24h,
              is_new_recipient: dbTx.is_new_recipient,
              isNewRecipient: dbTx.is_new_recipient,
              established_user_new_recipient: dbTx.established_user_new_recipient,
              recipient_risk_profile_score: dbTx.recipient_risk_profile_score,
              isDefective: dbTx.is_fraud === 1,
              decision: dbTx.action_taken === 'BLOCK' ? 'REJECT' : dbTx.action_taken === 'FLAG' ? 'REVIEW' : 'PASS',
              riskLevel: riskLevel,
              riskScore: riskScore,
              ensembleScore: dbTx.ml_risk_score,
              ground_truth: dbTx.is_fraud === 1 ? 'DEFECTIVE' : 'NOMINAL',
              template: dbTx.is_fraud === 1 ? 'drift' : 'normal',
              timestamp: new Date().toISOString(),
              scoredByBackend: true,
              sender_balance_before: dbTx.sender_balance_before,
              sender_balance_after: dbTx.sender_balance_after,
              receiver_balance_before: dbTx.receiver_balance_before,
              receiver_balance_after: dbTx.receiver_balance_after,
              currency: dbTx.currency,
              country: dbTx.country,
              deviceType: dbTx.device_type,
            };
          });
          
          setAllUnits(mappedUnits);
          window.__micronSentinelStore.unitHistory = [...mappedUnits, ...window.__micronSentinelStore.unitHistory].slice(0, 500);
        }
      } catch (err) {
        console.error("Failed to fetch initial units:", err);
      }
    };
    
    fetchInitialUnits();
  }, []);

  // ─── Backend scoring loop ─────────────────────────
  useEffect(() => {
    if (!isRunning && excursionQueue === 0) return

    let timeoutId
    const tick = async () => {
      const isExcursionMode = excursionQueue > 0
      let template = 'normal'
      if (isExcursionMode) {
        template = Math.random() > 0.4 ? 'drift' : 'marginal'
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

      const startTick = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)

      try {
        const res = await fetch('http://localhost:8000/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(raw)
        })

        clearTimeout(timeout)

        if (res.ok) {
          const scored = await res.json()
          
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

          try {
            fetch('http://localhost:8000/api/v1/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transaction_id: raw.unit_id || raw.id,
                user_hash: raw.name_sender || raw.userId || '',
                recipient_hash: raw.name_recipient || raw.receiverId || '',
                transfer_type: raw.transfer_type || raw.transaction_type || 'TRANSFER',
                amount: raw.amount || 0,
                avg_transaction_amount_30d: raw.avg_transaction_amount_30d || 0,
                amount_vs_avg_ratio: raw.amount_vs_avg_ratio || 1,
                transaction_hour: raw.transaction_hour || new Date().getHours(),
                is_weekend: raw.is_weekend || 0,
                sender_account_fully_drained: raw.sender_account_fully_drained || 0,
                is_new_device: raw.is_new_device || 0,
                session_duration_seconds: raw.session_duration_seconds || 0,
                failed_login_attempts: raw.failed_login_attempts || 0,
                is_proxy_ip: raw.is_proxy_ip || 0,
                ip_risk_score: raw.ip_risk_score || 0,
                country_mismatch: raw.country_mismatch || 0,
                account_age_days: raw.account_age_days || 0,
                tx_count_24h: raw.tx_count_24h || 0,
                is_new_recipient: raw.is_new_recipient || 0,
                established_user_new_recipient: raw.established_user_new_recipient || 0,
                recipient_risk_profile_score: raw.recipient_risk_profile_score || 0,
                is_fraud: raw.isDefective ? 1 : 0,
                action_taken: tunedDecision === 'REJECT' ? 'BLOCK' : tunedDecision === 'REVIEW' ? 'FLAG' : 'APPROVE',
                ml_risk_score: (tunedScore / 100),
                sender_balance_before: raw.sender_balance_before || 0,
                sender_balance_after: raw.sender_balance_after || 0,
                receiver_balance_before: raw.receiver_balance_before || 0,
                receiver_balance_after: raw.receiver_balance_after || 0,
                currency: raw.currency || 'Units',
                country: raw.country || 'Node-Alpha',
                device_type: raw.deviceType || 'Station-1',
              }),
            }).catch(() => {})
          } catch {}

        } else if (res.status === 503) {
          const errorTx = {
            ...raw,
            decision: 'REJECT',
            riskLevel: 'HIGH',
            reasons: ['Engine Unavailable (503)'],
            scoredByBackend: false,
          }
          setAllUnits(prev => [errorTx, ...prev].slice(0, 500))
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
  const clearData = useCallback(async () => {
    setAllUnits([])
    try {
      await fetch('http://localhost:8000/api/v1/reset-stats', { method: 'POST' })
    } catch (err) {
      console.error('Failed to reset backend stats:', err)
    }
  }, [])

  const units = allUnits.slice(0, 50)
  const displayTotal = backendStats?.total_transactions ?? allUnits.length
  const displayPassed = backendStats?.approved ?? allUnits.filter(t => t.decision === 'PASS').length
  const displayReviewed = backendStats?.flagged ?? allUnits.filter(t => t.decision === 'REVIEW').length
  const displayRejected = backendStats?.blocked ?? allUnits.filter(t => t.decision === 'REJECT').length

  const total = displayTotal
  const approved = displayPassed
  const flagged = displayReviewed
  const blocked = displayRejected

  const avgLatency = useMemo(() => {
    if (allUnits.length === 0) return 0
    return Math.round(allUnits.reduce((s, t) => s + (t.latencyMs || 0), 0) / allUnits.length)
  }, [allUnits])

  const matrix = useMemo(() => {
    let tp = 0, fp = 0, fn = 0, tn = 0
    allUnits.forEach(t => {
      const predicted = t.decision !== 'PASS'
      if (predicted && t.isDefective) tp++
      else if (predicted && !t.isDefective) fp++
      else if (!predicted && t.isDefective) fn++
      else tn++
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
    return (scored.filter(t => !t.reasons.includes('Normal behavior pattern')).length / scored.length) * 100
  }, [allUnits])

  const modelDisagreements = useMemo(() => {
    return allUnits
      .filter(t => t.lgbScore != null && t.isoScore != null)
      .filter(t => Math.abs(t.lgbScore - t.isoScore) > 0.3)
      .map(t => ({
        id: t.unit_id || t.id,
        amount: t.amount,
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
