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
    <div className="max-w-[1400px] mx-auto space-y-6 font-sans pb-12 text-slate-200">
      <svg width="0" height="0">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-[0.2em] text-white uppercase drop-shadow-sm">Model Insights</h1>
          <p className="text-[10px] text-slate-400 tracking-[0.3em] uppercase mt-2">Tri-Shield Ensemble · LightGBM + IsoForest + Physics Rules</p>
        </div>
        <div className="flex gap-3">
          {setIsRunning && (
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                isRunning
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                  : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
              )}
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
              {isRunning ? 'Pause Engine' : 'Resume Engine'}
            </button>
          )}
          {triggerExcursionBurst && (
            <button onClick={triggerExcursionBurst} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-all">
              <Zap size={14} />
              Excursion Burst
            </button>
          )}
        </div>
      </div>

      {/* PRIMARY GROUND TRUTH METRICS (Glassmorphism Redesign) */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Precision', value: sim.p, delta: '+1.2%', desc: `${sim.TP} TP / ${sim.TP + sim.FP} Blocked`, color: '#10b981' },
          { label: 'Recall', value: sim.r, delta: '+0.5%', desc: `${sim.TP} caught / ${sim.TP + sim.FN} total defects`, color: '#f59e0b' },
          { label: 'F1 Score', value: sim.f, delta: '-0.2%', desc: 'Harmonic mean of P & R', color: '#2563eb' },
          { label: 'FP Rate', value: sim.fp, delta: '-0.8%', desc: `${sim.FP} false positives`, color: '#ef4444', reverse: true },
        ].map((m, i) => {
          const pct = (m.value * 100)
          return (
            <div key={i} className="bg-slate-900/40 backdrop-blur-md rounded-[24px] border transition-all p-6 group hover:bg-slate-900/60" style={{ borderColor: m.color + '30' }}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black">{m.label}</span>
                <div className="flex items-center gap-1 text-[10px] font-black" style={{ color: m.color }}>
                  <span>{m.delta}</span>
                  <Activity size={10} className={m.delta.startsWith('+') ? "animate-pulse" : ""} />
                </div>
              </div>
              <div className="text-4xl font-black font-mono mb-2 text-white">
                {m.label === 'F1 Score' ? m.value.toFixed(3) : `${pct.toFixed(1)}%`}
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4 border border-white/5">
                <div className="h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: m.color }} />
              </div>
              <p className="text-[10px] text-slate-500 font-bold tracking-tight">{m.desc}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* LEFT: Ensemble Controls */}
        <div className="col-span-3 space-y-4">
          <Panel title="Ensemble Controls" className="bg-slate-900/40 border-white/10 text-white">
            <div className="space-y-6 pt-2">
              <div className="space-y-4">
                <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-4 border-b border-white/5 pb-2 font-black text-center">Live Weight Tuner</h3>
                {[
                  { key: 'lgb', label: 'Shield 1 (LGB)', color: '#2563eb', shadow: 'rgba(37,99,235,0.4)' },
                  { key: 'iso', label: 'Shield 2 (ISO)', color: '#7c3aed', shadow: 'rgba(124,58,237,0.4)' },
                  { key: 'beh', label: 'Shield 3 (Physics)', color: '#d97706', shadow: 'rgba(217,119,6,0.4)' },
                ].map(s => (
                  <div key={s.key} className="space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-black uppercase tracking-widest text-slate-400">{s.label}</span>
                      <span className="px-2 py-0.5 rounded-full font-mono font-black border border-white/10 bg-white/5" style={{ color: s.color }}>{weights[s.key].toFixed(2)}</span>
                    </div>
                    <div className="relative h-6 flex items-center">
                      <div className="absolute w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${weights[s.key] * 100}%`, backgroundColor: s.color, boxShadow: `0 0 12px ${s.shadow}` }} />
                      </div>
                      <input
                        type="range" min="0" max="100" value={weights[s.key] * 100}
                        onChange={e => handleWeightChange(s.key, Number(e.target.value))}
                        className="absolute w-full h-1 bg-transparent appearance-none cursor-pointer z-10 accent-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Live counts (Glassmorphic Treatment) */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3 shadow-inner">
                {[
                  { label: 'APPROVE', val: sim.approve, pct: sim.approvePct, color: '#10b981' },
                  { label: 'FLAG', val: sim.flag, pct: sim.flagPct, color: '#f59e0b' },
                  { label: 'BLOCK', val: sim.block, pct: sim.blockPct, color: '#ef4444' },
                ].map(d => (
                  <div key={d.label} className="flex justify-between items-center bg-black/20 border border-white/5 p-2.5 rounded-xl transition-all hover:bg-black/40">
                    <span className="text-[9px] tracking-[0.2em] font-black" style={{ color: d.color }}>{d.label}</span>
                    <div className="flex gap-3 items-center">
                      <span className="font-mono font-black text-xs text-white">{d.val}</span>
                      <span className="text-[9px] w-10 text-right font-bold" style={{ color: d.color }}>{d.pct.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Thresholds */}
              <div className="pt-4 border-t border-white/5">
                <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-4 font-black text-center">Decision Thresholds</h3>
                {[
                  { key: 'approve', label: 'Approve', color: '#10b981' },
                  { key: 'block', label: 'Block', color: '#ef4444' },
                ].map(t => (
                  <div key={t.key} className="space-y-2 mb-4">
                    <div className="flex justify-between text-[10px]">
                      <span className="tracking-[0.2em] font-black uppercase text-slate-400">{t.label} Thresh</span>
                      <span style={{ color: t.color }} className="font-mono font-black">{thresholds[t.key]}</span>
                    </div>
                    <div className="relative h-6 flex items-center">
                      <div className="absolute w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${thresholds[t.key]}%`, backgroundColor: t.color, boxShadow: `0 0 10px ${t.color}60` }} />
                      </div>
                      <input type="range" min="10" max="90" value={thresholds[t.key]} onChange={e => setThresholds(p => ({ ...p, [t.key]: Number(e.target.value) }))} className="absolute w-full h-1 bg-transparent appearance-none cursor-pointer z-10 accent-white" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Centered Diagnostic Boxes (Glassmorphic) */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                {[
                  { label: 'True Neg', val: sim.TN, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
                  { label: 'False Pos', val: sim.FP, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
                  { label: 'False Neg', val: sim.FN, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
                  { label: 'True Pos', val: sim.TP, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
                ].map(box => (
                  <div key={box.label} className={clsx("rounded-xl p-3 text-center border backdrop-blur-sm", box.bg, box.border)}>
                    <p className="text-[8px] uppercase tracking-widest font-black text-slate-400 mb-1">{box.label}</p>
                    <p className={clsx("text-xl font-black font-mono", box.color)}>{box.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* RIGHT: 4 Sections */}
        <div className="col-span-9 space-y-4">
          {/* 1: Model Agreement Matrix */}
          <Panel title="Shield Agreement Matrix" className="bg-slate-900/40 border-white/10">
            <div className="grid grid-cols-2 gap-4 mb-6 h-64">
              {[
                { title: 'Both Agree Safe', val: matrix.bothSafe, pct: matrix.pctBothSafe, color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
                { title: 'ISO flags, LGB misses', val: matrix.isoFlags, pct: matrix.pctIso, color: 'text-amber-500', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
                { title: 'LGB flags, ISO misses', val: matrix.lgbFlags, pct: matrix.pctLgb, color: 'text-amber-500', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
                { title: 'Both Agree Defective', val: matrix.bothDefect, pct: matrix.pctBothDefect, color: 'text-red-500', bg: 'bg-red-500/5', border: 'border-red-500/20' },
              ].map((q, idx) => (
                <div key={idx} className={clsx("rounded-2xl border p-6 flex flex-col items-center justify-center relative overflow-hidden transition-all hover:scale-[1.02]", q.bg, q.border)}>
                  <ShieldCheck className="absolute -left-4 -bottom-4 w-24 h-24 text-white opacity-[0.03] rotate-12" strokeWidth={1} />
                  <p className="text-[10px] uppercase tracking-[0.2em] mb-2 text-slate-400 font-black z-10 text-center">{q.title}</p>
                  <p className={clsx("text-4xl font-black z-10 font-mono", q.color)}>{q.val}</p>
                  <p className={clsx("text-[10px] mt-2 px-3 py-1 rounded-full font-black z-10 border", q.border, q.color)}>{q.pct.toFixed(1)}%</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <span className="text-[10px] uppercase tracking-[0.3em] text-amber-500 font-black px-6 py-2.5 rounded-full border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm shadow-lg shadow-amber-500/5">
                {matrix.disagree} units need review (Shield Disagreement Detected)
              </span>
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-4">
            {/* 2: Physics Rule Breakdown */}
            <Panel title="Shield 3 Rule Breakdown" className="bg-slate-900/40 backdrop-blur-md border-white/10">
              <div className="space-y-4 pt-2">
                {ruleData.map(r => (
                  <div key={r.id}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: r.color + '15', color: r.color, border: `1px solid ${r.color}40` }}>{r.weight}</span>
                        <span className="text-xs font-black text-slate-200">{r.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{r.pct.toFixed(1)}% triggered</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mb-1.5 ml-1 italic font-bold">{r.features}</p>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, backgroundColor: r.color }} />
                    </div>
                    <div className="flex justify-between text-[9px] uppercase tracking-wider px-2 bg-white/5 border border-white/5 py-1.5 rounded font-bold">
                      <span className="text-slate-400">Risk when triggered: <span className="text-red-500 font-black">{r.avgTrig.toFixed(1)}%</span></span>
                      <span className="text-slate-400">When not: <span className="text-emerald-500 font-black">{r.avgNot.toFixed(1)}%</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* 3: Feature Correlation */}
            <Panel title="Feature → Risk Correlation" className="flex flex-col h-full overflow-hidden bg-slate-900/40 backdrop-blur-md border-white/10">
              <div className="flex-1 overflow-y-auto -mr-2 pr-2">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10 border-b border-white/10">
                    <tr>
                      <th className="py-2 text-[9px] uppercase tracking-widest text-slate-400 font-bold">Feature</th>
                      <th className="py-2 text-[9px] uppercase tracking-widest text-slate-400 font-bold text-right w-14">Avg</th>
                      <th className="py-2 text-[9px] uppercase tracking-widest text-slate-400 font-bold text-center w-28">Corr</th>
                      <th className="py-2 text-[9px] uppercase tracking-widest text-slate-400 font-bold text-right">Rule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {featureCorrs.map(f => (
                      <tr key={f.key} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 text-[10px] text-slate-300 truncate max-w-[120px] pr-2 font-bold">{f.label}</td>
                        <td className="py-2.5 text-[10px] text-right text-slate-200 font-bold">{f.avg > 1000 ? (f.avg / 1000).toFixed(1) + 'k' : f.avg.toFixed(2)}</td>
                        <td className="py-2.5 w-28 px-2">
                          <div className="flex items-center justify-center w-full">
                            <div className="w-full h-1.5 bg-white/5 rounded-full flex relative">
                              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20 z-10" />
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

      {/* Reclassification banner */}
      <div className="text-center py-4 border-t border-white/5">
        <span className="text-[10px] uppercase tracking-[0.4em] font-black text-slate-500">
          Ensemble Reclassification Logic:
          <span className="text-white ml-2">{reclassified.toApprove + reclassified.toBlock} Units Re-Evaluated</span> ·
          <span className="text-emerald-500"> {reclassified.toApprove} → Auto-Approve</span> ·
          <span className="text-red-500"> {reclassified.toBlock} → Auto-Block</span>
        </span>
      </div>

      {/* THRESHOLD VS METRICS CHART */}
      {/* THRESHOLD VS METRICS CHART (Neon Redesign) */}
      <Panel title="Ensemble Sensitivity Profile — Precision/Recall Tradeoff Curves" className="bg-slate-900/40 border-white/10">
        <div className="w-full h-[400px] relative pt-8">
          <svg viewBox="0 0 800 300" className="w-full h-full bg-transparent" preserveAspectRatio="xMidYMid meet">
            {/* Grid lines */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
              <g key={v}>
                <line x1="60" y1={260 - v * 240} x2="780" y2={260 - v * 240} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x="50" y={264 - v * 240} textAnchor="end" className="text-[9px] font-mono" fill="#475569" fontSize="10">{v.toFixed(1)}</text>
              </g>
            ))}
            {/* X-axis labels */}
            {[0, 20, 40, 60, 80, 100].map(v => (
              <text key={v} x={60 + (v / 100) * 720} y="285" textAnchor="middle" fill="#475569" fontSize="10" className="font-mono">{v}%</text>
            ))}
            <text x="420" y="305" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="black" className="tracking-[0.5em] uppercase">Threshold Percentage</text>

            {/* Metric lines with Glow */}
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
              return <path key={metric.key} d={pathData} fill="none" stroke={metric.color} strokeWidth="3" strokeLinejoin="round" filter="url(#glow)" className="transition-all duration-500 opacity-80 hover:opacity-100" />
            })}

            {/* Decision Markers (Pinned Tags Redesign) */}
            <g>
              <line x1={60 + (thresholds.approve / 100) * 720} y1="20" x2={60 + (thresholds.approve / 100) * 720} y2="260" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" />
              <path d={`M ${60 + (thresholds.approve / 100) * 720} 260 L ${60 + (thresholds.approve / 100) * 720 - 40} 290 L ${60 + (thresholds.approve / 100) * 720 + 40} 290 Z`} fill="#f59e0b" opacity="0.1" />
              <rect x={60 + (thresholds.approve / 100) * 720 - 35} y="235" width="70" height="20" rx="4" fill="#f59e0b" />
              <text x={60 + (thresholds.approve / 100) * 720} y="248" textAnchor="middle" fill="white" fontSize="9" fontWeight="black" className="uppercase tracking-tighter">APPROVE: {thresholds.approve}</text>
            </g>

            <g>
              <line x1={60 + (thresholds.block / 100) * 720} y1="20" x2={60 + (thresholds.block / 100) * 720} y2="260" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />
              <path d={`M ${60 + (thresholds.block / 100) * 720} 260 L ${60 + (thresholds.block / 100) * 720 - 40} 290 L ${60 + (thresholds.block / 100) * 720 + 40} 290 Z`} fill="#ef4444" opacity="0.1" />
              <rect x={60 + (thresholds.block / 100) * 720 - 30} y="235" width="60" height="20" rx="4" fill="#ef4444" />
              <text x={60 + (thresholds.block / 100) * 720} y="248" textAnchor="middle" fill="white" fontSize="9" fontWeight="black" className="uppercase tracking-tighter">BLOCK: {thresholds.block}</text>
            </g>

            {/* Legend */}
            {[
              { label: 'Precision', color: '#10b981', x: 500 },
              { label: 'Recall', color: '#f59e0b', x: 580 },
              { label: 'F1', color: '#2563eb', x: 650 },
              { label: 'FP Rate', color: '#ef4444', x: 700 },
            ].map(l => (
              <g key={l.label}>
                <circle cx={l.x} cy="10" r="4" fill={l.color} filter="url(#glow)" />
                <text x={l.x + 10} y="14" fill="#94a3b8" fontSize="9" fontWeight="black" className="uppercase tracking-widest">{l.label}</text>
              </g>
            ))}
          </svg>
        </div>
      </Panel>

      {/* DISAGREEMENT CASES TABLE */}
      {/* DISAGREEMENT CASES TABLE (Industrial Redesign) */}
      <Panel title="Shield Disagreement Cases — Outlier Analysis & Conflict Resolution" className="bg-slate-900/40 border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-white/5">
              <tr>
                <th className="py-4 pl-6 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black w-36">Unit ID</th>
                <th className="py-4 text-[10px] uppercase tracking-[0.2em] font-black text-right w-24" style={{ color: '#2563eb' }}>S1 (LGB)</th>
                <th className="py-4 text-[10px] uppercase tracking-[0.2em] font-black text-right w-24" style={{ color: '#7c3aed' }}>S2 (ISO)</th>
                <th className="py-4 text-[10px] uppercase tracking-[0.2em] font-black text-right w-24" style={{ color: '#d97706' }}>S3 (PHY)</th>
                <th className="py-4 text-[10px] uppercase tracking-[0.2em] font-black text-right pr-6 w-28">Decision</th>
                <th className="py-4 text-[10px] uppercase tracking-[0.2em] font-black text-center w-28">Delta (%)</th>
                <th className="py-4 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black pl-6">Conflict Attribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {topDisagreements.map((t, idx) => {
                const deltaPct = t.delta * 100
                const isCriticalDelta = deltaPct > 50
                return (
                  <tr key={t.unit_id || t.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 pl-6 text-[11px] text-slate-300 font-black">
                      <span className="bg-white/5 px-2.5 py-1 rounded-md font-mono border border-white/10 group-hover:border-white/20 transition-all">{(t.unit_id || t.id || '').slice(0, 12)}</span>
                    </td>
                    <td className="py-4 text-xs text-right font-black" style={{ color: '#2563eb' }}>{((t.lgbScore || 0) * 100).toFixed(1)}%</td>
                    <td className="py-4 text-xs text-right font-black" style={{ color: '#7c3aed' }}>{((t.isoScore || 0) * 100).toFixed(1)}%</td>
                    <td className="py-4 text-xs text-right font-black" style={{ color: '#d97706' }}>{((t.behScore || 0) * 100).toFixed(1)}%</td>
                    <td className="py-4 text-[10px] text-right pr-6">
                      <span className={clsx("px-3 py-1 rounded-full font-black uppercase tracking-widest border",
                        t.decision === 'REJECT' ? 'text-red-500 border-red-500/30 bg-red-500/10' : t.decision === 'REVIEW' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' : 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                      )}>{t.decision}</span>
                    </td>
                    <td className="py-4 text-center">
                      <span className={clsx(
                        "px-3 py-1 rounded-md text-xs font-black font-mono inline-block min-w-[70px]",
                        isCriticalDelta ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" : deltaPct > 30 ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"
                      )}>
                        ±{deltaPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 text-[10px] text-slate-400 pl-6 font-black tracking-tight italic opacity-80 group-hover:opacity-100 transition-opacity">
                      {t.reasons?.join(' | ') || 'No explicit physics signal detected'}
                    </td>
                  </tr>
                )
              })}
              {topDisagreements.length === 0 && <tr><td colSpan={7} className="text-center py-20 text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] bg-white/[0.02]">Syncing Conflict Trajectories...</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
