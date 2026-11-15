/**
 * Single source of truth for HTTP security headers (OWASP A05).
 * Used by `vite preview` and written to public/_headers for Cloudflare Pages
 * (scripts/gen-headers.mjs keeps the two in sync; a unit test checks they match).
 *
 * Allowed external origins — keep this list minimal:
 *  - https://power.larc.nasa.gov          NASA POWER API (connect-src)
 *  - https://server.arcgisonline.com      Esri World Imagery map tiles (img-src for the 2D Leaflet map;
 *                                         connect-src for the 3D globe, where MapLibre fetches tiles with fetch())
 *  - https://photon.komoot.io             place search / geocoding, OpenStreetMap data (connect-src)
 *  - https://fihrist-sat-auoxh.azurewebsites.net  Fihrist satellite function (Azure, North Europe; on button press only)
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://server.arcgisonline.com",
  "font-src 'self'",
  "connect-src 'self' https://fihrist-sat-auoxh.azurewebsites.net https://power.larc.nasa.gov https://photon.komoot.io https://server.arcgisonline.com",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
