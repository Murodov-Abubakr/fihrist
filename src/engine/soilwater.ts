/**
 * Daily root-zone soil water balance — FAO-56 chapter 8 (single crop coefficient), with bare-soil
 * evaporation during fallow from FAO-56 chapter 7. Replaces the earlier monthly "effective rain"
 * shortcut, so water stored in the soil carries over between months and from fallow into the crop.
 *
 *   TAW = 1000 (θFC − θWP) Zr                 (Eq. 82)   total available water, mm
 *   RAW = p · TAW                               (Eq. 83)   p adjusted: p + 0.04 (5 − ETc), 0.1 ≤ p ≤ 0.8 (Table 22 fn 2)
 *   Ks  = (TAW − Dr) / ((1 − p) TAW) if Dr > RAW, else 1      (Eq. 84; checked against Example 37: Ks = 0.97)
 *   Dr,i = Dr,i−1 − P_i − I_i + ETa_i + DP_i, 0 ≤ Dr ≤ TAW    (Eq. 85, 86; RO and CR = 0, see gaps)
 *   Fallow: E = (Kcb_bare + Ke) ET0, Ke = Kr (Kc,max − Kcb_bare) (Eq. 71);
 *           Kr = 1 if De ≤ REW, else (TEW − De)/(TEW − REW)   (Eq. 74; as in Example 31)
 *   Irrigated fields: irrigate back to field capacity whenever Dr exceeds RAW (no stress, Ks = 1).
 *
 * Simplifications (listed as information gaps): no surface runoff (RO = 0) and no capillary rise
 * (CR = 0); roots at full depth from sowing; one homogeneous soil layer; during fallow the soil
 * profile is tracked over the NEXT crop's root depth (depletion carried as a fraction of TAW).
 */
import type { DailyDerived, DailySeries } from './climate.ts';
import type { CropId } from './crops.ts';
import type { Param } from './params.ts';
import { kcOnDay } from './kc.ts';
import { CROPS } from './crops.ts';

export type Soil = 'sand' | 'loam' | 'clay';

const T19 = 'FAO-56 Table 19 (typical soil water characteristics), midpoint of the printed range';
/** Available water per metre of soil (θFC − θWP), readily / total evaporable water of the top 0.10 m. */
export const SOIL: Record<Soil, { awc: Param; rew: Param; tew: Param }> = {
  sand: {
    awc: { value: 0.08, unit: 'm³/m³', source: `${T19}: sand 0.05–0.11`, quality: 'sourced' },
    rew: { value: 4.5, unit: 'mm', source: `${T19}: sand 2–7`, quality: 'sourced' },
    tew: { value: 9, unit: 'mm', source: `${T19}: sand 6–12 (Ze = 0.10 m)`, quality: 'sourced' },
  },
  loam: {
    awc: { value: 0.155, unit: 'm³/m³', source: `${T19}: loam 0.13–0.18`, quality: 'sourced' },
    rew: { value: 9, unit: 'mm', source: `${T19}: loam 8–10`, quality: 'sourced' },
    tew: { value: 19, unit: 'mm', source: `${T19}: loam 16–22 (Ze = 0.10 m)`, quality: 'sourced' },
  },
  clay: {
    awc: { value: 0.16, unit: 'm³/m³', source: `${T19}: clay 0.12–0.20`, quality: 'sourced' },
    rew: { value: 10, unit: 'mm', source: `${T19}: clay 8–12`, quality: 'sourced' },
    tew: { value: 25.5, unit: 'mm', source: `${T19}: clay 22–29 (Ze = 0.10 m)`, quality: 'sourced' },
  },
};

const T22 = 'FAO-56 Table 22 (maximum effective rooting depth Zr, depletion fraction p)';
/** Rooting depth (midpoint of the printed range) and depletion fraction p for ETc ≈ 5 mm/day. */
export const ROOT: Record<CropId, { zr: Param; p: Param }> = {
  wheat: { zr: { value: 1.65, unit: 'm', source: `${T22}: Winter Wheat 1.5–1.8`, quality: 'sourced' }, p: { value: 0.55, unit: '-', source: `${T22}: Winter Wheat`, quality: 'sourced' } },
  cotton: { zr: { value: 1.35, unit: 'm', source: `${T22}: Cotton 1.0–1.7`, quality: 'sourced' }, p: { value: 0.65, unit: '-', source: `${T22}: Cotton`, quality: 'sourced' } },
  chickpea: { zr: { value: 0.8, unit: 'm', source: `${T22}: Chick pea 0.6–1.0`, quality: 'sourced' }, p: { value: 0.5, unit: '-', source: `${T22}: Chick pea`, quality: 'sourced' } },
  sorghum: { zr: { value: 1.5, unit: 'm', source: `${T22}: Sorghum, grain 1.0–2.0`, quality: 'sourced' }, p: { value: 0.55, unit: '-', source: `${T22}: Sorghum, grain`, quality: 'sourced' } },
  mung: { zr: { value: 0.8, unit: 'm', source: `${T22}: Green Gram and Cowpeas 0.6–1.0`, quality: 'sourced' }, p: { value: 0.45, unit: '-', source: `${T22}: Green Gram and Cowpeas`, quality: 'sourced' } },
  maize: { zr: { value: 1.35, unit: 'm', source: `${T22}: Maize, Field (grain) 1.0–1.7`, quality: 'sourced' }, p: { value: 0.55, unit: '-', source: `${T22}: Maize, Field (grain)`, quality: 'sourced' } },
  barley: { zr: { value: 1.25, unit: 'm', source: `${T22}: Barley 1.0–1.5`, quality: 'sourced' }, p: { value: 0.55, unit: '-', source: `${T22}: Barley`, quality: 'sourced' } },
  potato: { zr: { value: 0.5, unit: 'm', source: `${T22}: Potato 0.4–0.6`, quality: 'sourced' }, p: { value: 0.35, unit: '-', source: `${T22}: Potato`, quality: 'sourced' } },
};

/** Bare-soil evaporation constants (FAO-56 ch. 7). */
export const KCB_BARE = 0.15; // Table 18 "annual crop – (nearly) bare soil surface"; text: Kc min ≈ 0.15–0.20
export const KC_MAX_BARE = 1.2; // Example 31 value for bare soil; text range 1.05–1.30 (Eq. 72 not modelled)

export interface WaterWindow {
  etc: number; // mm, crop season
  eta: number; // mm, crop season (= etc when irrigated)
  netIrrigation: number; // mm, crop season
  et0: number; // mm, crop season
  rain: number; // mm, crop season
  fallowRain: number; // mm, between startIdx and sowing
  fallowEvap: number; // mm, between startIdx and sowing
  deepPerc: number; // mm, whole window
  sowDepletion: number; // fraction of TAW at sowing (0 = field capacity, 1 = wilting point)
  endDepletion: number; // fraction of TAW at harvest/termination
  /** crop ET demand and actual ET per FAO-56 stage (initial, development, mid-season, late), mm */
  stageEtc: [number, number, number, number];
  stageEta: [number, number, number, number];
}

/**
 * Simulates one window: bare fallow from `startIdx` to the day before `sowIdx`, then the crop for `len`
 * days. `dr0` is the root-zone depletion at `startIdx` as a fraction of this crop's TAW.
 * `cropId` is the crop whose Kc curve and roots are used ('cover' → winter-wheat parameters).
 */
export function waterWindow(
  s: DailySeries, dd: DailyDerived, cropId: CropId | 'cover', startIdx: number, sowIdx: number, len: number,
  irrigated: boolean, soil: Soil, dr0: number,
): WaterWindow {
  const crop = cropId === 'cover' ? CROPS.wheat : CROPS[cropId];
  const root = ROOT[crop.id];
  const sp = SOIL[soil];
  const taw = 1000 * sp.awc.value * root.zr.value;
  const tew = sp.tew.value;
  const rew = sp.rew.value;
  let dr = Math.max(0, Math.min(1, dr0)) * taw;
  let de = Math.min(tew, dr);
  const out: WaterWindow = { etc: 0, eta: 0, netIrrigation: 0, et0: 0, rain: 0, fallowRain: 0, fallowEvap: 0, deepPerc: 0, sowDepletion: 0, endDepletion: 0, stageEtc: [0, 0, 0, 0], stageEta: [0, 0, 0, 0] };
  // day index (from sowing) at which each FAO-56 stage ends; days past the table length count as late season
  const [l1, l2, l3] = crop.stages;
  const stageOf = (k: number) => (k < l1 ? 0 : k < l1 + l2 ? 1 : k < l1 + l2 + l3 ? 2 : 3);
  const end = sowIdx + len;
  for (let i = Math.max(0, startIdx); i < end; i++) {
    const p = s.prcp[i];
    const et0 = dd.et0[i];
    // rain infiltrates (RO = 0); excess above field capacity drains (Eq. 88)
    dr -= p;
    if (dr < 0) { out.deepPerc -= dr; dr = 0; }
    de = Math.max(0, de - p);
    if (i < sowIdx) {
      // bare-soil fallow: evaporation from the surface layer (Ke) plus a small diffusive term (Kcb_bare)
      const kr = de <= rew ? 1 : Math.max(0, (tew - de) / (tew - rew));
      const eSurf = Math.min(kr * (KC_MAX_BARE - KCB_BARE) * et0, tew - de);
      const eDiff = Math.min(KCB_BARE * et0, taw - dr - eSurf);
      const e = Math.max(0, eSurf) + Math.max(0, eDiff);
      de += Math.max(0, eSurf);
      dr = Math.min(taw, dr + e);
      out.fallowRain += p;
      out.fallowEvap += e;
      if (i === sowIdx - 1) out.sowDepletion = dr / taw;
      continue;
    }
    if (i === sowIdx && startIdx >= sowIdx) out.sowDepletion = dr / taw;
    const etc = kcOnDay(crop, i - sowIdx) * et0;
    const pAdj = Math.min(0.8, Math.max(0.1, root.p.value + 0.04 * (5 - etc)));
    const raw = pAdj * taw;
    if (irrigated && dr > raw) { out.netIrrigation += dr; dr = 0; }
    const ks = dr > raw ? Math.max(0, Math.min(1, (taw - dr) / ((1 - pAdj) * taw))) : 1;
    const eta = ks * etc;
    dr = Math.min(taw, dr + eta);
    de = Math.min(tew, de + eta);
    out.etc += etc;
    out.eta += eta;
    const st = stageOf(i - sowIdx);
    out.stageEtc[st] += etc;
    out.stageEta[st] += eta;
    out.et0 += et0;
    out.rain += p;
  }
  out.endDepletion = dr / taw;
  return out;
}
