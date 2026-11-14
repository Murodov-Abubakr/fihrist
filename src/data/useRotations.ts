import { useMemo } from 'react';
import { deriveDaily, monthlyClimatology, type DailySeries, type MonthClimate } from '../engine/climate.ts';
import { regionOf, type RegionId } from '../engine/params.ts';
import { rankRotations, type PriorityKey, type RankedRotation } from '../engine/ranking.ts';
import { rotationDefs, simulateRotation, type Irrigation, type RotationId, type RotationResult } from '../engine/rotation.ts';

export const ROTATION_IDS: RotationId[] = ['baseline', 'waterSaving', 'regenerative'];

export interface ClimateSummary {
  from: number; to: number;
  et0: number; rain: number; peff: number; julyTmax: number; frostDays: number; elevation: number;
  months: MonthClimate[];
}

export interface Analysis {
  results: Record<RotationId, RotationResult>;
  ranked: Record<RotationId, RankedRotation>;
  order: RotationId[];
  climate: ClimateSummary;
  region: RegionId;
  outOfRegion: boolean;
  irrigation: Irrigation;
}

/** Heavy part (depends only on weather + field settings). Ranking is recomputed separately on slider moves. */
function useSimulation(series: DailySeries | null, irrigation: Irrigation, baseline: 'wheat' | 'wheatCotton') {
  const derived = useMemo(() => (series ? { dd: deriveDaily(series) } : null), [series]);
  return useMemo(() => {
    if (!series || !derived) return null;
    const { region, outOfRegion } = regionOf(series.lat, series.lon);
    const defs = rotationDefs(baseline);
    const results = Object.fromEntries(
      ROTATION_IDS.map((id) => [id, simulateRotation(series, derived.dd, defs[id], { irrigation, region })]),
    ) as Record<RotationId, RotationResult>;
    const months = monthlyClimatology(series, derived.dd);
    const sum = (f: (m: MonthClimate) => number) => months.reduce((t, m) => t + f(m), 0);
    const endYear = new Date(Date.UTC(+series.start.slice(0, 4), 0, series.tmax.length)).getUTCFullYear();
    const climate: ClimateSummary = {
      from: +series.start.slice(0, 4), to: endYear,
      et0: sum((m) => m.et0), rain: sum((m) => m.rain), peff: sum((m) => m.peff),
      julyTmax: months[series.lat >= 0 ? 6 : 0].tmax, frostDays: sum((m) => m.frostDays), elevation: series.elevation, months,
    };
    return { results, climate, region, outOfRegion };
  }, [series, derived, irrigation, baseline]);
}

export function useRotations(series: DailySeries | null, irrigation: Irrigation, baseline: 'wheat' | 'wheatCotton', priorities: Record<PriorityKey, number>): Analysis | null {
  const sim = useSimulation(series, irrigation, baseline);
  return useMemo(() => {
    if (!sim) return null;
    const list = rankRotations(ROTATION_IDS.map((id) => sim.results[id]), priorities, irrigation);
    const ranked = Object.fromEntries(list.map((r) => [r.id, r])) as Record<RotationId, RankedRotation>;
    const order = [...list].sort((a, b) => a.rank - b.rank).map((r) => r.id);
    return { ...sim, ranked, order, irrigation };
  }, [sim, priorities, irrigation]);
}
