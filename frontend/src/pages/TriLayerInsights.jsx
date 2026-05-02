import React, { useState, useMemo } from 'react'
import { Activity, AlertTriangle, ShieldCheck, Play, Pause, Zap, RefreshCw, Search, Target, Scale } from 'lucide-react'
import clsx from 'clsx'
import Panel from '../components/shared/Panel'
import { pearsonCorrelation, calcAgreementMatrix, rescore, calcMetrics, calcThresholdCurve, PHYSICS_RULES, FEATURE_MAP } from '../utils/modelAnalytics'

export default function TriLayerInsights({ engine }) {
  const allUnits = engine?.allUnits || []
  const { isRunning, setIsRunning, triggerExcursionBurst, resetParams } = engine || {}

  const [weights, setWeights] = useState({ lgb: 0.55, iso: 0.25, beh: 0.20 })
  const [thresholds, setThresholds] = useState({ approve: 35, block: 65 })

  const handleWeightChange = (key, value) => {
    let nv = Math.max(0, Math.min(100, value)) / 100
    setWeights(prev => {
      const others = Object.keys(prev).filter(k => k !== key)
      const delta = nv - prev[key]
      const oSum = prev[others[0]] + prev[others[1]]
      const next = { ...prev, [key]: nv }
      if (oSum === 0) { next[others[0]] = (1 - nv) / 2; next[others[1]] = (1 - nv) / 2 }
      else { next[others[0]] = Math.max(0, prev[others[0]] - delta * (prev[others[0]] / oSum)); next[others[1]] = Math.max(0, prev[others[1]] - delta * (prev[others[1]] / oSum)) }
      const tot = next.lgb + next.iso + next.beh
      return { lgb: next.lgb / tot, iso: next.iso / tot, beh: next.beh / tot }
    })
  }

  // Top stats
  const topStats = useMemo(() => {
    const lgbAvg = allUnits.length ? allUnits.reduce((s, t) => s + (t.lgbScore || 0), 0) / allUnits.length : 0
    const isoRate = allUnits.length ? allUnits.filter(t => (t.isoScore || 0) > 0.5).length / allUnits.length : 0
    const behRate = allUnits.length ? allUnits.filter(t => (t.behScore || 0) > 0.2).length / allUnits.length : 0
    const disRate = allUnits.length ? allUnits.filter(t => Math.abs((t.lgbScore || 0) - (t.isoScore || 0)) > 0.3).length / allUnits.length : 0
    return { lgbAvg, isoRate, behRate, disRate }
  }, [allUnits])

  // Live sim metrics
  const sim = useMemo(() => {
    let approve = 0, flag = 0, block = 0
    allUnits.forEach(t => {
      const { dec } = rescore(t, weights, thresholds)
      if (dec === 'PASS') approve++; else if (dec === 'REVIEW') flag++; else block++
    })
    const len = allUnits.length || 1
    const m = calcMetrics(allUnits, weights, thresholds)
    return { approve, flag, block, approvePct: (approve / len) * 100, flagPct: (flag / len) * 100, blockPct: (block / len) * 100, ...m }
  }, [allUnits, weights, thresholds])

  // Agreement matrix
  const matrix = useMemo(() => calcAgreementMatrix(allUnits), [allUnits])

  // Physics rules breakdown
  const ruleData = useMemo(() => PHYSICS_RULES.map(r => {
    let triggered = 0, riskTrig = 0, riskNot = 0
    allUnits.forEach(t => {
      const risk = t.ensembleScore || 0
      if (r.trigger(t)) { triggered++; riskTrig += risk } else { riskNot += risk }
    })
    const not = allUnits.length - triggered
    return { ...r, pct: allUnits.length ? (triggered / allUnits.length) * 100 : 0, avgTrig: triggered ? (riskTrig / triggered) * 100 : 0, avgNot: not ? (riskNot / not) * 100 : 0 }
  }), [allUnits])

  // Feature correlations
  const featureCorrs = useMemo(() => {
    const scores = allUnits.map(t => t.ensembleScore || 0)
    return FEATURE_MAP.map(f => {
      const vals = allUnits.map(t => t[f.key] ?? 0)
      return { ...f, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, corr: pearsonCorrelation(vals, scores) }
    }).sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))
  }, [allUnits])

  // Top disagreements
  const topDisagreements = useMemo(() => [...allUnits]
    .filter(t => t.lgbScore != null && t.isoScore != null)
    .map(t => ({ ...t, delta: Math.abs((t.lgbScore || 0) - (t.isoScore || 0)) }))
    .sort((a, b) => b.delta - a.delta).slice(0, 8), [allUnits])

  // Threshold curve for the chart
  const thresholdCurve = useMemo(() => calcThresholdCurve(allUnits, weights), [allUnits, weights])

  // Reclassification counts
  const reclassified = useMemo(() => {
    let toApprove = 0, toBlock = 0
    allUnits.forEach(u => {
      const original = u.decision
      const { dec } = rescore(u, weights, thresholds)
      if (original === 'REJECT' && dec === 'PASS') toApprove++
      if (original === 'PASS' && dec === 'REJECT') toBlock++
    })
    return { toApprove, toBlock }
  }, [allUnits, weights, thresholds])


  const MetricBar = ({ value, label, reverse }) => {
    let color = reverse ? (value <= 0.1 ? 'bg-emerald-400' : value <= 0.3 ? 'bg-amber-400' : 'bg-red-400') : (value >= 0.8 ? 'bg-emerald-400' : value >= 0.5 ? 'bg-amber-400' : 'bg-red-400')
    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex justify-between items-end">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{label}</span>
          <span className="font-sans text-xs font-black text-slate-700">{(value * 100).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 w-full rounded-full overflow-hidden">
          <div className={clsx("h-full rounded-full", color)} style={{ width: `${Math.min(value * 100, 100)}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 font-sans pb-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-wider text-slate-800 uppercase">Model Insights</h1>
          <p className="text-xs text-slate-400 tracking-widest uppercase mt-1">Tri-Shield Ensemble · LightGBM + IsoForest + Physics Rules</p>
        </div>
        <div className="flex gap-2">
          {setIsRunning && <button onClick={() => setIsRunning(!isRunning)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100">{isRunning ? <Pause size={12}/> : <Play size={12}/>}{isRunning ? 'Pause' : 'Resume'}</button>}
          {triggerExcursionBurst && <button onClick={triggerExcursionBurst} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"><Zap size={12}/>Excursion Burst</button>}
        </div>
      </div>

      {/* TOP STATS */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Shield 1 Avg Score', value: (topStats.lgbAvg * 100).toFixed(1) + '%', sub: 'LightGBM defect probability', color: '#2563eb' },
          { label: 'Shield 2 Anomaly Rate', value: (topStats.isoRate * 100).toFixed(1) + '%', sub: '% units where ISO > 0.5', color: '#7c3aed' },
          { label: 'Shield 3 Rule Hit Rate', value: (topStats.behRate * 100).toFixed(1) + '%', sub: '% where physics rules fired', color: '#d97706' },
          { label: 'Model Disagreement', value: (topStats.disRate * 100).toFixed(1) + '%', sub: '% where |S1 - S2| > 0.3', color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4" style={{ borderLeftWidth: 4, borderLeftColor: s.color }}>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{s.label}</p>
            <p className="text-2xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[9px] text-slate-400 mt-1 tracking-wider font-bold">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* LEFT: Ensemble Controls */}
        <div className="col-span-3 space-y-4">
          <Panel title="Ensemble Controls">
            <div className="space-y-5 pt-2">
              <div>
                <h3 className="text-[10px] text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1 font-bold">Live Weight Tuner</h3>
                {[
                  { key: 'lgb', label: 'Shield 1 (LGB)', color: '#2563eb' },
                  { key: 'iso', label: 'Shield 2 (ISO)', color: '#7c3aed' },
                  { key: 'beh', label: 'Shield 3 (Physics)', color: '#d97706' },
                ].map(s => (
                  <div key={s.key} className="space-y-1 mb-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-black uppercase tracking-widest" style={{ color: s.color }}>{s.label}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black" style={{ color: s.color, backgroundColor: s.color + '15' }}>{weights[s.key].toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="100" value={weights[s.key] * 100} onChange={e => handleWeightChange(s.key, Number(e.target.value))} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200" style={{ accentColor: s.color }} />
                  </div>
                ))}
              </div>

              {/* Live counts */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                {[
                  { label: 'APPROVE', val: sim.approve, pct: sim.approvePct, color: '#10b981' },
                  { label: 'FLAG', val: sim.flag, pct: sim.flagPct, color: '#f59e0b' },
                  { label: 'BLOCK', val: sim.block, pct: sim.blockPct, color: '#ef4444' },
                ].map(d => (
                  <div key={d.label} className="flex justify-between items-center bg-white border border-slate-100 p-2 rounded-lg">
                    <span className="text-[10px] tracking-wider font-bold" style={{ color: d.color }}>{d.label}</span>
                    <div className="flex gap-2 items-center">
                      <span className="font-black" style={{ color: d.color }}>{d.val}</span>
                      <span className="text-[9px] w-10 text-right" style={{ color: d.color + '80' }}>({d.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Thresholds */}
              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-[10px] text-slate-400 uppercase tracking-widest mb-3 font-bold">Decision Thresholds</h3>
                {[
                  { key: 'approve', label: 'Approve', color: '#10b981' },
                  { key: 'block', label: 'Block', color: '#ef4444' },
                ].map(t => (
                  <div key={t.key} className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs"><span style={{ color: t.color }} className="tracking-wider font-bold">{t.label} Thresh</span><span style={{ color: t.color }} className="font-black">{thresholds[t.key]}</span></div>
                    <input type="range" min="10" max="90" value={thresholds[t.key]} onChange={e => setThresholds(p => ({ ...p, [t.key]: Number(e.target.value) }))} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200" style={{ accentColor: t.color }} />
                  </div>
                ))}
              </div>

              {/* Confusion Matrix */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl grid grid-cols-2 gap-2">
                <MetricBar label="Precision" value={sim.p} />
                <MetricBar label="Recall" value={sim.r} />
                <MetricBar label="FP Rate" value={sim.fp} reverse />
                <MetricBar label="F1 Score" value={sim.f} />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center"><p className="text-[8px] text-emerald-500 uppercase tracking-wider font-bold">True Neg</p><p className="text-lg font-black text-emerald-600">{sim.TN}</p></div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center"><p className="text-[8px] text-amber-500 uppercase tracking-wider font-bold">False Pos</p><p className="text-lg font-black text-amber-600">{sim.FP}</p></div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center"><p className="text-[8px] text-red-500 uppercase tracking-wider font-bold">False Neg</p><p className="text-lg font-black text-red-600">{sim.FN}</p></div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center"><p className="text-[8px] text-blue-500 uppercase tracking-wider font-bold">True Pos</p><p className="text-lg font-black text-blue-600">{sim.TP}</p></div>
              </div>
            </div>
          </Panel>
        </div>

        {/* RIGHT: 4 Sections */}
        <div className="col-span-9 space-y-4">
          {/* 1: Model Agreement Matrix */}
          <Panel title="Shield Agreement Matrix">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col items-center relative overflow-hidden">
                <ShieldCheck className="absolute -left-2 -bottom-2 w-20 h-20 text-emerald-200" strokeWidth={1}/>
                <p className="text-[11px] uppercase tracking-widest mb-1 text-emerald-600 font-black z-10">Both Agree Safe</p>
                <p className="text-3xl font-black text-emerald-600 z-10">{matrix.bothSafe}</p>
                <p className="text-[10px] mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-600 font-bold z-10">{matrix.pctBothSafe.toFixed(1)}%</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col items-center">
                <p className="text-[11px] uppercase tracking-widest mb-1 text-amber-600 font-black">⚠ ISO flags, LGB misses</p>
                <p className="text-3xl font-black text-amber-600">{matrix.isoFlags}</p>
                <p className="text-[10px] mt-1 px-2 py-0.5 rounded bg-amber-100 text-amber-600 font-bold">{matrix.pctIso.toFixed(1)}%</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col items-center">
                <p className="text-[11px] uppercase tracking-widest mb-1 text-amber-600 font-black">⚠ LGB flags, ISO misses</p>
                <p className="text-3xl font-black text-amber-600">{matrix.lgbFlags}</p>
                <p className="text-[10px] mt-1 px-2 py-0.5 rounded bg-amber-100 text-amber-600 font-bold">{matrix.pctLgb.toFixed(1)}%</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col items-center">
                <p className="text-[11px] uppercase tracking-widest mb-1 text-red-600 font-black">🚨 Both Agree Defective</p>
                <p className="text-3xl font-black text-red-600">{matrix.bothDefect}</p>
                <p className="text-[10px] mt-1 px-2 py-0.5 rounded bg-red-100 text-red-600 font-bold">{matrix.pctBothDefect.toFixed(1)}%</p>
              </div>
            </div>
            <div className="text-center pt-2">
              <span className="text-xs uppercase tracking-widest text-amber-600 font-black px-4 py-1.5 rounded-full border border-amber-200 bg-amber-50">{matrix.disagree} units need review (shields disagree)</span>
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-4">
            {/* 2: Physics Rule Breakdown */}
            <Panel title="Shield 3 Rule Breakdown">
              <div className="space-y-4 pt-2">
                {ruleData.map(r => (
                  <div key={r.id}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: r.color + '15', color: r.color, border: `1px solid ${r.color}40` }}>{r.weight}</span>
                        <span className="text-xs font-black text-slate-700">{r.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{r.pct.toFixed(1)}% triggered</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mb-1.5 ml-1 italic font-bold">{r.features}</p>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, backgroundColor: r.color }} />
                    </div>
                    <div className="flex justify-between text-[9px] uppercase tracking-wider px-1 bg-slate-50 border border-slate-100 py-1 rounded font-bold">
                      <span className="text-slate-500">Risk when triggered: <span className="text-red-500 font-black">{r.avgTrig.toFixed(1)}%</span></span>
                      <span className="text-slate-500">When not: <span className="text-emerald-500 font-black">{r.avgNot.toFixed(1)}%</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* 3: Feature Correlation */}
            <Panel title="Feature → Risk Correlation" className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto -mr-2 pr-2">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2 text-[9px] uppercase tracking-widest text-slate-400 font-bold">Feature</th>
                      <th className="py-2 text-[9px] uppercase tracking-widest text-slate-400 font-bold text-right w-14">Avg</th>
                      <th className="py-2 text-[9px] uppercase tracking-widest text-slate-400 font-bold text-center w-28">Corr</th>
                      <th className="py-2 text-[9px] uppercase tracking-widest text-slate-400 font-bold text-right">Rule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {featureCorrs.map(f => (
                      <tr key={f.key} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 text-[10px] text-slate-600 truncate max-w-[120px] pr-2 font-bold">{f.label}</td>
                        <td className="py-2.5 text-[10px] text-right text-slate-700 font-bold">{f.avg > 1000 ? (f.avg / 1000).toFixed(1) + 'k' : f.avg.toFixed(2)}</td>
                        <td className="py-2.5 w-28 px-2">
                          <div className="flex items-center justify-center w-full">
                            <div className="w-full h-1.5 bg-slate-100 rounded-full flex relative">
                              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300 z-10" />
                              {f.corr > 0
                                ? <div className="absolute top-0 bottom-0 left-1/2 bg-red-400 rounded-r-full" style={{ width: `${Math.min(f.corr * 100, 50)}%` }} />
                                : <div className="absolute top-0 bottom-0 right-1/2 bg-emerald-400 rounded-l-full" style={{ width: `${Math.min(Math.abs(f.corr) * 100, 50)}%` }} />}
                            </div>
                          </div>
                          <div className="text-[8px] text-center mt-1 text-slate-400 font-bold">{f.corr > 0 ? '+' : ''}{f.corr.toFixed(2)}</div>
                        </td>
                        <td className="py-2.5 text-[9px] uppercase text-right pr-2">
                          <span className="px-1.5 py-0.5 rounded border font-bold" style={{ color: f.color, backgroundColor: f.color + '10', borderColor: f.color + '30' }}>{f.rule}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* CLASSIFICATION METRICS */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Precision', value: sim.p, desc: `${sim.TP} TP / ${sim.TP + sim.FP} Blocked`, color: '#10b981' },
          { label: 'Recall', value: sim.r, desc: `${sim.TP} caught / ${sim.TP + sim.FN} total defects`, color: '#f59e0b' },
          { label: 'F1 Score', value: sim.f, desc: 'Harmonic mean of P & R', color: '#2563eb' },
          { label: 'FP Rate', value: sim.fp, desc: `${sim.FP} false positives`, color: '#ef4444', reverse: true },
        ].map((m, i) => {
          const pct = (m.value * 100)
          const status = m.reverse 
            ? (pct <= 5 ? 'excellent' : pct <= 15 ? 'acceptable' : 'critical')
            : (pct >= 80 ? 'excellent' : pct >= 50 ? 'acceptable' : 'critical')
          const statusColor = status === 'excellent' ? '#10b981' : status === 'acceptable' ? '#f59e0b' : '#ef4444'
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{m.label}</span>
              </div>
              <div className="text-4xl font-black font-sans mb-1" style={{ color: m.color }}>
                {m.label === 'F1 Score' ? m.value.toFixed(3) : `${pct.toFixed(1)}%`}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ color: statusColor, backgroundColor: statusColor + '15' }}>
                  {status}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: m.color }} />
              </div>
              <p className="text-[9px] text-slate-400 font-bold">{m.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Reclassification banner */}
      <div className="text-center">
        <span className="text-xs uppercase tracking-widest font-black text-slate-500">
          {reclassified.toApprove + reclassified.toBlock} reclassified · 
          <span className="text-emerald-500"> {reclassified.toApprove} → Approve</span> · 
          <span className="text-red-500"> {reclassified.toBlock} → Block</span>
        </span>
      </div>

      {/* THRESHOLD VS METRICS CHART */}
      <Panel title="Threshold vs Metrics — How each metric changes across thresholds 0–100">
        <div className="w-full h-[340px] relative">
          <svg viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {/* Grid lines */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
              <g key={v}>
                <line x1="60" y1={260 - v * 240} x2="780" y2={260 - v * 240} stroke="#e2e8f0" strokeWidth="1" />
                <text x="50" y={264 - v * 240} textAnchor="end" className="text-[10px]" fill="#94a3b8" fontSize="10">{v.toFixed(1)}</text>
              </g>
            ))}
            {/* X-axis labels */}
            {[0, 12, 24, 36, 48, 60, 72, 84, 96].map(v => (
              <text key={v} x={60 + (v / 100) * 720} y="280" textAnchor="middle" fill="#94a3b8" fontSize="10">{v}</text>
            ))}
            <text x="420" y="298" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="bold">THRESHOLD</text>

            {/* Metric lines */}
            {[
              { key: 'precision', color: '#10b981', label: 'Precision' },
              { key: 'recall', color: '#f59e0b', label: 'Recall' },
              { key: 'f1', color: '#2563eb', label: 'F1' },
              { key: 'fpRate', color: '#ef4444', label: 'FP Rate' },
            ].map(metric => {
              const pathData = thresholdCurve.map((pt, i) => {
                const x = 60 + (pt.threshold / 100) * 720
                const y = 260 - pt[metric.key] * 240
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
              }).join(' ')
              return <path key={metric.key} d={pathData} fill="none" stroke={metric.color} strokeWidth="2.5" strokeLinejoin="round" />
            })}

            {/* Threshold markers */}
            <line x1={60 + (thresholds.approve / 100) * 720} y1="20" x2={60 + (thresholds.approve / 100) * 720} y2="260" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 3" />
            <rect x={60 + (thresholds.approve / 100) * 720 - 32} y="252" width="64" height="18" rx="4" fill="#f59e0b" />
            <text x={60 + (thresholds.approve / 100) * 720} y="264" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">Approve T={thresholds.approve}</text>

            <line x1={60 + (thresholds.block / 100) * 720} y1="20" x2={60 + (thresholds.block / 100) * 720} y2="260" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 3" />
            <rect x={60 + (thresholds.block / 100) * 720 - 28} y="252" width="56" height="18" rx="4" fill="#ef4444" />
            <text x={60 + (thresholds.block / 100) * 720} y="264" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">Block T={thresholds.block}</text>

            {/* Legend */}
            {[
              { label: 'Precision', color: '#10b981', x: 540 },
              { label: 'Recall', color: '#f59e0b', x: 610 },
              { label: 'F1', color: '#2563eb', x: 670 },
              { label: 'FP Rate', color: '#ef4444', x: 710 },
            ].map(l => (
              <g key={l.label}>
                <circle cx={l.x} cy="12" r="4" fill={l.color} />
                <text x={l.x + 8} y="16" fill="#64748b" fontSize="10" fontWeight="bold">{l.label}</text>
              </g>
            ))}
          </svg>
        </div>
      </Panel>

      {/* DISAGREEMENT CASES TABLE */}
      <Panel title="Shield Disagreement Cases — where LightGBM and IsoForest conflict most">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="py-3 pl-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold w-36">Unit ID</th>
                <th className="py-3 text-[10px] uppercase tracking-widest font-black text-right w-24" style={{ color: '#2563eb' }}>S1 (LGB)</th>
                <th className="py-3 text-[10px] uppercase tracking-widest font-black text-right w-24" style={{ color: '#7c3aed' }}>S2 (ISO)</th>
                <th className="py-3 text-[10px] uppercase tracking-widest font-black text-right w-24" style={{ color: '#d97706' }}>S3 (PHY)</th>
                <th className="py-3 text-[10px] uppercase tracking-widest font-black text-right pr-6 w-28">Decision</th>
                <th className="py-3 text-[10px] uppercase tracking-widest font-black text-center w-28">Delta</th>
                <th className="py-3 text-[10px] uppercase tracking-widest text-slate-400 font-bold pl-4">Reason for Conflict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topDisagreements.map(t => {
                const isHigh = t.delta > 0.5
                return (
                  <tr key={t.unit_id || t.id} className={clsx("hover:bg-slate-50/80 transition-colors", isHigh && "bg-red-50/20")}>
                    <td className="py-3.5 pl-4 text-[11px] text-slate-700 font-bold">
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-mono border border-slate-200">{(t.unit_id || t.id || '').slice(0, 12)}</span>
                    </td>
                    <td className="py-3.5 text-xs text-right font-black" style={{ color: '#2563eb' }}>{((t.lgbScore || 0) * 100).toFixed(1)}%</td>
                    <td className="py-3.5 text-xs text-right font-black" style={{ color: '#7c3aed' }}>{((t.isoScore || 0) * 100).toFixed(1)}%</td>
                    <td className="py-3.5 text-xs text-right font-black" style={{ color: '#d97706' }}>{((t.behScore || 0) * 100).toFixed(1)}%</td>
                    <td className="py-3.5 text-[10px] text-right pr-6">
                      <span className={clsx("px-2.5 py-1 rounded-md font-black uppercase tracking-wider",
                        t.decision === 'REJECT' ? 'text-red-600 bg-red-50 border border-red-100' : t.decision === 'REVIEW' ? 'text-amber-600 bg-amber-50 border border-amber-100' : 'text-emerald-600 bg-emerald-50 border border-emerald-100'
                      )}>{t.decision}</span>
                    </td>
                    <td className={clsx("py-3.5 text-xs text-center font-black", isHigh ? 'text-red-500' : t.delta > 0.3 ? 'text-amber-500' : 'text-emerald-500')}>
                      ±{(t.delta * 100).toFixed(1)}%
                    </td>
                    <td className="py-3.5 text-[10px] text-slate-500 pl-4 font-bold tracking-tight">
                      {t.reasons?.join(' | ') || 'No explicit physics signal'}
                    </td>
                  </tr>
                )
              })}
              {topDisagreements.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-xs text-slate-400 font-bold uppercase tracking-widest">Waiting for conflicting signals from Tri-Shield...</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
