import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server on port 5173 (Vite's default). Your backend's CORS is wide
// open right now (allow_origins=["*"]) so no proxy is needed — but once
// we lock CORS down for production, this is where you'd point it
// specifically at your backend's real domain.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
