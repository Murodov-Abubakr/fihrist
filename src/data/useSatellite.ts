import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresetId } from './presets.ts';
import { monthlyNdvi, monthlyWetness, validateSat, type SatFile } from '../engine/satellite.ts';
import type { ExtraSignals } from '../engine/stress.ts';

const MAX_BYTES = 2_000_000;

/**
 * On-demand satellite analysis for any point: an Azure Function in West Europe, next to the Microsoft Planetary
 * Computer storage, runs the same method as the preset prefetch. Empty string = feature off.
 */
export const SAT_API = '';
export const SAT_API_TIMEOUT_MS = 240_000;

export type SatStatus = 'none' | 'loading' | 'ready' | 'error' | 'available' | 'busy';
export interface SatelliteState { file: SatFile | null; extra: ExtraSignals; status: SatStatus; remote: boolean; run?: () => void }

function toState(file: SatFile, remote: boolean): SatelliteState {
  const extra: ExtraSignals = {
    ...(file.layers.ndvi ? { ndvi: monthlyNdvi(file.layers.ndvi.composites) } : {}),
    ...(file.layers.wetness ? { wetness: monthlyWetness(file.layers.wetness) } : {}),
  };
  return { file, extra, status: 'ready', remote };
}

async function readCapped(r: Response): Promise<unknown> {
  const text = await r.text();
  if (text.length > MAX_BYTES) throw new Error('file too large');
  return JSON.parse(text);
}

/**
 * Satellite layers (MODIS NDVI over cropland, POWER root-zone soil wetness, NASADEM slope).
 *  - Presets: prefetched same-origin static file.
 *  - Any other point: computed on request (button) by the Azure Function; the response is size-capped,
 *    strictly validated and must describe exactly the requested point.
 * Any failure becomes an information gap: the analysis continues with the weather signals.
 */
export function useSatellite(presetId: PresetId | null, lat: number | null, lon: number | null): SatelliteState {
  const [state, setState] = useState<SatelliteState>({ file: null, extra: {}, status: 'none', remote: false });
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null; // a stale cloud request must not report an error for the new point
    if (!presetId) {
      setState({ file: null, extra: {}, status: SAT_API && lat !== null && lon !== null ? 'available' : 'none', remote: false });
      return;
    }
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState((s) => ({ ...s, status: 'loading', remote: false }));
    (async () => {
      const r = await fetch(`/data/presets/${presetId}-sat.json`, { signal: ctrl.signal, credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const file = validateSat(await readCapped(r), presetId);
      if (!ctrl.signal.aborted) setState(toState(file, false));
    })().catch(() => { if (!ctrl.signal.aborted) setState({ file: null, extra: {}, status: 'error', remote: false }); });
    return () => ctrl.abort();
  }, [presetId, lat, lon]);

  const run = useCallback(() => {
    if (!SAT_API || presetId || lat === null || lon === null) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), SAT_API_TIMEOUT_MS);
    setState({ file: null, extra: {}, status: 'loading', remote: true });
    (async () => {
      const r = await fetch(SAT_API, {
        method: 'POST', signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat, lon }),
      });
      if (r.status === 429) { setState({ file: null, extra: {}, status: 'busy', remote: true }); return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const file = validateSat(await readCapped(r), 'field');
      if (file.lat !== lat || file.lon !== lon) throw new Error('response for another point');
      if (!ctrl.signal.aborted) setState(toState(file, true));
    })().catch(() => { if (!ctrl.signal.aborted || ctrlRef.current === ctrl) setState({ file: null, extra: {}, status: 'error', remote: true }); })
      .finally(() => clearTimeout(timer));
  }, [presetId, lat, lon]);

  useEffect(() => () => ctrlRef.current?.abort(), []);
  return { ...state, run: !presetId && SAT_API && lat !== null && lon !== null ? run : undefined };
}
