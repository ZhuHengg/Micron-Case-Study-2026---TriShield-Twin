import React, { useState, useMemo, useEffect } from 'react'
import { 
  Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle, 
  Search, AlertTriangle, ChevronDown, Filter, Settings2,
  AlertCircle, Activity, Box, Database, Clock, TrendingUp, ShieldAlert
} from 'lucide-react'
import clsx from 'clsx'
import { LineChart, Line, ResponsiveContainer, YAxis, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from 'recharts'

// Shadcn UI Imports
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { PROCESSES, MOCK_FLEETS } from '@/lib/mockData'

// ─── Constants ───────────────────────────────────────────

const PROCESS_COLORS = {
  'die-bond': '#2563eb',     // Industrial Blue
  'wire-bond': '#7c3aed',    // Royal Purple
  'mold': '#d97706',         // Deep Amber
  'ball-attach': '#0891b2',  // Ocean Cyan
  'saw': '#ec4899',          // Industrial Pink
  'iol': '#059669',          // Tech Emerald
}

// ─── UI Components ───────────────────────────────────────

const ParamBadge = ({ type }) => {
  const styles = {
    Unit: 'bg-sky-50 text-sky-600 border-sky-200',
    Process: 'bg-purple-50 text-purple-600 border-purple-200',
    Drift: 'bg-amber-50 text-amber-600 border-amber-200',
  }
  return (
    <span className={clsx(
      "px-2 py-0.5 rounded-md text-[9px] font-black uppercase border tracking-widest shadow-sm",
      styles[type] || 'bg-slate-50 text-slate-600 border-slate-200'
    )}>
      {type}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────

export default function UnitInvestigation() {
  const [activeProcessId, setActiveProcessId] = useState('wire-bond');
  const [sortMode, setSortMode] = useState('Highest Risk');
  const [selectedMachineId, setSelectedMachineId] = useState(MOCK_FLEETS['wire-bond'][0].id);

  const activeProcess = PROCESSES.find(p => p.id === activeProcessId);
  const activeColor = PROCESS_COLORS[activeProcessId] || '#3b82f6';
  const fleet = MOCK_FLEETS[activeProcessId];

  // Sorting
  const sortedFleet = useMemo(() => {
    let sorted = [...fleet];
    if (sortMode === 'Highest Risk') sorted.sort((a, b) => b.risk - a.risk);
    if (sortMode === 'Lowest Risk') sorted.sort((a, b) => a.risk - b.risk);
    return sorted;
  }, [fleet, sortMode]);

  const selectedMachine = useMemo(() => {
    return fleet.find(m => m.id === selectedMachineId) || fleet[0];
  }, [fleet, selectedMachineId]);

  // Real-time telemetry feed state for the selected machine
  const [chartFeed, setChartFeed] = useState([]);
  
  useEffect(() => {
     if (!selectedMachine) return;
     const initialFeed = Array.from({ length: 30 }).map((_, i) => ({
       time: i,
       ...selectedMachine.liveParams
     }));
     setChartFeed(initialFeed);
  }, [selectedMachine]);

  // Simulate live feed
  useEffect(() => {
    const interval = setInterval(() => {
      setChartFeed(prev => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        const next = { time: last.time + 1 };
        
        activeProcess.params.forEach(p => {
          const current = parseFloat(last[p.id]);
          const range = p.max - p.min;
          let step = (Math.random() - 0.5) * (range * 0.04);
          
          const baseVal = parseFloat(selectedMachine.liveParams[p.id]);
          if (Math.abs(current - baseVal) > range * 0.2 && Math.random() > 0.7) {
            step = current > baseVal ? -(range * 0.1) : (range * 0.1);
          }

          let newVal = current + step;
          next[p.id] = newVal;
        });
        return [...prev.slice(1), next];
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [activeProcess, selectedMachine]);

  // Use the live value from the feed if available
  const currentLiveParams = chartFeed.length > 0 ? chartFeed[chartFeed.length - 1] : selectedMachine.liveParams;

  // Handle Tab Switch
  const handleProcessChange = (pid) => {
    setActiveProcessId(pid);
    const newFleet = MOCK_FLEETS[pid];
    let sorted = [...newFleet];
    if (sortMode === 'Highest Risk') sorted.sort((a, b) => b.risk - a.risk);
    if (sortMode === 'Lowest Risk') sorted.sort((a, b) => a.risk - b.risk);
    setSelectedMachineId(sorted[0].id);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[1600px] mx-auto font-sans bg-slate-50">
      
      {/* ═════════ ZONE 1: PROCESS SUB-NAVIGATION (Top) ═════════ */}
      <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar shrink-0 px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10 relative">
        {PROCESSES.map(p => {
          const isActive = activeProcessId === p.id;
          const Icon = p.icon;
          const pColor = PROCESS_COLORS[p.id] || '#3b82f6';
          
          return (
            <button
              key={p.id}
              onClick={() => handleProcessChange(p.id)}
              style={isActive ? { backgroundColor: pColor, borderColor: pColor, color: '#fff' } : {}}
              className={clsx(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all whitespace-nowrap border shadow-sm",
                isActive
                  ? "shadow-lg scale-105"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <Icon size={16} className={isActive ? "text-white/80" : "text-slate-400"} />
              {p.name}
            </button>
          )
        })}
      </div>

      <div className="flex gap-6 flex-1 min-h-0 p-6">
        
        {/* ═════════ ZONE 2: MACHINE FLEET DIRECTORY (Left 30%) ═════════ */}
        <div className="w-[380px] shrink-0 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col border-slate-200 shadow-sm rounded-[24px] overflow-hidden bg-white">
            <CardHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Database size={16} style={{ color: activeColor }} />
                  Fleet Directory
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-bold bg-white">{fleet.length} Active</Badge>
              </div>
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  <option>Highest Risk</option>
                  <option>Lowest Risk</option>
                  <option>Most Recent Activity</option>
                </select>
                <Filter size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </CardHeader>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {sortedFleet.map(machine => {
                const isSelected = selectedMachineId === machine.id;
                const statusColor = machine.risk >= 7 ? 'bg-red-500' : machine.risk > 4 ? 'bg-amber-500' : 'bg-emerald-500';
                
                return (
                  <button
                    key={machine.id}
                    onClick={() => setSelectedMachineId(machine.id)}
                    className={clsx(
                      "w-full text-left p-4 rounded-2xl transition-all border group flex items-center justify-between",
                      isSelected 
                        ? "bg-slate-50 shadow-sm ring-1" 
                        : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    )}
                    style={isSelected ? { borderColor: activeColor, ringColor: activeColor } : {}}
                  >
                    <div className="flex items-center gap-4">
                      <div className={clsx("w-2.5 h-2.5 rounded-full shadow-sm shrink-0", statusColor)} />
                      <div className="flex flex-col">
                        <span className={clsx("text-sm font-black tracking-tight", isSelected ? "text-slate-900" : "text-slate-800")}>
                          {machine.id}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {machine.currentUnit}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Live Risk</span>
                      <span className={clsx(
                        "font-sans text-lg font-black leading-none",
                        machine.risk >= 7 ? 'text-red-500' : machine.risk > 4 ? 'text-amber-500' : 'text-emerald-500'
                      )}>
                        {machine.risk.toFixed(1)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ═════════ ZONE 3: MACHINE DEEP-DIVE & RCA PANEL (Right 70%) ═════════ */}
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pb-6">
          
          {/* SECTION A: Live Operating Status (Top row) */}
          <Card className="border-slate-200 shadow-sm rounded-[24px] bg-white shrink-0">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={clsx(
                    "w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg"
                  )} style={{ backgroundColor: activeColor }}>
                    <activeProcess.icon size={32} />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ color: activeColor }}>
                      {activeProcess.name}: {selectedMachine.id}
                      {selectedMachine.risk >= 7 && <AlertTriangle size={20} className="text-red-500 animate-pulse" />}
                    </h2>
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Box size={14} style={{ color: activeColor }} />
                        Processing Unit ID: <span className="font-black font-sans" style={{ color: activeColor }}>{selectedMachine.currentUnit}</span>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className={clsx(
                        "flex items-center gap-1.5",
                        selectedMachine.risk >= 7 ? 'text-red-600' : selectedMachine.risk > 4 ? 'text-amber-600' : 'text-emerald-600'
                      )}>
                        <Activity size={14} />
                        Status: {selectedMachine.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Diagnostic Risk Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className={clsx(
                      "text-5xl font-sans font-black tracking-tighter",
                      selectedMachine.risk >= 7 ? 'text-red-500' : selectedMachine.risk > 4 ? 'text-amber-500' : 'text-emerald-500'
                    )}>
                      {selectedMachine.risk.toFixed(1)}
                    </span>
                    <span className="text-lg font-bold text-slate-300">/10</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION B: Real-Time Parameter Telemetry (Middle row) */}
          <Card className="border-slate-200 shadow-sm rounded-[24px] bg-white shrink-0">
             <CardHeader className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 size={16} style={{ color: activeColor }} />
                  Real-Time Parameter Telemetry
                </CardTitle>
             </CardHeader>
             <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                   {activeProcess.params.map(p => {
                      const val = parseFloat(currentLiveParams[p.id]);
                      const isOutOfBounds = val > p.max || val < p.min;
                      
                      return (
                        <div key={p.id} className={clsx(
                          "p-5 rounded-2xl border transition-all",
                          isOutOfBounds ? "bg-red-50 border-red-200 ring-1 ring-red-200" : "bg-white border-slate-200 shadow-sm"
                        )}>
                          <div className="flex justify-between items-start mb-6">
                            <ParamBadge type={p.type} />
                            {isOutOfBounds && <AlertCircle size={16} className="text-red-500 animate-pulse" />}
                          </div>
                          
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-tight h-8">{p.name}</h4>
                            <div className="flex items-baseline gap-1.5">
                              <span className={clsx("text-3xl font-sans font-black", isOutOfBounds ? "text-red-600" : "text-slate-800")} style={!isOutOfBounds ? { color: activeColor } : {}}>
                                {val.toFixed(1)}
                              </span>
                              <span className="text-xs font-bold text-slate-400">{p.unit}</span>
                            </div>
                          </div>

                          <div className="mt-5 pt-4 border-t border-slate-100/60 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span className={clsx(val < p.min && "text-red-500")}>Min: {p.min}</span>
                            <span style={{ color: activeColor, opacity: 0.6 }}>Nominal: {p.nominal}</span>
                            <span className={clsx(val > p.max && "text-red-500")}>Max: {p.max}</span>
                          </div>
                        </div>
                      )
                   })}
                </div>

                <div className="h-32 w-full bg-slate-50/50 rounded-xl border border-slate-100 p-2">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={chartFeed}>
                       {activeProcess.params.map(p => (
                         <YAxis key={`y-${p.id}`} yAxisId={p.id} domain={['dataMin - 2', 'dataMax + 2']} hide />
                       ))}
                       {activeProcess.params.map((p, i) => (
                         <Line 
                           key={p.id}
                           yAxisId={p.id}
                           type="monotone"
                           dataKey={p.id}
                           stroke={activeColor}
                           strokeWidth={2}
                           strokeOpacity={i === 0 ? 1 : 0.4}
                           dot={false}
                           isAnimationActive={false}
                         />
                       ))}
                     </LineChart>
                   </ResponsiveContainer>
                </div>
             </CardContent>
          </Card>

           {/* SECTION C: Historical Operations Log (Bottom area) */}
          <Card className="flex flex-col border-slate-200 shadow-sm rounded-[24px] overflow-hidden bg-white min-h-[600px] shrink-0">
             <CardHeader className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={16} style={{ color: activeColor }} />
                  Historical Operations & Trend (24h)
                </CardTitle>
             </CardHeader>
             <div className="flex flex-col flex-1 min-h-0">
                <div className="h-40 p-6 border-b border-slate-100 bg-slate-50/30 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                     <TrendingUp size={14} style={{ color: activeColor }} />
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">24-Hour Risk Trend</h4>
                  </div>
                  <ResponsiveContainer width="100%" height={80}>
                    <AreaChart data={selectedMachine.historicalChartData}>
                      <defs>
                        <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={activeColor} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={activeColor} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="time" hide />
                      <YAxis domain={[0, 10]} hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: activeColor }}
                      />
                      <Area type="monotone" dataKey="riskScore" name="Risk Score" stroke={activeColor} strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <Table>
                  <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-8">Timestamp</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit / Batch ID</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Score</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Parameter Snapshot</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right px-8">System Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMachine.history.map((log) => (
                      <TableRow key={log.id} className={clsx("transition-colors", log.isHighRisk ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-slate-50")}>
                        <TableCell className="font-sans text-xs text-slate-500 px-8 whitespace-nowrap">{log.time}</TableCell>
                        <TableCell className="font-sans text-xs font-bold whitespace-nowrap" style={{ color: activeColor }}>{log.unit}</TableCell>
                        <TableCell>
                          <span className={clsx(
                            "px-2.5 py-1 rounded-md text-[10px] font-sans font-black",
                            log.isHighRisk ? 'bg-red-100 text-red-700' : log.risk > 4 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          )}>
                            {log.risk.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="font-sans text-[10px] text-slate-500">{log.snapshot}</TableCell>
                        <TableCell className="text-right px-8">
                          <span className={clsx(
                            "text-[10px] font-black uppercase tracking-widest flex items-center justify-end gap-1.5",
                            log.isHighRisk ? 'text-red-600' : 'text-emerald-600'
                          )}>
                            {log.isHighRisk && <ShieldAlert size={12} />}
                            {log.action}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </div>
             </div>
          </Card>
          
        </div>
      </div>
    </div>
  )
}
