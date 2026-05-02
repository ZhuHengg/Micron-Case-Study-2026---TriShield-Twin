import React, { useState, useMemo, useEffect } from 'react'
import { 
  Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle, 
  AlertTriangle, Info, Settings2, Activity, Gauge, TrendingUp
} from 'lucide-react'
import clsx from 'clsx'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

/**
 * Micron Sentinel - Digital Thread Dashboard
 * Refactored to Industrial "Feed-Forward" Logic
 */

/* ─── Components ────────────────────────────────────────── */

const ParameterDisplay = ({ label, value, unit, color }) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-sans text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-sans text-[18px] font-black" style={{ color }}>{value.toFixed(1)}</span>
        <span className="font-sans text-[10px] font-bold text-text-muted">{unit}</span>
      </div>
    </div>
  )
}

const MachineCard = ({ stage, data, cumulativeProb }) => {
  const Icon = stage.icon
  const [chartFeed, setChartFeed] = useState([])

  // Append new data to chart feed whenever global data updates
  useEffect(() => {
    setChartFeed(prev => {
      const next = { time: Date.now() }
      if (stage.params) {
        stage.params.forEach(p => {
          next[p.id] = data[p.id]
        })
      }
      const newFeed = [...prev, next]
      return newFeed.slice(-30) // Keep last 30 points
    })
  }, [data, stage.params])
  
  // Calculate local risk based on parameter deviations
  const localRisk = useMemo(() => {
    if (stage.id === 'iol') return cumulativeProb || 0
    if (!stage.params) return 0
    let totalDev = 0
    stage.params.forEach(p => {
      const val = data[p.id]
      const dev = Math.abs(val - p.nominal) / (p.max - p.min)
      totalDev += dev
    })
    return Math.min(100, (totalDev / stage.params.length) * 200) // Scale to 0-100
  }, [stage.params, data, stage.id, cumulativeProb])

  const status = localRisk < 30 ? 'PASS' : localRisk < 70 ? 'MARGINAL' : 'CRITICAL'
  const statusColor = status === 'PASS' ? 'text-status-pass' : status === 'MARGINAL' ? 'text-status-marginal' : 'text-status-reject'
  const borderColor = status === 'PASS' ? 'border-status-pass/20' : status === 'MARGINAL' ? 'border-status-marginal/30' : 'border-status-reject/40'
  const bgColor = status === 'PASS' ? 'bg-status-pass/5' : status === 'MARGINAL' ? 'bg-status-marginal/5' : 'bg-status-reject/5'

  return (
    <div className={clsx(
      "p-6 rounded-[24px] border transition-all duration-500 flex flex-col gap-6 bg-white shadow-xl relative overflow-hidden min-h-[260px]",
      borderColor
    )} style={{ borderLeftWidth: '8px', borderLeftColor: stage.color }}>
      {/* Dynamic Background Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] -mr-8 -mt-8" style={{ color: stage.color }}>
        <Icon size={128} />
      </div>

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg bg-bg-base" style={{ borderColor: `${stage.color}40`, color: stage.color }}>
            <Icon size={24} />
          </div>
          <div>
            <h3 className="font-sans font-black text-[16px] uppercase tracking-tight" style={{ color: stage.color }}>{stage.name}</h3>
            <div className="flex items-center gap-2">
              <span className={clsx("font-sans text-[10px] font-bold tracking-widest uppercase", statusColor)}>{status}</span>
              <div className="w-1 h-1 rounded-full bg-text-muted/30" />
              <span className="font-sans text-[10px] text-text-muted uppercase font-bold tracking-wider">
                {stage.id === 'iol' ? 'Confidence Index' : 'Risk Index'}: {(100 - localRisk).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <Activity size={16} className={clsx("mb-1 animate-pulse", statusColor)} />
          <span className="font-sans text-[9px] text-text-muted uppercase tracking-[0.2em] font-black">Station LIVE</span>
        </div>
      </div>

      {stage.params ? (
        <div className="space-y-6 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            {stage.params.map(p => (
              <ParameterDisplay 
                key={p.id}
                {...p}
                value={data[p.id]}
                color={stage.color}
              />
            ))}
          </div>
          
          {/* Real-time Machine Graph */}
          <div className="h-20 w-full bg-bg-base/50 rounded-xl border border-border/40 p-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartFeed}>
                {stage.params.map(p => (
                  <YAxis key={`y-${p.id}`} yAxisId={p.id} domain={[p.min - (p.max-p.min)*0.2, p.max + (p.max-p.min)*0.2]} hide />
                ))}
                {stage.params.map((p, i) => (
                  <Line 
                    key={p.id}
                    yAxisId={p.id}
                    type="monotone"
                    dataKey={p.id}
                    stroke={stage.color}
                    strokeWidth={2}
                    strokeOpacity={i === 0 ? 1 : 0.4}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 border border-border/30 rounded-2xl bg-bg-base/30 relative z-10">
          <span className="font-sans text-[10px] text-text-muted uppercase tracking-[0.2em] font-black mb-2">Cumulative IOL Failure Prob.</span>
          <div className="flex items-baseline gap-2">
            <span className={clsx(
              "font-sans text-[48px] font-black leading-none tracking-tighter tabular-nums",
              statusColor
            )}>
              {localRisk.toFixed(1)}%
            </span>
            <TrendingUp size={20} className={clsx("opacity-40", statusColor)} />
          </div>
          <div className="mt-4 flex flex-col items-center gap-1">
             <div className="w-32 h-1 bg-border/20 rounded-full overflow-hidden">
                <div className={clsx("h-full transition-all duration-1000", status === 'PASS' ? 'bg-status-pass' : status === 'MARGINAL' ? 'bg-status-marginal' : 'bg-status-reject')} style={{ width: `${localRisk}%` }} />
             </div>
             <p className="font-sans text-[9px] text-text-muted uppercase font-black tracking-widest mt-2">End-of-Line Synthesis</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────── */

const STAGES = [
  { 
    id: 'die-bond', name: 'Die Bond', icon: Cpu, color: '#2563eb', // Industrial Blue
    params: [
      { id: 'force', label: 'Bond Force', unit: 'N', min: 0, max: 10, nominal: 5 },
      { id: 'viscosity', label: 'Epoxy Viscosity', unit: 'cP', min: 300, max: 600, nominal: 450 }
    ]
  },
  { 
    id: 'wire-bond', name: 'Wire Bond', icon: Zap, color: '#7c3aed', // Royal Purple
    params: [
      { id: 'power', label: 'Ultrasonic Power', unit: 'W', min: 50, max: 110, nominal: 80 },
      { id: 'stroke', label: 'Capillary Stroke', unit: 'k', min: 0, max: 100, nominal: 40 }
    ]
  },
  { 
    id: 'mold', name: 'Mold', icon: Thermometer, color: '#d97706', // Deep Amber
    params: [
      { id: 'pressure', label: 'Transfer Pressure', unit: 'MPa', min: 4, max: 12, nominal: 8 },
      { id: 'temp', label: 'Molding Temp', unit: '°C', min: 150, max: 200, nominal: 175 }
    ]
  },
  { 
    id: 'ball-attach', name: 'Ball Attach & Laser Mark', icon: Microscope, color: '#0891b2', // Ocean Cyan
    params: [
      { id: 'accuracy', label: 'Placement Accuracy', unit: 'µm', min: 0, max: 30, nominal: 10 },
      { id: 'peak_temp', label: 'Reflow Peak Temp', unit: '°C', min: 220, max: 270, nominal: 245 }
    ]
  },
  { 
    id: 'saw', name: 'Saw Singulation', icon: Scissors, color: '#ec4899', // Industrial Pink
    params: [
      { id: 'vibration', label: 'Vibration Amplitude', unit: 'G', min: 0, max: 0.5, nominal: 0.15 },
      { id: 'wear', label: 'Blade Wear Index', unit: '', min: 0, max: 100, nominal: 30 }
    ]
  },
  { 
    id: 'iol', name: 'IOL / Burn-In Prediction', icon: CheckCircle, color: '#059669', // Tech Emerald
    params: null // Output only
  }
]

export default function Dashboard({ onRiskUpdate }) {
  const [stageData, setStageData] = useState(() => {
    const init = {}
    STAGES.forEach(s => {
      if (s.params) {
        s.params.forEach(p => init[p.id] = p.nominal)
      }
    })
    return init
  })

  // Simulate live telemetry drift
  useEffect(() => {
    const interval = setInterval(() => {
      setStageData(prev => {
        const next = { ...prev }
        STAGES.forEach(s => {
          if (s.params) {
            s.params.forEach(p => {
              const current = prev[p.id]
              const range = p.max - p.min
              const drift = (Math.random() - 0.5) * (range * 0.05)
              
              // Smooth return to nominal
              let newVal = current + drift
              if (Math.random() > 0.8) {
                newVal = current + (p.nominal - current) * 0.2
              }
              
              next[p.id] = Math.max(p.min, Math.min(p.max, newVal))
            })
          }
        })
        return next
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  // Global Risk Logic
  const riskMetrics = useMemo(() => {
    let machineRisks = []
    let marginalCount = 0

    STAGES.forEach(s => {
      if (!s.params) return
      let totalDev = 0
      s.params.forEach(p => {
        const val = stageData[p.id]
        const dev = Math.abs(val - p.nominal) / (p.max - p.min)
        totalDev += dev
      })
      const risk = Math.min(100, (totalDev / s.params.length) * 200)
      machineRisks.push(risk)
      if (risk >= 30) marginalCount++
    })

    const avgRisk = machineRisks.reduce((a, b) => a + b, 0) / machineRisks.length
    const isCompound = marginalCount >= 2
    
    let prob = avgRisk
    if (isCompound) {
      prob = Math.max(75, prob * 1.5)
    }

    return { 
      prob: Math.min(100, prob), 
      isCompound: isCompound 
    }
  }, [stageData])

  // Sync risk metrics with parent header
  useEffect(() => {
    if (onRiskUpdate) {
      onRiskUpdate(riskMetrics)
    }
  }, [riskMetrics, onRiskUpdate])

  return (
    <div className="flex flex-col min-h-full pb-12 bg-bg-base font-sans">
      
      {/* ─── Zone 1: Machine Feed Grid ─── */}
      <div className="max-w-[1600px] mx-auto px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {STAGES.map(s => (
            <MachineCard 
              key={s.id}
              stage={s}
              data={stageData}
              cumulativeProb={riskMetrics.prob}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
