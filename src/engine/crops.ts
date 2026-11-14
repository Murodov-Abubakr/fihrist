/**
 * Crop parameters. Every value carries its source; choices between table rows are explained.
 *
 * FAO-56 = Allen et al. (1998) FAO Irrigation and Drainage Paper 56.
 *   Table 11 (stage lengths): https://www.fao.org/4/x0490e/x0490e0b.htm#TopOfPage (Table 11)
 *   Table 12 (single Kc, max height): same page (Table 12). Group Kc ini values used where a crop row
 *   has no Kc ini ("only one value for Kc ini is listed ... representative of the whole group").
 * Verified against the FAO web edition on 2026-11-14.
 */

export type CropId = 'wheat' | 'cotton' | 'chickpea' | 'sorghum' | 'mung';

export interface CropParams {
  id: CropId;
  /** Kc for initial / mid-season / end of late season (FAO-56 Table 12). */
  kcIni: number;
  kcMid: number;
  kcEnd: number;
  /** Stage lengths in days: initial, development, mid, late (FAO-56 Table 11). */
  stages: [number, number, number, number];
  /** Maximum crop height, m (FAO-56 Table 12) — used in the Kc climate adjustment (Eq. 62). */
  heightM: number;
  /** Base temperature for growing degree-days, °C. */
  tbase: number;
  /** Default planting date (month, day) for Central Asian presets. */
  plant: [number, number];
  sources: string[];
  todo?: string[];
}

export const CROPS: Record<CropId, CropParams> = {
  wheat: {
    id: 'wheat',
    kcIni: 0.7, // FAO-56 T12 "Winter Wheat – with non-frozen soils" 0.7 (frozen soils: 0.4)
    kcMid: 1.15, // FAO-56 T12
    kcEnd: 0.25, // FAO-56 T12 0.25–0.4; "the higher value is for hand-harvested crops" (fn 10)
    stages: [30, 140, 40, 30], // FAO-56 T11 Winter Wheat, November, Mediterranean (total 240 d)
    heightM: 1.0, // FAO-56 T12
    tbase: 0, // McMaster & Wilhelm (1997) Agric. For. Meteorol. 87:291–300 (wheat, Tbase 0 °C)
    plant: [10, 15],
    sources: ['FAO-56 Table 11 (Winter Wheat, Mediterranean row)', 'FAO-56 Table 12 (Winter Wheat)', 'McMaster & Wilhelm 1997 (Tbase)'],
    todo: [
      'Planting date 15 Oct is an assumption for the Central Asian presets — confirm with local agronomists.',
      'Kc end 0.25 assumes machine harvest; use 0.4 for hand-harvested fields.',
      'FAO-56 T11 fn 2: winter-wheat stages lengthen in frozen climates (zero-growth days).',
    ],
  },
  cotton: {
    id: 'cotton',
    kcIni: 0.35, // FAO-56 T12 group "Fibre Crops" Kc ini
    kcMid: 1.175, // FAO-56 T12 1.15–1.20 (midpoint)
    kcEnd: 0.6, // FAO-56 T12 0.70–0.50 (midpoint)
    stages: [30, 50, 60, 55], // FAO-56 T11 Cotton, Mar–May, Egypt; Pakistan; Calif. (total 195 d)
    heightM: 1.35, // FAO-56 T12 1.2–1.5 (midpoint)
    tbase: 15.6, // "DD60" convention (60 °F) used for cotton heat units
    plant: [4, 10],
    sources: ['FAO-56 Table 11 (Cotton, Egypt/Pakistan row)', 'FAO-56 Table 12 (Cotton; Fibre Crops group Kc ini)'],
    todo: ['Tbase 15.6 °C (DD60) — add a citable reference.'],
  },
  chickpea: {
    id: 'chickpea',
    kcIni: 0.4, // FAO-56 T12 group "Legumes" Kc ini
    kcMid: 1.0, // FAO-56 T12 Chick pea
    kcEnd: 0.35, // FAO-56 T12 Chick pea
    stages: [20, 30, 40, 20], // PROXY: FAO-56 T11 has no chickpea row; "Beans (dry), Continental Climates" used
    heightM: 0.4, // FAO-56 T12 Chick pea
    tbase: 0,
    plant: [3, 15],
    sources: ['FAO-56 Table 12 (Chick pea; Legumes group Kc ini)', 'FAO-56 Table 11 (Beans (dry) row, as proxy)'],
    todo: [
      'Stage lengths are a proxy (dry beans) — FAO-56 Table 11 lists no chickpea row.',
      'Tbase 0 °C for chickpea needs a citable source.',
      'Spring sowing 15 Mar assumed for Central Asia.',
    ],
  },
  sorghum: {
    id: 'sorghum',
    kcIni: 0.3, // FAO-56 T12 group "Cereals" Kc ini
    kcMid: 1.05, // FAO-56 T12 Sorghum grain 1.00–1.10 (midpoint)
    kcEnd: 0.55, // FAO-56 T12 Sorghum grain
    stages: [20, 35, 45, 30], // FAO-56 T11 Sorghum, Mar/April, Arid Region (total 130 d)
    heightM: 1.5, // FAO-56 T12 1–2 m (midpoint)
    tbase: 10,
    plant: [4, 20],
    sources: ['FAO-56 Table 11 (Sorghum, Arid Region row)', 'FAO-56 Table 12 (Sorghum grain; Cereals group Kc ini)'],
    todo: ['Tbase 10 °C for sorghum needs a citable source.'],
  },
  mung: {
    id: 'mung',
    kcIni: 0.4, // FAO-56 T12 group "Legumes" Kc ini
    kcMid: 1.05, // FAO-56 T12 "Green Gram and Cowpeas" (mung bean = green gram, Vigna radiata)
    kcEnd: 0.35, // FAO-56 T12 0.60–0.35; second value = harvested dry (fn 6)
    stages: [20, 30, 30, 20], // FAO-56 T11 "Green gram, cowpeas", March, Mediterranean
    heightM: 0.4, // FAO-56 T12
    tbase: 10,
    plant: [6, 20], // summer catch crop sown after winter-wheat harvest
    sources: ['FAO-56 Table 11 (Green gram, cowpeas)', 'FAO-56 Table 12 (Green Gram and Cowpeas; Legumes group Kc ini)'],
    todo: [
      'FAO-56 T11 prints total 110 d for this row, but stages sum to 100 d — stages used as printed.',
      'Tbase 10 °C for mung bean needs a citable source.',
    ],
  },
};
