import { useEffect, useState } from 'react'

// Light/Dark switcher in the top bar. Applies the theme by toggling the
// `dark` class and `data-theme` on <html> — Tailwind reads the class for
// `dark:` variants, and theme.css reads the attribute for color-scheme.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('rag_theme') || 'light')

  useEffect(() => {
    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rag_theme', theme)
  }, [theme])

  function setLight() {
    setTheme('light')
  }
  function setDark() {
    setTheme('dark')
  }

  const active = 'bg-white text-slate-800 shadow-sm border border-slate-200/60'
  const inactive =
    'text-slate-400 hover:text-slate-600 hover:bg-white/70 dark:text-slate-400 dark:hover:text-slate-200'

  return (
    <div
      className="flex items-center p-1 bg-white/75 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-full shadow-sm space-x-1"
      data-purpose="theme-toggle"
    >
      <button
        onClick={setLight}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-tight transition-all duration-150 ${theme === 'light' ? active : inactive}`}
        type="button"
      >
        <span className="material-symbols-outlined text-amber-500 text-sm leading-none">light_mode</span>
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">Light</span>
      </button>
      <button
        onClick={setDark}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-tight transition-all duration-150 ${theme === 'dark' ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-800 shadow-sm border border-slate-700/60 dark:border-slate-200/60' : inactive}`}
        type="button"
      >
        <span className={`material-symbols-outlined text-sm leading-none ${theme === 'dark' ? 'text-slate-200 dark:text-amber-500' : 'text-slate-400'}`}>
          dark_mode
        </span>
        <span className="text-[11px] font-medium">Dark</span>
      </button>
    </div>
  )
}