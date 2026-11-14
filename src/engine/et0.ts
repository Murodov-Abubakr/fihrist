/**
 * Reference evapotranspiration ET0.
 * Primary: FAO-56 Penman–Monteith (Allen et al. 1998, FAO-56 Eq. 6) on daily data.
 * Fallback / cross-check: Hargreaves (FAO-56 Eq. 52; Hargreaves & Samani 1985).
 * Supporting equations: FAO-56 Eqs. 7, 8, 11, 12, 13, 19, 38, 39, 40.
 */
import { clearSkyRadiation, extraterrestrialRadiation } from './solar.ts';

/** Stefan–Boltzmann constant, MJ K⁻⁴ m⁻² day⁻¹ (FAO-56 Eq. 39). */
export const SIGMA = 4.903e-9;
/** Albedo of the grass reference crop (FAO-56 Eq. 38). */
export const ALBEDO = 0.23;

/** Saturation vapour pressure e°(T), kPa (FAO-56 Eq. 11). */
export function satVapourPressure(tC: number): number {
  return 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3));
}

/** Slope of the saturation vapour pressure curve Δ, kPa °C⁻¹ (FAO-56 Eq. 13). */
export function svpSlope(tC: number): number {
  return (4098 * satVapourPressure(tC)) / (tC + 237.3) ** 2;
}

/** Atmospheric pressure P, kPa, from elevation z in m (FAO-56 Eq. 7). */
export function atmosphericPressure(z: number): number {
  return 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26;
}

/** Psychrometric constant γ, kPa °C⁻¹ (FAO-56 Eq. 8). */
export function psychrometricConstant(pKPa: number): number {
  return 0.000665 * pKPa;
}

/** Mean saturation vapour pressure es, kPa (FAO-56 Eq. 12). */
export function meanSatVapourPressure(tmax: number, tmin: number): number {
  return (satVapourPressure(tmax) + satVapourPressure(tmin)) / 2;
}

/** Actual vapour pressure ea from mean relative humidity, kPa (FAO-56 Eq. 19). */
export function eaFromRHmean(rhMean: number, tmax: number, tmin: number): number {
  return (rhMean / 100) * meanSatVapourPressure(tmax, tmin);
}

/** Actual vapour pressure ea from RHmax and RHmin, kPa (FAO-56 Eq. 17). */
export function eaFromRHminmax(rhMax: number, rhMin: number, tmax: number, tmin: number): number {
  return (satVapourPressure(tmin) * rhMax / 100 + satVapourPressure(tmax) * rhMin / 100) / 2;
}

export interface PMInput {
  tmax: number; // °C
  tmin: number; // °C
  /** Actual vapour pressure, kPa. Give either ea or rhMean. */
  ea?: number;
  rhMean?: number; // %
  u2: number; // wind speed at 2 m, m s⁻¹
  rs: number; // incoming shortwave (solar) radiation, MJ m⁻² day⁻¹
  elevation: number; // m
  lat: number; // decimal degrees
  doy: number; // day of year
  /** Soil heat flux G, MJ m⁻² day⁻¹. FAO-56 Eq. 42: ≈ 0 for daily steps. */
  g?: number;
}

export interface PMResult {
  et0: number; // mm day⁻¹
  ra: number;
  rso: number;
  rn: number;
  ea: number;
  es: number;
}

/**
 * FAO-56 Penman–Monteith daily reference ET0 (mm day⁻¹), FAO-56 Eq. 6, with net radiation
 * from Eqs. 38–40. Rs/Rso is limited to [0.3, 1.0] as in ASCE-EWRI (2005) The ASCE Standardized
 * Reference Evapotranspiration Equation, Eq. 18 note (FAO-56 states Rs/Rso ≤ 1.0); this keeps the
 * cloudiness factor (1.35·Rs/Rso − 0.35) positive.
 */
export function et0PenmanMonteith(i: PMInput): PMResult {
  const tmean = (i.tmax + i.tmin) / 2;
  const es = meanSatVapourPressure(i.tmax, i.tmin);
  const ea = i.ea ?? eaFromRHmean(i.rhMean ?? NaN, i.tmax, i.tmin);
  const delta = svpSlope(tmean);
  const gamma = psychrometricConstant(atmosphericPressure(i.elevation));
  const ra = extraterrestrialRadiation(i.lat, i.doy);
  const rso = clearSkyRadiation(ra, i.elevation);
  const rns = (1 - ALBEDO) * i.rs; // Eq. 38
  const ratio = rso > 0 ? Math.min(1, Math.max(0.3, i.rs / rso)) : 0.5;
  const tk4 = ((i.tmax + 273.16) ** 4 + (i.tmin + 273.16) ** 4) / 2;
  const rnl = SIGMA * tk4 * (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) * (1.35 * ratio - 0.35); // Eq. 39
  const rn = rns - rnl; // Eq. 40
  const g = i.g ?? 0;
  const num = 0.408 * delta * (rn - g) + gamma * (900 / (tmean + 273)) * i.u2 * (es - ea);
  const den = delta + gamma * (1 + 0.34 * i.u2);
  return { et0: Math.max(0, num / den), ra, rso, rn, ea, es };
}

/**
 * Hargreaves reference ET0 (mm day⁻¹), FAO-56 Eq. 52:
 * ET0 = 0.0023 · (Tmean + 17.8) · (Tmax − Tmin)^0.5 · 0.408 · Ra
 */
export function et0Hargreaves(tmax: number, tmin: number, lat: number, doy: number): number {
  const ra = extraterrestrialRadiation(lat, doy);
  const tmean = (tmax + tmin) / 2;
  return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * 0.408 * ra);
}
