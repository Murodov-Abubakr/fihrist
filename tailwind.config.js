/**
 * Design tokens — "stone star-map": charcoal stone, copper hairlines, white glowing selection.
 * Contrast (WCAG) on panel #1E2126: text 13.2, copper 5.7, copper-glow 8.7, slate 6.8,
 * teal 9.3, terracotta-light 6.7, frost 8.8. slate-dim (4.0) is decorative only.
 * Token names (brass, verdigris, terracotta, parchment) kept from PROMPT.md for continuity;
 * `brass` now holds the copper tones.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#131518',
        panel: '#1E2126',
        'panel-2': '#2A2E34',
        parchment: '#ECE8E1',
        pill: '#F2EFEA',
        brass: { DEFAULT: '#C98B66', glow: '#E8B391', dim: '#8A5E44' },
        verdigris: { DEFAULT: '#3E8E7E', light: '#6FD6BF' },
        terracotta: { DEFAULT: '#C8553D', light: '#F08C74' },
        slate: { DEFAULT: '#A3A9B1', dim: '#7A8088' },
        frost: '#9CC2F2',
      },
      fontFamily: {
        display: ['"Exo 2"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        // white glow used for the selected item (pill / node)
        select: '0 0 0 2px rgba(255,255,255,.18), 0 0 14px rgba(255,255,255,.55), 0 0 32px -4px rgba(190,205,255,.45)',
        copper: '0 0 12px -2px rgba(201,139,102,.6)',
      },
    },
  },
  plugins: [],
};
