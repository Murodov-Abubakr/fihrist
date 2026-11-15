/**
 * Crop parameters. Every value carries its source; choices between table rows are explained.
 *
 * FAO-56 = Allen et al. (1998) FAO Irrigation and Drainage Paper 56.
 *   Table 11 (stage lengths): https://www.fao.org/4/x0490e/x0490e0b.htm#TopOfPage (Table 11)
 *   Table 12 (single Kc, max height): same page (Table 12). Group Kc ini values used where a crop row
 *   has no Kc ini ("only one value for Kc ini is listed ... representative of the whole group").
 * Verified against the FAO web edition on 2026-11-14.
 */

export type CropId = 'wheat' | 'cotton' | 'chickpea' | 'sorghum' | 'mung' | 'maize' | 'barley' | 'potato';

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
  // Added 2026-11-15 for the farmer's own rotation; values researched from FAO-56 web edition
  // (Tables 11, 12, 22), FAO Water Report 22, FAOSTAT via Our World in Data, USDA FDC.
  maize: {
    id: 'maize',
    kcIni: 0.3, // FAO-56 T12 group "Cereals" Kc ini (maize cell is part of an image on the web page — group value)
    kcMid: 1.2, // FAO-56 T12 "Maize, Field (grain) (field corn)"
    kcEnd: 0.35, // FAO-56 T12 0.60 / 0.35; 0.35 = harvest after field drying of the grain (fn 11)
    stages: [30, 40, 50, 30], // FAO-56 T11 Maize (grain), April, "Spain (spr, sum.); Calif." (total 150 d) — no Central Asia row
    heightM: 2, // FAO-56 T12
    tbase: 10, // 10 °C (50 °F) with 30 °C cap: UNL CropWatch; Purdue MRCC (US corn GDD convention)
    plant: [4, 20],
    sources: ['FAO-56 Table 12 (Maize, field grain; Cereals group Kc ini)', 'FAO-56 Table 11 (Maize grain, Spain/Calif. April row, as regional proxy)', 'UNL CropWatch / Purdue MRCC (Tbase 10 °C)'],
    todo: ['Stage lengths are a regional proxy (Spain/California).', 'Sowing 20 Apr assumed (GIEWS: spring planting from mid-April) — confirm locally.', 'Kc ini is the Cereals group value (not readable in text for the maize row).'],
  },
  barley: {
    id: 'barley',
    kcIni: 0.3, // FAO-56 T12 group "Cereals" Kc ini (barley row has no Kc ini)
    kcMid: 1.15, // FAO-56 T12 Barley
    kcEnd: 0.25, // FAO-56 T12 Barley
    stages: [40, 60, 60, 40], // FAO-56 T11 Barley/Oats/Wheat, "Nov", 200 d (region not given) — winter-sown row
    heightM: 1, // FAO-56 T12
    tbase: 0, // Bauer et al. (1992), as cited by the Montana Climate Office (barley GDD threshold 0 °C)
    plant: [10, 15],
    sources: ['FAO-56 Table 12 (Barley; Cereals group Kc ini)', 'FAO-56 Table 11 (Barley/Oats/Wheat, November 200-day row)', 'Bauer et al. 1992 via Montana Climate Office (Tbase 0 °C)'],
    todo: ['Stage row has no region in FAO-56 — proxy for Central Asian winter barley.', 'Sowing 15 Oct assumed (GIEWS: winter cereals planted by November) — confirm locally.'],
  },
  potato: {
    id: 'potato',
    kcIni: 0.5, // FAO-56 T12 group "Roots and Tubers" Kc ini (potato row has no Kc ini)
    kcMid: 1.15, // FAO-56 T12 Potato
    kcEnd: 0.75, // FAO-56 T12 Potato (0.40 for long-season potatoes with vine kill, fn 4)
    stages: [25, 30, 35, 30], // FAO-56 T11 Potato "(Semi) Arid Climate" 25/30/30–45/30; mid 35 → 120 d, matching the FAO Crop Calendar for Tajik lowlands (115–120 d)
    heightM: 0.6, // FAO-56 T12
    tbase: 7, // Manitoba Agriculture: "minimum temperature for potato growth and development is 7 °C"
    plant: [3, 1],
    sources: ['FAO-56 Table 12 (Potato; Roots and Tubers group Kc ini)', 'FAO-56 Table 11 (Potato, (Semi) Arid Climate row)', 'FAO Crop Calendar, Tajikistan, potato (spring sowing 15 Feb–15 Mar, 115–120 d)', 'Manitoba Agriculture (Tbase 7 °C)'],
    todo: ['Mid-season length 35 d chosen within the FAO range 30–45 d to match the 115–120 d Tajik lowland season.'],
  },
};
