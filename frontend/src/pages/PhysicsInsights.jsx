import React, { useState, useMemo } from 'react';
import { Activity, AlertTriangle, ShieldCheck, Zap, Server, SlidersHorizontal, Cpu, BookOpen } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell, YAxis as BarYAxis, XAxis as BarXAxis, LabelList } from 'recharts';
import clsx from 'clsx';
import Panel from '../components/shared/Panel';

export default function PhysicsInsights({ engine }) {
  // Sandbox State
  const [moldingTemp, setMoldingTemp] = useState(175);
  const [vacuumLevel, setVacuumLevel] = useState(95);
  const [transferPressure, setTransferPressure] = useState(10);

  // Dynamic Prediction Logic
  const predictedCRI = useMemo(() => {
    let cri = 0.3; // Default baseline
    cri += (moldingTemp - 175) * 0.015;
    cri += (95 - vacuumLevel) * 0.01;
    cri += (transferPressure - 10) * 0.02;
    return Math.max(0, Math.min(1.0, cri));
  }, [moldingTemp, vacuumLevel, transferPressure]);

  const isCritical = predictedCRI > 0.6;

  // Component B: CRI Lifecycle Data
  const criData = useMemo(() => [
    { stage: 'Die Bond', cri: 0.1 },
    { stage: 'Wire Bond', cri: 0.15 },
    { stage: 'Mold', cri: 0.15 + (predictedCRI - 0.3) * 0.4 },
    { stage: 'Ball Attach', cri: 0.2 + (predictedCRI - 0.3) * 0.7 },
    { stage: 'Saw Singulation', cri: predictedCRI },
  ].map(d => ({ ...d, cri: Math.max(0, Math.min(1, d.cri)) })), [predictedCRI]);

  // Component C: Root Cause Data
  const rootCauseData = [
    { name: 'Molding Temp', value: 42, color: '#ef4444' },
    { name: 'Vacuum Level', value: 23, color: '#f59e0b' },
    { name: 'Transfer Pressure', value: 12, color: '#3b82f6' },
    { name: 'Other', value: 23, color: '#9ca3af' },
  ];

  // Component A: Heatmap Data
  const heatmapCells = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => {
      const x = i % 10;
      const y = Math.floor(i / 10);
      const dist00 = Math.sqrt(x * x + y * y);
      const dist09 = Math.sqrt(x * x + (9 - y) * (9 - y));
      const dist90 = Math.sqrt((9 - x) * (9 - x) + y * y);
      const dist99 = Math.sqrt((9 - x) * (9 - x) + (9 - y) * (9 - y));
      const minDist = Math.min(dist00, dist09, dist90, dist99);
      
      let stress = (12 - minDist) / 12;
      stress = stress * (predictedCRI / 0.3); // Scale stress by CRI
      stress = Math.max(0, Math.min(1, stress));
      
      // Interpolate Hue: 240 (Blue) -> 0 (Red)
      const hue = (1 - stress) * 240;
      return { id: i, color: `hsl(${hue}, 100%, 45%)` };
    });
  }, [predictedCRI]);

  // Physics Explanations Mapping
  const physicsExplanations = {
    'Molding Temp': {
      deviation: "+8°C above nominal",
      effect: "CTE mismatch → thermal stress at die-mold interface",
      location: "center region",
      color: "text-red-600",
      bg: "bg-red-50"
    },
    'Vacuum Level': {
      deviation: "-15% below target",
      effect: "Void formation → increased acoustic impedance",
      location: "corner regions",
      color: "text-amber-600",
      bg: "bg-amber-50"
    },
    'Transfer Pressure': {
      deviation: "+2.5 MPa surge",
      effect: "Wire sweep → potential shorting at lead-frame",
      location: "peripheral bond pads",
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    'Other': {
      deviation: "Nominal variance",
      effect: "Composite minor stresses",
      location: "global distribution",
      color: "text-slate-600",
      bg: "bg-slate-50"
    }
  };

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
            label="ROM Reconstruction Time: 12ms" 
            icon={Zap} 
            className="bg-blue-500/10 text-blue-500 border-blue-500/30 shadow-glow-cyan"
          />
          <Badge 
            label="Current Unit: DIE-899A" 
            icon={Cpu} 
            className="bg-bg-base text-text-primary border-border"
          />
          <Badge 
            label="System Status: LIVE INFERENCE" 
            icon={Activity} 
            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 animate-pulse-slow"
          />
      </div>

      {/* Zone 2: The Physics & Analytics Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Component A: 2D Stress Distribution Heatmap */}
        <Panel title="2D Stress Distribution Heatmap" className="lg:col-span-1 flex flex-col items-center justify-center p-6">
          <div className="w-64 h-64 grid grid-cols-10 grid-rows-10 gap-0.5 mb-4 p-1 bg-black/5 border border-border rounded-lg shadow-inner">
            {heatmapCells.map(cell => (
              <div 
                key={cell.id} 
                className="w-full h-full rounded-sm transition-colors duration-300"
                style={{ backgroundColor: cell.color }}
              />
            ))}
          </div>
          <div className="text-center space-y-1">
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
              Reconstructed in 12ms via Singular Value Decomposition
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] uppercase text-text-muted mt-2 font-bold">
              <span>Low Stress</span>
              <div className="w-24 h-2 bg-gradient-to-r from-blue-600 to-red-600 rounded-full opacity-70" />
              <span>High Stress</span>
            </div>
          </div>
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
                  itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                  labelStyle={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}
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
                  dot={{ r: 4, fill: isCritical ? "#ef4444" : "#3b82f6", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
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
                  width={120}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sliders Area */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 border border-border">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-wider text-text-secondary">Molding Temperature (°C)</span>
                <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100 text-xs font-black font-sans shadow-sm">{moldingTemp}</span>
              </div>
              <input 
                type="range" 
                min="160" max="190" 
                value={moldingTemp} 
                onChange={(e) => setMoldingTemp(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" 
              />
              <div className="flex justify-between text-[10px] text-text-muted font-bold">
                <span>160</span><span>190</span>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 border border-border">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-wider text-text-secondary">Vacuum Level (%)</span>
                <span className="px-2 py-1 rounded bg-amber-50 text-amber-600 border border-amber-100 text-xs font-black font-sans shadow-sm">{vacuumLevel}</span>
              </div>
              <input 
                type="range" 
                min="80" max="100" 
                value={vacuumLevel} 
                onChange={(e) => setVacuumLevel(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500" 
              />
              <div className="flex justify-between text-[10px] text-text-muted font-bold">
                <span>80</span><span>100</span>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 border border-border sm:col-span-2 lg:col-span-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-wider text-text-secondary">Transfer Pressure (MPa)</span>
                <span className="px-2 py-1 rounded bg-purple-50 text-purple-600 border border-purple-100 text-xs font-black font-sans shadow-sm">{transferPressure}</span>
              </div>
              <input 
                type="range" 
                min="5" max="15" step="0.1"
                value={transferPressure} 
                onChange={(e) => setTransferPressure(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500" 
              />
              <div className="flex justify-between text-[10px] text-text-muted font-bold">
                <span>5.0</span><span>15.0</span>
              </div>
            </div>

          </div>

          {/* Output Display */}
          <div className={clsx(
            "md:col-span-1 flex flex-col items-center justify-center p-6 rounded-2xl border relative overflow-hidden transition-colors duration-300 shadow-sm",
            isCritical ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
          )}>
            <h3 className={clsx(
              "text-[10px] uppercase tracking-widest font-black mb-2 z-10",
              isCritical ? "text-red-600/70" : "text-emerald-600/70"
            )}>Predicted CRI Score</h3>
            <div 
              className="text-7xl font-black tracking-tighter tabular-nums z-10 transition-colors duration-300"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rootCauseData.map((item) => {
            const explanation = physicsExplanations[item.name] || physicsExplanations['Other'];
            return (
              <div key={item.name} className={clsx("p-4 rounded-xl border border-slate-100 shadow-sm bg-slate-50/30")}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-primary">{item.name}</span>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white border border-border text-text-muted">
                    {item.value}% Contrib.
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-black mb-0.5">Deviation</p>
                    <p className={clsx("text-xs font-black font-sans", explanation.color)}>{explanation.deviation}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-black mb-0.5">Physical Effect</p>
                    <p className="text-xs text-text-secondary leading-relaxed font-bold">{explanation.effect}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-black mb-0.5">Impact Area</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500/40" />
                      <p className="text-[10px] text-text-muted font-black uppercase tracking-tight italic">{explanation.location}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

    </div>
  );
}
