import { useEffect, useState } from 'react';
import type { PresetId } from './presets.ts';
import { monthlyNdvi, monthlyWetness, validateSat, type SatFile } from '../engine/satellite.ts';
import type { ExtraSignals } from '../engine/stress.ts';

const MAX_BYTES = 2_000_000;

export interface SatelliteState { file: SatFile | null; extra: ExtraSignals; status: 'none' | 'loading' | 'ready' | 'error' }

/**
 * Prefetched satellite layers (MODIS NDVI over cropland, POWER root-zone soil wetness, NASADEM slope) for
 * presets only. Same-origin static file, size-capped and strictly validated; any failure becomes an
 * information gap (the analysis continues with the weather signals).
 */
export function useSatellite(presetId: PresetId | null): SatelliteState {
  const [state, setState] = useState<SatelliteState>({ file: null, extra: {}, status: 'none' });
  useEffect(() => {
    if (!presetId) { setState({ file: null, extra: {}, status: 'none' }); return; }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    (async () => {
      const r = await fetch(`/data/presets/${presetId}-sat.json`, { signal: ctrl.signal, credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      if (text.length > MAX_BYTES) throw new Error('file too large');
      const file = validateSat(JSON.parse(text), presetId);
      const extra: ExtraSignals = {
        ...(file.layers.ndvi ? { ndvi: monthlyNdvi(file.layers.ndvi.composites) } : {}),
        ...(file.layers.wetness ? { wetness: monthlyWetness(file.layers.wetness) } : {}),
      };
      if (!ctrl.signal.aborted) setState({ file, extra, status: 'ready' });
    })().catch(() => { if (!ctrl.signal.aborted) setState({ file: null, extra: {}, status: 'error' }); });
    return () => ctrl.abort();
  }, [presetId]);
  return state;
}
