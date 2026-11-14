/**
 * Design tokens — palette from PROMPT.md, rendered as a modern orbital HUD.
 * Contrast (WCAG AA, measured on #141A33 panel): parchment 13.0, brass 7.4, slate 7.4,
 * verdigris-light 6.9, terracotta-light 5.8. Base verdigris (4.4) and terracotta (3.9)
 * are used only for fills, bars and borders, never for small text.
 */
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
        display: ['"Exo 2"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(201,165,90,.55), 0 0 18px -2px rgba(201,165,90,.45)',
        'glow-soft': '0 0 24px -6px rgba(201,165,90,.35)',
      },
    },
  },
  plugins: [],
};
