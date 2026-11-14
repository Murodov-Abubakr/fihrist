import { useCallback, useEffect, useState } from 'react';
import type { PresetId } from './presets.ts';
import { loadClimate, type ClimateResult } from './climateSource.ts';

export type ClimateState =
  | { status: 'loading' }
  | { status: 'ready'; result: ClimateResult }
  | { status: 'error'; message: string };

/**
 * Loads the daily climate series for the selected point. Map clicks are debounced (400 ms) and any
 * in-flight request is aborted when the point changes, so rapid clicking never queues requests (A04).
 */
export function useClimate(lat: number, lon: number, presetId: PresetId | null) {
  const [state, setState] = useState<ClimateState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    const timer = setTimeout(() => {
      loadClimate(lat, lon, presetId, ctrl.signal)
        .then((result) => { if (!ctrl.signal.aborted) setState({ status: 'ready', result }); })
        .catch((e: Error) => { if (!ctrl.signal.aborted) setState({ status: 'error', message: e.message }); });
    }, presetId ? 0 : 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [lat, lon, presetId, attempt]);

  return { state, retry };
}
