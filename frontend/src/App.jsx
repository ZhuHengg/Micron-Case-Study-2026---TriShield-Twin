import React, { useState } from 'react'

import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import UnitInvestigation from './pages/UnitInvestigation'
import TriLayerInsights from './pages/TriLayerInsights'
import PhysicsInsights from './pages/PhysicsInsights'
import Tuning from './pages/Tuning'
import clsx from 'clsx'

import { useYieldEngine } from './hooks/useYieldEngine'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboardRisk, setDashboardRisk] = useState({ prob: 0, isCompound: false })
  const engine = useYieldEngine()

  const tabNames = {
    dashboard: 'Yield Dashboard',
    investigation: 'Unit Investigation',
    insights: 'Model Insights',
    physics: 'Physics Sandbox',
    tuning: 'Tuning'
  }

  const isDashboard = activeTab === 'dashboard'

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col h-full bg-grid-pattern bg-grid">
        
        {/* Global Page Header */}
        <header className={clsx(
          "px-8 py-4 bg-white border-b flex items-center justify-between shrink-0 z-[100] relative transition-all duration-300",
          isDashboard ? "border-blue-500/20 shadow-sm" : "border-border"
        )}>
          {/* Subtle Accent for Dashboard */}
          {isDashboard && (
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 opacity-60" />
          )}

          <div className="flex flex-col relative z-10">
            <h2 className="font-sans font-black text-[16px] text-text-primary uppercase tracking-widest">
              {tabNames[activeTab] || activeTab}
            </h2>
            {isDashboard && (
              <span className="font-sans text-[10px] text-text-muted uppercase tracking-[0.15em] font-black mt-0.5">
                Live Telemetry Analytics: Real-Time Operating Conditions
              </span>
            )}
          </div>

          {/* Alert Badge (Dashboard Only) - Moved from middle gauge */}
          {isDashboard && dashboardRisk.isCompound && (
            <div className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-rose-100 border border-rose-200 animate-pulse z-10">
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">⚠️ Multi-Stage Process Drift Detected</span>
            </div>
          )}

          <div className="flex items-center gap-4 relative z-10">
             <div className="flex flex-col items-end">
                <span className="font-sans text-[9px] text-text-muted uppercase tracking-widest font-black">Environment</span>
                <span className="font-sans text-[11px] text-text-primary font-black uppercase">Production Fab 20</span>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {activeTab === 'dashboard' && <Dashboard engine={engine} onRiskUpdate={setDashboardRisk} />}
          {activeTab === 'investigation' && <div className="h-full"><UnitInvestigation /></div>}
          {activeTab === 'insights' && <div className="p-6"><TriLayerInsights engine={engine} /></div>}
          {activeTab === 'physics' && <div className="p-6"><PhysicsInsights engine={engine} /></div>}
          {activeTab === 'tuning' && <Tuning />}
        </main>
      </div>
    </div>
  )
}

export default App
