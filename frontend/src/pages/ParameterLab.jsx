import React, { useState } from 'react'
import { Beaker, RefreshCw, Play, BarChart2, CheckCircle, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

export default function ParameterLab() {
  const [isScoring, setIsScoring] = useState(false)
  const [result, setResult] = useState(null)
  
  const handleScore = () => {
    setIsScoring(true)
    setTimeout(() => {
      setResult({
        riskScore: 89,
        riskLevel: 'HIGH RISK',
        models: {
          lightgbm: 92,
          xgboost: 88,
          autoencoder: 85
        },
        reasons: [
          'Reflow Peak Temp exceeds golden baseline by 15°C',
          'High Capillary Stroke combined with low Wire Tension',
          'Epoxy Viscosity indicates potential voiding risk'
        ],
        shap: [
          { feature: 'Reflow Peak Temp', value: 12.5, positive: true },
          { feature: 'Capillary Stroke', value: 8.2, positive: true },
          { feature: 'Epoxy Viscosity', value: 5.1, positive: true },
          { feature: 'Bond Force', value: -2.3, positive: false },
          { feature: 'Molding Temp', value: -4.1, positive: false },
        ]
      })
      setIsScoring(false)
    }, 1500)
  }

  const handleReset = () => {
    setResult(null)
  }

  return (
    <div className="flex flex-col space-y-6">
      
      {/* Top Row: Inputs & Results */}
      <div className="grid grid-cols-3 gap-6 shrink-0">
        
        {/* Left: Input Form */}
        <div className="col-span-2 bg-bg-50 rounded-xl p-6 border border-border shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-text-primary">
              <Beaker size={20} className="text-cyan-600" />
              <h3 className="font-sans text-[14px] font-black uppercase tracking-widest">Simulate Process Parameters</h3>
            </div>
            <button onClick={handleReset} className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-text-primary uppercase tracking-wider transition-colors">
              <RefreshCw size={12} /> Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {/* Die Bond */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Bond Force (N)</label>
              <input type="number" defaultValue={5.0} className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-bold text-text-primary focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Epoxy Viscosity (cP)</label>
              <input type="number" defaultValue={450} className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-bold text-text-primary focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>

            {/* Wire Bond */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Ultrasonic Power (W)</label>
              <input type="number" defaultValue={80} className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-bold text-text-primary focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Wire Tension (gf)</label>
              <input type="number" defaultValue={4.5} className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-bold text-text-primary focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>

            {/* Mold */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Transfer Pressure (MPa)</label>
              <input type="number" defaultValue={8.0} className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-bold text-text-primary focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Molding Temp (°C)</label>
              <input type="number" defaultValue={175} className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-bold text-text-primary focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>

            {/* Ball Attach / Saw */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Reflow Peak Temp (°C)</label>
              <input type="number" defaultValue={260} className="w-full bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-[12px] font-bold text-rose-700 focus:outline-none focus:border-rose-500 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Spindle RPM (k)</label>
              <input type="number" defaultValue={45} className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-bold text-text-primary focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button 
              onClick={handleScore}
              disabled={isScoring}
              className="bg-gradient-signature text-white px-8 py-3 rounded-xl font-bold text-[12px] uppercase tracking-wider shadow-btn-primary hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              {isScoring ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {isScoring ? 'Scoring...' : 'Score Now'}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="col-span-1 bg-bg-50 rounded-xl p-6 border border-border shadow-sm flex flex-col">
          <h3 className="font-sans text-[11px] text-text-muted font-black uppercase tracking-widest mb-6">Result</h3>
          
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-text-muted">
              <div className="w-16 h-16 rounded-full border-4 border-dashed border-border flex items-center justify-center mb-4">
                <Play size={24} className="text-border ml-1" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest">Submit parameters<br/>to see results</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col animate-fade-in">
              {/* Gauge Area */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-28 h-28 mb-3">
                  {/* SVG Gauge Background */}
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-200)" strokeWidth="10" strokeDasharray="283" strokeDashoffset="0" />
                    <circle 
                      cx="50" cy="50" r="45" fill="none" 
                      stroke={result.riskScore > 50 ? "var(--block)" : "var(--approve)"} 
                      strokeWidth="10" 
                      strokeDasharray="283" 
                      strokeDashoffset={283 - (283 * result.riskScore) / 100} 
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={clsx("text-3xl font-black", result.riskScore > 50 ? "text-rose-500" : "text-emerald-500")}>
                      {result.riskScore}
                    </span>
                    <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest mt-0.5">Risk Score</span>
                  </div>
                </div>
                
                <div className={clsx("px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider", result.riskScore > 50 ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-emerald-50 text-emerald-600 border-emerald-200")}>
                  {result.riskLevel}
                </div>
              </div>

              {/* Model Scores */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">LightGBM (10%)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1 bg-bg-200 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 rounded-full" style={{ width: `${result.models.lightgbm}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-text-primary w-6 text-right">{result.models.lightgbm}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">XGBoost (40%)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1 bg-bg-200 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${result.models.xgboost}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-text-primary w-6 text-right">{result.models.xgboost}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Autoencoder (50%)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1 bg-bg-200 rounded-full overflow-hidden">
                       <div className="h-full bg-amber-500 rounded-full" style={{ width: `${result.models.autoencoder}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-text-primary w-6 text-right">{result.models.autoencoder}</span>
                  </div>
                </div>
              </div>

              {/* Top Reasons */}
              <div className="mt-auto">
                <h4 className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2">Top Risk Factors</h4>
                <ul className="space-y-1.5">
                  {result.reasons.map((reason, idx) => (
                    <li key={idx} className="text-[10px] font-bold text-text-secondary flex items-start gap-1.5">
                      <span className="text-rose-500 mt-0.5">•</span>
                      <span className="leading-tight">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle: SHAP Explanation (Full Width) */}
      <div className="bg-bg-50 rounded-xl p-6 border border-border shadow-sm flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 size={16} className="text-text-muted" />
          <h3 className="font-sans text-[11px] text-text-muted font-black uppercase tracking-widest">SHAP Explanation - Why This Score?</h3>
        </div>
        
        {!result ? (
          <div className="flex-1 flex items-center justify-center text-[11px] font-bold text-text-muted uppercase tracking-widest border-2 border-dashed border-border rounded-xl">
            Awaiting simulation results
          </div>
        ) : (
          <div className="flex flex-col justify-center flex-1 relative py-4">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-0" />
            
            {result.shap.map((item, idx) => (
              <div key={idx} className="flex items-center text-[10px] font-bold z-10 relative mb-4 last:mb-0">
                <div className="w-1/2 pr-6 text-right truncate text-text-secondary uppercase tracking-wider">
                  {item.feature}
                </div>
                <div className="w-1/2 pl-6 relative flex items-center">
                  <div 
                    className={clsx("h-6 rounded-sm shadow-sm", item.positive ? "bg-rose-500" : "bg-emerald-500 absolute right-full mr-6")}
                    style={{ width: `${Math.abs(item.value) * 10}%` }}
                  />
                </div>
              </div>
            ))}
            
            {/* Axis Labels */}
            <div className="flex justify-between text-[9px] font-bold text-text-muted mt-4 border-t border-border pt-4 uppercase">
               <span>-20.00 (Low Risk)</span>
               <span>+0.00</span>
               <span>+20.00 (High Risk)</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Investigation Log */}
      <div className="bg-bg-50 rounded-xl border border-border shadow-sm flex flex-col h-48 shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
           <div className="flex items-center gap-2 text-text-muted">
             <AlertTriangle size={14} />
             <h3 className="font-sans text-[11px] font-black tracking-widest uppercase">Simulation Log</h3>
           </div>
           <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
             {result ? '1 entry' : '0 entries'}
           </span>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-bg-50 sticky top-0">
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-[9px] font-bold text-text-muted uppercase tracking-wider">Time</th>
                <th className="py-2 px-4 text-[9px] font-bold text-text-muted uppercase tracking-wider">Process Type</th>
                <th className="py-2 px-4 text-[9px] font-bold text-text-muted uppercase tracking-wider">Risk Score</th>
                <th className="py-2 px-4 text-[9px] font-bold text-text-muted uppercase tracking-wider">Decision</th>
                <th className="py-2 px-4 text-[9px] font-bold text-text-muted uppercase tracking-wider">Top Reason</th>
              </tr>
            </thead>
            <tbody>
              {!result ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    No simulated units yet
                  </td>
                </tr>
              ) : (
                <tr className="border-b border-border hover:bg-bg-100">
                  <td className="py-3 px-4 text-[11px] font-bold font-mono text-text-secondary">
                    {new Date().toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-black text-cyan-600 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded uppercase tracking-wider">Full Assembly</span>
                  </td>
                  <td className="py-3 px-4 text-[11px] font-black text-rose-500">{result.riskScore}%</td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase tracking-wider">{result.riskLevel}</span>
                  </td>
                  <td className="py-3 px-4 text-[11px] font-bold text-text-secondary truncate max-w-xs">
                    {result.reasons[0]}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
