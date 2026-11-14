/**
 * Priority-weighted ranking of rotations. Transparent by design:
 *  - each priority maps to ONE computed metric (no hidden scores)
 *  - metrics are min–max scaled across the three rotations (best = 1, worst = 0; all equal → 0.5)
 *  - score = Σ wᵢ·sᵢ / Σ wᵢ, with wᵢ = the farmer's slider value (0–100)
 */
import type { RotationId, RotationResult, Irrigation } from './rotation.ts';

export type PriorityKey = 'water' | 'nitrogen' | 'erosion' | 'organic' | 'forage' | 'income';

export interface MetricDef { key: PriorityKey; better: 'lower' | 'higher'; value: (r: RotationResult, irr: Irrigation) => number; unit: string }

export const PRIORITY_METRICS: Record<PriorityKey, MetricDef> = {
  // irrigated: water drawn from the canal; rainfed: water the crop needed but did not get
  water: { key: 'water', better: 'lower', unit: 'm³/ha/yr', value: (r, irr) => (irr === 'rainfed' ? r.mean.unmetM3 : r.mean.grossIrrigationM3) },
  nitrogen: { key: 'nitrogen', better: 'higher', unit: 'kg N/ha/yr', value: (r) => r.mean.nFixedKg - r.mean.nRemovedKg },
  erosion: { key: 'erosion', better: 'lower', unit: 'mm rain on bare soil/yr', value: (r) => r.mean.bareRainMm },
  organic: { key: 'organic', better: 'higher', unit: 'living-root days/yr', value: (r) => r.mean.livingRootDays },
  forage: { key: 'forage', better: 'higher', unit: 'straw/stover/cover seasons/yr', value: (r) => r.mean.forageSeasons },
  income: { key: 'income', better: 'higher', unit: 'USD/ha/yr', value: (r) => r.mean.trueProfitUsd },
};

export interface RankedRotation { id: RotationId; rank: number; score: number; parts: Record<PriorityKey, { value: number; scaled: number }> }

export function rankRotations(results: RotationResult[], weights: Record<PriorityKey, number>, irrigation: Irrigation): RankedRotation[] {
  const keys = Object.keys(PRIORITY_METRICS) as PriorityKey[];
  const rows = results.map((r) => ({ id: r.id, parts: {} as RankedRotation['parts'] }));
  for (const k of keys) {
    const m = PRIORITY_METRICS[k];
    const vals = results.map((r) => m.value(r, irrigation));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    vals.forEach((v, i) => {
      let s = hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo);
      if (m.better === 'lower') s = 1 - s;
      rows[i].parts[k] = { value: v, scaled: s };
    });
  }
  const wSum = keys.reduce((t, k) => t + Math.max(0, weights[k] ?? 0), 0);
  const scored = rows.map((r) => ({
    ...r,
    score: wSum > 0 ? keys.reduce((t, k) => t + Math.max(0, weights[k] ?? 0) * r.parts[k].scaled, 0) / wSum : 0.5,
  }));
  // stable: ties keep the canonical order baseline → waterSaving → regenerative
  const order = [...scored].sort((a, b) => b.score - a.score || 0);
  return scored.map((r) => ({ ...r, rank: order.findIndex((o) => o.id === r.id) + 1 }));
}
