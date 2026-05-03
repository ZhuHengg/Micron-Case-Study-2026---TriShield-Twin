import React, { useState } from 'react'

import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import UnitInvestigation from './pages/UnitInvestigation'
import TriLayerInsights from './pages/TriLayerInsights'
import PhysicsInsights from './pages/PhysicsInsights'
import Tuning from './pages/Tuning'
import Retraining from './pages/Retraining'
import ParameterLab from './pages/ParameterLab'
import clsx from 'clsx'
import { Play, Pause, Zap } from 'lucide-react'


import { useYieldEngine } from './hooks/useYieldEngine'

import Header from './components/layout/Header'
import ErrorBoundary from './components/shared/ErrorBoundary'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const engine = useYieldEngine()

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col h-full bg-grid-pattern bg-grid">
        <Header engine={engine} activeTab={activeTab} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <ErrorBoundary>
            {activeTab === 'dashboard' && <Dashboard engine={engine} />}

            {activeTab === 'investigation' && <div className="h-full"><UnitInvestigation engine={engine} /></div>}
            {activeTab === 'insights' && <div className="p-6"><TriLayerInsights engine={engine} /></div>}
            {activeTab === 'physics' && <div className="p-6 h-full"><PhysicsInsights engine={engine} /></div>}
            {activeTab === 'tuning' && <Tuning engine={engine} />}
            {activeTab === 'parameter_lab' && <div className="p-6"><ParameterLab engine={engine} /></div>}
            {activeTab === 'retraining' && <div className="p-6 h-full"><Retraining engine={engine} /></div>}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export default App
