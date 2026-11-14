import { useEffect, useMemo, useState } from 'react';
import { deriveDaily, type DailyDerived, type DailySeries } from '../engine/climate.ts';
import { applyClimateDelta } from '../engine/montecarlo.ts';

export interface Derived { series: DailySeries; dd: DailyDerived; dT: number; dP: number }

/** Debounce a value (slider drags shouldn't recompute on every pixel). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Climate-adjusted series (delta change from the sliders) + daily ET0, computed once and shared. */
export function useDerived(series: DailySeries | null, dT: number, dP: number): Derived | null {
  const t = useDebounced(dT, 250);
  const p = useDebounced(dP, 250);
  return useMemo(() => {
    if (!series) return null;
    const adj = applyClimateDelta(series, t, p);
    return { series: adj, dd: deriveDaily(adj), dT: t, dP: p };
  }, [series, t, p]);
}
