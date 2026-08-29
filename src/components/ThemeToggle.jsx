import { useEffect, useState } from 'react'

// How this works: we set a data-theme attribute on <html>, and theme.css
// defines two sets of CSS variables (--bg, --text, --panel, etc.) — one
// per theme. Every element in the app reads colors from those variables
// instead of hardcoding them, so flipping the attribute re-themes the
// entire app instantly, and CSS `transition` on those properties is what
// makes it animate smoothly instead of jarring-snapping.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('rag_theme') || 'glass')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rag_theme', theme)
  }, [theme])

  function toggle() {
    setTheme((t) => (t === 'glass' ? 'mono' : 'glass'))
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
      <span className={`theme-toggle-track ${theme === 'mono' ? 'is-mono' : ''}`}>
        <span className="theme-toggle-thumb">{theme === 'glass' ? '✨' : '◐'}</span>
      </span>
      <span className="theme-toggle-label">{theme === 'glass' ? 'Glass' : 'Mono'}</span>
    </button>
  )
}
