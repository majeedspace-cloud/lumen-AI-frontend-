/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          charcoal: '#0f172a',
          graphite: '#1e293b',
          muted: '#475569',
        },
        // Warm amber family — internal document intelligence (RAG from PDFs)
        ragDoc: {
          bg: '#fffbeb',
          border: '#fde68a',
          accent: '#d97706',
          text: '#92400e',
        },
        // Cool sky family — live web intelligence
        ragWeb: {
          bg: '#f0f9ff',
          border: '#bae6fd',
          accent: '#0284c7',
          text: '#0369a1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      backdropBlur: {
        '2xl': '40px',
        '3xl': '64px',
      },
    },
  },
  plugins: [],
}