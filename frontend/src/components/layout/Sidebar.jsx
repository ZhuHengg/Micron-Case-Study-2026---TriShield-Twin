import React, { useState, useEffect } from 'react'
import {
  ShieldCheck, LayoutDashboard, Search, ShieldAlert,
  Zap, Beaker, RefreshCw, Settings, Sun, Moon
} from 'lucide-react'
import clsx from 'clsx'
import micronLogo from '../../micron-logo/micron-logo-J6vsDRis_t.jpg'

export default function Sidebar({ activeTab, setActiveTab }) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'investigation', label: 'Unit Investigation', icon: Search },
    { id: 'insights', label: 'Model Insights', icon: ShieldAlert },
    { id: 'physics', label: 'Physics Sandbox', icon: Zap },
    { id: 'tuning', label: 'Tuning', icon: Settings },
    { id: 'parameter_lab', label: 'Parameter Tuning Lab', icon: Beaker },
    { id: 'retraining', label: 'Retraining', icon: RefreshCw },
  ]

  return (
    <div className="w-64 h-full flex flex-col pt-6 pb-6 shadow-xl z-20 relative transition-all duration-300 bg-[#E2E8F0] dark:bg-slate-900/60 dark:backdrop-blur-xl border-r border-slate-300 dark:border-white/10">

      {/* Branding */}
      <div className="px-6 mb-10">
        <div className="flex items-center mb-1">
          <img 
            src={micronLogo} 
            alt="Micron" 
            className={clsx("h-7 object-contain transition-all duration-300", isDark && "brightness-0 invert")}
          />
          <div className="flex flex-col justify-center ml-2 border-l-[3px] border-slate-400 dark:border-white/30 pl-2">
            <span className="text-[12px] font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] leading-none transition-colors">
              Sentinel
            </span>
          </div>
        </div>
        <p className="font-sans text-[8px] text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] mt-3 font-black transition-colors">
          Fab 20 Digital Thread
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1.5">
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
                  ? "bg-[#0066CC] dark:bg-white/20 text-white shadow-md dark:shadow-inner"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-white/10"
              )}
            >
              <Icon
                size={18}
                className={clsx(
                  "transition-colors",
                  isActive ? "text-white" : "text-slate-500 dark:text-slate-300 group-hover:text-[#0066CC] dark:group-hover:text-white"
                )}
              />
              <span className="font-sans font-black text-[11px] uppercase tracking-widest text-left flex-1">{item.label}</span>

              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer / System Status */}
      <div className="px-6 pt-6 border-t border-slate-300 dark:border-white/10 space-y-4">
        
        {/* Theme Toggle */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-300/50 dark:border-white/10 hover:bg-slate-300/50 dark:hover:bg-white/10 transition-all group"
        >
          {isDark ? (
            <Sun size={14} className="text-slate-300 group-hover:text-amber-400 transition-colors" />
          ) : (
            <Moon size={14} className="text-slate-600 group-hover:text-[#0066CC] transition-colors" />
          )}
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
            {isDark ? 'Light Lab' : 'Dark Lab'}
          </span>
        </button>

        {/* Status */}
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-2 rounded-full bg-[#00A3AD] animate-pulse shadow-[0_0_8px_#00A3AD]" />
          <span className="text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">System Online</span>
        </div>
      </div>

    </div>
  )
}
