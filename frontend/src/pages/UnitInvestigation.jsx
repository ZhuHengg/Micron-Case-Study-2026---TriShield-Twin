import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle,
  Search, AlertTriangle, ChevronDown, Filter, Settings2, Target,
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
  { id: 1, name: 'Die Attach', icon: Box, params: ['bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity', 'pick_place_speed'] },
  { id: 2, name: 'Wire Bonding', icon: Activity, params: ['ultrasonic_power', 'bond_time', 'loop_height', 'capillary_stroke_count', 'efo_voltage'] },
  { id: 3, name: 'Molding', icon: Droplet, params: ['transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level', 'resin_batch_risk_score'] },
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
  resin_batch_risk_score: { nominal: 0.1, unit: 'RISK' },
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

        // Restoring the classic, highly-readable thermal gradient
        const hue = (1 - norm) * 240 // blue (240) → red (0)
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`
        ctx.fillRect(Math.floor(col * cellW), Math.floor(row * cellH), Math.ceil(cellW), Math.ceil(cellH))
      }
    }
  }, [stressGrid, maxStress])

  return (
    <div className="relative group">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="rounded-[24px] border border-slate-200/60 shadow-inner w-full aspect-square"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/20 pointer-events-none" />

      {/* Overlay Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-40 rounded-[24px] pointer-events-none" />
    </div>
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
        <span className={clsx("text-3xl font-black font-mono leading-none",
          decision === 'REJECT' ? 'text-red-400' : decision === 'REVIEW' ? 'text-amber-400' : 'text-emerald-400'
        )}>{score.toFixed(1)}</span>
      </div>
    </div>
  )
}

export default function UnitInvestigation({ engine }) {
  const { allUnits = [] } = engine || {}
  const [sortMode, setSortMode] = useState('Highest Risk')
  const [searchTerm, setSearchTerm] = useState('')
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
      'bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity', 'pick_place_speed',
      'ultrasonic_power', 'bond_time', 'loop_height', 'capillary_stroke_count', 'efo_voltage',
      'transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level',
      'ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density',
      'spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow'
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
    <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[1600px] mx-auto font-sans bg-gradient-to-br from-[#050A18] to-[#111827] relative overflow-hidden text-slate-100 transition-colors duration-500">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes subtle-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .electric-grid {
          background-size: 40px 40px;
          background-image: 
            linear-gradient(to right, rgba(0, 102, 204, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 102, 204, 0.05) 1px, transparent 1px);
        }
      `}</style>

      {/* Electric Grid Background */}
      <div className="absolute inset-0 electric-grid pointer-events-none" />

      {/* Dynamic Background Glows (Atmospheric) */}
      <div className={clsx(
        "absolute -bottom-24 -left-24 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none transition-all duration-1000 animate-subtle-pulse",
        activeUnit.decision === 'REJECT' ? "bg-red-600/10" : activeUnit.decision === 'REVIEW' ? "bg-amber-600/10" : "bg-blue-600/10"
      )} />
      <div className={clsx(
        "absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none transition-all duration-1000",
        activeUnit.decision === 'REJECT' ? "bg-red-500/5" : activeUnit.decision === 'REVIEW' ? "bg-amber-500/5" : "bg-purple-600/5"
      )} />


      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* Main Content Area (Now starting from top) */}
      <div className="flex gap-6 flex-1 min-h-0 p-6 pt-8">

        {/* ═════════ ZONE 2: UNIT DIRECTORY (Left 30%) ═════════ */}
        <div className="w-[380px] shrink-0 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col border-white/10 shadow-2xl rounded-[24px] overflow-hidden bg-[#1E293B]/50 backdrop-blur-[15px]">
            <CardHeader className="px-6 py-5 border-b border-white/5 bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Database size={16} className="text-[#0066CC] drop-shadow-[0_0_5px_rgba(0,102,204,0.6)]" />
                  Unit Directory
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-bold bg-white/5 text-slate-300 border-white/10">{allUnits.length} Live</Badge>
              </div>
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value)}
                  className="w-full appearance-none bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0066CC]/40 uppercase tracking-wider cursor-pointer shadow-inner"
                >
                  <option className="bg-slate-900 text-white">Highest Risk</option>
                  <option className="bg-slate-900 text-white">Lowest Risk</option>
                  <option className="bg-slate-900 text-white">Most Recent</option>
                </select>
                <Filter size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
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
                  className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-100 bg-slate-800/40 border border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/40 focus:border-[#0066CC]/50 placeholder:text-slate-600 shadow-inner"
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
                      "w-full text-left p-4 rounded-2xl transition-all border group flex items-center justify-between relative overflow-hidden",
                      isSelected
                        ? (unit.decision === 'REJECT'
                          ? "bg-red-500/20 border-red-500/50 shadow-[inset_0_0_30px_rgba(239,68,68,0.2)]"
                          : unit.decision === 'REVIEW'
                            ? "bg-amber-500/20 border-amber-500/50 shadow-[inset_0_0_30px_rgba(245,158,11,0.2)]"
                            : "bg-[#0066CC]/20 border-[#0066CC]/50 shadow-[inset_0_0_20px_rgba(0,102,204,0.1)]")
                        : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    {/* Glass Shimmer Effect for Selected Unit */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />
                    )}

                    <div className="flex items-center gap-4 relative z-10">
                      <div className={clsx("w-3 h-3 rounded-full shadow-[0_0_12px_currentColor] shrink-0", statusColor)} />
                      <div className="flex flex-col">
                        <span className={clsx("text-sm font-black tracking-tight font-mono", isSelected ? "text-white" : "text-slate-300")}>
                          {unit.unit_id || unit.id}
                        </span>
                        <span className={clsx("text-[9px] font-black uppercase tracking-widest mt-0.5", isSelected ? "text-white/80" : "text-slate-500")}>
                          {unit.decision}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Risk</span>
                      <span className={clsx(
                        "text-lg font-black leading-none font-mono",
                        risk >= 7 ? 'text-red-400' : risk > 4 ? 'text-amber-400' : 'text-emerald-400'
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

          {/* ═════════ NEW: STAGE PROCESS PIPELINE (Stepper Style) ═════════ */}
          <div className="flex flex-col gap-2 shrink-0 px-6 py-4 rounded-[20px] bg-[#1E293B]/40 backdrop-blur-md ring-1 ring-white/10 shadow-xl relative">
            <div className="flex items-center justify-between w-full overflow-x-auto custom-scrollbar pb-2">
              {STAGES.filter(s => s.id <= terminationStage).map((stage, index, arr) => {
                const rrs = (activeUnit[`rrs_${stage.id}`] || 0) * 10
                const isTerminal = stage.id === terminationStage && (activeUnit.decision === 'REJECT' || activeUnit.decision === 'REVIEW')
                const isSelected = activeStageId === stage.id

                let statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                let iconColor = "text-emerald-400"
                if (isTerminal || rrs >= 8.5) {
                  statusColor = "bg-red-500/20 text-red-400 border-red-500/40"
                  iconColor = "text-red-400"
                } else if (rrs > 5.0) {
                  statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  iconColor = "text-amber-400"
                }

                return (
                  <React.Fragment key={stage.id}>
                    <button
                      onClick={() => setActiveStageId(stage.id)}
                      className={clsx(
                        "flex-none flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all relative border",
                        isSelected ? "bg-white/10 border-white/20 shadow-lg" : "bg-transparent border-transparent hover:bg-white/5"
                      )}
                    >
                      <div className={clsx(
                        "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
                        statusColor,
                        isSelected ? "scale-110 shadow-inner" : "scale-100"
                      )}
                        style={isSelected ? { borderColor: STAGE_COLORS[stage.id] } : {}}
                      >
                        <stage.icon size={16} className={iconColor} style={isSelected && !isTerminal ? { color: STAGE_COLORS[stage.id] } : {}} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-white leading-none mb-1">{stage.name}</h4>
                        <span className={clsx("text-[10px] font-black font-mono", rrs >= 8.5 ? "text-red-400" : "text-slate-400")}>
                          {rrs.toFixed(1)}
                        </span>
                      </div>
                    </button>
                    {/* Stepper Separator */}
                    {index < arr.length - 1 && (
                      <div className="flex-1 h-[1px] bg-white/10 mx-2 min-w-[20px]" />
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            {/* Stepper Navigation Controls */}
            <div className="flex justify-between items-center px-4 pt-3 border-t border-white/5">
              <button
                onClick={() => setActiveStageId(Math.max(1, activeStageId - 1))}
                disabled={activeStageId === 1}
                className="px-4 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-black text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/10"
              >
                Back
              </button>
              <button
                onClick={() => setActiveStageId(Math.min(terminationStage, activeStageId + 1))}
                disabled={activeStageId === terminationStage}
                className="px-4 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-black text-slate-900 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-emerald-400/50"
              >
                Next Stage
              </button>
            </div>
          </div>

          {/* ROW A: Bin Classification + Archetype + Decision Summary (Redesigned Compact) */}
          <div className="grid grid-cols-3 gap-4 shrink-0">
            {(() => {
              const bin = BIN_INFO[activeUnit.bin_code] || BIN_INFO[1]
              return (
                <Card className={clsx("border-none ring-1 ring-white/10 shadow-lg rounded-[20px] bg-[#1E293B]/40 backdrop-blur-md overflow-hidden", bin.bg && "bg-opacity-20")}>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1.5">
                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black shadow-lg", bin.color)}>
                      {activeUnit.bin_code || 1}
                    </div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bin Class</span>
                    <span className={clsx("text-xs font-black text-white text-opacity-90 truncate w-full")}>{bin.name}</span>
                  </CardContent>
                </Card>
              )
            })()}

            <Card className="border-none ring-1 ring-white/10 shadow-lg rounded-[20px] bg-[#1E293B]/40 backdrop-blur-md">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1.5">
                <AlertTriangle size={22} className={activeUnit.decision === 'REJECT' ? "text-red-400" : activeUnit.decision === 'REVIEW' ? "text-amber-400" : "text-emerald-400"} />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Archetype</span>
                <span className="text-xs font-black text-white truncate w-full">{activeUnit.archetype || 'Nominal'}</span>
              </CardContent>
            </Card>

            <Card className={clsx("border-none ring-1 ring-white/10 shadow-lg rounded-[20px] bg-[#1E293B]/40 backdrop-blur-md")}>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1.5">
                <span className={clsx("text-2xl font-black font-mono leading-none",
                  activeUnit.decision === 'REJECT' ? "text-red-500" : activeUnit.decision === 'REVIEW' ? "text-amber-500" : "text-emerald-500"
                )}>
                  {((activeUnit.ensembleScore || 0) * 10).toFixed(1)}
                </span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fused Risk</span>
                <Badge className={clsx("text-[8px] font-black border-none h-4 px-2",
                  activeUnit.decision === 'REJECT' ? "bg-red-500/80" : activeUnit.decision === 'REVIEW' ? "bg-amber-500/80" : "bg-emerald-500/80"
                )}>{activeUnit.decision}</Badge>
              </CardContent>
            </Card>
          </div>

          {/* ROW B: Termination Callout (only if terminated early) */}
          {terminationStage < 5 && (
            <Card className="border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)] rounded-[24px] bg-red-500/10 backdrop-blur-md shrink-0 relative overflow-hidden group">
              <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
              <CardContent className="p-6 flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                  <XCircle size={28} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-red-400 uppercase tracking-wide flex items-center gap-2">
                    Early Termination at Stage {terminationStage}: {STAGES.find(s => s.id === terminationStage)?.name}
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  </h3>
                  <p className="text-xs text-red-300/80 mt-1 font-medium">
                    Cumulative RRS reached <span className="font-black font-mono text-red-400 text-sm">{((activeUnit[`rrs_${terminationStage}`] || 0) * 10).toFixed(1)}/10</span> —
                    exceeding the safety threshold (8.5). Stages {terminationStage + 1}–5 were skipped,
                    saving processing cost on {5 - terminationStage} machine{5 - terminationStage > 1 ? 's' : ''}.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ROW C: Stage Sensor Telemetry with Deviation Analysis */}
          <Card className="border-white/10 shadow-2xl rounded-[24px] bg-[#1E293B]/40 backdrop-blur-md shrink-0">
            <CardHeader className="px-8 py-5 border-b border-white/5 bg-white/5">
              <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Settings2 size={16} className="text-[#0066CC] drop-shadow-[0_0_8px_rgba(0,102,204,0.4)]" />
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
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                  {STAGES.find(s => s.id === activeStageId).params.map(paramKey => {
                    const val = activeUnit[paramKey]
                    if (val === undefined) return null
                    const ref = SENSOR_NOMINALS[paramKey] || { nominal: 0, unit: '' }
                    const deviation = ref.nominal !== 0 ? Math.abs(val - ref.nominal) / ref.nominal * 100 : 0
                    const isSuspicious = deviation > 30

                    return (
                      <div key={paramKey} className={clsx(
                        "flex-none w-60 p-3 rounded-xl border transition-all relative overflow-hidden",
                        isSuspicious
                          ? "bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20"
                          : "bg-white/5 border-white/5 shadow-inner"
                      )}>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest px-1.5 h-4" style={!isSuspicious ? { color: '#0066CC', borderColor: 'rgba(0,102,204,0.3)' } : { color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>
                            {isSuspicious ? '⚠ Dev' : 'Sensor'}
                          </Badge>
                          {isSuspicious && <AlertCircle size={12} className="text-red-400 animate-pulse" />}
                        </div>

                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight h-7 relative z-10 truncate">{formatParam(paramKey)}</h4>
                        <div className="flex items-baseline gap-1 relative z-10">
                          <span className={clsx("text-xl font-black font-mono", isSuspicious ? "text-red-400" : "text-white")}>
                            {Number.isInteger(val) ? val : val.toFixed(2)}
                          </span>
                          <span className="text-[8px] font-black font-mono text-slate-500 uppercase">{ref.unit}</span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center relative z-10">
                          <span className="text-[8px] font-bold text-slate-500">
                            Nominal: <span className="text-slate-400 font-mono">{ref.nominal}</span>
                          </span>
                          <span className={clsx("text-[9px] font-black font-mono uppercase tracking-tighter", isSuspicious ? "text-red-400" : "text-emerald-400")}>
                            {deviation > 0.1 ? `${deviation.toFixed(0)}%` : '✓'}
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
          <Card className="flex flex-col border-white/10 shadow-2xl rounded-[24px] overflow-hidden bg-[#1E293B]/40 backdrop-blur-md shrink-0">
            <CardHeader className="px-8 py-5 border-b border-white/5 bg-white/5">
              <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert size={16} className="text-[#0066CC] drop-shadow-[0_0_8px_rgba(0,102,204,0.4)]" />
                Tri-Shield Final Verdict & Explainability
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex items-center justify-between gap-12">
                {/* Left: Overall Risk Gauge */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Overall Risk</span>
                  <GaugeChart score={(activeUnit.ensembleScore || 0) * 10} decision={activeUnit.decision} />
                </div>

                {/* Right: Detailed Model Shields (Horizontal Layout) */}
                <div className="flex-1 flex flex-col gap-6">
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { label: 'Shield 1: LGBM', score: activeUnit.lgbScore, threshold: 0.6, colorClass: (s) => s > 0.6 ? "bg-red-500" : "bg-emerald-500", textClass: (s) => s > 0.6 ? "text-red-400" : "text-emerald-400" },
                      { label: 'Shield 2: I-Forest', score: activeUnit.isoScore, threshold: 0.5, colorClass: (s) => s > 0.5 ? "bg-amber-500" : "bg-emerald-500", textClass: (s) => s > 0.5 ? "text-amber-400" : "text-emerald-400" },
                      { label: 'Shield 3: Physics', score: activeUnit.behScore, threshold: 0.6, colorClass: (s) => s > 0.6 ? "bg-red-500" : "bg-emerald-500", textClass: (s) => s > 0.6 ? "text-red-400" : "text-emerald-400" }
                    ].map((shield, idx) => (
                      <div key={idx} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest w-32 shrink-0">{shield.label}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className={clsx("h-full rounded-full transition-all", shield.colorClass(shield.score))} style={{ width: `${(shield.score || 0) * 100}%` }} />
                        </div>
                        <span className={clsx("text-xs font-black font-mono w-12 text-right", shield.textClass(shield.score))}>
                          {((shield.score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Triggers (now below the horizontal row) */}
              {activeUnit.reasons && activeUnit.reasons.length > 0 && (
                <div className="mt-8 w-full bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="flex flex-wrap justify-center gap-2">
                    {activeUnit.reasons.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] font-black py-1 px-3 bg-[#0066CC]/10 border-[#0066CC]/30 text-[#0066CC]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

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
                color: 'text-red-900', bg: 'bg-red-100', border: 'border-red-300',
              },
              {
                title: Object.keys(stageAttr)[1] || 'Wire Bond',
                contribution: stageAttr[Object.keys(stageAttr)[1]] ? `${(stageAttr[Object.keys(stageAttr)[1]] * 100).toFixed(0)}%` : '—',
                deviation: 'Secondary stress contributor',
                effect: 'Compound interaction with primary stage increases cumulative failure probability',
                location: 'Distributed across affected regions',
                color: 'text-amber-900', bg: 'bg-amber-100', border: 'border-amber-300',
              },
              {
                title: 'Cumulative RRS',
                contribution: `${(finalCRI * 100).toFixed(0)}%`,
                deviation: `Final CRI: ${finalCRI.toFixed(4)}`,
                effect: isCritical ? 'Tolerance stack exceeds critical threshold — unit at high risk of burn-in failure' : 'Cumulative stress within acceptable envelope',
                location: 'Global — all stages contribute',
                color: isCritical ? 'text-red-400' : 'text-emerald-400',
                bg: 'bg-slate-900/60',
                border: isCritical ? 'border-red-500/30' : 'border-emerald-500/30',
              },
            ]

            return (
              <Card className="flex flex-col border-white/10 shadow-2xl rounded-[24px] overflow-hidden bg-[#1E293B]/40 backdrop-blur-md shrink-0">
                <CardHeader className="px-8 py-5 border-b border-white/5 bg-white/5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Zap size={16} className="text-[#0066CC] drop-shadow-[0_0_8px_rgba(0,102,204,0.4)]" />
                      ROM Digital Twin — Stress & Root Cause Analysis
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[9px] font-black bg-[#0066CC]/10 border-[#0066CC]/30 text-[#0066CC]">
                        POD Modes: {romResult.rom_metadata.pod_modes_used}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] font-black bg-white/5 border-white/10 text-slate-400 font-mono">
                        {romResult.rom_metadata.reconstruction_time_ms.toFixed(1)}ms
                      </Badge>
                      <Badge variant="outline" className={clsx("text-[9px] font-black", isCritical ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-emerald-500/20 border-emerald-200 text-emerald-400")}>
                        {isCritical ? '⚠ CRITICAL' : '✓ HEALTHY'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">

                  {/* Row 1: Heatmap + CRI Lifecycle + Root Cause */}
                  <div className="grid grid-cols-3 gap-6">

                    {/* 2D Stress Distribution Heatmap */}
                    <div className="flex flex-col items-center bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 h-[320px] justify-between">
                      <div className="w-full flex items-center gap-2 mb-2">
                        <Activity size={14} className="text-[#00A3AD]" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          2D Stress Distribution
                        </h4>
                      </div>
                      <StressHeatmapCanvas stressGrid={stressGrid} maxStress={maxStress} />
                      <div className="mt-3 w-full space-y-2">
                        <div className="flex items-center justify-center gap-2 text-[8px] uppercase text-slate-500 font-black tracking-widest">
                          <span>Low</span>
                          <div className="w-24 h-1.5 rounded-full opacity-80" style={{ background: 'linear-gradient(to right, hsl(240,100%,50%), hsl(180,100%,50%), hsl(120,100%,50%), hsl(60,100%,50%), hsl(0,100%,50%))' }} />
                          <span>High</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-slate-400 px-2 font-mono">
                          <span>Max: <span className={clsx(maxStress > 150 ? "text-red-400" : "text-white")}>{maxStress.toFixed(1)} MPa</span></span>
                          <span>Mean: <span className="text-white">{meanStress.toFixed(1)} MPa</span></span>
                        </div>
                      </div>
                    </div>

                    {/* CRI Lifecycle Trajectory */}
                    <div className="flex flex-col bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 h-[320px]">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap size={14} className="text-[#00A3AD]" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          CRI Lifecycle Trajectory
                        </h4>
                      </div>
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={criData} margin={{ top: 10, right: 10, left: -20, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                              dataKey="stage" stroke="#475569"
                              tick={{ fontSize: 8, fill: "#94a3b8", fontWeight: 'black' }}
                              angle={-35} textAnchor="end" height={60}
                            />
                            <YAxis domain={[0, 1.0]} stroke="#475569" tick={{ fontSize: 9, fill: "#94a3b8", fontMono: true }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#111827',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: '#fff'
                              }}
                              itemStyle={{ color: '#fff' }}
                              formatter={(val) => [val.toFixed(4), 'CRI']}
                            />
                            <ReferenceLine y={0.6} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2}
                              label={{ position: 'top', value: 'CRITICAL', fill: '#ef4444', fontSize: 8, fontWeight: 'black' }}
                            />
                            <Line
                              type="monotone" dataKey="cri"
                              stroke={isCritical ? "#ef4444" : "#3b82f6"} strokeWidth={3}
                              filter="drop-shadow(0 0 8px rgba(59,130,246,0.2))"
                              dot={(props) => {
                                const { cx, cy, index } = props
                                const isSpike = index === spikeIdx
                                return (
                                  <circle
                                    key={index} cx={cx} cy={cy}
                                    r={isSpike ? 5 : 3}
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
                        <div className="mt-2 text-[9px] font-black text-slate-500 bg-white/5 rounded-lg px-2 py-1 border border-white/5 uppercase tracking-tighter">
                          ⚡ Spike: <span className="text-white">{stageNames[spikeIdx]}</span> (+{(rrsDeltas[spikeIdx]).toFixed(3)})
                        </div>
                      )}
                    </div>

                    {/* Root Cause Attribution */}
                    <div className="flex flex-col bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 h-[320px]">
                      <div className="flex items-center gap-2 mb-4">
                        <Target size={14} className="text-[#00A3AD]" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Root Cause Attribution
                        </h4>
                      </div>
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={stageAttrData} margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                              type="category" dataKey="name" stroke="#475569"
                              tick={{ fontSize: 9, fill: "#cbd5e1", fontWeight: 'black' }} width={90}
                            />
                            <Tooltip
                              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                              contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                              itemStyle={{ color: '#fff' }}
                              formatter={(val) => [`${val}%`, 'Attribution']}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                              {stageAttrData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                              <LabelList dataKey="value" position="right" fill="#fff" formatter={(v) => `${v}%`} fontSize={10} fontWeight="black" fontMono />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 text-[9px] font-black text-slate-500 bg-white/5 rounded-lg px-2 py-1 border border-white/5 uppercase tracking-tighter">
                        🎯 Primary: <span className="text-white">{primaryStage}</span> → <span style={{ color: ROM_STAGE_COLORS_MAP[primaryStage] }}>{formatParam(primaryParam)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Physics-Based Diagnostic Explanations */}
                  <div>
                    <div className="flex items-center gap-2 mb-6">
                      <BookOpen size={16} className="text-[#00A3AD]" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Physics-Based Diagnostic Explanations</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      {physicsExplanations.map((item) => (
                        <div key={item.title} className={clsx(
                          "p-6 rounded-3xl border backdrop-blur-md transition-all relative overflow-hidden group shadow-2xl",
                          item.bg, item.border
                        )}>
                          <div className="flex items-center justify-between mb-5 relative z-10">
                            <span className="text-xs font-black text-white uppercase tracking-widest">{item.title}</span>
                            <span className={clsx(
                              "text-[9px] font-black px-3 py-1 rounded-full text-white shadow-lg",
                              item.title === 'Cumulative RRS' ? "bg-emerald-500" : "bg-[#0066CC]"
                            )}>
                              {item.contribution} Contrib.
                            </span>
                          </div>
                          <div className="space-y-4 relative z-10">
                            <div>
                              <p className="text-[9px] uppercase tracking-[0.2em] text-red-400 font-black mb-1.5">Deviation Identified</p>
                              <p className={clsx("text-xs font-black font-mono leading-relaxed", item.color)}>{item.deviation}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black mb-1.5">Physical Effect</p>
                              <p className="text-xs text-[#E2E8F0] leading-relaxed font-bold">{item.effect}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black mb-1.5">Impact Region</p>
                              <div className="flex items-center gap-2">
                                <div className={clsx("w-2 h-2 rounded-full", item.color.replace('text-', 'bg-'))} />
                                <p className={clsx("text-[10px] font-black italic uppercase tracking-tighter", item.color)}>{item.location}</p>
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
