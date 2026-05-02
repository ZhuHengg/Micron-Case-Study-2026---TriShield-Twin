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
        contribution: `${(predictedCRI * 100).toFixed(0)}%`,
        deviation: `Final CRI: ${predictedCRI.toFixed(4)}`,
        effect: isCritical ? 'Tolerance stack exceeds critical threshold — unit at high risk of burn-in failure' : 'Cumulative stress within acceptable envelope',
        location: 'Global — all stages contribute',
        color: isCritical ? 'text-red-600' : 'text-emerald-600',
        bg: isCritical ? 'bg-red-50' : 'bg-emerald-50',
        borderColor: isCritical ? 'border-red-200' : 'border-emerald-200',
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
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-2xl border border-border shadow-sm">
          <Badge 
            label={`ROM Reconstruction Time: ${reconstructionTimeMs.toFixed(1)}ms`} 
            icon={Zap} 
            className="bg-blue-500/10 text-blue-500 border-blue-500/30 shadow-glow-cyan"
          />
          <Badge 
            label="Current Unit: SANDBOX" 
            icon={Cpu} 
            className="bg-bg-base text-text-primary border-border"
          />
          <Badge 
            label={`POD Modes: ${podModes}`} 
            icon={Activity} 
            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
          />
      </div>

      {/* Zone 2: The Physics & Analytics Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Component A: 2D Stress Distribution Heatmap */}
        <Panel title="2D Stress Distribution Heatmap" className="lg:col-span-1 flex flex-col items-center justify-center p-6 min-h-[340px]">
          {romResult?.stress_map ? (
            <div className="flex flex-col items-center justify-center">
              <StressHeatmapCanvas stressGrid={romResult.stress_map.values} maxStress={romResult.stress_map.max_stress_mpa} />
              <div className="mt-3 w-full space-y-2">
                <div className="flex items-center justify-center gap-2 text-[9px] uppercase text-text-muted font-bold">
                  <span>Low Stress</span>
                  <div className="w-24 h-2 bg-gradient-to-r from-blue-600 to-red-600 rounded-full opacity-70" />
                  <span>High Stress</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-text-muted px-2 w-[250px]">
                  <span>Max: <span className={clsx("font-black", romResult.stress_map.max_stress_mpa > 150 ? "text-red-500" : "text-text-primary")}>{romResult.stress_map.max_stress_mpa.toFixed(1)} MPa</span></span>
                  <span>Mean: <span className="font-black text-text-primary">{romResult.stress_map.mean_stress_mpa.toFixed(1)} MPa</span></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-muted">Waiting for ROM data...</div>
          )}
        </Panel>

        {/* Component B: CRI Lifecycle Trajectory */}
        <Panel title="CRI Lifecycle Trajectory" className="lg:col-span-1 h-[340px]">
          <div className="h-full w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={criData} margin={{ top: 10, right: 10, left: -20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="stage" 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                  angle={-35} 
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  domain={[0, 1.0]} 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#1e293b', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val) => [val.toFixed(4), 'CRI']}
                />
                <ReferenceLine 
                  y={0.6} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  label={{ position: 'top', value: 'Critical Threshold', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="cri" 
                  stroke={isCritical ? "#ef4444" : "#3b82f6"} 
                  strokeWidth={3} 
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
        <Panel title="Root Cause Attribution" className="lg:col-span-1 h-[340px]">
          <div className="h-full w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={rootCauseData} margin={{ top: 10, right: 40, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <BarXAxis type="number" hide />
                <BarYAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 'bold' }}
                  width={90}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val) => [`${val}%`, 'Contribution']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {rootCauseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList dataKey="value" position="right" fill="#1e293b" formatter={(val) => `${val}%`} fontSize={11} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

      </div>

      {/* Zone 3: Virtual Experimentation Sandbox */}
      <Panel className="relative overflow-hidden border-border bg-white shadow-lg">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-signature opacity-50" />
        
        <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
          <SlidersHorizontal className="text-blue-500" size={20} />
          <h2 className="text-sm font-black tracking-widest text-text-primary uppercase">Virtual Experimentation Sandbox</h2>
        </div>

        {isCritical && (
          <div className="mb-6 bg-red-500/5 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-red-500 font-black uppercase tracking-wider text-xs">WARNING: Delamination Risk Exceeds Threshold</h3>
              <p className="text-red-600/70 text-[11px] mt-1 font-bold">ROM predicts catastrophic failure at Burn-In. Parameter optimization required.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Output Display */}
          <div className={clsx(
            "lg:col-span-1 flex flex-col items-center justify-center p-6 rounded-2xl border relative overflow-hidden transition-colors duration-300 shadow-sm",
            isCritical ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
          )}>
            <h3 className={clsx(
              "text-[10px] uppercase tracking-widest font-black mb-2 z-10",
              isCritical ? "text-red-600/70" : "text-emerald-600/70"
            )}>Predicted CRI Score</h3>
            <div 
              className="text-6xl xl:text-7xl font-black tracking-tighter tabular-nums z-10 transition-colors duration-300"
              style={{ color: isCritical ? '#dc2626' : '#059669' }}
            >
              {predictedCRI.toFixed(3)}
            </div>
            <div className="mt-4 flex items-center gap-2 z-10">
              {isCritical ? (
                <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] uppercase font-black rounded-full border border-red-200 shadow-sm">
                  CRITICAL RISK
                </span>
              ) : (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black rounded-full border border-emerald-200 shadow-sm">
                  SAFE ENVELOPE
                </span>
              )}
            </div>
            {isLoading && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/80 px-2 py-1 rounded text-[9px] font-black text-blue-600 border border-blue-200">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                SYNCING...
              </div>
            )}
          </div>

          {/* Sliders Area (22 parameters) */}
          <div className="lg:col-span-3 space-y-4">
            {STAGE_CONFIG.map((stage) => {
              const themeClasses = {
                blue: { bg: 'bg-blue-500', text: 'text-blue-600', badgeBg: 'bg-blue-50', border: 'border-blue-100', accent: 'accent-blue-500' },
                purple: { bg: 'bg-purple-500', text: 'text-purple-600', badgeBg: 'bg-purple-50', border: 'border-purple-100', accent: 'accent-purple-500' },
                amber: { bg: 'bg-amber-500', text: 'text-amber-600', badgeBg: 'bg-amber-50', border: 'border-amber-100', accent: 'accent-amber-500' },
                cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', badgeBg: 'bg-cyan-50', border: 'border-cyan-100', accent: 'accent-cyan-500' },
                pink: { bg: 'bg-pink-500', text: 'text-pink-600', badgeBg: 'bg-pink-50', border: 'border-pink-100', accent: 'accent-pink-500' },
              }[stage.theme];

              return (
              <div key={stage.name} className="border border-border rounded-xl overflow-hidden bg-slate-50/30">
                <button 
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors focus:outline-none"
                  onClick={() => setExpandedStage(expandedStage === stage.name ? null : stage.name)}
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx("w-3 h-3 rounded-full", themeClasses.bg)} />
                    <span className="text-xs font-black uppercase tracking-widest text-text-primary">{stage.name}</span>
                  </div>
                  {expandedStage === stage.name ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
                </button>
                
                {expandedStage === stage.name && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-border bg-slate-50/50">
                    {stage.params.map(param => (
                      <div key={param.key} className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-black uppercase tracking-wider text-text-secondary">{param.label}</span>
                          <span className={clsx("px-2 py-1 rounded border text-xs font-black font-sans shadow-sm", themeClasses.badgeBg, themeClasses.text, themeClasses.border)}>
                            {Number(params[param.key]).toFixed(param.step < 1 ? 2 : 0)}
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min={param.min} max={param.max} step={param.step}
                          value={params[param.key]} 
                          onChange={(e) => setParams(p => ({ ...p, [param.key]: Number(e.target.value) }))}
                          className={clsx("w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer", themeClasses.accent)} 
                        />
                        <div className="flex justify-between text-[9px] text-text-muted font-bold">
                          <span>{param.min}</span><span>{param.max}</span>
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
      <Panel className="relative overflow-hidden border-border bg-white shadow-lg">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-signature opacity-50" />
        
        <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
          <BookOpen className="text-blue-500" size={20} />
          <h2 className="text-sm font-black tracking-widest text-text-primary uppercase">Physics-Based Diagnostic Explanations</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {physicsExplanations.map((item) => (
            <div key={item.title} className={clsx("p-4 rounded-xl border border-slate-100 shadow-sm", item.bg, item.borderColor)}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-text-primary">{item.title}</span>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white border border-border text-text-muted">
                  {item.contribution} Contrib.
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black mb-0.5">Deviation</p>
                  <p className={clsx("text-xs font-black font-sans", item.color)}>{item.deviation}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black mb-0.5">Physical Effect</p>
                  <p className="text-xs text-text-secondary leading-relaxed font-bold">{item.effect}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black mb-0.5">Impact Area</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500/40" />
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-tight italic">{item.location}</p>
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
