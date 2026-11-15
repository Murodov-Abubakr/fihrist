/**
 * Agronomic and economic parameters for the rotation model (step 3).
 * Every value has a source. `quality` makes the evidence level visible in the UI:
 *   'sourced' — taken from the cited source for this crop/region
 *   'proxy'   — sourced, but for a related crop/region/year; shown as an information gap
 *   'todo'    — assumption awaiting a source or local confirmation (CLAUDE.md honesty rule)
 * Researched 2026-11-14.
 */
import type { CropId } from './crops.ts';

export type Quality = 'sourced' | 'proxy' | 'todo';
export interface Param { value: number; unit: string; source: string; quality: Quality; note?: string }
export type RegionId = 'centralAsia' | 'kansas';

const BU_WHEAT_KG = 27.2155; // 60 lb bushel
const ACRE_HA = 0.404686;
const buAcToTHa = (bu: number) => (bu * BU_WHEAT_KG) / ACRE_HA / 1000;

/* ───────────── Yield response to water (FAO-33, seasonal Ky) ───────────── */
const KY_SRC = 'Doorenbos & Kassam (1979) FAO Irrigation and Drainage Paper 33, seasonal Ky';
export const KY: Record<CropId | 'cover', Param> = {
  wheat: { value: 1.0, unit: '-', source: `${KY_SRC} (winter wheat), as reproduced in IAEA/FAO Moutonnet, FAO Water Report 22, Table 1`, quality: 'sourced' },
  cotton: { value: 0.85, unit: '-', source: `${KY_SRC}, as reproduced in IAEA/FAO Moutonnet, FAO Water Report 22, Table 1`, quality: 'sourced' },
  sorghum: { value: 0.9, unit: '-', source: KY_SRC, quality: 'todo', note: 'Value seen only in a search excerpt of the FAO-33 table; re-check against the table.' },
  chickpea: { value: 1.15, unit: '-', source: `${KY_SRC} (beans)`, quality: 'proxy', note: 'FAO-33 has no chickpea; dry-bean Ky used.' },
  mung: { value: 1.15, unit: '-', source: `${KY_SRC} (beans)`, quality: 'proxy', note: 'FAO-33 has no mung bean; dry-bean Ky used.' },
  maize: { value: 1.25, unit: '-', source: `${KY_SRC} (maize), as reproduced in IAEA/FAO Moutonnet, FAO Water Report 22, Table 1`, quality: 'sourced' },
  barley: { value: 1.0, unit: '-', source: `${KY_SRC} (winter wheat), FAO Water Report 22, Table 1`, quality: 'proxy', note: 'FAO-33 and FAO-56 Table 24 have no barley row; the winter-wheat value is used (FAO-56 Table 24 gives 1.05).' },
  potato: { value: 1.1, unit: '-', source: `${KY_SRC} (potato), as reproduced in IAEA/FAO Moutonnet, FAO Water Report 22, Table 1`, quality: 'sourced' },
  cover: { value: 0, unit: '-', source: 'not harvested', quality: 'sourced' },
};

/**
 * Stage-specific Ky (FAO-33) per FAO-56 stage [initial, development, mid-season, late], for crops where
 * FAO gives stage values. Filled only from verified sources. Used only with kyMode 'stage': tested against
 * USDA NASS in the Validation drawer (2026-11-15) it did NOT improve the fit (loam: level −49 % vs −45 %,
 * r 0.66 vs 0.77), so the seasonal KY remains the default.
 */
export const KY_STAGES: Partial<Record<CropId, { ky: [number, number, number, number]; source: string; quality: 'sourced' | 'proxy' | 'todo'; note?: string }>> = {
  wheat: {
    ky: [0.2, 0.6, 0.5, 0],
    source: 'FAO Water Report 22 (IAEA/FAO, Moutonnet), Table 1 "FAO yield response factors", Winter wheat: Tr.0111 (initial) 0.20, Tr.1011 (development) 0.60, Tr.1101 (mid-season) 0.50, Tr.1110 (late season) blank; https://www.fao.org/4/Y3655E/y3655e04.htm',
    quality: 'sourced',
    note: 'Late-season cell is blank in the FAO table; used as 0 (no listed yield effect). FAO gives no rule for combining stages; the multiplicative combination Π[1 − Ky_i(1 − ETa_i/ETc_i)] is a modelling choice (Rao et al. 1988), not an FAO rule.',
  },
};

/* ───────────── Reference yield Ym under full water supply, t/ha ───────────── */
export const YM: Record<RegionId, Record<CropId, Param>> = {
  centralAsia: {
    wheat: { value: 4.0, unit: 't/ha', source: 'ICARDA, yield-gap analysis for Central Asia: ~4.0 t/ha irrigated wheat on average (vs ~1.0 t/ha rainfed)', quality: 'sourced', note: 'Consistent with Khatlon 2022 official 3.6 t/ha (Ministry of Agriculture via Trend.az).' },
    cotton: { value: 1.7, unit: 't/ha seed cotton', source: 'Secondary report of Tajikistan national cotton yield 1.7 t/ha (year unclear)', quality: 'todo', note: 'Unclear if seed cotton or lint and which year — needs FAOSTAT confirmation.' },
    chickpea: { value: 1.35, unit: 't/ha', source: 'FAOSTAT via Helgi Library: Tajikistan dry peas yield 13,486 hg/ha (2022)', quality: 'proxy', note: 'Dry-pea yield used as pulse proxy; no chickpea yield source found.' },
    mung: { value: 1.35, unit: 't/ha', source: 'FAOSTAT via Helgi Library: Tajikistan dry peas yield 13,486 hg/ha (2022)', quality: 'proxy', note: 'Pulse proxy; a Karakalpakstan trial reported up to 0.43 t/ha for mung after wheat, so this may be optimistic for a summer catch crop.' },
    sorghum: { value: 3.63, unit: 't/ha', source: 'World Bank / Statbase: Tajikistan cereal yield 3,629 kg/ha (2023)', quality: 'proxy', note: 'All-cereal average used as sorghum proxy.' },
    maize: { value: 1.93, unit: 't/ha', source: 'FAOSTAT (2025) via Our World in Data: Afghanistan maize yield 1.93 t/ha (2024)', quality: 'todo', note: 'Conservative. Tajikistan official FAOSTAT figures (10–19 t/ha, above the US average) look implausible and were not used; a credible irrigated Central Asian maize yield is needed.' },
    barley: { value: 2.36, unit: 't/ha', source: 'FAOSTAT (2025) via Our World in Data: Tajikistan barley yield 2.36 t/ha (2024)', quality: 'proxy', note: 'National average (irrigated and rainfed together), not yield under full water supply.' },
    potato: { value: 19.96, unit: 't/ha fresh', source: 'FAOSTAT (2025) via Our World in Data: Tajikistan potato yield 19.96 t/ha (2024)', quality: 'sourced', note: 'National average of a mostly irrigated crop.' },
  },
  kansas: {
    wheat: { value: +buAcToTHa(49).toFixed(2), unit: 't/ha', source: 'Crops & Soils (CSSA) 2024, "Winter wheat historic trends and yield gaps in the Wheat State": irrigated Kansas winter wheat averaged 49 bu/ac, 1970–2022', quality: 'sourced', note: 'Independent of the NASS dryland yields used for validation.' },
    cotton: { value: 1.7, unit: 't/ha seed cotton', source: 'Central Asia value reused', quality: 'todo' },
    chickpea: { value: 1.35, unit: 't/ha', source: 'Central Asia proxy reused', quality: 'todo' },
    mung: { value: 1.35, unit: 't/ha', source: 'Central Asia proxy reused', quality: 'todo' },
    sorghum: { value: 3.63, unit: 't/ha', source: 'Central Asia proxy reused', quality: 'todo' },
    maize: { value: +(129 * 25.4012 / 0.404686 / 1000).toFixed(2), unit: 't/ha', source: 'USDA NASS Kansas 2024 annual crop production summary: corn 129 bu/ac (all practices), 56-lb bushel', quality: 'proxy', note: 'All practices (irrigated + dryland), not yield under full water supply.' },
    barley: { value: 4.13, unit: 't/ha', source: 'FAOSTAT (2025) via Our World in Data: United States barley yield 4.13 t/ha (2024)', quality: 'proxy', note: 'US national value, not Kansas.' },
    potato: { value: 50.9, unit: 't/ha fresh', source: 'FAOSTAT (2025) via Our World in Data: United States potato yield 50.9 t/ha (2024)', quality: 'proxy', note: 'US national value, not Kansas.' },
  },
};

/* ───────────── Nutrition (USDA FoodData Central, SR Legacy, per 100 g as harvested) ───────────── */
export const NUTRITION: Record<CropId, { kcal: Param; protein: Param }> = {
  wheat: { kcal: { value: 327, unit: 'kcal/100 g', source: 'USDA FDC SR Legacy 168890 "Wheat, hard red winter"', quality: 'sourced' }, protein: { value: 12.6, unit: 'g/100 g', source: 'USDA FDC 168890', quality: 'sourced' } },
  chickpea: { kcal: { value: 378, unit: 'kcal/100 g', source: 'USDA FDC SR Legacy 173756 "Chickpeas, mature seeds, raw"', quality: 'sourced' }, protein: { value: 20.5, unit: 'g/100 g', source: 'USDA FDC 173756', quality: 'sourced' } },
  mung: { kcal: { value: 347, unit: 'kcal/100 g', source: 'USDA FDC SR Legacy 174256 "Mung beans, mature seeds, raw"', quality: 'sourced' }, protein: { value: 23.9, unit: 'g/100 g', source: 'USDA FDC 174256', quality: 'sourced' } },
  sorghum: { kcal: { value: 329, unit: 'kcal/100 g', source: 'USDA FDC SR Legacy 169716 "Sorghum grain"', quality: 'sourced' }, protein: { value: 10.6, unit: 'g/100 g', source: 'USDA FDC 169716', quality: 'sourced' } },
  maize: { kcal: { value: 365, unit: 'kcal/100 g', source: 'USDA FDC SR Legacy 170288 "Corn grain, yellow"', quality: 'sourced' }, protein: { value: 9.42, unit: 'g/100 g', source: 'USDA FDC 170288', quality: 'sourced' } },
  barley: { kcal: { value: 354, unit: 'kcal/100 g', source: 'USDA FDC SR Legacy 170283 "Barley, hulled"', quality: 'sourced', note: 'Read via a mirror of FDC; FDC itself was unreachable during the build.' }, protein: { value: 12.5, unit: 'g/100 g', source: 'USDA FDC 170283', quality: 'sourced' } },
  potato: { kcal: { value: 77, unit: 'kcal/100 g fresh', source: 'USDA FDC SR Legacy 170026 "Potatoes, flesh and skin, raw"', quality: 'sourced' }, protein: { value: 2.05, unit: 'g/100 g fresh', source: 'USDA FDC 170026', quality: 'sourced' } },
  cotton: { kcal: { value: 0, unit: 'kcal/100 g', source: 'Lint is not food; cottonseed oil not yet counted', quality: 'todo', note: 'CLAUDE.md §6: lint ≈ 0 (seed oil only). Seed-oil calories need seed:lint ratio and oil-extraction sources.' }, protein: { value: 0, unit: 'g/100 g', source: 'not counted', quality: 'todo' } },
};

/** People-fed denominator (CLAUDE.md §5 eq. 9). */
export const KCAL_PER_PERSON_DAY = 2200;
/** General nitrogen-to-protein factor (FAO 2003, Food energy – methods of analysis and conversion factors, FAO Food and Nutrition Paper 77). */
export const N_TO_PROTEIN = 6.25;

/* ───────────── Biological N fixation (ONE source, CLAUDE.md §5 eq. 8) ───────────── */
const BNF_SRC = 'GRDC Update Paper (2015) "Fixing more nitrogen in pulse crops", table of average annual N fixed in Australia';
export const N_FIXED: Partial<Record<CropId, Param>> = {
  chickpea: { value: 70, unit: 'kg N/ha', source: BNF_SRC, quality: 'proxy', note: 'Australian average; scaled by relative yield; total N fixed (not net of grain removal).' },
  mung: { value: 34, unit: 'kg N/ha', source: BNF_SRC, quality: 'proxy', note: 'Australian average; scaled by relative yield.' },
};

/* ───────────── Prices (World Bank Commodity Price Data "Pink Sheet", Dec 2025 edition, 2024 annual averages) ───────────── */
const WB = 'World Bank Pink Sheet (Dec 2025), 2024 annual average';
export const UREA_USD_T: Param = { value: 338.3, unit: 'USD/t', source: `${WB}, Urea E. Europe`, quality: 'proxy', note: 'International price; farm-gate prices in Tajikistan/Afghanistan differ.' };
export const UREA_N_SHARE = 0.46; // urea is 46 % N (CLAUDE.md §5 eq. 10)
export const PRICE_USD_T: Record<CropId, Param> = {
  wheat: { value: 268.7, unit: 'USD/t', source: `${WB}, Wheat US HRW`, quality: 'proxy', note: 'International reference, not farm-gate.' },
  sorghum: { value: 190.6, unit: 'USD/t', source: `${WB}, Maize (Sorghum series discontinued)`, quality: 'proxy' },
  cotton: { value: 1910 * 0.35, unit: 'USD/t seed cotton', source: `${WB}, Cotton A Index 1.91 USD/kg lint × assumed 35 % lint turnout`, quality: 'todo', note: 'Lint turnout 35 % unsourced; cottonseed value not counted.' },
  chickpea: { value: 500, unit: 'USD/t', source: 'Tridge export-price aggregate, Tajikistan dried chickpea ~0.50 USD/kg (2024)', quality: 'todo', note: 'Noisy trade aggregate — please enter a local market price.' },
  mung: { value: 875, unit: 'USD/t', source: 'Tridge export-price aggregate, Uzbekistan mung bean 0.35–1.40 USD/kg (2023), midpoint', quality: 'todo', note: 'Very wide range — please enter a local market price.' },
  maize: { value: 190.6, unit: 'USD/t', source: `${WB}, Maize (U.S.) no. 2 yellow, f.o.b. US Gulf`, quality: 'proxy', note: 'International export price, not farm-gate.' },
  barley: { value: 190.6, unit: 'USD/t', source: `${WB}, Maize — barley series discontinued after 2020 (last value 97.6 USD/t)`, quality: 'proxy', note: 'Feed-grain proxy; please enter a local barley price.' },
  potato: { value: 120, unit: 'USD/t', source: 'Selina Wamucii, Tajikistan potato ~0.12 USD/kg (Jan 2023), attributed to FAOSTAT producer prices (secondary)', quality: 'todo', note: 'FAOSTAT producer price not reachable during the build; local price needed.' },
};

/* ───────────── Irrigation application efficiency ───────────── */
export const IRRIGATION_EFFICIENCY: Record<'canal' | 'drip', Param> = {
  canal: { value: 0.5, unit: '-', source: 'FAO Water Report (improving water-use efficiency): field application efficiency in traditional schemes "typically less than 50 percent"', quality: 'sourced', note: 'Upper bound of that statement; often as low as 30 %.' },
  drip: { value: 0.9, unit: '-', source: 'Commonly cited design value for drip irrigation', quality: 'todo' },
};

/**
 * Which reference-yield table applies. Points outside both regions fall back to Central Asia and
 * are flagged `outOfRegion` so the card can say the reference yields are not local.
 */
export function regionOf(lat: number, lon: number): { region: RegionId; outOfRegion: boolean } {
  const greatPlains = lat >= 33 && lat <= 49 && lon >= -105 && lon <= -94;
  if (greatPlains) return { region: 'kansas', outOfRegion: false };
  const centralAsia = lat >= 34 && lat <= 46 && lon >= 55 && lon <= 81;
  return { region: 'centralAsia', outOfRegion: !centralAsia };
}
