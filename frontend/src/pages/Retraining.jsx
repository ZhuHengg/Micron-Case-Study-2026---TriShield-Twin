import React, { useState } from 'react'
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

const MOCK_UNITS = [
  { id: 'UNT-M39VY', wafer: 'WF-15542', risk: 99, mlLabel: 'DEFECT', status: 'Unlabeled' },
  { id: 'UNT-V8P5D', wafer: 'WF-19096', risk: 99, mlLabel: 'DEFECT', status: 'Unlabeled' },
  { id: 'UNT-98PZE', wafer: 'WF-17233', risk: 99, mlLabel: 'DEFECT', status: 'Unlabeled' },
  { id: 'UNT-VQDE4', wafer: 'WF-5516', risk: 99, mlLabel: 'DEFECT', status: 'Unlabeled' },
  { id: 'UNT-M2Q1Y', wafer: 'WF-18204', risk: 99, mlLabel: 'DEFECT', status: 'Unlabeled' },
  { id: 'UNT-3CC65', wafer: 'WF-8645', risk: 99, mlLabel: 'DEFECT', status: 'Unlabeled' },
  { id: 'UNT-316Y7', wafer: 'WF-8318', risk: 99, mlLabel: 'DEFECT', status: 'Unlabeled' },
  { id: 'UNT-M1UY2', wafer: 'WF-16305', risk: 98, mlLabel: 'DEFECT', status: 'Unlabeled' },
]

export default function Retraining() {
  const [activeTab, setActiveTab] = useState('unlabeled')
  
  const stats = {
    total: '19,132',
    labeled: 62,
    labeledCoverage: '0.3',
    defectLabels: 52,
    goodLabels: 10,
    ready: true,
    needed: 50
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Top Header / Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-bg-50 rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between">
          <span className="font-sans text-[10px] text-text-muted font-bold tracking-widest uppercase">Total in DB</span>
          <div className="text-3xl font-black text-cyan-600 mt-2">{stats.total}</div>
        </div>
        
        <div className="bg-bg-50 rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between">
          <span className="font-sans text-[10px] text-text-muted font-bold tracking-widest uppercase">Labeled</span>
          <div className="mt-2">
             <div className="text-3xl font-black text-teal-500">{stats.labeled}</div>
             <div className="text-[10px] font-bold text-text-muted mt-1 uppercase tracking-wider">{stats.labeledCoverage}% coverage</div>
          </div>
        </div>

        <div className="bg-bg-50 rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between">
          <span className="font-sans text-[10px] text-text-muted font-bold tracking-widest uppercase">Defect Labels</span>
          <div className="text-3xl font-black text-rose-500 mt-2">{stats.defectLabels}</div>
        </div>

        <div className="bg-bg-50 rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between">
          <span className="font-sans text-[10px] text-text-muted font-bold tracking-widest uppercase">Good Labels</span>
          <div className="text-3xl font-black text-blue-500 mt-2">{stats.goodLabels}</div>
        </div>

        <div className="bg-bg-50 rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between">
          <span className="font-sans text-[10px] text-text-muted font-bold tracking-widest uppercase">Retrain Ready</span>
          <div className="mt-2">
             <div className="text-3xl font-black text-emerald-500">YES</div>
             <div className="text-[10px] font-bold text-text-muted mt-1 uppercase tracking-wider">Need ≥{stats.needed} labels</div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
        
        {/* Left Column: List */}
        <div className="col-span-2 bg-bg-50 rounded-xl border border-border shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
             <h3 className="font-sans text-[11px] text-text-muted font-black tracking-widest uppercase">Unit Labeling</h3>
          </div>
          
          <div className="px-4 pt-3 flex gap-2 border-b border-border">
            <button 
              onClick={() => setActiveTab('unlabeled')}
              className={clsx(
                "px-4 py-2 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors",
                activeTab === 'unlabeled' ? "border-blue-500 text-blue-600" : "border-transparent text-text-secondary hover:text-text-primary"
              )}>
              Unlabeled (19,070)
            </button>
            <button 
              onClick={() => setActiveTab('labeled')}
              className={clsx(
                "px-4 py-2 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors",
                activeTab === 'labeled' ? "border-blue-500 text-blue-600" : "border-transparent text-text-secondary hover:text-text-primary"
              )}>
              Labeled (62)
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={clsx(
                "px-4 py-2 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors",
                activeTab === 'all' ? "border-blue-500 text-blue-600" : "border-transparent text-text-secondary hover:text-text-primary"
              )}>
              All (19,132)
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-50 sticky top-0 z-10">
                  <th className="py-3 px-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Unit ID</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Wafer ID</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Yield Risk</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">ML Label</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_UNITS.map((unit, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-bg-100 transition-colors group">
                    <td className="py-3 px-4 text-[12px] font-bold font-mono text-text-primary">{unit.id}</td>
                    <td className="py-3 px-4 text-[12px] font-medium text-text-secondary">{unit.wafer}</td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{unit.risk}%</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">{unit.mlLabel}</span>
                    </td>
                    <td className="py-3 px-4 text-[11px] font-bold text-text-secondary">{unit.status}</td>
                    <td className="py-3 px-4 flex justify-end gap-2">
                       <button className="px-3 py-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1">
                          <AlertTriangle size={12} /> Defect
                       </button>
                       <button className="px-3 py-1 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1">
                          <CheckCircle size={12} /> Good
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Actions */}
        <div className="col-span-1 flex flex-col gap-6">
          
          {/* Model Retraining Card */}
          <div className="bg-bg-50 rounded-xl p-5 border border-border shadow-sm">
            <h3 className="font-sans text-[11px] text-text-muted font-black tracking-widest uppercase mb-4">Model Retraining</h3>
            
            <p className="text-[12px] text-text-secondary leading-relaxed mb-6 font-medium">
              Re-optimizes ensemble weights and decision thresholds using your labeled data. Base models (LightGBM, XGBoost, IsoForest) are preserved — only the fusion layer is updated.
            </p>

            <div className="mb-6">
               <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-2 text-text-primary">
                 <span>Labeling Progress</span>
                 <span>62/50 Min</span>
               </div>
               <div className="w-full h-2 bg-bg-200 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 w-full rounded-full relative">
                    <div className="absolute inset-0 bg-white/20 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                 </div>
               </div>
            </div>

            <button className="w-full py-3 bg-gradient-signature text-white rounded-xl font-bold text-[12px] uppercase tracking-wider shadow-btn-primary hover:shadow-lg transition-all flex items-center justify-center gap-2">
               <RefreshCw size={16} /> Retrain Ensemble
            </button>
          </div>

          {/* How It Works */}
          <div className="bg-bg-50 rounded-xl p-5 border border-border shadow-sm flex-1">
             <h3 className="font-sans text-[11px] text-text-muted font-black tracking-widest uppercase mb-4">How it works</h3>
             
             <div className="space-y-4">
                <div className="flex gap-3">
                   <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 border border-blue-200">1</div>
                   <div>
                     <div className="text-[11px] font-bold text-text-primary uppercase tracking-wider mb-1">Label</div>
                     <div className="text-[12px] text-text-secondary leading-tight">Analysts mark flagged units as DEFECT or GOOD based on inspection.</div>
                   </div>
                </div>

                <div className="flex gap-3">
                   <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 border border-blue-200">2</div>
                   <div>
                     <div className="text-[11px] font-bold text-text-primary uppercase tracking-wider mb-1">Score</div>
                     <div className="text-[12px] text-text-secondary leading-tight">All labeled units are re-scored through the full multi-stage engine.</div>
                   </div>
                </div>

                <div className="flex gap-3">
                   <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 border border-blue-200">3</div>
                   <div>
                     <div className="text-[11px] font-bold text-text-primary uppercase tracking-wider mb-1">Optimize</div>
                     <div className="text-[12px] text-text-secondary leading-tight">Grid search finds optimal weights & thresholds on the labeled data.</div>
                   </div>
                </div>

                <div className="flex gap-3">
                   <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 border border-blue-200">4</div>
                   <div>
                     <div className="text-[11px] font-bold text-text-primary uppercase tracking-wider mb-1">Deploy</div>
                     <div className="text-[12px] text-text-secondary leading-tight">New config is saved and hot-reloaded (no restart needed).</div>
                   </div>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  )
}
