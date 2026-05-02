import React, { useState } from 'react'
import { 
  Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle, 
  Settings2, Rocket, RotateCcw, Cloud, RefreshCw, User, History, 
  ChevronRight, Save, ShieldCheck, AlertCircle
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
    <div className="mt-4 flex flex-col gap-1.5">
      <div className="h-2 w-full rounded-full flex overflow-hidden shadow-inner bg-slate-100">
        <div className="h-full bg-red-500" style={{ flex: critical }} />
        <div className="h-full bg-amber-400" style={{ flex: warning }} />
        <div className="h-full bg-emerald-500 flex-[3]" />
        <div className="h-full bg-amber-400" style={{ flex: warning }} />
        <div className="h-full bg-red-500" style={{ flex: critical }} />
      </div>
      <div className="flex justify-between px-1">
        <span className="text-[8px] font-black text-red-500 uppercase">Critical</span>
        <span className="text-[8px] font-black text-emerald-600 uppercase">Golden Range</span>
        <span className="text-[8px] font-black text-red-500 uppercase">Critical</span>
      </div>
    </div>
  )
}

const ThresholdCard = ({ param }) => {
  return (
    <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Settings2 size={16} className="text-slate-400" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{param.name}</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{param.unit || 'No Unit'}</p>
          </div>
        </div>
        <ShieldCheck size={16} className="text-emerald-500 opacity-40 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Golden Baseline</label>
          <input 
            type="number" 
            defaultValue={param.baseline} 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-black font-sans focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest block">Warning Limit (±)</label>
          <input 
            type="number" 
            defaultValue={param.warning} 
            className="w-full bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm font-black font-sans focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black text-red-500 uppercase tracking-widest block">Critical Limit (±)</label>
          <input 
            type="number" 
            defaultValue={param.critical} 
            className="w-full bg-red-50 border-red-200 rounded-lg px-3 py-2 text-sm font-black font-sans focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all" 
          />
        </div>
      </div>

      <VisualControlBar warning={param.warning} critical={param.critical} />
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────── */

export default function Tuning() {
  const [activeStageId, setActiveStageId] = useState('die-bond')
  const activeStage = TUNING_STAGES.find(s => s.id === activeStageId)

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[1600px] mx-auto font-sans bg-slate-50">
      
      {/* ═════════ ZONE 1: THE COMMAND STRIP ═════════ */}
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Active Recipe Configuration</span>
            <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm cursor-pointer">
              <option>Active Recipe: DDR5-X75-Memory</option>
              <option>NAND-Flash-V2</option>
              <option>HBM3-Hyper-Core</option>
            </select>
          </div>
          <div className="h-10 w-[1px] bg-slate-200" />
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <RefreshCw size={20} className="text-emerald-500 animate-pulse-slow" />
             </div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Network Status</span>
                <span className="text-[11px] font-black text-emerald-600 uppercase">Edge Nodes: SYNCED</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all text-[11px] font-black uppercase tracking-widest shadow-sm">
            <RotateCcw size={16} />
            Revert to Previous
          </button>
          <button className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all text-[11px] font-black uppercase tracking-[0.1em] shadow-lg shadow-blue-600/20">
            <Rocket size={16} />
            Deploy Settings to Fab
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        
        {/* ═════════ ZONE 2: STAGE NAVIGATION (Left) ═════════ */}
        <div className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="px-6 py-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Settings2 size={14} />
              Process Stages
            </h3>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
            {TUNING_STAGES.map(stage => {
              const isActive = activeStageId === stage.id
              const Icon = stage.icon
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStageId(stage.id)}
                  className={clsx(
                    "w-full flex items-center justify-between p-4 rounded-2xl transition-all border group",
                    isActive 
                      ? "bg-slate-50 shadow-sm" 
                      : "bg-white border-transparent text-slate-500 hover:bg-slate-50"
                  )}
                  style={isActive ? { borderColor: stage.color } : {}}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${stage.color}10`, color: stage.color }}>
                      <Icon size={20} />
                    </div>
                    <span className={clsx("text-xs font-black uppercase tracking-tight", isActive ? "text-slate-900" : "text-slate-500")}>
                      {stage.name}
                    </span>
                  </div>
                  {isActive && <ChevronRight size={16} className="text-slate-400" />}
                </button>
              )
            })}
          </nav>
        </div>

        {/* ═════════ ZONE 3: THRESHOLD CONFIGURATOR (Center) ═════════ */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="mb-10">
              <div className="flex items-center gap-4 mb-2">
                 <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: activeStage.color }}>
                   <activeStage.icon size={24} />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{activeStage.name}</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Parameter Baseline & Tolerance Configuration</p>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {activeStage.params.map(param => (
                <ThresholdCard key={param.id} param={param} />
              ))}
              
              {/* Informational Prompt */}
              <div className="p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center bg-slate-50/30">
                 <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
                    <AlertCircle size={20} className="text-slate-300" />
                 </div>
                 <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Add Dynamic Parameter</h5>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">New attributes must be registered via RAG Engine</p>
              </div>
            </div>
          </div>

          {/* ═════════ ZONE 4: AUDIT TRAIL (Bottom) ═════════ */}
          <div className="h-[180px] bg-white border-t border-slate-200 flex flex-col shrink-0 overflow-hidden">
             <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                   <History size={16} className="text-slate-400" />
                   <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Configuration Audit Log</h3>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Session: Active</span>
                   </div>
                   <div className="w-[1px] h-4 bg-slate-200" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User: Micron-Admin-2026</span>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                   <thead className="bg-white sticky top-0 z-10">
                      <tr className="border-b border-slate-100">
                         <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                         <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator ID</th>
                         <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Stage</th>
                         <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Parameter Changed</th>
                         <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Authorization Status</th>
                      </tr>
                   </thead>
                   <tbody>
                      {AUDIT_LOG.map(log => (
                         <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-4 font-sans text-[11px] font-bold text-slate-500">{log.time}</td>
                            <td className="px-6 py-4 font-sans text-[11px] font-black text-blue-600">{log.operator}</td>
                            <td className="px-6 py-4 font-sans text-[11px] font-bold text-slate-800">{log.stage}</td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-black text-slate-900 uppercase">{log.param}</span>
                                  <span className="text-[10px] font-black text-slate-400 font-sans tracking-tight">{log.change}</span>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex justify-center">
                                  <span className={clsx(
                                     "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                                     log.status === 'AUTHORIZED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
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
