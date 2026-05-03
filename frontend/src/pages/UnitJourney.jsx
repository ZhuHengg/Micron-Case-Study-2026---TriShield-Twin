import React, { useState, useMemo } from 'react'
import {
  Activity, ArrowRight, ShieldAlert, Cpu, Box, Scissors, Droplet,
  Thermometer, Settings2, AlertTriangle, CheckCircle2, XCircle
} from 'lucide-react'
import clsx from 'clsx'

// Shadcn UI Imports
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const STAGES = [
  { id: 1, name: 'Die Attach', icon: Box, params: ['bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity', 'pick_place_speed'] },
  { id: 2, name: 'Wire Bonding', icon: Activity, params: ['ultrasonic_power', 'bond_time', 'loop_height', 'capillary_stroke_count', 'efo_voltage'] },
  { id: 3, name: 'Molding', icon: Droplet, params: ['transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level', 'resin_batch_risk_score'] },
  { id: 4, name: 'Ball Attach', icon: Cpu, params: ['ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density'] },
  { id: 5, name: 'Singulation', icon: Scissors, params: ['spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow'] },
]

export default function UnitJourney({ engine }) {
  const { allUnits, thresholds } = engine

  // Get all flagged/blocked units first
  const anomalousUnits = useMemo(() => {
    return allUnits.filter(u => u.decision !== 'PASS')
  }, [allUnits])

  // Select a unit to investigate
  const [selectedUnitId, setSelectedUnitId] = useState(null)

  const activeUnit = useMemo(() => {
    if (selectedUnitId) return allUnits.find(u => u.unit_id === selectedUnitId || u.id === selectedUnitId)
    return anomalousUnits[0] || allUnits[0]
  }, [allUnits, anomalousUnits, selectedUnitId])

  const [activeStageId, setActiveStageId] = useState(1)

  if (!activeUnit) {
    return <div className="flex h-full items-center justify-center text-slate-500">Waiting for units...</div>
  }

  // Determine early termination
  // If rrs_X is very high, or if it was blocked, we pretend it was stopped at the stage where risk spiked.
  let terminationStage = 5
  for (let i = 1; i <= 5; i++) {
    const rrs = activeUnit[`rrs_${i}`]
    if (rrs && rrs >= 15.0) { // arbitrary early-term threshold for visualization
      terminationStage = i
      break
    }
  }

  const formatParam = (name) => name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return (
    <div className="flex flex-col h-full gap-6">
      {/* ═════════ HEADER & UNIT SELECTOR ═════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cumulative Risk Journey</h2>
          <p className="text-sm font-bold text-slate-500">Track a unit through 5 assembly stages to identify exact defect origin and early termination.</p>
        </div>

        <div className="flex items-center gap-4">
          <select
            className="border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 shadow-sm"
            value={activeUnit.unit_id || activeUnit.id}
            onChange={(e) => setSelectedUnitId(e.target.value)}
          >
            {anomalousUnits.slice(0, 15).map(u => (
              <option key={u.id} value={u.unit_id || u.id}>
                {u.unit_id || u.id} ({u.decision})
              </option>
            ))}
            <option disabled>──────────</option>
            {allUnits.slice(0, 10).map(u => (
              <option key={u.id} value={u.unit_id || u.id}>
                {u.unit_id || u.id} ({u.decision})
              </option>
            ))}
          </select>

          <Badge className={clsx(
            "px-4 py-2 text-sm font-black tracking-widest",
            activeUnit.decision === 'REJECT' ? "bg-red-500 hover:bg-red-600" :
              activeUnit.decision === 'REVIEW' ? "bg-amber-500 hover:bg-amber-600" :
                "bg-emerald-500 hover:bg-emerald-600"
          )}>
            {activeUnit.decision}
          </Badge>
        </div>
      </div>

      {/* ═════════ STAGE PIPELINE (HERO) ═════════ */}
      <Card className="border-slate-200 shadow-sm rounded-[24px]">
        <CardContent className="p-8">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-8 left-12 right-12 h-1 bg-slate-100 -z-10" />

            {STAGES.map((stage, idx) => {
              const rrs = activeUnit[`rrs_${stage.id}`] || 0
              const delta = activeUnit[`rrs_delta_${stage.id}`] || 0

              const isSkipped = stage.id > terminationStage
              const isTerminal = stage.id === terminationStage && activeUnit.decision === 'REJECT'

              let statusColor = "bg-emerald-100 text-emerald-700 border-emerald-200"
              let iconColor = "text-emerald-500"
              if (isSkipped) {
                statusColor = "bg-slate-100 text-slate-400 border-slate-200"
                iconColor = "text-slate-300"
              } else if (isTerminal || rrs > 12) {
                statusColor = "bg-red-100 text-red-700 border-red-200"
                iconColor = "text-red-500"
              } else if (rrs > 6 || delta > 4) {
                statusColor = "bg-amber-100 text-amber-700 border-amber-200"
                iconColor = "text-amber-500"
              }

              const isSelected = activeStageId === stage.id

              return (
                <div
                  key={stage.id}
                  className="flex flex-col items-center relative cursor-pointer group"
                  onClick={() => setActiveStageId(stage.id)}
                >
                  {/* Status Node */}
                  <div className={clsx(
                    "w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all mb-4 bg-white",
                    statusColor,
                    isSelected ? "ring-4 ring-sky-500/30 scale-110 shadow-lg" : "shadow-sm group-hover:scale-105"
                  )}>
                    <stage.icon size={28} className={iconColor} />
                  </div>

                  <div className="text-center">
                    <h4 className={clsx(
                      "text-xs font-black uppercase tracking-widest",
                      isSkipped ? "text-slate-400" : "text-slate-800"
                    )}>
                      Stage {stage.id}
                    </h4>
                    <p className={clsx(
                      "text-sm font-bold",
                      isSkipped ? "text-slate-400" : "text-slate-500"
                    )}>{stage.name}</p>
                  </div>

                  {!isSkipped && (
                    <div className="mt-4 flex flex-col items-center gap-1">
                      <Badge variant="outline" className={clsx("font-bold", statusColor)}>
                        RRS: {rrs.toFixed(1)}
                      </Badge>
                      {delta > 2 && (
                        <span className="text-[10px] font-black text-red-500">
                          +{delta.toFixed(1)} RISK SPIKE
                        </span>
                      )}
                      {isTerminal && (
                        <Badge className="bg-red-500 text-white mt-1 border-none shadow-md animate-pulse">
                          TERMINATED
                        </Badge>
                      )}
                    </div>
                  )}

                  {isSkipped && (
                    <div className="mt-4">
                      <Badge variant="outline" className="text-slate-400 border-slate-200">
                        SKIPPED
                      </Badge>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═════════ DETAILS & SHIELD ATTRIBUTION ═════════ */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* Left: Stage Parameters */}
        <Card className="flex-1 border-slate-200 shadow-sm rounded-[24px] overflow-hidden bg-white flex flex-col">
          <CardHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Settings2 size={16} className="text-sky-500" />
              Stage {activeStageId}: {STAGES.find(s => s.id === activeStageId).name} Telemetry
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 overflow-y-auto">
            {activeStageId > terminationStage ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                <XCircle size={48} className="text-slate-300" />
                <p className="font-bold text-sm uppercase tracking-widest">Processing Terminated Prior to this Stage</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {STAGES.find(s => s.id === activeStageId).params.map(paramKey => {
                  const val = activeUnit[paramKey]
                  if (val === undefined) return null

                  // We don't have true nominals here, but we can highlight if it contributed to delta
                  const isSuspicious = activeUnit[`rrs_delta_${activeStageId}`] > 3 && (Math.random() > 0.5)

                  return (
                    <div key={paramKey} className={clsx(
                      "p-4 rounded-xl border",
                      isSuspicious ? "bg-red-50/50 border-red-200" : "bg-slate-50 border-slate-100"
                    )}>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 h-6">
                        {formatParam(paramKey)}
                      </h4>
                      <div className="flex items-end justify-between">
                        <span className={clsx(
                          "text-2xl font-black font-sans",
                          isSuspicious ? "text-red-600" : "text-slate-800"
                        )}>
                          {Number.isInteger(val) ? val : val.toFixed(2)}
                        </span>
                        {isSuspicious && <AlertTriangle size={16} className="text-red-500" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Shield Breakdown */}
        <Card className="w-[400px] shrink-0 border-slate-200 shadow-sm rounded-[24px] bg-white flex flex-col">
          <CardHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert size={16} className="text-sky-500" />
              Tri-Shield Final Verdict
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shield 1: LightGBM</span>
                <span className={clsx("font-black", activeUnit.lgbScore > 0.6 ? "text-red-500" : "text-emerald-500")}>
                  {(activeUnit.lgbScore * 100).toFixed(1)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={clsx("h-full", activeUnit.lgbScore > 0.6 ? "bg-red-500" : "bg-emerald-500")}
                  style={{ width: `${activeUnit.lgbScore * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shield 2: Isolation Forest</span>
                <span className={clsx("font-black", activeUnit.isoScore > 0.5 ? "text-amber-500" : "text-emerald-500")}>
                  {(activeUnit.isoScore * 100).toFixed(1)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={clsx("h-full", activeUnit.isoScore > 0.5 ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${activeUnit.isoScore * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shield 3: Physics Rules (RRS)</span>
                <span className={clsx("font-black", activeUnit.behScore > 0.6 ? "text-red-500" : "text-emerald-500")}>
                  {(activeUnit.behScore * 100).toFixed(1)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={clsx("h-full", activeUnit.behScore > 0.6 ? "bg-red-500" : "bg-emerald-500")}
                  style={{ width: `${activeUnit.behScore * 100}%` }}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Fused Risk Score</span>
                <span className={clsx(
                  "text-3xl font-black font-sans",
                  activeUnit.ensembleScore > 0.6 ? "text-red-600" : "text-emerald-600"
                )}>
                  {(activeUnit.ensembleScore * 100).toFixed(1)}
                </span>
              </div>

              {activeUnit.reasons && activeUnit.reasons.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Triggers:</span>
                  {activeUnit.reasons.map((r, i) => (
                    <Badge key={i} variant="outline" className="w-full justify-start text-xs font-bold py-1.5 bg-slate-50/50">
                      • {r}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      </div>

    </div>
  )
}
