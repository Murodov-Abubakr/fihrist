/** "Observatory Ledger" design tokens. Hex values from PROMPT.md; slate chosen for WCAG AA (see src/styles/contrast note). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B1020',
        panel: '#141A33',
        'panel-2': '#1B2244',
        parchment: '#EADFC8',
        brass: { DEFAULT: '#C9A55A', dim: '#8C7440' },
        verdigris: { DEFAULT: '#3E8E7E', light: '#5FB3A1' },
        terracotta: { DEFAULT: '#C8553D', light: '#E07A63' },
        slate: { DEFAULT: '#A3AAC2', dim: '#6B7290' },
      },
      fontFamily: {
        display: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
