import React, { useState } from 'react'
import { 
  Beaker, RefreshCw, Play, BarChart2, CheckCircle, 
  AlertTriangle, Sparkles, Database, ShieldAlert 
} from 'lucide-react'
import clsx from 'clsx'

const SENSOR_NOMINALS = {
  bond_force: 30.0,
  epoxy_viscosity: 5000,
  ultrasonic_power: 1.2,
  bond_time: 15.0,
  transfer_pressure: 8.0,
  molding_temp: 180,
  reflow_peak_temp: 245,
  spindle_current: 2.0
}

export default function ParameterLab() {
  const [isScoring, setIsScoring] = useState(false)
  const [result, setResult] = useState(null)
  
  // Parameter State for What-If Analysis
  const [params, setParams] = useState({
    bond_force: 30.0,
    epoxy_viscosity: 5000,
    ultrasonic_power: 1.2,
    bond_time: 15.0,
    transfer_pressure: 8.0,
    molding_temp: 180,
    reflow_peak_temp: 265, // Start with a 'bad' value to show off optimization
    spindle_current: 2.0
  })

  const handleParamChange = (key, val) => {
    setParams(prev => ({ ...prev, [key]: parseFloat(val) || 0 }))
  }

  const handleScore = () => {
    setIsScoring(true)
    setTimeout(() => {
      // Simulate ROM Inference
      const isHighRisk = params.reflow_peak_temp > 260 || params.epoxy_viscosity < 4000
      setResult({
        riskScore: isHighRisk ? 82 : 12,
        riskLevel: isHighRisk ? 'HIGH RISK' : 'NOMINAL',
        models: {
          lightgbm: isHighRisk ? 85 : 10,
          xgboost: isHighRisk ? 78 : 15,
          autoencoder: isHighRisk ? 83 : 12
        },
        reasons: isHighRisk 
          ? ['Reflow Peak Temp exceeds golden baseline', 'Epoxy Viscosity indicates potential voiding']
          : ['All parameters within 3-sigma control limits'],
        shap: [
          { feature: 'Reflow Peak Temp', value: isHighRisk ? 12.5 : 0.5, positive: isHighRisk },
          { feature: 'Epoxy Viscosity', value: isHighRisk ? 8.2 : 1.2, positive: isHighRisk },
          { feature: 'Bond Force', value: -2.3, positive: false },
          { feature: 'Molding Temp', value: -4.1, positive: false },
        ]
      })
      setIsScoring(false)
    }, 800)
  }

  const handleOptimize = () => {
    // Inverse ROM Logic: Snap to Nominals
    setParams({ ...SENSOR_NOMINALS })
    setResult(null)
  }

  const handleReset = () => {
    setParams({ ...SENSOR_NOMINALS, reflow_peak_temp: 265 })
    setResult(null)
  }

  return (
    <div className="flex flex-col space-y-6 animate-fade-in pb-10">

      {/* Top Row: Inputs & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 shrink-0">

        {/* Left: Input Form */}
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl flex flex-col border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                <Beaker size={24} />
              </div>
              <div>
                <h3 className="font-sans text-[15px] font-black uppercase tracking-[0.2em] text-white">Process Simulation Lab</h3>
                <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.3em]">Digital Twin Parameter Tuning</span>
              </div>
            </div>
            <button onClick={handleReset} className="flex items-center gap-2 text-[10px] font-black text-white/40 hover:text-blue-400 uppercase tracking-widest transition-all">
              <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-500" /> Reset System
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 relative z-10">
            {Object.entries(params).map(([key, value]) => {
              const isDeviated = Math.abs(value - SENSOR_NOMINALS[key]) / SENSOR_NOMINALS[key] > 0.1
              return (
                <div key={key} className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{key.replace(/_/g, ' ')}</label>
                    <span className="font-mono text-[10px] font-black text-blue-400/40">Nom: {SENSOR_NOMINALS[key]}</span>
                  </div>
                  <div className="relative group/field">
                    <input 
                      type="number" 
                      value={value}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      className={clsx(
                        "w-full bg-black/40 border rounded-2xl px-5 py-3.5 text-[15px] font-black font-mono transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40",
                        isDeviated 
                          ? "border-amber-500/50 text-amber-400 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
                          : "border-white/10 text-white focus:border-blue-500/50"
                      )} 
                    />
                    {isDeviated && <AlertTriangle size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 animate-pulse" />}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-12 flex justify-end gap-4 relative z-10">
            <button
              onClick={handleOptimize}
              className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] border border-blue-400/30 text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/50 transition-all shadow-[0_0_20px_rgba(37,99,235,0.1)]"
            >
              <Sparkles size={18} />
              Inverse ROM Optimization
            </button>
            <button
              onClick={handleScore}
              disabled={isScoring}
              className="relative overflow-hidden group/btn bg-gradient-to-r from-blue-600 to-blue-500 text-white px-10 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-blue-600/40 hover:-translate-y-0.5 transition-all flex items-center gap-3 disabled:opacity-70"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
              {isScoring ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
              {isScoring ? 'Neural Ingestion...' : 'Execute Simulation'}
            </button>
          </div>
        </div>

        {/* Right: Results Panel */}
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl border border-white/5 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          
          <div className="flex items-center gap-3 mb-10 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <ShieldAlert size={20} />
            </div>
            <h3 className="font-sans text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Inference Result</h3>
          </div>

          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
              <div className="w-24 h-24 rounded-[32px] border-2 border-dashed border-white/5 flex items-center justify-center mb-8 bg-white/2 group-hover:border-white/10 transition-colors">
                <Database size={40} className="text-white/10" />
              </div>
              <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.3em] leading-loose">
                Awaiting Parameter<br />Neural Ingestion
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col animate-pop-out relative z-10">
              {/* Score Hero */}
              <div className="flex flex-col items-center mb-10 bg-white/2 rounded-[32px] p-8 border border-white/5 shadow-inner">
                <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Ensemble Risk Index</div>
                <div className={clsx(
                  "text-7xl font-black font-mono leading-none tracking-tighter mb-6 transition-colors duration-500",
                  result.riskScore > 50 ? "text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                )}>
                  {result.riskScore}<span className="text-2xl opacity-20">.0</span>
                </div>
                <div className={clsx(
                  "px-8 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] border backdrop-blur-md shadow-xl",
                  result.riskScore > 50 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                )}>
                  {result.riskLevel}
                </div>
              </div>

              {/* Shields Area */}
              <div className="space-y-6 mb-10 px-2">
                {Object.entries(result.models).map(([model, score]) => (
                  <div key={model}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{model} Core</span>
                      <span className="font-mono text-[12px] font-black text-white">{score}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                      <div 
                        className={clsx(
                          "h-full rounded-full transition-all duration-1000 relative overflow-hidden", 
                          score > 60 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        )} 
                        style={{ width: `${score}%` }} 
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Attribution */}
              <div className="mt-auto pt-8 border-t border-white/5">
                <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-4">Neural Root Cause</h4>
                <div className="space-y-3">
                  {result.reasons.map((reason, idx) => (
                    <div key={idx} className="flex gap-3 p-4 bg-white/2 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                      <span className="text-[10px] font-black text-white/70 uppercase tracking-widest leading-relaxed">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle: SHAP Explanation */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-[32px] p-10 shadow-2xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        
        <div className="flex items-center gap-4 mb-10 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-400 border border-white/10 shadow-inner">
            <BarChart2 size={22} />
          </div>
          <div>
            <h3 className="font-sans text-[13px] text-white font-black uppercase tracking-[0.3em]">Neural Feature Contribution (SHAP)</h3>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-1">Impact Attribution Engine</p>
          </div>
        </div>

        {!result ? (
          <div className="h-40 flex items-center justify-center text-[11px] font-black text-white/20 uppercase tracking-[0.3em] border-2 border-dashed border-white/5 rounded-[32px] bg-white/2">
            Execute Simulation to Generate Neural Explanations
          </div>
        ) : (
          <div className="space-y-8 relative z-10 px-4">
            {result.shap.map((item, idx) => (
              <div key={idx} className="flex items-center gap-8 group">
                <div className="w-40 text-right shrink-0">
                  <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-white transition-colors">{item.feature}</span>
                </div>
                <div className="flex-1 flex items-center">
                  <div className="flex-1 h-10 bg-black/30 rounded-2xl relative overflow-hidden flex items-center border border-white/5 shadow-inner">
                    <div className="absolute left-1/2 w-[2px] h-full bg-white/10 z-10" />
                    <div 
                      className={clsx(
                        "h-4 rounded-full transition-all duration-1000 relative overflow-hidden",
                        item.positive 
                          ? "bg-red-500/30 border-l-4 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] ml-[50%]" 
                          : "bg-emerald-500/30 border-r-4 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] absolute right-1/2"
                      )}
                      style={{ width: `${Math.abs(item.value) * 5}%` }}
                    >
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                  </div>
                  <div className="w-20 ml-6 shrink-0">
                    <span className={clsx("font-mono text-[13px] font-black drop-shadow-md", item.positive ? "text-red-400" : "text-emerald-400")}>
                      {item.positive ? '+' : '-'}{Math.abs(item.value).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
