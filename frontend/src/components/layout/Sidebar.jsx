import React from 'react'
import { ShieldCheck, LayoutDashboard, Search, ShieldAlert, Settings, Zap, RefreshCw, Beaker } from 'lucide-react'
import clsx from 'clsx'

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'investigation', label: 'Investigation', icon: Search },
    { id: 'insights', label: 'Model Insights', icon: ShieldAlert },
    { id: 'physics', label: 'Physics Sandbox', icon: Zap },
    { id: 'tuning', label: 'Tuning', icon: Settings },
    { id: 'parameter_lab', label: 'Simulation Lab', icon: Beaker },
    { id: 'retraining', label: 'Retraining', icon: RefreshCw },
  ]

  return (
    <div className="w-64 h-full bg-bg-50 border-r border-border flex flex-col pt-6 pb-6 shadow-xl z-20 relative">
      
      {/* Branding */}
      <div className="px-6 mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-signature flex items-center justify-center shadow-btn-primary">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <h1 className="font-sans font-black text-[18px] leading-tight tracking-tight text-text-primary uppercase">
            Micron Sentinel
          </h1>
        </div>
        <p className="font-sans text-[9px] text-text-muted uppercase tracking-[0.15em] pl-[44px] font-black">
          Fab 20 Digital Thread
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                isActive 
                  ? "bg-bg-100 text-blue-600 shadow-[inset_2px_0_0_0_#2563eb]" 
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-100"
              )}
            >
              <Icon 
                size={18} 
                className={clsx(
                  "transition-colors",
                  isActive ? "text-blue-600" : "text-text-muted group-hover:text-text-primary"
                )} 
              />
              <span className="font-sans font-bold text-[13px] uppercase tracking-wider">{item.label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
