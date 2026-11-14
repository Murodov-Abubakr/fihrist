/**
 * Solar geometry and extraterrestrial radiation.
 * Source: Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop evapotranspiration —
 * Guidelines for computing crop water requirements. FAO Irrigation and Drainage Paper 56 (FAO-56),
 * Chapter 3, Eqs. 21–25 and 34, 37. https://www.fao.org/4/x0490e/x0490e00.htm
 */

/** Solar constant Gsc, MJ m⁻² min⁻¹ (FAO-56 Eq. 21). */
export const GSC = 0.082;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Inverse relative Earth–Sun distance dr (FAO-56 Eq. 23). */
export function inverseRelativeDistance(doy: number): number {
  return 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * doy);
}

/** Solar declination δ, rad (FAO-56 Eq. 24). */
export function solarDeclination(doy: number): number {
  return 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39);
}

/** Sunset hour angle ωs, rad (FAO-56 Eq. 25), clamped for polar day/night. */
export function sunsetHourAngle(latRad: number, decl: number): number {
  const x = -Math.tan(latRad) * Math.tan(decl);
  return Math.acos(Math.min(1, Math.max(-1, x)));
}

/**
 * Daily extraterrestrial radiation Ra, MJ m⁻² day⁻¹ (FAO-56 Eq. 21).
 * Computed from latitude and day of year — NOT from POWER's ALLSKY_SFC_SW_DWN (that is Rs).
 */
export function extraterrestrialRadiation(latDeg: number, doy: number): number {
  const phi = rad(latDeg);
  const dr = inverseRelativeDistance(doy);
  const d = solarDeclination(doy);
  const ws = sunsetHourAngle(phi, d);
  const ra = ((24 * 60) / Math.PI) * GSC * dr * (ws * Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.sin(ws));
  return Math.max(0, ra);
}

/** Daylight hours N (FAO-56 Eq. 34). */
export function daylightHours(latDeg: number, doy: number): number {
  return (24 / Math.PI) * sunsetHourAngle(rad(latDeg), solarDeclination(doy));
}

/** Clear-sky solar radiation Rso, MJ m⁻² day⁻¹ (FAO-56 Eq. 37), z = elevation in m. */
export function clearSkyRadiation(ra: number, elevationM: number): number {
  return (0.75 + 2e-5 * elevationM) * ra;
}

/** Day of year (1–366) for a UTC date. */
export function dayOfYear(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
}
