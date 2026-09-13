import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import LumenLogo from './components/LumenLogo.jsx'

// Soft-focus daylight backdrop: architectural photo, luminous washes,
// gradient blooms and a faint dot grid — all pointer-transparent and
// fixed behind the frosted-glass panels.
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" data-purpose="ambient-canvas-atmosphere">
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-[6px] scale-105 transform dark:opacity-40"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2400&q=80")',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-sky-100/50 via-white/60 to-amber-50/50 backdrop-blur-[2px] dark:from-sky-900/40 dark:via-slate-900/60 dark:to-slate-800/40" />
      <div className="absolute -top-[10%] left-[15%] w-[850px] h-[650px] rounded-full bg-gradient-to-br from-amber-200/40 via-rose-100/30 to-transparent blur-[100px] dark:from-amber-500/10" />
      <div className="absolute top-[25%] -right-[5%] w-[750px] h-[750px] rounded-full bg-gradient-to-bl from-cyan-200/40 via-sky-100/30 to-transparent blur-[120px] dark:from-cyan-500/10" />
      <div className="absolute inset-0 opacity-[0.025] ambient-dot-grid" />
    </div>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <>
      <AmbientBackground />
      <div className="app-shell soft-glow relative z-10 flex flex-col h-screen max-w-[1440px] mx-auto px-4 py-3 md:px-6 md:py-4">
        {/* Top bar */}
        <header
          className="flex items-center justify-between h-14 px-6 rounded-2xl frosted-glass-panel mb-3.5 flex-shrink-0"
          data-purpose="top-navigation"
        >
          <div className="flex items-center space-x-2.5">
            <LumenLogo size={32} />
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Lex</span>
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-amber-500 inline-block animate-pulse" />
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Workspace */}
        <div className="flex flex-1 gap-3.5 overflow-hidden min-h-0">
          {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
          <ChatWindow
            sidebarOpen={sidebarOpen}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        </div>
      </div>
    </>
  )
}