/**
 * Where climate data comes from, in order:
 *  1. preset  — precomputed JSON in /data/presets (works offline / when POWER is slow)
 *  2. cache   — IndexedDB copy of an earlier live fetch for the same point
 *  3. live    — NASA POWER daily API
 * No fallback ever substitutes another location's data: if all fail, the caller shows an error.
 */
import type { DailySeries } from '../engine/climate.ts';
import type { PresetId } from './presets.ts';
import { PRESETS } from './presets.ts';
import { cacheGet, cachePut } from './cache.ts';
import { fetchPowerDaily, PowerDataError, validateSeries } from './power.ts';

export type ClimateOrigin = 'preset' | 'cache' | 'live';
export interface ClimateResult { series: DailySeries; origin: ClimateOrigin; fetchedAt?: string }

export const PRESET_FORMAT = 'fihrist-daily-v1';
export interface PresetFile {
  format: typeof PRESET_FORMAT;
  id: PresetId;
  source: string;
  fetchedAt: string;
  series: DailySeries;
}

/** Cache key on a 0.01° grid (~1 km) — finer than POWER's ~50 km cells, coarse enough for privacy. */
export const cacheKey = (lat: number, lon: number) => `power:v1:${lat.toFixed(2)}:${lon.toFixed(2)}`;

export async function loadPreset(id: PresetId, signal?: AbortSignal): Promise<ClimateResult> {
  if (!PRESETS.some((p) => p.id === id)) throw new PowerDataError('unknown preset');
  const res = await fetch(`/data/presets/${id}.json`, { signal, credentials: 'same-origin' });
  if (!res.ok) throw new PowerDataError(`preset ${id} missing`);
  const file = (await res.json()) as PresetFile;
  if (file?.format !== PRESET_FORMAT || file.id !== id || typeof file.series !== 'object') throw new PowerDataError('invalid preset file');
  validateSeries(file.series); // same checks as live data (A08)
  return { series: file.series, origin: 'preset', fetchedAt: file.fetchedAt };
}

export async function loadClimate(lat: number, lon: number, presetId: PresetId | null, signal?: AbortSignal): Promise<ClimateResult> {
  if (presetId) {
    try {
      return await loadPreset(presetId, signal);
    } catch {
      /* fall through to cache/live for the same coordinates */
    }
  }
  const key = cacheKey(lat, lon);
  const cached = await cacheGet<{ series: DailySeries; fetchedAt: string }>(key);
  if (cached) {
    try {
      validateSeries(cached.series);
      return { series: cached.series, origin: 'cache', fetchedAt: cached.fetchedAt };
    } catch {
      /* corrupted cache entry → refetch */
    }
  }
  const series = await fetchPowerDaily(lat, lon, signal);
  const fetchedAt = new Date().toISOString();
  void cachePut(key, { series, fetchedAt });
  return { series, origin: 'live', fetchedAt };
}
