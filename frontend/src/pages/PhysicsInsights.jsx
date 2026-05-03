import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, ShieldCheck, Zap, Server, SlidersHorizontal, Cpu, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell, YAxis as BarYAxis, XAxis as BarXAxis, LabelList } from 'recharts';
import clsx from 'clsx';
import Panel from '../components/shared/Panel';
import { useROM } from '../hooks/useROM';

const ROM_NOMINAL = {
  bond_force: 30.0, xy_placement_offset: 0.0, bond_line_thickness: 25.0,
  epoxy_viscosity: 5000, pick_place_speed: 8000,
  ultrasonic_power: 1.2, bond_time: 15.0, loop_height: 200.0,
  capillary_stroke_count: 0, efo_voltage: 60.0,
  transfer_pressure: 8.0, clamping_force: 50.0, molding_temperature: 180.0, vacuum_level: 2.0,
  ball_placement_accuracy: 0.0, laser_pulse_energy: 12.0, reflow_peak_temp: 260.0, flux_density: 0.8,
  spindle_current: 2.0, vibration_amplitude: 0.0, blade_wear_index: 0.0, cooling_water_flow: 1.5,
};

const STAGE_CONFIG = [
  { 
    name: 'Die Bond', 
    theme: 'blue', 
    params: [
      { key: 'bond_force', label: 'Bond Force (N)', min: 25, max: 35, step: 0.1 },
      { key: 'xy_placement_offset', label: 'XY Offset (µm)', min: -15, max: 15, step: 0.1 },
      { key: 'bond_line_thickness', label: 'Bond Line Thickness (µm)', min: 18, max: 32, step: 0.1 },
      { key: 'epoxy_viscosity', label: 'Epoxy Viscosity (cP)', min: 4000, max: 6000, step: 10 },
      { key: 'pick_place_speed', label: 'Pick Place Speed (mm/s)', min: 6000, max: 10000, step: 100 }
    ]
  },
  { 
    name: 'Wire Bond', 
    theme: 'purple', 
    params: [
      { key: 'ultrasonic_power', label: 'Ultrasonic Power (W)', min: 0.8, max: 1.6, step: 0.01 },
      { key: 'bond_time', label: 'Bond Time (ms)', min: 10, max: 20, step: 0.1 },
      { key: 'loop_height', label: 'Loop Height (µm)', min: 150, max: 250, step: 1 },
      { key: 'capillary_stroke_count', label: 'Capillary Strokes', min: 0, max: 500000, step: 1000 },
      { key: 'efo_voltage', label: 'EFO Voltage (V)', min: 50, max: 70, step: 0.1 }
    ]
  },
  { 
    name: 'Mold', 
    theme: 'amber', 
    params: [
      { key: 'transfer_pressure', label: 'Transfer Pressure (MPa)', min: 5, max: 15, step: 0.1 },
      { key: 'clamping_force', label: 'Clamping Force (kN)', min: 40, max: 60, step: 0.5 },
      { key: 'molding_temperature', label: 'Molding Temp (°C)', min: 160, max: 190, step: 0.5 },
      { key: 'vacuum_level', label: 'Vacuum Level (mbar)', min: 0, max: 10, step: 0.1 }
    ]
  },
  { 
    name: 'Ball Attach', 
    theme: 'cyan', 
    params: [
      { key: 'ball_placement_accuracy', label: 'Ball Placement Acc. (µm)', min: -25, max: 25, step: 0.5 },
      { key: 'laser_pulse_energy', label: 'Laser Pulse Energy (mJ)', min: 10, max: 14, step: 0.1 },
      { key: 'reflow_peak_temp', label: 'Reflow Peak Temp (°C)', min: 240, max: 280, step: 1 },
      { key: 'flux_density', label: 'Flux Density (mg/cm²)', min: 0.5, max: 1.1, step: 0.01 }
    ]
  },
  { 
    name: 'Saw', 
    theme: 'pink', 
    params: [
      { key: 'spindle_current', label: 'Spindle Current (A)', min: 1.5, max: 2.5, step: 0.01 },
      { key: 'vibration_amplitude', label: 'Vibration Amplitude (mm)', min: 0, max: 1.5, step: 0.01 },
      { key: 'blade_wear_index', label: 'Blade Wear Index', min: 0, max: 1, step: 0.01 },
      { key: 'cooling_water_flow', label: 'Cooling Water Flow (L/min)', min: 1.0, max: 2.0, step: 0.01 }
    ]
  }
];

const ROM_STAGE_COLORS_MAP = {
  'Die Bond': '#2563eb', 'Wire Bond': '#7c3aed', 'Mold': '#d97706', 'Ball Attach': '#0891b2', 'Saw': '#ec4899'
}

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
      className="rounded-lg border border-border shadow-inner"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

const formatParam = (name) => name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export default function PhysicsInsights({ engine }) {
  const [params, setParams] = useState(ROM_NOMINAL);
  const [expandedStage, setExpandedStage] = useState('Mold');

  const { romResult, isLoading } = useROM(params);

  // Derive all visuals from ROM result
  const predictedCRI = romResult?.cri_lifecycle?.cumulative_cri[4] || 0;
  const isCritical = predictedCRI >= 0.6;
  const reconstructionTimeMs = romResult?.rom_metadata?.reconstruction_time_ms || 0;
  const podModes = romResult?.rom_metadata?.pod_modes_used || 8;

  const criData = useMemo(() => {
    if (!romResult) return [];
    return romResult.cri_lifecycle.stages.map((stage, i) => ({
      stage,
      cri: romResult.cri_lifecycle.cumulative_cri[i],
      delta: romResult.cri_lifecycle.stage_deltas[i]
    }));
  }, [romResult]);

  const spikeIdx = useMemo(() => {
    if (!romResult) return -1;
    const deltas = romResult.cri_lifecycle.stage_deltas;
    return deltas.indexOf(Math.max(...deltas));
  }, [romResult]);

  const rootCauseData = useMemo(() => {
    if (!romResult) return [];
    return Object.entries(romResult.root_cause.stage_contributions).map(([name, val]) => ({
      name,
      value: Math.round(val * 100),
      color: ROM_STAGE_COLORS_MAP[name] || '#9ca3af'
    }));
  }, [romResult]);

  const physicsExplanations = useMemo(() => {
    if (!romResult) return [];
    const stageAttr = romResult.root_cause.stage_contributions;
    const sensitivities = romResult.root_cause.parameter_contributions;
    
    const primaryStage = Object.keys(stageAttr)[0];
    const primaryParam = Object.keys(sensitivities)[0];

    return [
      {
        title: primaryStage || 'Mold',
        contribution: stageAttr[primaryStage] ? `${(stageAttr[primaryStage] * 100).toFixed(0)}%` : '—',
        deviation: `${formatParam(primaryParam || '')} deviated from nominal`,
        color: 'text-red-400', bg: 'bg-red-500/5', borderColor: 'border-red-500/20',
      },
      {
        title: Object.keys(stageAttr)[1] || 'Wire Bond',
        contribution: stageAttr[Object.keys(stageAttr)[1]] ? `${(stageAttr[Object.keys(stageAttr)[1]] * 100).toFixed(0)}%` : '—',
        deviation: 'Secondary stress contributor',
        effect: 'Compound interaction with primary stage increases cumulative failure probability',
        location: 'Distributed across affected regions',
        color: 'text-amber-400', bg: 'bg-amber-500/5', borderColor: 'border-amber-500/20',
      },
      {
        title: 'Cumulative RRS',
        contribution: `${(predictedCRI * 100).toFixed(0)}%`,
        deviation: `Final CRI: ${predictedCRI.toFixed(4)}`,
        effect: isCritical ? 'Tolerance stack exceeds critical threshold — unit at high risk of burn-in failure' : 'Cumulative stress within acceptable envelope',
        location: 'Global — all stages contribute',
        color: isCritical ? 'text-red-400' : 'text-emerald-400',
        bg: isCritical ? 'bg-red-500/5' : 'bg-emerald-500/5',
        borderColor: isCritical ? 'border-red-500/20' : 'border-emerald-500/20',
      },
    ]
  }, [romResult, predictedCRI, isCritical]);

  const Badge = ({ label, icon: Icon, className }) => (
    <div className={clsx("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider", className)}>
      {Icon && <Icon size={14} />}
      {label}
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 font-sans pb-8">
      {/* Zone 1: Engineering Status Badges */}
      <div className="flex flex-wrap gap-3 bg-[#111827]/40 backdrop-blur-[15px] p-5 rounded-[24px] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <Badge 
            label={`ROM Reconstruction Time: ${reconstructionTimeMs.toFixed(1)}ms`} 
            icon={Zap} 
            className="bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] font-black"
          />
          <Badge 
            label="Current Unit: SANDBOX" 
            icon={Cpu} 
            className="bg-white/5 text-slate-300 border-white/10 font-black"
          />
          <Badge 
            label={`POD Modes: ${podModes}`} 
            icon={Activity} 
            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-black"
          />
      </div>

      {/* Zone 2: The Physics & Analytics Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Component A: 2D Stress Distribution Heatmap */}
        <Panel title="2D Stress Distribution Heatmap" className="lg:col-span-1 flex flex-col items-center justify-center p-6 h-[380px] bg-[#111827]/40 backdrop-blur-[15px] border-white/10">
          {romResult?.stress_map ? (
            <div className="flex flex-col items-center justify-center">
              <StressHeatmapCanvas stressGrid={romResult.stress_map.values} maxStress={romResult.stress_map.max_stress_mpa} />
              <div className="mt-4 w-full space-y-2.5">
                <div className="flex items-center justify-center gap-2 text-[9px] uppercase text-slate-500 font-black tracking-widest">
                  <span>Low Stress</span>
                  <div className="w-32 h-1.5 bg-gradient-to-r from-blue-600 via-emerald-500 to-red-600 rounded-full opacity-80" />
                  <span>High Stress</span>
                </div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 px-2 w-[250px] font-mono">
                  <span>Max: <span className={clsx(maxResult => romResult.stress_map.max_stress_mpa > 150 ? "text-red-400" : "text-white")}>{romResult.stress_map.max_stress_mpa.toFixed(1)} MPa</span></span>
                  <span>Mean: <span className="text-white">{romResult.stress_map.mean_stress_mpa.toFixed(1)} MPa</span></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 font-black uppercase tracking-widest animate-pulse">Waiting for ROM data...</div>
          )}
        </Panel>

        {/* Component B: CRI Lifecycle Trajectory */}
        <Panel title="CRI Lifecycle Trajectory" className="lg:col-span-1 h-[380px] bg-[#111827]/40 backdrop-blur-[15px] border-white/10">
          <div className="h-full w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={criData} margin={{ top: 10, right: 10, left: -20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="stage" 
                  stroke="#475569" 
                  tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'black' }} 
                  angle={-35} 
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  domain={[0, 1.0]} 
                  stroke="#475569" 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontMono: true }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(val) => [val.toFixed(4), 'CRI']}
                />
                <ReferenceLine 
                  y={0.6} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  label={{ position: 'top', value: 'CRITICAL', fill: '#ef4444', fontSize: 9, fontWeight: 'black' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="cri" 
                  stroke={isCritical ? "#ef4444" : "#3b82f6"} 
                  strokeWidth={4} 
                  filter="drop-shadow(0 0 8px rgba(59,130,246,0.3))"
                  dot={(props) => {
                    const { cx, cy, index } = props;
                    const isSpike = index === spikeIdx;
                    return (
                      <circle
                        key={index} cx={cx} cy={cy}
                        r={isSpike ? 6 : 4}
                        fill={isCritical ? "#ef4444" : "#3b82f6"}
                        stroke={isSpike ? "#fff" : "none"}
                        strokeWidth={isSpike ? 2 : 0}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Component C: Root Cause Attribution Bar Chart */}
        <Panel title="Root Cause Attribution" className="lg:col-span-1 h-[380px] bg-[#111827]/40 backdrop-blur-[15px] border-white/10">
          <div className="h-full w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={rootCauseData} margin={{ top: 10, right: 40, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <BarXAxis type="number" hide />
                <BarYAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="#475569" 
                  tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 'black' }}
                  width={90}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(val) => [`${val}%`, 'Contribution']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                  {rootCauseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList dataKey="value" position="right" fill="#fff" formatter={(val) => `${val}%`} fontSize={10} fontWeight="black" fontMono />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

      </div>

      {/* Zone 3: Virtual Experimentation Sandbox */}
      <Panel className="relative overflow-hidden border-white/10 bg-[#111827]/40 backdrop-blur-[15px] shadow-2xl p-8 rounded-[32px]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-emerald-500/50 via-blue-500/50 to-purple-500/50" />
        
        <div className="flex items-center gap-3 mb-10 pb-6 border-b border-white/5">
          <SlidersHorizontal className="text-blue-400" size={20} />
          <h2 className="text-xl font-black tracking-[0.2em] text-white uppercase">Virtual Experimentation Sandbox</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-center">
          {/* Output Display (Pulsing Hub) */}
          <div className={clsx(
            "lg:col-span-1 flex flex-col items-center justify-center p-8 rounded-3xl border-2 relative overflow-hidden transition-all duration-500 shadow-2xl h-64",
            isCritical 
              ? "bg-red-500/10 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-pulse" 
              : "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
          )}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <h3 className={clsx(
              "text-[10px] uppercase tracking-[0.3em] font-black mb-4 z-10",
              isCritical ? "text-red-400" : "text-emerald-400"
            )}>Predicted CRI Score</h3>
            <div 
              className={clsx(
                "text-7xl font-black tracking-tighter font-mono z-10 transition-colors duration-500",
                isCritical ? "text-red-500" : "text-emerald-500"
              )}
            >
              {predictedCRI.toFixed(3)}
            </div>
            <div className="mt-6 z-10">
              <span className={clsx(
                "px-4 py-1.5 text-[9px] uppercase font-black rounded-full border backdrop-blur-sm",
                isCritical ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              )}>
                {isCritical ? 'CRITICAL RISK DETECTED' : 'SYSTEM HEALTH: OPTIMAL'}
              </span>
            </div>
            {isLoading && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg text-[9px] font-black text-blue-400 border border-white/10 backdrop-blur-md">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                SIMULATING...
              </div>
            )}
          </div>

          {/* Sliders Area (22 parameters) */}
          <div className="lg:col-span-3 space-y-6">
            {STAGE_CONFIG.map((stage) => {
              const themeClasses = {
                blue: { bg: 'bg-blue-500', text: 'text-blue-400', badgeBg: 'bg-blue-500/10', border: 'border-blue-500/30', accent: 'accent-blue-400', shadow: 'rgba(59,130,246,0.4)' },
                purple: { bg: 'bg-purple-500', text: 'text-purple-400', badgeBg: 'bg-purple-500/10', border: 'border-purple-500/30', accent: 'accent-purple-400', shadow: 'rgba(124,58,237,0.4)' },
                amber: { bg: 'bg-amber-500', text: 'text-amber-400', badgeBg: 'bg-amber-500/10', border: 'border-amber-500/30', accent: 'accent-amber-400', shadow: 'rgba(245,158,11,0.4)' },
                cyan: { bg: 'bg-cyan-500', text: 'text-cyan-400', badgeBg: 'bg-cyan-500/10', border: 'border-cyan-500/30', accent: 'accent-cyan-400', shadow: 'rgba(6,182,212,0.4)' },
                pink: { bg: 'bg-pink-500', text: 'text-pink-400', badgeBg: 'bg-pink-500/10', border: 'border-pink-500/30', accent: 'accent-pink-400', shadow: 'rgba(236,72,153,0.4)' },
              }[stage.theme];

              return (
              <div key={stage.name} className="border border-white/10 rounded-2xl overflow-hidden bg-black/20 group/stage">
                <button 
                  className="w-full flex items-center justify-between p-5 bg-white/5 hover:bg-white/10 transition-all focus:outline-none"
                  onClick={() => setExpandedStage(expandedStage === stage.name ? null : stage.name)}
                >
                  <div className="flex items-center gap-4">
                    <div className={clsx("w-2.5 h-2.5 rounded-full transition-all group-hover/stage:scale-125", themeClasses.bg)} style={{ boxShadow: `0 0 10px ${themeClasses.shadow}` }} />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">{stage.name}</span>
                  </div>
                  {expandedStage === stage.name ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </button>
                
                {expandedStage === stage.name && (
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-8 border-t border-white/5 bg-black/40">
                    {stage.params.map(param => (
                      <div key={param.key} className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group/param">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover/param:text-slate-300 transition-colors">{param.label}</span>
                          <div className="flex items-center gap-2">
                            <span className={clsx("px-3 py-1 rounded-lg text-xs font-black font-mono shadow-inner border bg-black/40", themeClasses.text, themeClasses.border)}>
                              {Number(params[param.key]).toFixed(param.step < 1 ? 2 : 0)}
                            </span>
                          </div>
                        </div>
                        <div className="relative h-6 flex items-center">
                          <div className="absolute w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full transition-all" 
                              style={{ 
                                width: `${((params[param.key] - param.min) / (param.max - param.min)) * 100}%`,
                                backgroundColor: themeClasses.bg.replace('bg-', ''),
                                boxShadow: `0 0 12px ${themeClasses.shadow}`
                              }} 
                            />
                          </div>
                          <input 
                            type="range" 
                            min={param.min} max={param.max} step={param.step}
                            value={params[param.key]} 
                            onChange={(e) => setParams(p => ({ ...p, [param.key]: Number(e.target.value) }))}
                            className="absolute w-full h-1 bg-transparent appearance-none cursor-pointer z-10 accent-white" 
                          />
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-600 font-black font-mono uppercase tracking-tighter">
                          <span>MIN: {param.min}</span><span>MAX: {param.max}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )})}
          </div>

        </div>
      </Panel>

      {/* Zone 4: Physics-Based Diagnostic Explanations */}
      <Panel className="relative overflow-hidden border-white/10 bg-[#111827]/40 backdrop-blur-[15px] shadow-2xl p-8 rounded-[32px]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-emerald-500/50 via-blue-500/50 to-purple-500/50" />
        
        <div className="flex items-center gap-3 mb-10 pb-6 border-b border-white/5">
          <BookOpen className="text-blue-400" size={20} />
          <h2 className="text-xl font-black tracking-[0.2em] text-white uppercase">Physics-Based Diagnostic Explanations</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {physicsExplanations.map((item) => (
            <div key={item.title} className={clsx("p-6 rounded-2xl border backdrop-blur-md shadow-2xl transition-all hover:bg-white/5", item.bg, item.borderColor)}>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{item.title}</span>
                <span className="text-[9px] font-black px-3 py-1 rounded-full bg-[#00A3AD] text-white shadow-lg shadow-[#00A3AD]/20">
                  {item.contribution} Contrib.
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-red-400 font-black mb-1.5">Primary Finding</p>
                  <p className={clsx("text-xs font-black font-mono leading-relaxed", item.color)}>{item.deviation}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500 font-black mb-1.5">Physical Effect</p>
                  <p className="text-xs text-[#E2E8F0] leading-relaxed font-bold">{item.effect}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500 font-black mb-1.5">Impact Region</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">{item.location}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

    </div>
  );
}
