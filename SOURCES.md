# Sources

Every crop parameter, constant and dataset used by Project Fihrist is listed here with its source.
Items marked **TODO verify** are assumptions or proxies that still need a primary source or local confirmation.

## Datasets
| Dataset | Use | Resolution | Access | Source |
|---|---|---|---|---|
| NASA POWER daily point API v2, community=AG | T2M_MAX, T2M_MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN, WS2M, RH2M, 2001-01-01 to 2024-12-31 | Meteorology: MERRA-2, 0.5° × 0.625° (~50 km); radiation: CERES SYN1deg, 1° | Live (browser, CSV) and prefetched preset JSON (`scripts/prefetch_power.py`) | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ |

Notes found while building (2026-11-14):
- POWER **monthly** endpoint `T2M_MAX`/`T2M_MIN` are monthly *extremes* (highest/lowest daily value), not mean daily max/min; Fihrist therefore derives all monthly values from the **daily** endpoint.
- POWER elevation is the MERRA-2 grid-cell mean (e.g. Gissar cell 1327 m, while the Dushanbe valley floor is lower); used for atmospheric pressure in Penman–Monteith and listed as an information gap.

## Equations
| Quantity | Equation | Source |
|---|---|---|
| Extraterrestrial radiation Ra | FAO-56 Eqs. 21–25 (from latitude, day of year) | Allen et al. 1998, FAO Irrigation and Drainage Paper 56 |
| Daylight hours, clear-sky radiation | FAO-56 Eqs. 34, 37 | FAO-56 |
| Saturation / actual vapour pressure, Δ, P, γ | FAO-56 Eqs. 7, 8, 11, 12, 13, 17, 19 | FAO-56 |
| Net radiation | FAO-56 Eqs. 38–40 (albedo 0.23, σ = 4.903e-9) | FAO-56 |
| Rs/Rso limits [0.3, 1.0] | | ASCE-EWRI (2005) Standardized Reference ET Equation |
| Reference ET0 (primary) | FAO-56 Penman–Monteith, Eq. 6, daily, G = 0 (Eq. 42) | FAO-56 |
| Reference ET0 (cross-check) | Hargreaves, FAO-56 Eq. 52 | FAO-56; Hargreaves & Samani 1985 |
| Daily RHmin estimate | RHmin = ea / e°(Tmax) (approach of FAO-56 Eq. 63) | FAO-56 |
| Crop coefficient curve | FAO-56 Eq. 66, Fig. 25 | FAO-56 |
| Kc mid/end climate adjustment | FAO-56 Eqs. 62, 65 | FAO-56 |
| Effective rainfall | USDA Soil Conservation Service method (monthly): P(125 − 0.2P)/125 for P ≤ 250 mm; 125 + 0.1P above | FAO CROPWAT 8.0; Smith 1992 (FAO I&D Paper 46) |
| Water deficit | 10 · Σ max(0, ETc − Peff), monthly, m³/ha | CLAUDE.md §5 (1 mm over 1 ha = 10 m³) |
| Growing degree-days | Σ max(0, (Tmax + Tmin)/2 − Tbase) | McMaster & Wilhelm 1997 |
| Frost day | Tmin ≤ 0 °C | CLAUDE.md §5 |

Unit tests reproduce FAO-56 Examples 2, 8, 9, 18 and Annex 2 Table 2.3 (`src/engine/engine.test.ts`).

## Crop parameters (`src/engine/crops.ts`)
Verified against the FAO-56 web edition, Tables 11 and 12 (https://www.fao.org/4/x0490e/x0490e0b.htm), on 2026-11-14.

| Crop | Kc ini / mid / end | Stages (d) | Height | Tbase | Source / notes |
|---|---|---|---|---|---|
| Winter wheat | 0.7 / 1.15 / 0.25 | 30/140/40/30 | 1.0 m | 0 °C | T12 non-frozen soils (frozen: 0.4); Kc end 0.25–0.4 (0.4 hand-harvest); T11 Mediterranean Nov row. Tbase: McMaster & Wilhelm 1997. **TODO verify** sowing date 15 Oct; dormancy in frozen winters |
| Cotton | 0.35 / 1.175 / 0.6 | 30/50/60/55 | 1.35 m | 15.6 °C | T12 (Fibre group Kc ini; ranges → midpoints); T11 Egypt/Pakistan row. **TODO verify** Tbase source (DD60 convention) |
| Chickpea | 0.4 / 1.00 / 0.35 | 20/30/40/20 | 0.4 m | 0 °C | T12 (Legumes group Kc ini). **TODO verify**: T11 has no chickpea row — dry-bean stages used as proxy; Tbase source |
| Sorghum (grain) | 0.3 / 1.05 / 0.55 | 20/35/45/30 | 1.5 m | 10 °C | T12 (Cereals group Kc ini; mid = midpoint of 1.00–1.10); T11 Arid Region row. **TODO verify** Tbase source |
| Mung bean (= green gram) | 0.4 / 1.05 / 0.35 | 20/30/30/20 | 0.4 m | 10 °C | T12 "Green Gram and Cowpeas" (dry harvest); T11 row prints total 110 d but stages sum to 100 d. **TODO verify** Tbase source |

### Crops added 2026-11-15 (for "My own rotation")
| Crop | Kc ini / mid / end | Stages (d) | Zr / p | Ky | Ym Central Asia | Food (USDA FDC) | Price | Sowing |
|---|---|---|---|---|---|---|---|---|
| Maize (grain) | 0.3 (Cereals group) / 1.20 / 0.35 (dry harvest), h 2 m — FAO-56 T12 | 30/40/50/30 — T11 Spain/Calif. April row (**proxy region**) | 1.35 m (1.0–1.7) / 0.55 — T22 | 1.25 — FAO WR 22 T1 | 1.93 t/ha Afghanistan 2024, FAOSTAT via OWID — **TODO**: Tajik official 10–19 t/ha judged implausible, not used | 365 kcal, 9.42 g protein — FDC 170288 | 190.6 USD/t, World Bank 2024 (proxy) | 20 Apr (GIEWS: spring planting from mid-April; **TODO verify**) |
| Winter barley | 0.3 (Cereals group) / 1.15 / 0.25, h 1 m — T12 | 40/60/60/40 — T11 Barley/Oats/Wheat "Nov" 200-d row, no region (**proxy**) | 1.25 m (1.0–1.5) / 0.55 — T22 | 1.0 — **proxy** (winter wheat; FAO-33 has no barley) | 2.36 t/ha Tajikistan 2024, FAOSTAT via OWID (proxy: national average) | 354 kcal, 12.5 g — FDC 170283 (read via mirror) | maize price as proxy (World Bank barley series ends 2020) | 15 Oct (GIEWS: winter cereals planted by November; **TODO verify**) |
| Potato | 0.5 (Roots & Tubers group) / 1.15 / 0.75, h 0.6 m — T12 | 25/30/35/30 = 120 — T11 "(Semi) Arid", mid 35 within 30–45 to match the FAO Crop Calendar (TJ lowlands 115–120 d) | 0.5 m (0.4–0.6) / 0.35 — T22 | 1.10 — FAO WR 22 T1 | 19.96 t/ha fresh, Tajikistan 2024, FAOSTAT via OWID | 77 kcal, 2.05 g per 100 g fresh — FDC 170026 | 120 USD/t, secondary (Selina Wamucii, Jan 2023, attributed to FAOSTAT) — **TODO** | 1 Mar (FAO Crop Calendar TJ: 15 Feb–15 Mar) |

Tbase: maize 10 °C (UNL CropWatch, Purdue MRCC), barley 0 °C (Bauer et al. 1992 via Montana Climate Office), potato 7 °C (Manitoba Agriculture). Kansas reference yields: maize 129 bu/ac all practices (NASS 2024, proxy), barley and potato US national FAOSTAT values (proxy).

## Rotation model parameters (`src/engine/params.ts`, researched 2026-11-14)
Quality: **sourced** = from the cited source for this crop/region · **proxy** = sourced but for a related crop/region · **TODO** = assumption awaiting a source. Every non-sourced item is listed automatically in each card's "Information gaps".

| Parameter | Value | Quality | Source |
|---|---|---|---|
| Ky winter wheat | 1.00 | sourced | Doorenbos & Kassam 1979 (FAO-33), as reproduced in FAO/IAEA Moutonnet, FAO Water Report 22, Table 1 (https://www.fao.org/4/Y3655E/y3655e04.htm) |
| Ky cotton | 0.85 | sourced | same table |
| Ky sorghum | 0.90 | TODO | FAO-33 table seen only in a search excerpt |
| Ky chickpea, mung bean | 1.15 | proxy | FAO-33 "beans" (no chickpea/mung row) |
| Ym wheat, Central Asia | 4.0 t/ha | sourced | ICARDA yield-gap analysis for Central Asia (~4.0 t/ha irrigated; ~1.0 t/ha rainfed); consistent with Khatlon 2022 official 3.6 t/ha |
| Ym wheat, Kansas | 3.30 t/ha (49 bu/ac) | sourced | Crops & Soils (CSSA) 2024: irrigated Kansas winter wheat 1970–2022 average — independent of NASS dryland yields kept for validation |
| Ym chickpea, mung (CA) | 1.35 t/ha | proxy | FAOSTAT via Helgi Library: Tajikistan dry peas 13,486 hg/ha (2022) |
| Ym sorghum (CA) | 3.63 t/ha | proxy | Tajikistan cereal yield 3,629 kg/ha (2023), Statbase/World Bank |
| Ym cotton (CA) | 1.7 t/ha seed cotton | TODO | secondary report, year/basis unclear |
| kcal / protein per 100 g | wheat 327/12.6 · chickpea 378/20.5 · mung 347/23.9 · sorghum 329/10.6 | sourced | USDA FoodData Central SR Legacy 168890, 173756, 174256, 169716 |
| Cotton food energy | 0 | TODO | lint is not food; cottonseed oil not yet counted (CLAUDE.md §6) |
| N : protein factor | 6.25 | sourced | FAO 2003, Food and Nutrition Paper 77 |
| N fixed chickpea / mung | 70 / 34 kg N/ha | proxy | GRDC Update Paper 2015 "Fixing more nitrogen in pulse crops" (Australian averages), scaled by relative yield — the single fixation source (CLAUDE.md §5 eq. 8) |
| Urea price | 338.3 USD/t | proxy | World Bank Pink Sheet (Dec 2025), 2024 annual average, Urea E. Europe |
| Wheat price | 268.7 USD/t | proxy | same, Wheat US HRW |
| Sorghum price | 190.6 USD/t | proxy | same, Maize (sorghum series discontinued) |
| Cotton price | 1.91 USD/kg lint × 35 % turnout | TODO | same, Cotton A Index; lint turnout unsourced |
| Chickpea / mung price | 500 / 875 USD/t | TODO | Tridge export-price aggregates (noisy) — local prices needed |
| Irrigation efficiency canal / drip | 0.50 / 0.90 | sourced / TODO | FAO Water Report: traditional schemes "typically less than 50 percent"; drip value commonly cited |
| People fed | kcal / (2,200 × 365) | — | CLAUDE.md §5 eq. 9 |

## Monte Carlo and climate stress (`src/engine/montecarlo.ts`)
| Item | Choice | Rationale |
|---|---|---|
| Weather futures | Year bootstrap: each synthetic sowing year draws one real NASA POWER year (2001–2023) with replacement; seasons sown in the same synthetic year share it; all rotations share the draws (common random numbers) | Keeps real, internally consistent seasonal weather (CLAUDE.md §5 eq. 12: "sample residuals from real years where possible") |
| Horizon | 12 years (CLAUDE.md says 10) | Whole cycles of the 1-, 2- and 3-year rotations; avoids cycle-phase bias |
| Runs | 2,400 in 12 batches of 200 | — |
| Climate sliders | Delta change: daily Tmax/Tmin + ΔT, daily rain × (1 + ΔP); RH, wind, radiation unchanged | Standard delta-change method; RH held constant so vapour pressure rises with warming |
| Not sampled | Parameter uncertainty (yields, prices, fixation); irrigation water availability (canal assumed to deliver full demand) | Listed as information gaps |

## Soil water model (`src/engine/soilwater.ts`, added 2026-11-15)
Daily root-zone water balance, FAO-56 chapter 8 (Eqs. 82–86, 88), with bare-soil fallow evaporation from chapter 7 (Eqs. 71, 74). Values read from the FAO web edition (ch. 7: https://www.fao.org/4/x0490e/x0490e0c.htm, ch. 8: https://www.fao.org/4/x0490e/x0490e0e.htm). Eq. 84 and Eq. 74 are images on the web page; their forms were checked against FAO Examples 37 (Ks = 0.97) and 31.

| Parameter | Value used (midpoint of FAO range) | Source |
|---|---|---|
| θFC − θWP sand / loam / clay | 0.08 / 0.155 / 0.16 m³/m³ | FAO-56 Table 19 (0.05–0.11 / 0.13–0.18 / 0.12–0.20) |
| REW sand / loam / clay | 4.5 / 9 / 10 mm | Table 19 (2–7 / 8–10 / 8–12) |
| TEW (Ze 0.10 m) sand / loam / clay | 9 / 19 / 25.5 mm | Table 19 (6–12 / 16–22 / 22–29) |
| Zr winter wheat / cotton / chickpea / sorghum / mung | 1.65 / 1.35 / 0.8 / 1.5 / 0.8 m | Table 22 (1.5–1.8 / 1.0–1.7 / 0.6–1.0 / 1.0–2.0 / Green gram 0.6–1.0) |
| p (ETc ≈ 5 mm/d) wheat / cotton / chickpea / sorghum / mung | 0.55 / 0.65 / 0.50 / 0.55 / 0.45 | Table 22; adjusted daily p + 0.04(5 − ETc), 0.1–0.8 (Table 22 fn 2) |
| Kcb bare soil | 0.15 | Table 18 ("annual crop – (nearly) bare soil") |
| Kc max for bare-soil evaporation | 1.20 | Example 31 (text range 1.05–1.30; Eq. 72 not modelled) |

Simplifications: no runoff, no capillary rise, roots at full depth from sowing, one layer, fallow tracked over the next crop's root depth. Seasons start from the previous season's end state (continuous replay); Monte Carlo season tables start from the rotation's average end-of-season state.

## Validation (`src/engine/validation.ts`, Validation drawer)
| Item | Value | Source |
|---|---|---|
| Observed | Kansas wheat yield, statewide, all practices, 2015–2024: 37, 57, 48, 38, 52, 45, 52, 37, 35, 43 bu/ac | USDA NASS "Kansas Wheat History", via Kansas Wheat: https://kswheat.com/growers/average-kansas-wheat-production (read 2026-11-15) |
| Ellis County (model point) | not retrieved | needs the NASS Quick Stats API key |
| OpenET ET | not retrieved — **pending** | needs an OpenET API key |
| Result (loam, 2026-11-15) | r = 0.77, direction 8/9, level −45 %, MAE 1.34 t/ha | computed live in the drawer; regression-guarded in `validation.test.ts` |
| Sensitivity (not used in the app) | without the Kcb,bare diffusive fallow term: level −29 %, r = 0.85 | `scripts/validation-table.mts` with KCB_BARE = 0; reported only, the FAO default is kept |
| Stage-specific Ky test (not used) | Winter wheat Ky per stage 0.20 / 0.60 / 0.50 / blank→0 (FAO Water Report 22 Table 1, https://www.fao.org/4/Y3655E/y3655e04.htm), combined multiplicatively (Rao et al. 1988 — FAO states no combination rule). Loam: r = 0.66, level −49 % vs seasonal r = 0.77, −45 % | Rejected: worse fit; seasonal Ky 1.00 stays the default. Shown live in the Validation drawer; locked by `validation.test.ts` |

## Field year and stress calendar (`src/engine/stress.ts`, `RotationResult.calendar`)
| Item | Choice | Source / rationale |
|---|---|---|
| Field calendar | Share of each month's days with a living crop, per cycle year, averaged over the 2015–2024 replay | Computed from the same crop calendars as the rotation results |
| Frost day | Tmin ≤ 0 °C | CLAUDE.md §5 eq. 6 |
| Hot day | Tmax ≥ 35 °C, shown as a count | Display threshold only — **TODO verify** a citable crop-specific heat-stress threshold |
| Compound stress (partial) | Monthly mean Tmax and monthly rain → z-scores against the same calendar month in all complete years 2001–2024 of this field; flagged when z(heat) > 1 and z(dry) > 1 | CLAUDE.md §5 eq. 11 ("e.g. z > 1"). **2 of 4 signals**: soil moisture and NDVI not yet included |
| Dryness defined only if the month's mean rain ≥ 10 mm | Avoids "drier than normal" in months that are normally dry | Project choice, documented here |

Observed (2026-11-15): the index flags June–July 2012 and August 2022 at the Kansas preset (both widely reported US drought periods) and February 2021 / spring 2008 at all three Central Asian presets. The Central Asian drought years still need confirmation from FAO/WFP before any drought claim (CLAUDE.md §2 item 5).

## Chart colours (`src/lib/palette.ts`)
Rotation identity colours baseline `#CF7A4C`, water-saving `#6890DE`, regenerative `#23A383`, validated on the panel surface `#1E2126` with a palette validator (OKLCH lightness band, chroma floor, colour-vision-deficiency separation ΔE ≥ 8, normal-vision ΔE ≥ 15, contrast ≥ 3:1). Rotations are always named in text too.

Not modelled yet (shown as information gaps): runoff and capillary rise in the soil water balance, stage-specific Ky, nitrogen losses, wheat winter dormancy, farm costs other than replacing nitrogen.

## Map and UI assets
| Asset | Source / licence |
|---|---|
| Place search | Photon geocoder by Komoot (https://photon.komoot.io), OpenStreetMap data © OpenStreetMap contributors, ODbL; attribution shown in the search dropdown. Public instance — fair use. |
| Satellite basemap | Esri World Imagery (Esri, Maxar, Earthstar Geographics, GIS User Community); attribution shown on map |
| Fonts | Exo 2, Inter, IBM Plex Mono — self-hosted via @fontsource 5.3.0 (SIL Open Font License 1.1) |
| Map library | Leaflet 1.9.4 (BSD-2) |
| 3D globe | MapLibre GL JS 6.16.0 (BSD-3), globe projection, Esri World Imagery tiles |
| Field area | Spherical polygon area, Chamberlain & Duquette (2007), "Some algorithms for polygons on a sphere", JPL Publication 07-03; mean Earth radius 6,371,008.8 m (IUGG). Whole-field totals = per-hectare results × area; the outline does not change the weather (NASA POWER ~50 km cell) |
