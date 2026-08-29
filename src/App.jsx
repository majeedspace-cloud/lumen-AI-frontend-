import Sidebar from './components/Sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import LumenLogo from './components/LumenLogo.jsx'

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <LumenLogo size={32} />
          <h1 className="app-logo">Lumen</h1>
        </div>
        <ThemeToggle />
      </header>
      <div className="app-body">
        <Sidebar />
        <ChatWindow />
      </div>
    </div>
  )
}
