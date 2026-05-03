import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Micron Sentinel Crash Log:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#050A18] text-white p-10 font-sans">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-6 border border-red-500/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest mb-2">Interface Subsystem Failure</h1>
          <p className="text-slate-400 text-center max-w-md mb-8 font-medium">
            The module encountered a runtime exception during state synchronization. 
            Telemetry has been logged for engineering review.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 w-full max-w-2xl overflow-auto mb-8">
            <pre className="text-xs text-red-400 font-mono">
              {this.state.error?.toString() || 'Unknown Runtime Error'}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Reinitialize Interface
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
