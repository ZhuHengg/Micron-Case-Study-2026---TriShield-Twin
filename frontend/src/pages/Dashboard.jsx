import React, { useState, useMemo } from 'react'
import {
  AlertTriangle, Search, Filter, Activity, Database,
  ShieldCheck, ArrowUpRight, ArrowDownRight, X,
  Box, Zap as ZapIcon, Thermometer, Cpu, Scissors, ShieldAlert, AlertCircle
} from 'lucide-react'
import clsx from 'clsx'

/**
 * Micron Sentinel — WIP Dashboard
 * Zone 1: Global WIP Header (KPI cards synced to backend engine)
 * Zone 2: Master Batch List (all units from engine.allUnits)
 */

/* ─── BIN INFO ──────────────────────────────────────────── */
const BIN_INFO = {
  1: { name: 'Bin 1 — Perfect',        short: 'Perfect',        color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  2: { name: 'Bin 2 — Marginal',       short: 'Marginal',       color: '#0ea5e9', bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  3: { name: 'Bin 3 — Recoverable',    short: 'Recoverable',    color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  4: { name: 'Bin 4 — Fab Passthrough', short: 'Fab Passthrough', color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700',  dot: 'bg-orange-500' },
  5: { name: 'Bin 5 — Open/Short',     short: 'Open/Short',     color: '#ef4444', bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  6: { name: 'Bin 6 — Delamination',   short: 'Delamination',   color: '#dc2626', bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-600' },
  7: { name: 'Bin 7 — Leakage',        short: 'Leakage',        color: '#e11d48', bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500' },
  8: { name: 'Bin 8 — Functional Fail', short: 'Functional Fail', color: '#a21caf', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-600' },
}

const DECISION_STYLES = {
  PASS:   { label: 'PASS',   bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  REVIEW: { label: 'REVIEW', bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200' },
  REJECT: { label: 'REJECT', bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200' },
}

const STAGES = [
  { id: 1, name: 'Die Attach', icon: Box, color: '#2563eb', params: ['bond_force','xy_placement_offset','bond_line_thickness','epoxy_viscosity'] },
  { id: 2, name: 'Wire Bond', icon: ZapIcon, color: '#7c3aed', params: ['ultrasonic_power','bond_time','loop_height','capillary_stroke_count','efo_voltage'] },
  { id: 3, name: 'Molding', icon: Thermometer, color: '#d97706', params: ['transfer_pressure','clamping_force','molding_temperature','vacuum_level'] },
  { id: 4, name: 'Ball Attach', icon: Cpu, color: '#0891b2', params: ['ball_placement_accuracy','laser_pulse_energy','reflow_peak_temp','flux_density'] },
  { id: 5, name: 'Singulation', icon: Scissors, color: '#ec4899', params: ['spindle_current','vibration_amplitude','blade_wear_index','cooling_water_flow'] },
]

const SENSOR_NOMINALS = {
  bond_force: { nominal: 30.0, unit: 'gf' }, xy_placement_offset: { nominal: 5.0, unit: 'µm' },
  bond_line_thickness: { nominal: 25.0, unit: 'µm' }, epoxy_viscosity: { nominal: 5000, unit: 'cP' },
  ultrasonic_power: { nominal: 1.2, unit: 'W' }, bond_time: { nominal: 15.0, unit: 'ms' },
  loop_height: { nominal: 200, unit: 'µm' }, capillary_stroke_count: { nominal: 100000, unit: '' },
  efo_voltage: { nominal: 60, unit: 'V' }, transfer_pressure: { nominal: 8.0, unit: 'MPa' },
  clamping_force: { nominal: 50, unit: 'kN' }, molding_temperature: { nominal: 180, unit: '°C' },
  vacuum_level: { nominal: 2.0, unit: 'mbar' }, ball_placement_accuracy: { nominal: 5.0, unit: 'µm' },
  laser_pulse_energy: { nominal: 12.0, unit: 'mJ' }, reflow_peak_temp: { nominal: 260, unit: '°C' },
  flux_density: { nominal: 0.8, unit: 'mg/cm²' }, spindle_current: { nominal: 2.0, unit: 'A' },
  vibration_amplitude: { nominal: 0.5, unit: 'mm' }, blade_wear_index: { nominal: 0.3, unit: '' },
  cooling_water_flow: { nominal: 1.5, unit: 'L/min' }, pick_place_speed: { nominal: 8000, unit: 'mm/s' },
}

const formatParam = (name) => name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

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

/* ─── KPI Card Component ────────────────────────────────── */
const KpiCard = ({ icon: Icon, iconColor, label, value, subtitle, trend, trendUp }) => (
  <div className="flex-1 bg-white rounded-[20px] border border-slate-200 shadow-sm p-6 flex items-center gap-5 transition-all hover:shadow-md hover:border-slate-300 group">
    <div className={clsx(
      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
      iconColor === 'blue'   && "bg-blue-50 text-blue-600",
      iconColor === 'red'    && "bg-red-50 text-red-600",
      iconColor === 'green'  && "bg-emerald-50 text-emerald-600",
    )}>
      <Icon size={28} />
    </div>
    <div className="flex flex-col min-w-0">
      <span className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="font-sans text-[32px] font-black text-slate-900 leading-none tracking-tight tabular-nums">{value}</span>
        {trend !== undefined && (
          <span className={clsx(
            "flex items-center gap-0.5 text-xs font-black",
            trendUp ? "text-red-500" : "text-emerald-500"
          )}>
            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend}
          </span>
        )}
      </div>
      {subtitle && <span className="font-sans text-[11px] font-bold text-slate-400 mt-0.5">{subtitle}</span>}
    </div>
  </div>
)

/* ─── Main Dashboard ────────────────────────────────────── */
export default function Dashboard({ engine }) {
  const { allUnits = [], total = 0, blocked = 0, flagged = 0, approved = 0 } = engine || {}

  const [searchTerm, setSearchTerm] = useState('')
  const [sortMode, setSortMode] = useState('Most Recent')
  const [filterDecision, setFilterDecision] = useState('All')
  const [selectedUnitId, setSelectedUnitId] = useState(null)

  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null
    return allUnits.find(u => (u.unit_id || u.id) === selectedUnitId) || null
  }, [allUnits, selectedUnitId])

  // ── Compute KPIs from engine data ──────────────────────
  const kpis = useMemo(() => {
    const criticalAlerts = allUnits.filter(u => u.decision === 'REVIEW').length
    const rejectAlerts = allUnits.filter(u => u.decision === 'REJECT').length

    // Unique lot IDs
    const lotSet = new Set(allUnits.map(u => u.lotId).filter(Boolean))
    const activeLots = lotSet.size

    // Predicted floor yield: % of units that passed
    const yieldPct = total > 0 ? ((approved / total) * 100) : 100

    // Trend: compare last 50 vs previous 50
    const recent50 = allUnits.slice(0, 50)
    const prev50 = allUnits.slice(50, 100)
    const recentRejectRate = recent50.length > 0 ? recent50.filter(u => u.decision === 'REJECT').length / recent50.length : 0
    const prevRejectRate = prev50.length > 0 ? prev50.filter(u => u.decision === 'REJECT').length / prev50.length : 0
    const alertTrend = prev50.length > 0 ? ((recentRejectRate - prevRejectRate) * 100).toFixed(1) : null

    return {
      activeLots,
      criticalAlerts,
      rejectAlerts,
      yieldPct,
      alertTrend,
      alertTrendUp: recentRejectRate > prevRejectRate,
    }
  }, [allUnits, total, approved])

  // ── Filter & Sort ──────────────────────────────────────
  const filteredUnits = useMemo(() => {
    let units = [...allUnits]

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      units = units.filter(u =>
        (u.unit_id || u.id || '').toLowerCase().includes(term) ||
        (u.lotId || '').toLowerCase().includes(term) ||
        (u.archetype || '').toLowerCase().includes(term) ||
        (u.fab || '').toLowerCase().includes(term)
      )
    }

    // Decision filter
    if (filterDecision !== 'All') {
      units = units.filter(u => u.decision === filterDecision)
    }

    // Sort
    if (sortMode === 'Highest Risk') units.sort((a, b) => (b.ensembleScore || 0) - (a.ensembleScore || 0))
    else if (sortMode === 'Lowest Risk') units.sort((a, b) => (a.ensembleScore || 0) - (b.ensembleScore || 0))
    else if (sortMode === 'Most Recent') units.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    return units
  }, [allUnits, searchTerm, sortMode, filterDecision])

  return (
    <div className="flex flex-col min-h-full bg-slate-50/50 font-sans">

      {/* ═══════════ ZONE 1: KPI METRICS ═══════════ */}
      <div className="shrink-0 px-8 pt-6 pb-2">
        {/* KPI Cards Row */}
        <div className="flex gap-5 mb-6">
          <KpiCard
            icon={Database}
            iconColor="blue"
            label="Total Active Lots"
            value={kpis.activeLots}
            subtitle={`${total} units processed`}
          />
          <KpiCard
            icon={AlertTriangle}
            iconColor="red"
            label="Critical Alerts"
            value={kpis.criticalAlerts}
            subtitle={`${kpis.rejectAlerts} rejected / blocked`}
            trend={kpis.alertTrend ? `${Math.abs(parseFloat(kpis.alertTrend))}%` : undefined}
            trendUp={kpis.alertTrendUp}
          />
          <KpiCard
            icon={ShieldCheck}
            iconColor="green"
            label="Predicted Floor Yield"
            value={`${kpis.yieldPct.toFixed(1)}%`}
            subtitle={`${approved} nominal / ${total} total`}
          />
        </div>
      </div>

      {/* ═══════════ ZONE 2: MASTER BATCH LIST ═══════════ */}
      <div className="flex-1 flex flex-col min-h-0 px-8 pb-8">
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* List Header & Controls */}
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Database size={18} className="text-sky-500" />
                <h2 className="font-sans text-sm font-black text-slate-800 uppercase tracking-widest">
                  Unit Directory
                </h2>
                <span className="font-sans text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg tabular-nums">
                  {filteredUnits.length} of {total} units
                </span>
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search unit ID, lot, archetype, fab..."
                  className="w-full pl-11 pr-4 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-300 placeholder:text-slate-300 shadow-sm"
                />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value)}
                  className="appearance-none bg-white border border-slate-200 rounded-xl px-4 pr-10 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  <option>Most Recent</option>
                  <option>Highest Risk</option>
                  <option>Lowest Risk</option>
                </select>
                <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Decision Filter */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {['All', 'PASS', 'REVIEW', 'REJECT'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFilterDecision(opt)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                      filterDecision === opt
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1.5fr_1fr_1fr] gap-4 px-8 py-3 border-b border-slate-100 bg-slate-50/30 shrink-0">
            <span className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit ID</span>
            <span className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest">Lot / Fab</span>
            <span className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest">Decision</span>
            <span className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Score</span>
            <span className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest">Archetype / Bin</span>
            <span className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest">Shields</span>
            <span className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Timestamp</span>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredUnits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                <Activity size={48} className="mb-4 text-slate-300" />
                <p className="font-sans text-sm font-black uppercase tracking-widest mb-1">
                  {total === 0 ? 'Waiting for Units' : 'No Matching Units'}
                </p>
                <p className="font-sans text-xs text-slate-300">
                  {total === 0
                    ? 'Units will appear here as the backend engine processes them.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
              </div>
            ) : (
              filteredUnits.map((unit, idx) => {
                const risk = (unit.ensembleScore || 0) * 100
                const riskNorm = (unit.ensembleScore || 0) * 10
                const bin = BIN_INFO[unit.bin_code] || BIN_INFO[1]
                const decision = DECISION_STYLES[unit.decision] || DECISION_STYLES.PASS
                const ts = unit.timestamp ? new Date(unit.timestamp) : null
                const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'

                return (
                  <div
                    key={unit.unit_id || unit.id || idx}
                    onClick={() => setSelectedUnitId(unit.unit_id || unit.id)}
                    className={clsx(
                      "grid grid-cols-[2fr_1.2fr_1fr_1fr_1.5fr_1fr_1fr] gap-4 px-8 py-4 border-b border-slate-50 transition-all hover:bg-sky-50/50 group items-center cursor-pointer",
                      idx === 0 && "animate-pop-out",
                      selectedUnitId === (unit.unit_id || unit.id) && "bg-sky-50 ring-1 ring-inset ring-sky-200"
                    )}
                  >
                    {/* Unit ID */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0 shadow-sm", bin.dot)} />
                      <div className="flex flex-col min-w-0">
                        <span className="font-sans text-[15px] font-black text-slate-900 tracking-tight truncate">
                          {unit.unit_id || unit.id}
                        </span>
                        <span className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Wafer #{unit.waferNum || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Lot / Fab */}
                    <div className="flex flex-col min-w-0">
                      <span className="font-sans text-[13px] font-bold text-slate-700 truncate">
                        {unit.lotId || '—'}
                      </span>
                      <span className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {unit.fab || 'Fab 20'}
                      </span>
                    </div>

                    {/* Decision */}
                    <div>
                      <span className={clsx(
                        "inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest border",
                        decision.bg, decision.text, decision.border
                      )}>
                        {decision.label}
                      </span>
                    </div>

                    {/* Risk Score */}
                    <div className="flex flex-col gap-1.5">
                      <span className={clsx(
                        "font-sans text-[20px] font-black leading-none tabular-nums",
                        riskNorm >= 7 ? 'text-red-600' : riskNorm > 4 ? 'text-amber-600' : 'text-emerald-600'
                      )}>
                        {riskNorm.toFixed(1)}
                      </span>
                      {/* Mini risk bar */}
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                        <div
                          className={clsx(
                            "h-full rounded-full transition-all",
                            riskNorm >= 7 ? 'bg-red-500' : riskNorm > 4 ? 'bg-amber-500' : 'bg-emerald-500'
                          )}
                          style={{ width: `${Math.min(100, risk)}%` }}
                        />
                      </div>
                    </div>

                    {/* Archetype / Bin */}
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-sans text-[12px] font-bold text-slate-700 truncate">
                        {unit.archetype || 'Nominal'}
                      </span>
                      <span className={clsx("font-sans text-[10px] font-black uppercase tracking-wider", bin.text)}>
                        {bin.short}
                      </span>
                    </div>

                    {/* Shield Scores (compact) */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase">LGB</span>
                        <span className={clsx(
                          "text-[12px] font-black tabular-nums",
                          (unit.lgbScore || 0) > 0.6 ? 'text-red-500' : 'text-slate-600'
                        )}>
                          {((unit.lgbScore || 0) * 100).toFixed(0)}
                        </span>
                      </div>
                      <div className="w-px h-6 bg-slate-100" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase">ISO</span>
                        <span className={clsx(
                          "text-[12px] font-black tabular-nums",
                          (unit.isoScore || 0) > 0.5 ? 'text-amber-500' : 'text-slate-600'
                        )}>
                          {((unit.isoScore || 0) * 100).toFixed(0)}
                        </span>
                      </div>
                      <div className="w-px h-6 bg-slate-100" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase">BEH</span>
                        <span className={clsx(
                          "text-[12px] font-black tabular-nums",
                          (unit.behScore || 0) > 0.6 ? 'text-red-500' : 'text-slate-600'
                        )}>
                          {((unit.behScore || 0) * 100).toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center justify-end">
                      <div className="flex flex-col items-end">
                        <span className="font-sans text-[12px] font-bold text-slate-600 tabular-nums">
                          {timeStr}
                        </span>
                        <span className="font-sans text-[9px] font-bold text-slate-300 uppercase tracking-wider">
                          {unit.latencyMs ? `${unit.latencyMs}ms` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ ZONE 3: UNIT DETAIL SLIDE-OUT PANEL ═══════════ */}
      {selectedUnit && (() => {
        const u = selectedUnit
        const bin = BIN_INFO[u.bin_code] || BIN_INFO[1]
        const riskNorm = (u.ensembleScore || 0) * 10
        const decision = DECISION_STYLES[u.decision] || DECISION_STYLES.PASS

        // Determine termination stage
        let termStage = 5
        if (u.decision === 'REJECT' || u.decision === 'REVIEW') {
          for (let i = 1; i <= 5; i++) {
            if ((u[`rrs_${i}`] || 0) * 10 >= 8.5) { termStage = i; break }
          }
        }

        // Find the worst stage (highest RRS delta)
        let worstStageId = 1
        let worstDelta = 0
        for (let i = 1; i <= 5; i++) {
          const d = Math.abs(u[`rrs_delta_${i}`] || 0)
          if (d > worstDelta) { worstDelta = d; worstStageId = i }
        }

        return (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/20 z-[200] backdrop-blur-sm" onClick={() => setSelectedUnitId(null)} />

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-[201] flex flex-col border-l border-slate-200 animate-slide-in">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="font-sans text-[15px] font-black text-slate-900 tracking-tight">{u.unit_id || u.id}</h3>
                  <span className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {u.lotId || '—'} • {u.fab || 'Fab 20'} • Wafer #{u.waferNum || '—'}
                  </span>
                </div>
                <button onClick={() => setSelectedUnitId(null)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                {/* Decision + Risk Hero */}
                <div className="flex gap-3">
                  <div className={clsx("flex-1 rounded-2xl p-4 text-center border", decision.bg, decision.border)}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Decision</span>
                    <span className={clsx("text-2xl font-black", decision.text)}>{decision.label}</span>
                  </div>
                  <div className={clsx("flex-1 rounded-2xl p-4 text-center border",
                    riskNorm >= 7 ? "bg-red-50 border-red-200" : riskNorm > 4 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
                  )}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Risk / 10</span>
                    <span className={clsx("text-2xl font-black",
                      riskNorm >= 7 ? "text-red-600" : riskNorm > 4 ? "text-amber-600" : "text-emerald-600"
                    )}>{riskNorm.toFixed(1)}</span>
                  </div>
                  <div className={clsx("flex-1 rounded-2xl p-4 text-center border", bin.bg, `border-${bin.color}/20`)}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bin</span>
                    <span className={clsx("text-sm font-black", bin.text)}>{bin.short}</span>
                  </div>
                </div>

                {/* Archetype */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                  <AlertTriangle size={16} className={u.decision === 'REJECT' ? "text-red-500" : u.decision === 'REVIEW' ? "text-amber-500" : "text-emerald-500"} />
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Defect Archetype</span>
                    <span className="text-sm font-black text-slate-800">{u.archetype || 'Nominal'}</span>
                  </div>
                </div>

                {/* Stage Pipeline */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Stage Pipeline — RRS Progression</h4>
                  <div className="space-y-2">
                    {STAGES.map(stage => {
                      const rrs = (u[`rrs_${stage.id}`] || 0) * 10
                      const delta = (u[`rrs_delta_${stage.id}`] || 0) * 10
                      const isSkipped = stage.id > termStage
                      const isTerminal = stage.id === termStage && termStage < 5
                      const Icon = stage.icon

                      return (
                        <div key={stage.id} className={clsx(
                          "flex items-center gap-3 p-3 rounded-xl border transition-all",
                          isSkipped ? "bg-slate-50 border-slate-100 opacity-50" :
                          isTerminal ? "bg-red-50 border-red-200" :
                          rrs >= 7 ? "bg-red-50/50 border-red-100" :
                          rrs > 4 ? "bg-amber-50/50 border-amber-100" :
                          "bg-white border-slate-100"
                        )}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: isSkipped ? '#f1f5f9' : stage.color + '15', color: isSkipped ? '#94a3b8' : stage.color }}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{stage.name}</span>
                              {isTerminal && <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded">TERMINATED</span>}
                              {isSkipped && <span className="text-[9px] font-bold text-slate-400">SKIPPED</span>}
                            </div>
                            {!isSkipped && (
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={clsx("h-full rounded-full", rrs >= 7 ? "bg-red-500" : rrs > 4 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(rrs * 10, 100)}%` }} />
                                </div>
                                <span className={clsx("text-[11px] font-black tabular-nums w-8 text-right", rrs >= 7 ? "text-red-600" : rrs > 4 ? "text-amber-600" : "text-emerald-600")}>{rrs.toFixed(1)}</span>
                                {delta > 2.0 && <span className="text-[9px] font-black text-red-500 bg-red-50 px-1 rounded">+{delta.toFixed(1)}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tri-Shield Breakdown */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ShieldAlert size={14} className="text-sky-500" /> Tri-Shield Scores
                  </h4>
                  
                  {/* Gauge Chart for Overall Risk */}
                  <div className="flex flex-col items-center justify-center mb-8 pb-6 border-b border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Overall Ensemble Risk</span>
                    <GaugeChart score={(u.ensembleScore || 0) * 10} decision={u.decision} />
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Shield 1: LightGBM', score: u.lgbScore || 0, threshold: 0.6, color: '#2563eb' },
                      { label: 'Shield 2: Isolation Forest', score: u.isoScore || 0, threshold: 0.5, color: '#7c3aed' },
                      { label: 'Shield 3: Physics Rules', score: u.behScore || 0, threshold: 0.6, color: '#d97706' },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</span>
                          <span className={clsx("text-sm font-black", s.score > s.threshold ? "text-red-500" : "text-emerald-500")}>{(s.score * 100).toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={clsx("h-full rounded-full transition-all", s.score > s.threshold ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${s.score * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Sensor Readings — Worst Stage */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Sensor Readings — {STAGES.find(s => s.id === worstStageId)?.name} (Highest Delta)
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {STAGES.find(s => s.id === worstStageId)?.params.map(paramKey => {
                      const val = u[paramKey]
                      if (val === undefined) return null
                      const ref = SENSOR_NOMINALS[paramKey] || { nominal: 0, unit: '' }
                      const deviation = ref.nominal !== 0 ? Math.abs(val - ref.nominal) / ref.nominal * 100 : 0
                      const isSuspicious = deviation > 30

                      return (
                        <div key={paramKey} className={clsx("p-3 rounded-xl border", isSuspicious ? "bg-red-50 border-red-200" : "bg-white border-slate-100")}>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{formatParam(paramKey)}</span>
                          <div className="flex items-baseline gap-1">
                            <span className={clsx("text-lg font-black", isSuspicious ? "text-red-600" : "text-slate-800")}>{Number.isInteger(val) ? val : val.toFixed(2)}</span>
                            <span className="text-[9px] font-bold text-slate-400">{ref.unit}</span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[8px] font-bold text-slate-300">Nom: {ref.nominal}</span>
                            <span className={clsx("text-[8px] font-black", isSuspicious ? "text-red-500" : "text-emerald-500")}>
                              {deviation > 0.1 ? `${deviation.toFixed(0)}% dev` : '✓'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Trigger Reasons */}
                {u.reasons && u.reasons.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Model Triggers</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {u.reasons.map((r, i) => (
                        <span key={i} className="text-[10px] font-bold py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">{r}</span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
