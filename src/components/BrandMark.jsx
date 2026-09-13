// The faceted prism gem brand mark — a gradient tile with the gem polygon.
// `className` sizes the tile (e.g. "w-8 h-8 rounded-xl"), `iconClass` sizes
// the drawn gem inside it. Sizes default to the top-bar style.
export default function BrandMark({ className = 'w-8 h-8 rounded-xl', iconClass = 'w-[18px] h-[18px]' }) {
  return (
    <div
      className={`${className} bg-gradient-to-tr from-cyan-400 via-sky-300 to-amber-300 flex items-center justify-center shadow-sm shadow-sky-200/50 ring-1 ring-white/80`}
    >
      <svg
        className={`${iconClass} text-slate-800`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <polygon className="stroke-slate-900 fill-white/40" points="6 3 18 3 22 9 12 22 2 9" />
        <line className="stroke-slate-800" x1="12" x2="12" y1="22" y2="9" />
        <line className="stroke-slate-800" x1="2" x2="22" y1="9" y2="9" />
      </svg>
    </div>
  )
}