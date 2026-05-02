import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { 
  Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle, 
  Search, AlertTriangle, ChevronDown, Filter, Settings2,
  AlertCircle, Activity, Box, Database, Clock, TrendingUp, ShieldAlert, Droplet,
  XCircle, BookOpen
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell, LabelList } from 'recharts'
import clsx from 'clsx'
import { useROM } from '../hooks/useROM'

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

// ─── ROM MOCK COMPUTATION ──────────────────────────────────────────────────
const ROM_NOMINAL = {
  bond_force: 30.0, xy_placement_offset: 0.0, bond_line_thickness: 25.0,
  epoxy_viscosity: 5000, pick_place_speed: 8000,
  ultrasonic_power: 1.2, bond_time: 15.0, loop_height: 200.0,
  capillary_stroke_count: 0, efo_voltage: 60.0,
  transfer_pressure: 8.0, clamping_force: 50.0, molding_temperature: 180.0, vacuum_level: 2.0,
  ball_placement_accuracy: 0.0, laser_pulse_energy: 12.0, reflow_peak_temp: 260.0, flux_density: 0.8,
  spindle_current: 2.0, vibration_amplitude: 0.0, blade_wear_index: 0.0, cooling_water_flow: 1.5,
}

const ROM_HALF_RANGE = {
  bond_force: 5, xy_placement_offset: 15, bond_line_thickness: 7,
  epoxy_viscosity: 1000, pick_place_speed: 2000,
  ultrasonic_power: 0.4, bond_time: 5, loop_height: 50,
  capillary_stroke_count: 500000, efo_voltage: 10,
  transfer_pressure: 2, clamping_force: 10, molding_temperature: 10, vacuum_level: 10,
  ball_placement_accuracy: 25, laser_pulse_energy: 2, reflow_peak_temp: 10, flux_density: 0.3,
  spindle_current: 0.5, vibration_amplitude: 1.5, blade_wear_index: 1, cooling_water_flow: 0.5,
}

const ROM_STAGE_PARAMS = {
  'Die Bond': ['bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity', 'pick_place_speed'],
  'Wire Bond': ['ultrasonic_power', 'bond_time', 'loop_height', 'capillary_stroke_count', 'efo_voltage'],
  'Mold': ['transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level'],
  'Ball Attach': ['ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density'],
  'Saw': ['spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow'],
}

const ROM_STAGE_COLORS_MAP = {
  'Die Bond': '#2563eb', 'Wire Bond': '#7c3aed', 'Mold': '#d97706', 'Ball Attach': '#0891b2', 'Saw': '#ec4899'
}

function gaussianHotspot(x, y, cx, cy, sigma, amplitude) {
  return amplitude * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma ** 2))
}

function computeMockStressField(unit) {
  const GRID = 50
  const grid = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => 20.0))
  
  const dev = (key) => {
    const val = unit[key] ?? ROM_NOMINAL[key]
    const hr = ROM_HALF_RANGE[key] || 1
    return Math.abs(val - ROM_NOMINAL[key]) / hr
  }

  // Stage 1 — Die Bond
  const forceDev = dev('bond_force')
  const offsetNorm = (unit.xy_placement_offset || 0) / 15
  const bltDev = dev('bond_line_thickness')
  const ampCenter = forceDev * 35 + dev('epoxy_viscosity') * 8
  const ampCorners = offsetNorm * 25 + bltDev * 18

  // Stage 3 — Mold
  const tempDev = dev('molding_temperature')
  const vacRisk = (unit.vacuum_level || 2) / 10
  const pressDev = dev('transfer_pressure')

  // Stage 4 — Ball Attach
  const reflowDev = dev('reflow_peak_temp')
  const ballErr = (unit.ball_placement_accuracy || 0) / 25

  // Stage 5 — Saw
  const vibNorm = (unit.vibration_amplitude || 0) / 1.5
  const bladeWear = unit.blade_wear_index || 0

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const x = col / (GRID - 1)
      const y = row / (GRID - 1)

      // Die Bond center + corners
      grid[row][col] += gaussianHotspot(x, y, 0.5, 0.5, 0.18, ampCenter)
      grid[row][col] += gaussianHotspot(x, y, 0.2, 0.2, 0.09, ampCorners)
      grid[row][col] += gaussianHotspot(x, y, 0.8, 0.2, 0.09, ampCorners * 0.9)
      grid[row][col] += gaussianHotspot(x, y, 0.2, 0.8, 0.09, ampCorners * 0.95)
      grid[row][col] += gaussianHotspot(x, y, 0.8, 0.8, 0.09, ampCorners)

      // Mold thermal stress
      grid[row][col] += gaussianHotspot(x, y, 0.5, 0.5, 0.35, tempDev * 40)
      grid[row][col] += gaussianHotspot(x, y, 0.3, 0.4, 0.12, vacRisk * 25)
      grid[row][col] += gaussianHotspot(x, y, 0.7, 0.6, 0.1, vacRisk * 20)

      // Ball Attach
      for (let bx = 0.15; bx <= 0.86; bx += 0.14) {
        grid[row][col] += gaussianHotspot(x, y, bx, 0.88, 0.07, reflowDev * 30 + ballErr * 20)
      }

      // Saw edges
      const ampSaw = vibNorm * 22 + bladeWear * 30
      grid[row][col] += gaussianHotspot(x, y, 0.5, 0.02, 0.08, ampSaw)
      grid[row][col] += gaussianHotspot(x, y, 0.5, 0.98, 0.08, ampSaw * 0.9)
      grid[row][col] += gaussianHotspot(x, y, 0.02, 0.5, 0.08, ampSaw * 0.85)
      grid[row][col] += gaussianHotspot(x, y, 0.98, 0.5, 0.08, ampSaw)

      // Clamp
      grid[row][col] = Math.min(Math.max(grid[row][col], 0), 300)
    }
  }
  return grid
}

function computeMockSensitivity(unit) {
  const sensitivities = {}
  const params = Object.keys(ROM_NOMINAL)
  
  params.forEach(p => {
    const val = unit[p] ?? ROM_NOMINAL[p]
    const hr = ROM_HALF_RANGE[p] || 1
    sensitivities[p] = Math.abs(val - ROM_NOMINAL[p]) / hr
  })

  const total = Object.values(sensitivities).reduce((s, v) => s + v, 0) || 1
  const normalized = {}
  for (const [k, v] of Object.entries(sensitivities)) {
    normalized[k] = v / total
  }
  return Object.fromEntries(Object.entries(normalized).sort(([, a], [, b]) => b - a))
}

function computeStageAttribution(sensitivities) {
  const stages = {}
  for (const [stage, params] of Object.entries(ROM_STAGE_PARAMS)) {
    stages[stage] = params.reduce((s, p) => s + (sensitivities[p] || 0), 0)
  }
  return Object.fromEntries(Object.entries(stages).sort(([, a], [, b]) => b - a))
}

// ─── Canvas Heatmap Component ──────────────────────────────────────────────
function StressHeatmapCanvas({ stressGrid, maxStress }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !stressGrid || stressGrid.length === 0) return
    const ctx = canvas.getContext('2d')
    const gridSize = stressGrid.length
    const cellW = canvas.width / gridSize
    const cellH = canvas.height / gridSize
    const max = maxStress || 1

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const val = stressGrid[row][col]
        const norm = Math.min(val / max, 1)
        const hue = (1 - norm) * 240 // blue → red
        ctx.fillStyle = `hsl(${hue}, 100%, 45%)`
        ctx.fillRect(col * cellW, row * cellH, cellW + 0.5, cellH + 0.5)
      }
    }
  }, [stressGrid, maxStress])

  return (
    <canvas 
      ref={canvasRef} 
      width={250} 
      height={250} 
      className="rounded-lg border border-slate-200 shadow-inner"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

function GaugeChart({ score, decision }) {
  const radius = 60;
  const strokeWidth = 12;
  const cx = 80;
  const cy = 70;
  const circumference = Math.PI * radius;
  // score is 0 to 10
  const normalizedScore = Math.min(Math.max(score, 0), 10);
  const fillPercentage = normalizedScore / 10;
  const strokeDashoffset = circumference - (fillPercentage * circumference);

  let color = "#10b981"; // emerald
  if (decision === 'REVIEW' || (score >= 4 && score < 7)) color = "#f59e0b"; // amber
  if (decision === 'REJECT' || score >= 7) color = "#ef4444"; // red

  const angle = (fillPercentage * 180) - 90; // -90 to 90

  return (
    <div className="relative flex flex-col items-center justify-center w-[160px] h-[90px]">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 160 80">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        {/* Background Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Foreground Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Needle */}
        <g transform={`rotate(${angle}, ${cx}, ${cy})`} className="transition-all duration-1000 ease-out">
          <polygon points={`${cx - 4},${cy} ${cx + 4},${cy} ${cx},${cy - radius + 10}`} fill="#334155" />
          <circle cx={cx} cy={cy} r="6" fill="#334155" />
          <circle cx={cx} cy={cy} r="2" fill="#ffffff" />
        </g>
      </svg>
      <div className="absolute bottom-[-20px] text-center w-full">
         <span className={clsx("text-3xl font-black font-sans leading-none", 
            decision === 'REJECT' ? 'text-red-600' : decision === 'REVIEW' ? 'text-amber-600' : 'text-emerald-600'
         )}>{score.toFixed(1)}</span>
      </div>
    </div>
  )
}

export default function UnitInvestigation({ engine }) {
  const { allUnits } = engine || { allUnits: [] }
  const [sortMode, setSortMode] = useState('Highest Risk')
  const [selectedUnitId, setSelectedUnitId] = useState(null)
  const [activeStageId, setActiveStageId] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')

  // Sort units
  const sortedUnits = useMemo(() => {
    let sorted = [...allUnits]
    if (sortMode === 'Highest Risk') sorted.sort((a, b) => (b.ensembleScore || 0) - (a.ensembleScore || 0))
    if (sortMode === 'Lowest Risk') sorted.sort((a, b) => (a.ensembleScore || 0) - (b.ensembleScore || 0))
    if (sortMode === 'Most Recent') sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    return sorted
  }, [allUnits, sortMode])

  // Filter by search
  const filteredUnits = useMemo(() => {
    if (!searchTerm.trim()) return sortedUnits
    const term = searchTerm.toLowerCase()
    return sortedUnits.filter(u =>
      (u.unit_id || u.id || '').toLowerCase().includes(term) ||
      (u.lotId || '').toLowerCase().includes(term) ||
      (u.archetype || '').toLowerCase().includes(term)
    )
  }, [sortedUnits, searchTerm])

  const activeUnit = useMemo(() => {
    if (selectedUnitId) return allUnits.find(u => u.unit_id === selectedUnitId || u.id === selectedUnitId)
    return sortedUnits[0]
  }, [allUnits, sortedUnits, selectedUnitId])

  // ROM Digital Twin — call backend physics engine for the selected unit
  const romParams = useMemo(() => {
    if (!activeUnit) return null
    const keys = [
      'bond_force','xy_placement_offset','bond_line_thickness','epoxy_viscosity','pick_place_speed',
      'ultrasonic_power','bond_time','loop_height','capillary_stroke_count','efo_voltage',
      'transfer_pressure','clamping_force','molding_temperature','vacuum_level',
      'ball_placement_accuracy','laser_pulse_energy','reflow_peak_temp','flux_density',
      'spindle_current','vibration_amplitude','blade_wear_index','cooling_water_flow'
    ]
    const p = {}
    keys.forEach(k => { p[k] = activeUnit[k] ?? 0 })
    return p
  }, [activeUnit])

  const { romResult, isLoading: romLoading } = useROM(romParams || {})

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

            {/* Search */}
            <div className="px-4 pt-3 pb-1 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search unit ID, lot..."
                  className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-300 placeholder:text-slate-300 shadow-sm"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredUnits.map(unit => {
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
                  {/* Gauge Chart for Overall Risk */}
                  <div className="flex flex-col items-center justify-center mb-8 pb-6 border-b border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Overall Ensemble Risk</span>
                    <GaugeChart score={(activeUnit.ensembleScore || 0) * 10} decision={activeUnit.decision} />
                  </div>

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

          {/* ROW E: ROM Digital Twin Insights */}
          {(() => {
            // Use backend ROM result — physics-derived CRI instead of raw RRS
            if (!romResult) {
              return (
                <Card className="flex flex-col border-slate-200 shadow-sm rounded-[24px] overflow-hidden bg-white shrink-0">
                  <CardContent className="p-8 flex items-center justify-center h-[340px]">
                    <div className="text-sm text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                      {romLoading ? '⚡ Computing ROM Reconstruction...' : 'Waiting for ROM data...'}
                    </div>
                  </CardContent>
                </Card>
              )
            }

            const stressGrid = romResult.stress_map.values
            const maxStress = romResult.stress_map.max_stress_mpa
            const meanStress = romResult.stress_map.mean_stress_mpa

            const stageAttr = romResult.root_cause.stage_contributions
            const sensitivities = romResult.root_cause.parameter_contributions

            const rrsValues = romResult.cri_lifecycle.cumulative_cri
            const rrsDeltas = romResult.cri_lifecycle.stage_deltas
            const stageNames = romResult.cri_lifecycle.stages
            const criData = stageNames.map((name, i) => ({
              stage: name,
              cri: rrsValues[i],
              delta: rrsDeltas[i],
            }))
            const finalCRI = rrsValues[4]
            const isCritical = activeUnit.decision === 'REJECT' || activeUnit.decision === 'REVIEW'
            const spikeIdx = rrsDeltas.indexOf(Math.max(...rrsDeltas))

            const stageAttrData = Object.entries(stageAttr).map(([name, value]) => ({
              name,
              value: Math.round(value * 100),
              color: ROM_STAGE_COLORS_MAP[name] || '#94a3b8',
            }))

            const primaryStage = romResult.root_cause.primary_stage
            const primaryParam = romResult.root_cause.primary_parameter

            const physicsExplanations = [
              {
                title: primaryStage || 'Mold',
                contribution: stageAttr[primaryStage] ? `${(stageAttr[primaryStage] * 100).toFixed(0)}%` : '—',
                deviation: `${formatParam(primaryParam)} deviated from nominal`,
                effect: primaryStage === 'Die Bond' ? 'Bond force deviation → epoxy void / delamination risk at die-mold interface' :
                        primaryStage === 'Wire Bond' ? 'Ultrasonic power/capillary wear → weak wire bonds, potential lift-off' :
                        primaryStage === 'Mold' ? 'CTE mismatch → thermal stress at die-mold interface, void formation' :
                        primaryStage === 'Ball Attach' ? 'Thermal overshoot → solder joint fatigue, intermetallic fracture' :
                        'Blade wear × vibration → edge chipping, kerf damage',
                location: primaryStage === 'Die Bond' ? 'Die center + corners' :
                          primaryStage === 'Wire Bond' ? 'Bond pad ring periphery' :
                          primaryStage === 'Mold' ? 'Center + void concentrators' :
                          primaryStage === 'Ball Attach' ? 'BGA ball grid (bottom)' :
                          'Package perimeter edges',
                color: 'text-red-600', bg: 'bg-red-50', borderColor: 'border-red-200',
              },
              {
                title: Object.keys(stageAttr)[1] || 'Wire Bond',
                contribution: stageAttr[Object.keys(stageAttr)[1]] ? `${(stageAttr[Object.keys(stageAttr)[1]] * 100).toFixed(0)}%` : '—',
                deviation: 'Secondary stress contributor',
                effect: 'Compound interaction with primary stage increases cumulative failure probability',
                location: 'Distributed across affected regions',
                color: 'text-amber-600', bg: 'bg-amber-50', borderColor: 'border-amber-200',
              },
              {
                title: 'Cumulative RRS',
                contribution: `${(finalCRI * 100).toFixed(0)}%`,
                deviation: `Final CRI: ${finalCRI.toFixed(4)}`,
                effect: isCritical ? 'Tolerance stack exceeds critical threshold — unit at high risk of burn-in failure' : 'Cumulative stress within acceptable envelope',
                location: 'Global — all stages contribute',
                color: isCritical ? 'text-red-600' : 'text-emerald-600',
                bg: isCritical ? 'bg-red-50' : 'bg-emerald-50',
                borderColor: isCritical ? 'border-red-200' : 'border-emerald-200',
              },
            ]

            return (
              <Card className="flex flex-col border-slate-200 shadow-sm rounded-[24px] overflow-hidden bg-white shrink-0">
                <CardHeader className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <Zap size={16} className="text-blue-500" />
                      ROM Digital Twin — Stress & Root Cause Analysis
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[9px] font-black bg-blue-50 border-blue-200 text-blue-600">
                        POD Modes: {romResult.rom_metadata.pod_modes_used}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] font-black bg-white border-slate-200 text-slate-500">
                        {romResult.rom_metadata.reconstruction_time_ms.toFixed(1)}ms
                      </Badge>
                      <Badge variant="outline" className={clsx("text-[9px] font-black", isCritical ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-600")}>
                        {isCritical ? '⚠ CRITICAL' : '✓ HEALTHY'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  
                  {/* Row 1: Heatmap + CRI Lifecycle + Root Cause */}
                  <div className="grid grid-cols-3 gap-6">
                    
                    {/* 2D Stress Distribution Heatmap */}
                    <div className="flex flex-col items-center">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 self-start">
                        2D Stress Distribution (Von Mises)
                      </h4>
                      <StressHeatmapCanvas stressGrid={stressGrid} maxStress={maxStress} />
                      <div className="mt-3 w-full space-y-2">
                        <div className="flex items-center justify-center gap-2 text-[9px] uppercase text-slate-400 font-bold">
                          <span>Low</span>
                          <div className="w-24 h-2 bg-gradient-to-r from-blue-600 to-red-600 rounded-full opacity-70" />
                          <span>High</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 px-2">
                          <span>Max: <span className={clsx("font-black", maxStress > 150 ? "text-red-500" : "text-slate-700")}>{maxStress.toFixed(1)} MPa</span></span>
                          <span>Mean: <span className="font-black text-slate-700">{meanStress.toFixed(1)} MPa</span></span>
                        </div>
                      </div>
                    </div>

                    {/* CRI Lifecycle Trajectory */}
                    <div className="flex flex-col">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                        CRI Lifecycle Trajectory
                      </h4>
                      <div className="flex-1 min-h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={criData} margin={{ top: 10, right: 10, left: -20, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis
                              dataKey="stage" stroke="#94a3b8"
                              tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }}
                              angle={-35} textAnchor="end" height={60}
                            />
                            <YAxis domain={[0, 1.0]} stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                              formatter={(val) => [val.toFixed(4), 'CRI']}
                            />
                            <ReferenceLine y={0.6} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2}
                              label={{ position: 'top', value: 'Critical', fill: '#ef4444', fontSize: 9, fontWeight: 'bold' }}
                            />
                            <Line
                              type="monotone" dataKey="cri"
                              stroke={isCritical ? "#ef4444" : "#3b82f6"} strokeWidth={3}
                              dot={(props) => {
                                const { cx, cy, index } = props
                                const isSpike = index === spikeIdx
                                return (
                                  <circle
                                    key={index} cx={cx} cy={cy}
                                    r={isSpike ? 6 : 4}
                                    fill={isCritical ? "#ef4444" : "#3b82f6"}
                                    stroke={isSpike ? "#fff" : "none"}
                                    strokeWidth={isSpike ? 2 : 0}
                                  />
                                )
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {spikeIdx >= 0 && (
                        <div className="mt-2 text-[10px] font-bold text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                          ⚡ Spike at <span className="font-black text-slate-800">{stageNames[spikeIdx]}</span> (+{(rrsDeltas[spikeIdx]).toFixed(4)})
                        </div>
                      )}
                    </div>

                    {/* Root Cause Attribution */}
                    <div className="flex flex-col">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                        Root Cause Attribution (by Stage)
                      </h4>
                      <div className="flex-1 min-h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={stageAttrData} margin={{ top: 10, right: 40, left: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                              type="category" dataKey="name" stroke="#94a3b8"
                              tick={{ fontSize: 10, fill: '#1e293b', fontWeight: 'bold' }} width={100}
                            />
                            <Tooltip
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                              formatter={(val) => [`${val}%`, 'Attribution']}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                              {stageAttrData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                              <LabelList dataKey="value" position="right" fill="#1e293b" formatter={(v) => `${v}%`} fontSize={11} fontWeight="bold" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        🎯 Primary: <span className="font-black text-slate-800">{primaryStage}</span> → <span className="font-black" style={{ color: ROM_STAGE_COLORS_MAP[primaryStage] }}>{formatParam(primaryParam)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Physics-Based Diagnostic Explanations */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen size={14} className="text-blue-500" />
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Physics-Based Diagnostic Explanations</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {physicsExplanations.map((item) => (
                        <div key={item.title} className={clsx("p-5 rounded-2xl border shadow-sm", item.bg, item.borderColor)}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{item.title}</span>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                              {item.contribution} Contrib.
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-0.5">Deviation</p>
                              <p className={clsx("text-xs font-black", item.color)}>{item.deviation}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-0.5">Physical Effect</p>
                              <p className="text-xs text-slate-600 leading-relaxed font-bold">{item.effect}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-0.5">Impact Region</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500/40" />
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-tight italic">{item.location}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </CardContent>
              </Card>
            )
          })()}
          
        </div>
      </div>
    </div>
  )
}
