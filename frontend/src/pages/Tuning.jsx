import React, { useState } from 'react'
import { 
  Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle, 
  Settings2, Rocket, RotateCcw, RefreshCw, History, 
  ChevronRight, ShieldCheck, AlertCircle
} from 'lucide-react'
import clsx from 'clsx'

/**
 * Micron Sentinel - Tuning & Process Control
 * High-fidelity industrial configuration interface for Process Engineers.
 */

/* ─── Mock Data ─────────────────────────────────────────── */

const TUNING_STAGES = [
  { id: 'die-bond', name: 'Die Bond', icon: Cpu, color: '#2563eb',
    params: [
      { id: 'force', name: 'Bond Force', unit: 'N', baseline: 5.0, warning: 0.5, critical: 1.2 },
      { id: 'viscosity', name: 'Epoxy Viscosity', unit: 'cP', baseline: 450.0, warning: 25.0, critical: 50.0 },
      { id: 'time', name: 'Bond Time', unit: 'ms', baseline: 120.0, warning: 10.0, critical: 25.0 },
      { id: 'thickness', name: 'BLT (Bond Line Thickness)', unit: 'µm', baseline: 15.0, warning: 2.0, critical: 4.0 }
    ]
  },
  { id: 'wire-bond', name: 'Wire Bond', icon: Zap, color: '#7c3aed',
    params: [
      { id: 'power', name: 'Ultrasonic Power', unit: 'W', baseline: 80.0, warning: 5.0, critical: 12.0 },
      { id: 'stroke', name: 'Capillary Stroke', unit: 'k', baseline: 40.0, warning: 10.0, critical: 20.0 },
      { id: 'efo', name: 'EFO Spark Gap', unit: 'mil', baseline: 12.0, warning: 1.5, critical: 3.0 },
      { id: 'tension', name: 'Wire Tension', unit: 'gf', baseline: 4.5, warning: 0.8, critical: 1.5 }
    ]
  },
  { id: 'mold', name: 'Mold', icon: Thermometer, color: '#d97706',
    params: [
      { id: 'pressure', name: 'Transfer Pressure', unit: 'MPa', baseline: 8.0, warning: 1.0, critical: 2.5 },
      { id: 'temp', name: 'Molding Temp', unit: '°C', baseline: 175.0, warning: 5.0, critical: 10.0 },
      { id: 'clamping', name: 'Clamping Force', unit: 'kN', baseline: 2500.0, warning: 100.0, critical: 250.0 },
      { id: 'curing', name: 'In-Mold Cure Time', unit: 'sec', baseline: 60.0, warning: 5.0, critical: 10.0 }
    ]
  },
  { id: 'ball-attach', name: 'Ball Attach & Laser Mark', icon: Microscope, color: '#0891b2',
    params: [
      { id: 'accuracy', name: 'Placement Accuracy', unit: 'µm', baseline: 10.0, warning: 2.0, critical: 5.0 },
      { id: 'peak_temp', name: 'Reflow Peak Temp', unit: '°C', baseline: 245.0, warning: 10.0, critical: 20.0 },
      { id: 'flux_depth', name: 'Flux Dipping Depth', unit: 'µm', baseline: 45.0, warning: 5.0, critical: 12.0 },
      { id: 'laser_power', name: 'Marking Laser Power', unit: 'W', baseline: 15.5, warning: 1.2, critical: 3.0 }
    ]
  },
  { id: 'saw', name: 'Saw Singulation', icon: Scissors, color: '#ec4899',
    params: [
      { id: 'vibration', name: 'Vibration Amplitude', unit: 'G', baseline: 0.15, warning: 0.05, critical: 0.15 },
      { id: 'wear', label: 'Blade Wear Index', unit: '', baseline: 30.0, warning: 20.0, critical: 40.0 },
      { id: 'spindle_speed', name: 'Spindle RPM', unit: 'k', baseline: 45.0, warning: 2.0, critical: 5.0 },
      { id: 'water_flow', name: 'Coolant Flow Rate', unit: 'L/min', baseline: 2.5, warning: 0.3, critical: 0.8 }
    ]
  },
  { id: 'iol', name: 'IOL Prediction Limits', icon: CheckCircle, color: '#059669',
    params: [
      { id: 'drift_sensitivity', name: 'Multi-Stage Sensitivity', unit: 'x', baseline: 1.5, warning: 0.2, critical: 0.5 },
      { id: 'scrap_threshold', name: 'Auto-Scrap Prob.', unit: '%', baseline: 85.0, warning: 5.0, critical: 10.0 },
      { id: 'false_positive', name: 'False Positive Tolerance', unit: '%', baseline: 0.5, warning: 0.1, critical: 0.3 },
      { id: 'inference_lag', name: 'Max Inference Latency', unit: 'ms', baseline: 20.0, warning: 10.0, critical: 30.0 }
    ]
  }
]

const AUDIT_LOG = [
  { id: 1, time: '2026-05-02 10:45:12', operator: 'ENG-402', stage: 'Mold', param: 'Molding Temp', change: '175.0 → 178.5', status: 'AUTHORIZED' },
  { id: 2, time: '2026-05-02 09:12:44', operator: 'SYS-ROOT', stage: 'IOL', param: 'Auto-Scrap Prob.', change: '90.0 → 85.0', status: 'AUTHORIZED' },
  { id: 3, time: '2026-05-02 08:30:05', operator: 'ENG-119', stage: 'Wire Bond', param: 'Ultrasonic Power', change: '80.0 → 82.0', status: 'PENDING' },
  { id: 4, time: '2026-05-01 22:15:30', operator: 'ENG-402', stage: 'Saw', param: 'Blade Wear', change: '40.0 → 30.0', status: 'AUTHORIZED' },
  { id: 5, time: '2026-05-01 18:05:11', operator: 'ENG-331', stage: 'Die Bond', param: 'Bond Force', change: '5.0 → 5.2', status: 'AUTHORIZED' },
  { id: 6, time: '2026-05-01 14:20:00', operator: 'ENG-402', stage: 'Ball Attach', param: 'Reflow Peak', change: '240.0 → 245.0', status: 'AUTHORIZED' },
]

/* ─── Components ────────────────────────────────────────── */

const VisualControlBar = ({ warning, critical }) => {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="relative h-2.5 w-full rounded-full overflow-hidden bg-white/5 border border-white/5 shadow-inner">
        {/* The Multi-Color Gradient Bar */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-amber-400 via-emerald-400 via-amber-400 to-red-600 opacity-80" />
        
        {/* Golden Range Outer Glow (approximate position) */}
        <div className="absolute top-0 bottom-0 left-[35%] right-[35%] bg-emerald-400/30 blur-[4px] pointer-events-none" />
        
        {/* Interactive Pointer Placeholder (Visual Only) */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[3px] bg-white shadow-[0_0_15px_#fff] z-20 animate-pulse" />
      </div>
      <div className="flex justify-between items-center px-1">
        <span className="text-[8px] font-black text-red-500/60 uppercase tracking-[0.2em]">Critical</span>
        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">Golden Zone</span>
        <span className="text-[8px] font-black text-red-500/60 uppercase tracking-[0.2em]">Critical</span>
      </div>
    </div>
  )
}

const ThresholdCard = ({ param }) => {
  return (
    <div className="p-8 rounded-[32px] bg-slate-800/40 backdrop-blur-xl border border-white/[0.05] shadow-2xl transition-all hover:bg-slate-800/50 hover:border-white/10 group">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-blue-500/30">
            <Settings2 size={20} className="text-blue-400/60 group-hover:text-blue-400 transition-colors" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">{param.name}</h4>
            <p className="text-[10px] text-blue-400/40 font-black uppercase tracking-[0.3em]">{param.unit || 'Standard Metric'}</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck size={18} className="text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Golden Baseline</label>
          <div className="relative group/input">
            <input 
              type="number" 
              defaultValue={param.baseline} 
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-black font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" 
            />
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest block">Warning Limit (±)</label>
          <input 
            type="number" 
            defaultValue={param.warning} 
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-black font-mono text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all" 
          />
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-red-500/60 uppercase tracking-widest block">Critical Limit (±)</label>
          <input 
            type="number" 
            defaultValue={param.critical} 
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-black font-mono text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/50 transition-all" 
          />
        </div>
      </div>

      <VisualControlBar warning={param.warning} critical={param.critical} />
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────── */

export default function Tuning({ engine }) {
  const { engineOnline = false } = engine || {}
  const [activeStageId, setActiveStageId] = useState('die-bond')
  const activeStage = TUNING_STAGES.find(s => s.id === activeStageId)

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[1600px] mx-auto font-sans bg-[#0F172A] relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* ═════════ ZONE 1: THE COMMAND STRIP ═════════ */}
      <div className="flex items-center justify-between px-8 py-5 bg-slate-900/60 backdrop-blur-xl border-b border-white/10 shadow-2xl z-30 shrink-0">
        <div className="flex items-center gap-8">
          {/* Micron Wordmark Branding */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black text-white tracking-tighter uppercase">Micron</span>
              <span className="text-[10px] font-black text-blue-400 tracking-[0.3em] uppercase">Sentinel</span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-white/10" />

          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Active Recipe Configuration</span>
            <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-black text-white uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all cursor-pointer">
              <option className="bg-slate-900">Active Recipe: DDR5-X75-Memory</option>
              <option className="bg-slate-900">NAND-Flash-V2</option>
              <option className="bg-slate-900">HBM3-Hyper-Core</option>
            </select>
          </div>

          <div className="hidden xl:flex items-center gap-3 ml-4">
              <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center border", engineOnline ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30")}>
                <RefreshCw size={20} className={clsx(engineOnline ? "text-emerald-400 animate-spin-slow" : "text-rose-400")} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Network Status</span>
                <span className={clsx("text-[11px] font-black uppercase drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]", engineOnline ? "text-emerald-400" : "text-rose-400")}>
                  Edge Nodes: {engineOnline ? 'SYNCED' : 'OFFLINE'}
                </span>
              </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tagline */}
          <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mr-6">Intelligence Accelerated</span>

          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest backdrop-blur-md">
            <RotateCcw size={16} />
            Revert
          </button>
          
          <button className="group relative flex items-center gap-2 px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 transition-all text-[11px] font-black uppercase tracking-[0.15em] shadow-[0_0_20px_rgba(37,99,235,0.3)] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <Rocket size={16} className="group-hover:translate-y-[-2px] group-hover:translate-x-[2px] transition-transform" />
            Deploy Settings
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative z-10">
        
        {/* ═════════ ZONE 2: STAGE NAVIGATION (Left) ═════════ */}
        <div className="w-72 bg-transparent flex flex-col shrink-0">
          <div className="px-8 py-8">
            <h3 className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em] flex items-center gap-3">
              <Settings2 size={14} className="text-blue-400" />
              Process Stages
            </h3>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar pb-8">
            {TUNING_STAGES.map(stage => {
              const isActive = activeStageId === stage.id
              const Icon = stage.icon
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStageId(stage.id)}
                  className={clsx(
                    "w-full flex items-center justify-between p-4 rounded-2xl transition-all group relative overflow-hidden",
                    isActive 
                      ? "bg-blue-600/20 border border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.1)]" 
                      : "bg-transparent border border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={clsx(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                      isActive ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]" : "bg-white/5 text-slate-500 group-hover:bg-white/10"
                    )}>
                      <Icon size={20} />
                    </div>
                    <span className={clsx("text-xs font-black uppercase tracking-widest transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")}>
                      {stage.name}
                    </span>
                  </div>
                  {isActive && <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]" />}
                </button>
              )
            })}
          </nav>
        </div>

        {/* ═════════ ZONE 3: THRESHOLD CONFIGURATOR (Center) ═════════ */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <div className="mb-12">
              <div className="flex items-center gap-5 mb-4">
                 <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl relative" style={{ backgroundColor: activeStage.color }}>
                   <div className="absolute inset-0 bg-white/20 blur-sm rounded-2xl" />
                   <activeStage.icon size={28} className="relative z-10" />
                 </div>
                 <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-md">{activeStage.name}</h2>
                    <p className="text-xs font-black text-blue-400/60 uppercase tracking-[0.3em]">Recipe Parameter Engine</p>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {activeStage.params.map(param => (
                <ThresholdCard key={param.id} param={param} />
              ))}
              
              {/* Informational Prompt */}
              <div className="p-10 rounded-[32px] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center bg-white/2 hover:bg-white/5 transition-colors group cursor-pointer">
                 <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <AlertCircle size={24} className="text-white/20 group-hover:text-white/40" />
                 </div>
                 <h5 className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] mb-2">Register New Parameter</h5>
                 <p className="text-[9px] text-white/20 font-black uppercase tracking-widest max-w-[200px]">Advanced attributes must be reconciled via RAG Subsystem</p>
              </div>
            </div>
          </div>

          {/* ═════════ ZONE 4: AUDIT TRAIL (Bottom) ═════════ */}
          <div className="h-[220px] bg-slate-900/80 backdrop-blur-2xl border-t border-white/10 flex flex-col shrink-0 overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
             <div className="px-10 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <History size={16} className="text-blue-400" />
                   </div>
                   <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Configuration Audit Log</h3>
                </div>
                <div className="flex items-center gap-6">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Status: NOMINAL</span>
                   </div>
                   <div className="w-[1px] h-4 bg-white/10" />
                   <span className="text-[10px] font-black text-white/40 uppercase tracking-widest font-mono">User: ENG_S_CHUA_2026</span>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                   <tbody className="divide-y divide-white/[0.03]">
                      {AUDIT_LOG.map(log => (
                         <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="pl-10 py-5 font-mono text-[11px] font-bold text-slate-500">{log.time}</td>
                            <td className="px-6 py-5 font-mono text-[11px] font-black text-blue-400 group-hover:text-blue-300 transition-colors">{log.operator}</td>
                            <td className="px-6 py-5 text-[10px] font-black text-white/60 uppercase tracking-widest">{log.stage}</td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col gap-0.5">
                                  <span className="text-[11px] font-black text-white uppercase tracking-tighter">{log.param}</span>
                                  <span className="text-[10px] font-black text-slate-500 font-mono tracking-tight group-hover:text-slate-400 transition-colors">{log.change}</span>
                                </div>
                            </td>
                            <td className="pr-10 py-5">
                               <div className="flex justify-end">
                                  <span className={clsx(
                                     "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border backdrop-blur-md transition-all",
                                     log.status === 'AUTHORIZED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-200/20'
                                  )}>
                                     {log.status}
                                  </span>
                               </div>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

      </div>
    </div>
  )
}
