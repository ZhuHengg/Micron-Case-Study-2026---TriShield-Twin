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
    <div className="flex flex-col space-y-6 animate-fade-in">

      {/* Top Row: Inputs & Results */}
      <div className="grid grid-cols-[1fr_400px] gap-6 shrink-0">

        {/* Left: Input Form */}
        <div className="bg-white rounded-[24px] p-8 shadow-premium flex flex-col border border-slate-200/60">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0066CC]/10 flex items-center justify-center text-[#0066CC]">
                <Beaker size={20} />
              </div>
              <div>
                <h3 className="font-sans text-[14px] font-black uppercase tracking-widest text-slate-800">Process Simulation Lab</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Digital Twin Parameter Tuning</span>
              </div>
            </div>
            <button onClick={handleReset} className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-[#0066CC] uppercase tracking-widest transition-colors">
              <RefreshCw size={12} /> Reset System
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-8">
            {Object.entries(params).map(([key, value]) => {
              const isDeviated = Math.abs(value - SENSOR_NOMINALS[key]) / SENSOR_NOMINALS[key] > 0.1
              return (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{key.replace(/_/g, ' ')}</label>
                    <span className="font-mono text-[10px] font-bold text-slate-400">Nom: {SENSOR_NOMINALS[key]}</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={value}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      className={clsx(
                        "w-full bg-slate-50 border rounded-xl px-4 py-3 text-[14px] font-black font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20",
                        isDeviated ? "border-amber-300 text-amber-700 bg-amber-50/30" : "border-slate-200 text-slate-800 focus:border-[#0066CC]"
                      )} 
                    />
                    {isDeviated && <AlertTriangle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500" />}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-10 flex justify-end gap-3">
            <button
              onClick={handleOptimize}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest border-2 border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/5 transition-all"
            >
              <Sparkles size={16} />
              Inverse ROM Optimization
            </button>
            <button
              onClick={handleScore}
              disabled={isScoring}
              className="bg-gradient-signature text-white px-10 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-btn-primary hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isScoring ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {isScoring ? 'Inference Running...' : 'Execute Simulation'}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="bg-white rounded-[24px] p-8 shadow-premium border border-slate-200/60 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <ShieldAlert size={18} className="text-[#0066CC]" />
            <h3 className="font-sans text-[11px] text-slate-400 font-black uppercase tracking-widest">Inference Result</h3>
          </div>

          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-300">
              <div className="w-20 h-20 rounded-3xl border-4 border-dashed border-slate-100 flex items-center justify-center mb-6">
                <Database size={32} className="text-slate-200" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-relaxed">
                Awaiting Parameter<br />Neural Ingestion
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col animate-pop-out">
              {/* Score Hero */}
              <div className="flex flex-col items-center mb-8 bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Ensemble Risk Index</div>
                <div className={clsx(
                  "text-6xl font-black font-mono leading-none tracking-tighter mb-4",
                  result.riskScore > 50 ? "text-red-600" : "text-[#00A3AD]"
                )}>
                  {result.riskScore}<span className="text-2xl opacity-30">.0</span>
                </div>
                <div className={clsx(
                  "px-6 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm",
                  result.riskScore > 50 ? "bg-red-600 text-white" : "bg-[#00A3AD] text-white"
                )}>
                  {result.riskLevel}
                </div>
              </div>

              {/* Shields Area */}
              <div className="space-y-4 mb-8">
                {Object.entries(result.models).map(([model, score]) => (
                  <div key={model}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{model} Shield</span>
                      <span className="font-mono text-[11px] font-black text-slate-700">{score}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={clsx("h-full rounded-full transition-all duration-1000", score > 60 ? "bg-red-500" : "bg-[#0066CC]")} 
                        style={{ width: `${score}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Attribution */}
              <div className="mt-auto pt-6 border-t border-slate-100">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Root Cause Attribution</h4>
                <div className="space-y-2">
                  {result.reasons.map((reason, idx) => (
                    <div key={idx} className="flex gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-600 leading-tight">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle: SHAP Explanation */}
      <div className="bg-white rounded-[24px] p-8 shadow-premium border border-slate-200/60">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
            <BarChart2 size={18} />
          </div>
          <h3 className="font-sans text-[11px] text-slate-800 font-black uppercase tracking-widest">Neural Feature Contribution (SHAP)</h3>
        </div>

        {!result ? (
          <div className="h-32 flex items-center justify-center text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] border-2 border-dashed border-slate-100 rounded-[24px]">
            Execute Simulation to Generate Model Explanations
          </div>
        ) : (
          <div className="space-y-6">
            {result.shap.map((item, idx) => (
              <div key={idx} className="flex items-center gap-6">
                <div className="w-32 text-right">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.feature}</span>
                </div>
                <div className="flex-1 flex items-center">
                  <div className="flex-1 h-8 bg-slate-50 rounded-lg relative overflow-hidden flex items-center">
                    <div className="absolute left-1/2 w-px h-full bg-slate-200 z-10" />
                    <div 
                      className={clsx(
                        "h-full transition-all duration-1000",
                        item.positive ? "bg-red-500/20 border-l-2 border-red-500" : "bg-[#00A3AD]/20 border-r-2 border-[#00A3AD] absolute right-1/2"
                      )}
                      style={{ width: `${Math.abs(item.value) * 5}%` }}
                    />
                  </div>
                  <div className="w-16 ml-4">
                    <span className={clsx("font-mono text-[11px] font-black", item.positive ? "text-red-500" : "text-[#00A3AD]")}>
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
