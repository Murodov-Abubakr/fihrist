# Security & integrity audit — Project Fihrist

Audit date: 2026-11-14 (after step 1). Scope: every file in the repository at that point.
Architecture audited: static Vite/React SPA, planned Cloudflare Pages + Pages Functions; **no server-side
code exists yet**, so server controls are recorded as design requirements for the steps that add them.

Status key: **PASS** (already compliant) · **HARDENED** (defect found and fixed in this pass) ·
**N/A-now** (no such surface exists yet; requirement recorded) · **OPEN** (decision needed).

## OWASP Top 10 (2021) audit

| ID | Area | Files | Status | Finding → action |
|---|---|---|---|---|
| A01 | Access control / CORS / CSRF | `functions/api/simulate.ts` | HARDENED | `/api/simulate` is POST-only, same-origin only (Origin must match, else 403), emits no CORS headers, uses no cookies or credentials. No admin/debug routes. |
| A03/A04/A08 | Compute Grid input (edge + Web Workers) | `src/engine/montecarlo.ts`, `functions/api/simulate.ts`, `src/workers/mc.worker.ts` | HARDENED | One validator (`validateSimulateRequest`) for network and `postMessage` input: exact shape, finite numbers in range, own-property lookups only (prototype-pollution safe), ≤ 500 runs/batch, ≤ 16 batches, body ≤ 150 kB (413), JSON content type (415). Results from nodes re-validated client-side (`validateBatchResult`). No stack traces in responses; structured rejection log without IP/body (A09). Endpoint makes no outbound requests (A10). 9 handler tests + 9 payload tests. |
| A02 | Secrets hygiene | `.gitignore`, all source | HARDENED | No secrets found (automated scan in `src/security.test.ts`). `.gitignore` lacked `.env*`, `.dev.vars` (Wrangler secrets), `*.pem`, `*.key`, `__pycache__/` → added. |
| A02 | Transport | `FieldMap.tsx`, `index.html` | PASS | All external URLs are `https://` (test-enforced). HSTS header added. |
| A03 | XSS / injection sinks | `src/**` | PASS | No `eval`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML=`, `document.write` (test-enforced). Leaflet attribution is a static constant; no popups with user content. React escapes all i18n output. |
| A03 | Untrusted storage input | `src/i18n/index.ts` | HARDENED | Language read from `localStorage` was passed straight to i18next and `<html lang>`. Now allowlisted via `safeLang()`; XSS payload test proves fallback to `en`. |
| A03/A08 | Coordinate input | `FieldMap.tsx`, new `src/lib/geo.ts` | HARDENED | Map clicks after panning across the antimeridian produced longitudes outside ±180 (would be sent to NASA POWER as invalid). Added `clampLat`, `wrapLon`, strict `isValidLatLon`; unit-tested with NaN/∞/strings/injection strings. |
| A03 | Slider input | `LeftPanel.tsx` | HARDENED | Slider values now `Number()`-parsed, finite-checked and clamped to the slider's min/max before entering state. |
| A04 | Client CPU (decorative animation) | `SpaceMap.tsx`, `Astrolabe.tsx` | HARDENED | Animated background measured at **98 % main-thread load** on a 4×-throttled phone (SVG SMIL + full-screen filters repainting every frame). Fixed: static layer painted once; planets and loaders are HTML elements with CSS transform keyframes, which run on the compositor. Now **~0–2 %** idle (`scripts/fps.mjs`). Honours `prefers-reduced-motion` (CSS + `MotionConfig reducedMotion="user"`). |
| A04 | Resource exhaustion | — | N/A-now | No Monte Carlo yet. **Requirement:** trajectories hard-capped server- and client-side; Web Worker pool `min(hardwareConcurrency, 12)`; upstream fetch timeout ≤ 10 s with `AbortController`. |
| A05 | Security headers | new `security-headers.ts`, `public/_headers`, `vite.config.ts` | HARDENED | There were no headers. Added strict CSP (`script-src 'self'`, `style-src 'self'`, no `unsafe-*`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limited to self + NASA POWER), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS. One source of truth → Cloudflare `_headers` + `vite preview`; test asserts they match. Runtime check proves the app works under this CSP with zero violations. |
| A05 | Source maps / debug | `vite.config.ts` | PASS | `build.sourcemap: false`. No debug endpoints. (FastAPI `/docs` concern not applicable — no FastAPI; see OPEN-1.) |
| A06 | Vulnerable components | `package.json` | HARDENED | `npm audit` found 16 (2 critical, 11 high, 3 moderate), **all in dev tooling** (vitest/tinypool, vite, postcss, puppeteer-core); production deps had 0. Upgraded vite 6.0.7→6.4.6, vitest 2.1.8→4.1.12, postcss→8.5.33, puppeteer-core→25.17.0, plugin-react→4.7.0. **Now 0 vulnerabilities.** |
| A06 | Pinning / third-party CDN | `package.json`, `.npmrc`, `index.html` | HARDENED | Ranges (`^`) → exact versions, `.npmrc save-exact=true`, lockfile committed (test-enforced). Google Fonts CSS link (cannot carry SRI — content is UA-dependent) replaced by self-hosted `@fontsource` packages; **no third-party script/style at runtime**. |
| A07 | Authentication | — | N/A-now | No accounts or sessions. **Requirement:** any future feedback endpoint uses `HttpOnly; Secure; SameSite=Strict` cookies or none. |
| A08 | Data integrity (NASA POWER) | `src/data/power.ts`, `climateSource.ts`, `scripts/prefetch_power.py` | HARDENED | Live CSV and preset JSON go through the same `validateSeries`: exact column list, numeric-only cells, consecutive dates (no gaps/duplicates/reordering), physical bounds per field, Tmin ≤ Tmax, fill value −999 interpolated only if ≤ 2 % of a column, else rejected; HTML/JSON error pages rejected. 18 adversarial tests (`power.test.ts`). Failure never substitutes another location's data. Worker `onmessage` validation: step 4. |
| A04 | Upstream timeouts / payload size | `src/data/power.ts`, `useClimate.ts` | HARDENED | 10 s `AbortController` timeout; 3 MB response cap; map clicks debounced 400 ms and in-flight requests aborted on change. Measured live fetch+parse: ~2.9 s. |
| A03/A08/A10 | Place search (Photon geocoder) | `src/data/geocode.ts`, `PlaceSearch.tsx` | HARDENED | New outbound host `photon.komoot.io` added to CSP `connect-src` only. Sends only the typed text (≥ 3 chars, ≤ 100, URL-encoded, debounced 350 ms, stale requests aborted, 6 s timeout, `credentials: 'omit'`, no referrer). Response validated (Point geometry, finite in-range coordinates, control chars stripped, fields ≤ 80 chars, ≤ 5 results) and rendered as text. Typed coordinates are parsed locally without any request. 17 tests (`geocode.test.ts`). Nominatim deliberately not used: its policy forbids autocomplete. |
| A10 | Outbound requests (browser) | `src/data/power.ts`, `scripts/prefetch_power.py` | HARDENED | Fixed host `power.larc.nasa.gov`, https only, `redirect: 'error'` (Python: redirects blocked), `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`; only validated numbers enter the query string. |
| A09 | Logging | — | N/A-now | No server. **Requirement:** Pages Function logs structured events (invalid input, rate-limit, errors) with coordinates rounded to 0.1° and no headers/IPs. |
| A10 | SSRF | — | PASS (by design) | No server-side outbound requests exist or are planned: the browser calls NASA POWER directly and `/api/simulate` only computes. URLs are never user-supplied. CSP `connect-src` restricts the browser to self + `power.larc.nasa.gov`. |

## Scientific & Field Shift rubric

| Check | Status | Note |
|---|---|---|
| Five sections per rotation (why / evidence / benefits / gaps / risks) | PASS (shell) | Present on all three cards; content arrives with the engine (step 3). |
| No invented numbers | PASS | All metrics show "—" until computed from real data. |
| No medical / biofuel / rigged claims | PASS | None in code or copy. |
| Equations (ET0, GDD, N balance, Monte Carlo) | N/A-now | Step 2–4, each with a cited source in `SOURCES.md` and unit tests. |

## Verification (reproducible)

```
npm audit                              # 0 vulnerabilities
npm test                               # 20 tests: sink scan, secret scan, https, headers, pinning, sanitisers, i18n
npm run build                          # tsc strict + vite build, no warnings
npx vite preview --port 4174 &
node scripts/verify-runtime.mjs        # headers served, 0 CSP violations, 0 console errors,
                                       # only allowlisted hosts, presets/lang/mode/drawer/map-click OK,
                                       # tampered localStorage rejected
```

## Decisions (project owner, 2026-11-14)
- **D-1 Backend:** both. Cloudflare Pages + Functions is the live app. FastAPI runs **offline only** (preset prefetch), never in the live path. When FastAPI code is added it must still meet A01/A03/A04/A05/A10: Pydantic range validation, `docs_url=None` in production, ≤10 s upstream timeouts, outbound host allowlist (`power.larc.nasa.gov`, Planetary Computer STAC), no redirects to private IP ranges.
- **D-2 Space framing:** closing section / README only. No BLiSS output in the UI, no residue-energy claims.
- **D-3 Datasets:** NASA POWER (live) + MODIS NDVI, SMAP, SRTM (presets, prefetched), fetched in priority order. If one fails, the rest continue and the missing one is shown as an information gap, never as evidence.
