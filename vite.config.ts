import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { SECURITY_HEADERS } from './security-headers';

// Note: run tests with `npm test` (scripts/run-tests.mjs) — it fixes a Windows drive-letter-case issue in Vitest.
export default defineConfig({
  plugins: [react()],
  // `vite preview` serves the production build with the same headers as Cloudflare Pages
  // (public/_headers), so CSP breakage is caught locally before deploy.
  preview: { headers: SECURITY_HEADERS },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: better caching for farmers on slow mobile links.
        manualChunks: {
          map: ['leaflet', 'react-leaflet'],
          motion: ['framer-motion'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
