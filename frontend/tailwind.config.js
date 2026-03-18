/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── CSS-variable–backed colors ──────────────────────────────
      // Use rgb channel vars so Tailwind opacity modifiers (/50 etc.) still work.
      // e.g.  bg-surface/50  →  rgb(var(--surface) / 0.5)
      colors: {
        surface:   'rgb(var(--surface) / <alpha-value>)',     // card / panel bg
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',// inner nested bg
        base:      'rgb(var(--base) / <alpha-value>)',        // page background
        sidebar:   'rgb(var(--sidebar) / <alpha-value>)',     // sidebar bg
        topbar:    'rgb(var(--topbar) / <alpha-value>)',      // topbar bg
        ink:       'rgb(var(--ink) / <alpha-value>)',         // primary text
        'ink-2':   'rgb(var(--ink-2) / <alpha-value>)',       // secondary text
        'ink-3':   'rgb(var(--ink-3) / <alpha-value>)',       // muted text
        line:      'rgb(var(--line) / <alpha-value>)',        // borders / dividers
        accent:    'rgb(var(--accent) / <alpha-value>)',      // primary accent (blue/indigo)
        'accent-2':'rgb(var(--accent-2) / <alpha-value>)',   // secondary accent
        hover:     'rgb(var(--hover) / <alpha-value>)',       // hover state bg
      },
      keyframes: {
        shrink: {
          '0%':   { width: '100%' },
          '100%': { width: '0%'  },
        },
      },
      animation: {
        'shrink-15': 'shrink 15s linear infinite',
      },
    },
  },
  plugins: [],
}
