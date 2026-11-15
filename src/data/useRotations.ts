import { useMemo } from 'react';
import { monthlyClimatology, type MonthClimate } from '../engine/climate.ts';
import type { Derived } from './useDerived.ts';
import { regionOf, type RegionId } from '../engine/params.ts';
import { stressCalendar, type ExtraSignals } from '../engine/stress.ts';
import type { SatFile } from '../engine/satellite.ts';
import type { Soil } from '../engine/soilwater.ts';
import { rankRotations, type PriorityKey, type RankedRotation } from '../engine/ranking.ts';
import { rotationDefs, simulateRotation, type BaselineSpec, type Irrigation, type RotationId, type RotationResult } from '../engine/rotation.ts';

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
  /** hot/frost days and heat + dry compound months from this field's own history (with climate deltas applied) */
  stress: ReturnType<typeof stressCalendar>;
  /** prefetched satellite layers for presets (null elsewhere: shown as an information gap) */
  sat: SatFile | null;
  region: RegionId;
  outOfRegion: boolean;
  irrigation: Irrigation;
  /** climate-stress deltas applied (°C, % rain) */
  dT: number;
  dP: number;
}

/** Heavy part (depends only on weather + field settings). Ranking is recomputed separately on slider moves. */
function useSimulation(derived: Derived | null, irrigation: Irrigation, baseline: BaselineSpec, soil: Soil) {
  return useMemo(() => {
    if (!derived) return null;
    const series = derived.series;
    const { region, outOfRegion } = regionOf(series.lat, series.lon);
    const defs = rotationDefs(baseline);
    const results = Object.fromEntries(
      ROTATION_IDS.map((id) => [id, simulateRotation(series, derived.dd, defs[id], { irrigation, region, soil })]),
    ) as Record<RotationId, RotationResult>;
    const months = monthlyClimatology(series, derived.dd);
    const sum = (f: (m: MonthClimate) => number) => months.reduce((t, m) => t + f(m), 0);
    const endYear = new Date(Date.UTC(+series.start.slice(0, 4), 0, series.tmax.length)).getUTCFullYear();
    const climate: ClimateSummary = {
      from: +series.start.slice(0, 4), to: endYear,
      et0: sum((m) => m.et0), rain: sum((m) => m.rain), peff: sum((m) => m.peff),
      julyTmax: months[series.lat >= 0 ? 6 : 0].tmax, frostDays: sum((m) => m.frostDays), elevation: series.elevation, months,
    };
    return { results, climate, region, outOfRegion, dT: derived.dT, dP: derived.dP };
  }, [derived, irrigation, baseline, soil]);
}

export function useRotations(derived: Derived | null, irrigation: Irrigation, baseline: BaselineSpec, priorities: Record<PriorityKey, number>, soil: Soil, sat: { file: SatFile | null; extra: ExtraSignals } = { file: null, extra: {} }): Analysis | null {
  const sim = useSimulation(derived, irrigation, baseline, soil);
  // satellite layers only describe the preset point: use them only when the series is that point
  const extra = sat.file && derived && Math.abs(sat.file.lat - derived.series.lat) < 1e-6 && Math.abs(sat.file.lon - derived.series.lon) < 1e-6 ? sat.extra : null;
  const stress = useMemo(() => (derived ? stressCalendar(derived.series, extra ?? {}) : null), [derived, extra]);
  return useMemo(() => {
    if (!sim || !stress) return null;
    const list = rankRotations(ROTATION_IDS.map((id) => sim.results[id]), priorities, irrigation);
    const ranked = Object.fromEntries(list.map((r) => [r.id, r])) as Record<RotationId, RankedRotation>;
    const order = [...list].sort((a, b) => a.rank - b.rank).map((r) => r.id);
    return { ...sim, stress, sat: extra ? sat.file : null, ranked, order, irrigation };
  }, [sim, stress, extra, sat.file, priorities, irrigation]);
}
