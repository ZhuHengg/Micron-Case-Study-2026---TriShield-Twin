import React, { useState, useMemo } from 'react'
import { 
  Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle, 
  Search, AlertTriangle, ChevronDown, Filter, Settings2,
  AlertCircle, Activity, Box, Database, Clock, TrendingUp, ShieldAlert, Droplet,
  XCircle
} from 'lucide-react'
import clsx from 'clsx'

// Shadcn UI Imports
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const STAGES = [
  { id: 1, name: 'Die Attach', icon: Box, params: ['bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity'] },
  { id: 2, name: 'Wire Bonding', icon: Activity, params: ['pick_place_speed', 'ultrasonic_power', 'bond_time', 'loop_height', 'capillary_stroke_count', 'efo_voltage'] },
  { id: 3, name: 'Molding', icon: Droplet, params: ['transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level'] },
  { id: 4, name: 'Ball Attach', icon: Cpu, params: ['ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density'] },
  { id: 5, name: 'Singulation', icon: Scissors, params: ['spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow'] },
]

const STAGE_COLORS = {
  1: '#2563eb', // Blue
  2: '#7c3aed', // Purple
  3: '#d97706', // Amber
  4: '#0891b2', // Cyan
  5: '#ec4899', // Pink
}

const SENSOR_NOMINALS = {
  bond_force: { nominal: 30.0, unit: 'gf' }, xy_placement_offset: { nominal: 5.0, unit: 'µm' },
  bond_line_thickness: { nominal: 25.0, unit: 'µm' }, epoxy_viscosity: { nominal: 5000, unit: 'cP' },
  pick_place_speed: { nominal: 8000, unit: 'mm/s' }, ultrasonic_power: { nominal: 1.2, unit: 'W' },
  bond_time: { nominal: 15.0, unit: 'ms' }, loop_height: { nominal: 200, unit: 'µm' },
  capillary_stroke_count: { nominal: 100000, unit: '' }, efo_voltage: { nominal: 60, unit: 'V' },
  transfer_pressure: { nominal: 8.0, unit: 'MPa' }, clamping_force: { nominal: 50, unit: 'kN' },
  molding_temperature: { nominal: 180, unit: '°C' }, vacuum_level: { nominal: 2.0, unit: 'mbar' },
  ball_placement_accuracy: { nominal: 5.0, unit: 'µm' }, laser_pulse_energy: { nominal: 12.0, unit: 'mJ' },
  reflow_peak_temp: { nominal: 260, unit: '°C' }, flux_density: { nominal: 0.8, unit: 'mg/cm²' },
  spindle_current: { nominal: 2.0, unit: 'A' }, vibration_amplitude: { nominal: 0.5, unit: 'mm' },
  blade_wear_index: { nominal: 0.3, unit: '' }, cooling_water_flow: { nominal: 1.5, unit: 'L/min' },
}

const BIN_INFO = {
  1: { name: 'Bin 1 — Perfect', color: 'bg-emerald-500', textColor: 'text-emerald-700', bg: 'bg-emerald-50' },
  2: { name: 'Bin 2 — Marginal', color: 'bg-sky-500', textColor: 'text-sky-700', bg: 'bg-sky-50' },
  3: { name: 'Bin 3 — Recoverable', color: 'bg-amber-500', textColor: 'text-amber-700', bg: 'bg-amber-50' },
  4: { name: 'Bin 4 — Fab Passthrough', color: 'bg-orange-500', textColor: 'text-orange-700', bg: 'bg-orange-50' },
  5: { name: 'Bin 5 — Open/Short Fail', color: 'bg-red-500', textColor: 'text-red-700', bg: 'bg-red-50' },
  6: { name: 'Bin 6 — Delamination', color: 'bg-red-600', textColor: 'text-red-700', bg: 'bg-red-50' },
  7: { name: 'Bin 7 — Leakage Fail', color: 'bg-rose-500', textColor: 'text-rose-700', bg: 'bg-rose-50' },
  8: { name: 'Bin 8 — Functional Fail', color: 'bg-fuchsia-600', textColor: 'text-fuchsia-700', bg: 'bg-fuchsia-50' },
}

const formatParam = (name) => name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export default function UnitInvestigation({ engine }) {
  const { allUnits } = engine || { allUnits: [] }
  const [sortMode, setSortMode] = useState('Highest Risk')
  const [selectedUnitId, setSelectedUnitId] = useState(null)
  const [activeStageId, setActiveStageId] = useState(1)

  // Sort units
  const sortedUnits = useMemo(() => {
    let sorted = [...allUnits]
    if (sortMode === 'Highest Risk') sorted.sort((a, b) => (b.ensembleScore || 0) - (a.ensembleScore || 0))
    if (sortMode === 'Lowest Risk') sorted.sort((a, b) => (a.ensembleScore || 0) - (b.ensembleScore || 0))
    if (sortMode === 'Most Recent') sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    return sorted
  }, [allUnits, sortMode])

  const activeUnit = useMemo(() => {
    if (selectedUnitId) return allUnits.find(u => u.unit_id === selectedUnitId || u.id === selectedUnitId)
    return sortedUnits[0]
  }, [allUnits, sortedUnits, selectedUnitId])

  if (!activeUnit) {
    return <div className="flex h-full items-center justify-center text-slate-500">Waiting for units...</div>
  }

  // Determine early termination
  let terminationStage = 5
  if (activeUnit.decision === 'REJECT' || activeUnit.decision === 'REVIEW') {
    for (let i = 1; i <= 5; i++) {
      const rrs = (activeUnit[`rrs_${i}`] || 0) * 10
      if (rrs >= 8.5) {
        terminationStage = i
        break
      }
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[1600px] mx-auto font-sans bg-slate-50">
      
      {/* ═════════ ZONE 1: HERO PIPELINE (Top Navigation) ═════════ */}
      <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar shrink-0 px-8 py-6 bg-white border-b border-slate-200 shadow-sm z-10 relative">
        <div className="absolute top-1/2 left-24 right-24 h-1 bg-slate-100 -translate-y-1/2 -z-10" />

        {STAGES.map((stage) => {
          const rrs = (activeUnit[`rrs_${stage.id}`] || 0) * 10
          const delta = (activeUnit[`rrs_delta_${stage.id}`] || 0) * 10
          
          const isSkipped = stage.id > terminationStage
          const isTerminal = stage.id === terminationStage && (activeUnit.decision === 'REJECT' || activeUnit.decision === 'REVIEW')
          const isSelected = activeStageId === stage.id
          
          let statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200"
          let iconColor = "text-emerald-500"
          if (isSkipped) {
            statusColor = "bg-slate-50 text-slate-400 border-slate-200"
            iconColor = "text-slate-300"
          } else if (isTerminal || rrs >= 8.5) {
            statusColor = "bg-red-50 text-red-700 border-red-200"
            iconColor = "text-red-500"
          } else if (rrs > 5.0 || delta > 3.0) {
            statusColor = "bg-amber-50 text-amber-700 border-amber-200"
            iconColor = "text-amber-500"
          }

          return (
            <button
              key={stage.id}
              onClick={() => setActiveStageId(stage.id)}
              className={clsx(
                "flex-1 flex flex-col items-center gap-3 transition-all relative group",
                isSelected ? "scale-105" : "hover:scale-105"
              )}
            >
              <div className={clsx(
                "w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all bg-white",
                statusColor,
                isSelected ? "shadow-lg scale-110" : "shadow-sm"
              )}
              style={isSelected ? { borderColor: STAGE_COLORS[stage.id], ringColor: STAGE_COLORS[stage.id], ringWidth: '4px' } : {}}
              >
                <stage.icon size={24} className={iconColor} style={isSelected && !isTerminal && !isSkipped ? { color: STAGE_COLORS[stage.id] } : {}} />
              </div>

              <div className="text-center">
                <h4 className={clsx("text-[10px] font-black uppercase tracking-widest", isSkipped ? "text-slate-400" : "text-slate-800")}>
                  {stage.name}
                </h4>
                {!isSkipped && (
                  <div className="flex flex-col items-center mt-1">
                    <span className={clsx("text-xs font-bold", rrs >= 8.5 ? "text-red-600" : "text-slate-500")}>
                      RRS: {rrs.toFixed(1)}
                    </span>
                    {delta > 2.0 && (
                      <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 rounded">+ {delta.toFixed(1)}</span>
                    )}
                  </div>
                )}
                {isTerminal && (
                  <Badge className="bg-red-500 text-white mt-1 border-none shadow-md text-[9px] py-0">TERMINATED</Badge>
                )}
                {isSkipped && (
                  <span className="text-[10px] font-bold text-slate-400 mt-1 block">SKIPPED</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-6 flex-1 min-h-0 p-6">
        
        {/* ═════════ ZONE 2: UNIT DIRECTORY (Left 30%) ═════════ */}
        <div className="w-[380px] shrink-0 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col border-slate-200 shadow-sm rounded-[24px] overflow-hidden bg-white">
            <CardHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Database size={16} className="text-sky-500" />
                  Unit Directory
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-bold bg-white">{allUnits.length} Live</Badge>
              </div>
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  <option>Highest Risk</option>
                  <option>Lowest Risk</option>
                  <option>Most Recent</option>
                </select>
                <Filter size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </CardHeader>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {sortedUnits.map(unit => {
                const isSelected = (activeUnit.unit_id || activeUnit.id) === (unit.unit_id || unit.id)
                const risk = (unit.ensembleScore || 0) * 10
                const statusColor = risk >= 7 ? 'bg-red-500' : risk > 4 ? 'bg-amber-500' : 'bg-emerald-500'
                
                return (
                  <button
                    key={unit.unit_id || unit.id}
                    onClick={() => setSelectedUnitId(unit.unit_id || unit.id)}
                    className={clsx(
                      "w-full text-left p-4 rounded-2xl transition-all border group flex items-center justify-between",
                      isSelected ? "bg-slate-50 shadow-sm ring-1 border-sky-500 ring-sky-500" : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={clsx("w-2.5 h-2.5 rounded-full shadow-sm shrink-0", statusColor)} />
                      <div className="flex flex-col">
                        <span className={clsx("text-sm font-black tracking-tight", isSelected ? "text-slate-900" : "text-slate-800")}>
                          {unit.unit_id || unit.id}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {unit.decision}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Risk</span>
                      <span className={clsx(
                        "font-sans text-lg font-black leading-none",
                        risk >= 7 ? 'text-red-500' : risk > 4 ? 'text-amber-500' : 'text-emerald-500'
                      )}>
                        {risk.toFixed(1)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ═════════ ZONE 3: DEEP DIVE & RCA PANEL (Right 70%) ═════════ */}
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pb-6">
          
          {/* ROW A: Bin Classification + Archetype + Decision Summary */}
          <div className="grid grid-cols-3 gap-4 shrink-0">
            {(() => {
              const bin = BIN_INFO[activeUnit.bin_code] || BIN_INFO[1]
              return (
                <Card className={clsx("border-slate-200 shadow-sm rounded-[24px]", bin.bg)}>
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
                    <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black", bin.color)}>
                      {activeUnit.bin_code || 1}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bin Classification</span>
                    <span className={clsx("text-sm font-black", bin.textColor)}>{bin.name}</span>
                  </CardContent>
                </Card>
              )
            })()}
            
            <Card className="border-slate-200 shadow-sm rounded-[24px] bg-white">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
                <AlertTriangle size={28} className={activeUnit.decision === 'REJECT' ? "text-red-500" : activeUnit.decision === 'REVIEW' ? "text-amber-500" : "text-emerald-500"} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Defect Archetype</span>
                <span className="text-sm font-black text-slate-800">{activeUnit.archetype || 'Nominal'}</span>
              </CardContent>
            </Card>

            <Card className={clsx("border-slate-200 shadow-sm rounded-[24px]",
              activeUnit.decision === 'REJECT' ? "bg-red-50" : activeUnit.decision === 'REVIEW' ? "bg-amber-50" : "bg-emerald-50"
            )}>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
                <span className={clsx("text-4xl font-black font-sans",
                  activeUnit.decision === 'REJECT' ? "text-red-600" : activeUnit.decision === 'REVIEW' ? "text-amber-600" : "text-emerald-600"
                )}>
                  {((activeUnit.ensembleScore || 0) * 10).toFixed(1)}
                </span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fused Risk / 10</span>
                <Badge className={clsx("text-xs font-black border-none",
                  activeUnit.decision === 'REJECT' ? "bg-red-500" : activeUnit.decision === 'REVIEW' ? "bg-amber-500" : "bg-emerald-500"
                )}>{activeUnit.decision}</Badge>
              </CardContent>
            </Card>
          </div>

          {/* ROW B: Termination Callout (only if terminated early) */}
          {terminationStage < 5 && (
            <Card className="border-red-200 shadow-sm rounded-[24px] bg-red-50 shrink-0">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
                  <XCircle size={28} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-red-800 uppercase tracking-wide">
                    Early Termination at Stage {terminationStage}: {STAGES.find(s => s.id === terminationStage)?.name}
                  </h3>
                  <p className="text-xs text-red-600 mt-1">
                    Cumulative RRS reached <span className="font-black">{((activeUnit[`rrs_${terminationStage}`] || 0) * 10).toFixed(1)}/10</span> — 
                    exceeding the safety threshold (8.5). Stages {terminationStage + 1}–5 were skipped, 
                    saving processing cost on {5 - terminationStage} machine{5 - terminationStage > 1 ? 's' : ''}.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ROW C: Stage Sensor Telemetry with Deviation Analysis */}
          <Card className="border-slate-200 shadow-sm rounded-[24px] bg-white shrink-0">
            <CardHeader className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Settings2 size={16} style={{ color: STAGE_COLORS[activeStageId] }} />
                Stage {activeStageId}: {STAGES.find(s => s.id === activeStageId).name} — Sensor Deviation Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {activeStageId > terminationStage ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <XCircle size={48} className="text-slate-300" />
                  <p className="font-bold text-sm uppercase tracking-widest">Processing Terminated Prior to this Stage</p>
                  <p className="text-xs text-slate-400">This stage was skipped — no sensor data was collected.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {STAGES.find(s => s.id === activeStageId).params.map(paramKey => {
                    const val = activeUnit[paramKey]
                    if (val === undefined) return null
                    const ref = SENSOR_NOMINALS[paramKey] || { nominal: 0, unit: '' }
                    const deviation = ref.nominal !== 0 ? Math.abs(val - ref.nominal) / ref.nominal * 100 : 0
                    const isSuspicious = deviation > 30

                    return (
                      <div key={paramKey} className={clsx(
                        "p-5 rounded-2xl border transition-all",
                        isSuspicious ? "bg-red-50 border-red-200 ring-1 ring-red-200" : "bg-white border-slate-200 shadow-sm"
                      )}>
                        <div className="flex justify-between items-start mb-4">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest" style={!isSuspicious ? { color: STAGE_COLORS[activeStageId], borderColor: STAGE_COLORS[activeStageId] + '33' } : { color: '#dc2626', borderColor: '#fca5a5' }}>
                            {isSuspicious ? '⚠ Deviated' : 'Sensor'}
                          </Badge>
                          {isSuspicious && <AlertCircle size={16} className="text-red-500 animate-pulse" />}
                        </div>
                        
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-tight h-8">{formatParam(paramKey)}</h4>
                        <div className="flex items-baseline gap-1.5">
                          <span className={clsx("text-3xl font-sans font-black", isSuspicious ? "text-red-600" : "text-slate-800")} style={!isSuspicious ? { color: STAGE_COLORS[activeStageId] } : {}}>
                            {Number.isInteger(val) ? val : val.toFixed(2)}
                          </span>
                          <span className="text-xs font-bold text-slate-400">{ref.unit}</span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400">
                            Nominal: <span className="text-slate-600">{ref.nominal}{ref.unit}</span>
                          </span>
                          <span className={clsx("text-[10px] font-black", isSuspicious ? "text-red-500" : "text-emerald-500")}>
                            {deviation > 0.1 ? (isSuspicious ? `↑ ${deviation.toFixed(0)}% off` : `${deviation.toFixed(0)}% dev`) : '✓ On target'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ROW D: Tri-Shield Verdict */}
          <Card className="flex flex-col border-slate-200 shadow-sm rounded-[24px] overflow-hidden bg-white shrink-0">
             <CardHeader className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <ShieldAlert size={16} className="text-sky-500" />
                  Tri-Shield Final Verdict & Explainability
                </CardTitle>
             </CardHeader>
             <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shield 1: LightGBM</span>
                      <span className={clsx("font-black", activeUnit.lgbScore > 0.6 ? "text-red-500" : "text-emerald-500")}>
                        {((activeUnit.lgbScore || 0) * 100).toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={clsx("h-full rounded-full transition-all", activeUnit.lgbScore > 0.6 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${(activeUnit.lgbScore || 0) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shield 2: Isolation Forest</span>
                      <span className={clsx("font-black", activeUnit.isoScore > 0.5 ? "text-amber-500" : "text-emerald-500")}>
                        {((activeUnit.isoScore || 0) * 100).toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={clsx("h-full rounded-full transition-all", activeUnit.isoScore > 0.5 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${(activeUnit.isoScore || 0) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shield 3: Physics Rules</span>
                      <span className={clsx("font-black", activeUnit.behScore > 0.6 ? "text-red-500" : "text-emerald-500")}>
                        {((activeUnit.behScore || 0) * 100).toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={clsx("h-full rounded-full transition-all", activeUnit.behScore > 0.6 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${(activeUnit.behScore || 0) * 100}%` }} />
                    </div>
                  </div>
                </div>

                <div className="col-span-2 border-l border-slate-100 pl-8 flex flex-col justify-center">
                  {activeUnit.reasons && activeUnit.reasons.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Model Triggers:</span>
                      <div className="flex flex-wrap gap-2">
                        {activeUnit.reasons.map((r, i) => (
                          <Badge key={i} variant="outline" className="text-xs font-bold py-2 px-3 bg-slate-50 border-slate-200 text-slate-600">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

             </CardContent>
          </Card>
          
        </div>
      </div>
    </div>
  )
}
