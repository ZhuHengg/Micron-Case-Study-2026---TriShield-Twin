import React from 'react'
import { Bell, RefreshCw, Play, Pause, Flame, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const PAGE_TITLES = {
  dashboard: 'Batch Yield Analytics',
  investigation: 'Single Unit Diagnostics',
  insights: 'Tri-Shield Model Explainer',
  physics: 'ROM Digital Twin Sandbox',
  parameter_lab: 'Process Tuning Laboratory',
}

const BREADCRUMBS = {
  dashboard: 'Fab 20 > Digital Thread > Batch Tracking',
  investigation: 'Diagnostics > Unit Traceability > Deep Dive',
  insights: 'Models > Ensemble Explainability',
  physics: 'Digital Twin > Stress Field Analysis',
  parameter_lab: 'Simulation > Yield Optimization',
}

export default function Header({ engine, activeTab }) {
  const { resetParams, triggerExcursionBurst, isRunning, setIsRunning } = engine
  const title = PAGE_TITLES[activeTab] || 'Micron Sentinel'
  const breadcrumb = BREADCRUMBS[activeTab] || 'Production Env'

  return (
    <header className="h-[90px] glass dark:bg-transparent flex items-center justify-between px-8 border-b border-slate-200/50 dark:border-white/10 z-10 relative transition-colors duration-300">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-sans font-black text-[22px] text-slate-800 dark:text-white uppercase tracking-tight dark:drop-shadow-md transition-colors">
            {title}
          </h2>
          <span className="text-[10px] font-black bg-[#0066CC]/10 dark:bg-white/20 text-[#0066CC] dark:text-white px-2 py-0.5 rounded uppercase tracking-widest shadow-sm transition-colors">Live</span>
        </div>
        <p className="font-mono text-[9px] text-slate-400 dark:text-slate-300 font-bold uppercase tracking-widest transition-colors">
          {breadcrumb}
        </p>
      </div>

      <div className="flex items-center gap-4">
        
        {/* Connection Pulse */}
        <div className="hidden md:flex items-center gap-2 mr-4 bg-slate-50 dark:bg-transparent dark:glass-card px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 shadow-sm transition-colors duration-300">
          <div className={clsx("w-2 h-2 rounded-full animate-pulse transition-colors", isRunning ? 'bg-[#00A3AD] shadow-[0_0_8px_#00A3AD]' : 'bg-slate-300 dark:bg-slate-400')} />
          <span className="font-sans text-[10px] font-black text-slate-500 dark:text-slate-200 uppercase tracking-widest transition-colors">
            {isRunning ? 'Stream Active' : 'Stream Paused'}
          </span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 bg-white dark:bg-transparent dark:glass-card p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-premium transition-colors duration-300">
          <button 
            onClick={resetParams}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black text-slate-500 hover:text-[#0066CC] hover:bg-[#0066CC]/5 dark:text-slate-200 dark:hover:text-white dark:hover:bg-white/10 transition-all uppercase tracking-widest"
          >
            <RefreshCw size={14} />
            Reset Specs
          </button>
          
          <div className="w-[1px] h-6 bg-slate-100 dark:bg-white/20 mx-1 transition-colors" />

          <button 
            onClick={() => setIsRunning(p => !p)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all border uppercase tracking-widest",
              isRunning 
                ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/30"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20"
            )}
          >
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
            {isRunning ? 'Hold' : 'Resume'}
          </button>

          <button 
            onClick={triggerExcursionBurst}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black text-white bg-red-600 hover:bg-red-700 transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-red-500/50 animate-excursion-glow ml-1 uppercase tracking-widest"
          >
            <Flame size={14} />
            Yield Excursion
          </button>
        </div>

        {/* User / Alerts */}
        <div className="ml-4 flex items-center gap-4">
          <button className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-[#0066CC] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/20 transition-all relative">
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-[#1E293B] transition-colors" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#0066CC] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-sans font-black text-[13px] text-white">YI</span>
          </div>
        </div>

      </div>
      
      {/* Branding Anchor Tagline */}
      <div className="absolute top-2 right-8 pointer-events-none opacity-20 hidden lg:block">
        <span className="font-sans text-[8px] font-black text-white uppercase tracking-[0.4em] italic">
          Intelligence Accelerated™
        </span>
      </div>
    </header>
  )
}
