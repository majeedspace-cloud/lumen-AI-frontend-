# Lex Bot — Frontend

React SPA for the Lex Bot RAG chatbot: streaming chat, document browsing, multi-session history, cross-session memory, and a polished glassmorphism UI with light/dark themes.

## Tech Stack

- **React 18** + **Vite 5**
- **Tailwind CSS 3.4** — custom design tokens in `tailwind.config.js`
- **react-markdown** + **remark-gfm** — renders streaming answers with GFM tables/lists/code
- **Material Symbols** + **Inter** fonts

## Getting Started

```bash
cd frontend
npm install
copy .env.example .env        # set VITE_API_KEY and VITE_API_BASE_URL
npm run dev                   # http://localhost:5173
```

`npm run build` outputs a static site to `dist/`.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `VITE_API_KEY` | Must match the backend `API_KEY`; sent as the `X-API-Key` header |
| `VITE_API_BASE_URL` | Backend base URL, e.g. `https://lex-bot-backend.fastapicloud.dev` |

> `VITE_*` variables are inlined at build time. Both are visible in the served bundle — this is by design (the API is protected by server-side rate limits, not key secrecy). For a new deployment, re-run the build with the correct values.

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `npm run dev` | Vite dev server (HMR) |
| `build` | `npm run build` | Production build → `dist/` |
| `preview` | `npm run preview` | Preview the production build locally |

## Features

- **Streaming chat** — reads the backend SSE stream (`/chat/stream`) and appends tokens live; a status pill ("Searching your documents…") shows while retrieval runs, and a rotating RGB border marks the in-progress answer.
- **Sources** — retrieved citations render as chips with color-coded dots (amber = document, sky = live web) and are kept in session history.
- **Uploads** — PDF upload (≤15 MB) from the prompt bar, with a progress chip, size warnings as toasts, and a document list + delete in the sidebar.
- **Sessions** — grouped Today / Previous 7 Days / Older, auto-named from your first question, renameable and deletable; `Ctrl`/`Cmd` + `K` starts a new chat.
- **Cross-session memory** — per-device facts toggle, cleared from the sidebar.
- **Theme toggle** — light/dark with no flash-of-wrong-theme (pre-paint script in `index.html`).
- **Empty state** — one-click example prompts that send instantly.
- **Accessibility** — real `<button>` elements, `focus-visible` rings, `role="status"` toasts, keyboard-driven flows.

## Project Structure

```text
src/
├── main.jsx                # React bootstrap + global styles
├── App.jsx                 # Layout: ambient background, top bar, workspace
├── api.js                  # fetch wrappers + SSE parsing for all endpoints
├── components/
│   ├── Sidebar.jsx         # Sessions, documents, memory panel, Ctrl+K
│   ├── ChatWindow.jsx      # Message stream, input, uploads, toasts, sources
│   ├── ThemeToggle.jsx     # Light/dark pill toggle
│   └── LumenLogo.jsx       # Animated SVG logo (name kept from earlier branding)
└── styles/
    ├── theme.css           # Tailwind directives + base theme
    ├── App.css             # Frosted-glass panels, soft glow, RGB borders, markdown, toasts
    └── prism.css           # Scrollbar + glow utilities
```

### Design System

The "glow" language is deliberately restrained:

- **`.soft-glow`** — a static ring + halo (blue in light mode, green in dark) applied only to the outer frame, the prompt box, and the New Chat button.
- **`.rgb-border-loading`** — the single *animated* RGB ring, used only on the answer box while an answer is streaming.
- **`.frosted-glass-panel`** — the shared surface behind the top bar, sidebar, and chat area.

## Deployment

Host `dist/` on any static host (Vercel, Netlify, Cloudflare Pages). At build time set `VITE_API_BASE_URL` to the deployed backend and `VITE_API_KEY` to its `API_KEY`. Add the resulting site's origin to the backend's `ALLOWED_ORIGINS` or requests will be blocked by CORS.

On Vercel, remember to disable **Deployment Protection** before sharing the URL publicly.