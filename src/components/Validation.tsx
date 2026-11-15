import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { loadPreset } from '../data/climateSource';
import { deriveDaily, monthlyClimatology, type DailySeries } from '../engine/climate';
import { NASS_SOURCE, validateKansasWheat } from '../engine/validation';
import { YM } from '../engine/params';
import type { Soil } from '../engine/soilwater';
import { Astrolabe } from './Astrolabe';

/**
 * Validation drawer (English): model vs USDA NASS Kansas wheat yields, computed live from the Kansas
 * preset file with the same engine the cards use. Shows where the model agrees AND where it does not.
 */
const OBS = '#ECE8E1';
const MOD = '#6890DE';
const AXIS = { fill: '#A3A9B1', fontSize: 11, fontFamily: '"IBM Plex Mono", ui-monospace, monospace' };
const f = (v: number, d = 2) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="eyebrow mb-2 mt-7 first:mt-0">{children}</h3>;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate">{label}</div>
      <div className="num mt-1 text-xl text-parchment">{value}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-slate">{note}</div>
    </div>
  );
}

export function Validation({ soil }: { soil: Soil }) {
  const { t } = useTranslation();
  const [series, setSeries] = useState<DailySeries | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    loadPreset('kansas', ctrl.signal).then((r) => setSeries(r.series)).catch((e: Error) => { if (!ctrl.signal.aborted) setError(e.message); });
    return () => ctrl.abort();
  }, []);

  const result = useMemo(() => {
    if (!series) return null;
    const dd = deriveDaily(series);
    const v = validateKansasWheat(series, dd, soil, 'season');
    const vStage = validateKansasWheat(series, dd, soil, 'stage'); // sensitivity test, not used by the app
    const months = monthlyClimatology(series, dd);
    const pm = months.reduce((s, m) => s + m.et0, 0);
    const hg = months.reduce((s, m) => s + m.et0Harg, 0);
    return { v, vStage, pm, hg };
  }, [series, soil]);

  if (error) return <p className="text-sm text-terracotta-light">{error}</p>;
  if (!result) return <div className="flex h-40 items-center justify-center"><Astrolabe size={46} label={t('timeline.waiting')} /></div>;
  const { v, vStage, pm, hg } = result;
  const rows = v.rows.map((r) => ({ year: r.year, observed: +r.observed.toFixed(2), modelled: +r.modelled.toFixed(2) }));

  return (
    <div className="text-sm leading-relaxed text-parchment">
      <p className="mb-4 text-xs text-slate">{t('drawer.validationEnglish')}</p>

      <H>Wheat yield: model vs USDA NASS (Kansas)</H>
      <p className="text-[13px]">Rainfed continuous winter wheat simulated at the Kansas preset (38.8 N, 99.3 W, near Hays) on {soil} soil, with real NASA POWER weather for each season, compared with USDA NASS statewide Kansas wheat yields {v.rows[0]?.year}–{v.rows[v.rows.length - 1]?.year}. The model’s potential yield (Ym = {YM.kansas.wheat.value} t/ha) comes from irrigated Kansas yields, not from these NASS numbers, so this is an out-of-sample test.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Year-to-year r" value={f(v.r)} note="Pearson correlation, model vs NASS" />
        <Stat label="Direction" value={`${v.directionHits}/${v.directionYears}`} note="years moving the same way as NASS" />
        <Stat label="Mean level" value={`${v.biasPct > 0 ? '+' : ''}${f(v.biasPct, 0)}%`} note={`model ${f(v.meanModelled)} vs NASS ${f(v.meanObserved)} t/ha`} />
        <Stat label="Mean abs. error" value={`${f(v.mae)}`} note="t/ha per year" />
      </div>

      <div className="mt-4">
        <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-parchment">
          <li className="flex items-center gap-2"><span aria-hidden className="h-0.5 w-4 rounded" style={{ background: OBS }} />USDA NASS, statewide (observed)</li>
          <li className="flex items-center gap-2"><span aria-hidden className="h-0.5 w-4 rounded" style={{ background: MOD }} />Fihrist model, one NASA POWER cell</li>
        </ul>
        <div className="h-52" role="img" aria-label="Wheat yield, model vs USDA NASS, t/ha per year">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
              <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,.15)' }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} domain={[0, 'auto']} unit="" />
              <Tooltip
                contentStyle={{ background: '#17191C', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: '#A3A9B1' }} itemStyle={{ color: '#ECE8E1' }}
                formatter={(val: number, name: string) => [`${f(val)} t/ha`, name === 'observed' ? 'NASS (observed)' : 'Model']}
              />
              <Line dataKey="observed" type="linear" stroke={OBS} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: OBS, stroke: '#1E2126' }} isAnimationActive={false} />
              <Line dataKey="modelled" type="linear" stroke={MOD} strokeWidth={2} dot={{ r: 3, fill: MOD, stroke: '#1E2126' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-2 text-[11px] text-slate">
          <summary className="cursor-pointer select-none hover:text-parchment">{t('charts.table')}</summary>
          <table className="num mt-2 w-full text-right">
            <thead><tr><th className="text-left font-normal">Year</th><th className="font-normal">NASS t/ha</th><th className="font-normal">Model t/ha</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.year} className="text-parchment"><td className="text-left">{r.year}</td><td>{f(r.observed)}</td><td>{f(r.modelled)}</td></tr>)}</tbody>
          </table>
        </details>
      </div>

      <H>What this shows</H>
      <ul className="list-disc space-y-1.5 pl-5 text-[13px]">
        <li><b>The model follows real good and bad years</b> (r = {f(v.r)}): the weather signal from NASA POWER, the FAO-56 water balance and FAO-33 yield response move together with what Kansas farmers actually harvested.</li>
        <li><b>The absolute level is too low</b> ({f(v.biasPct, 0)}%). Likely reasons, all listed as information gaps: (1) NASS is a statewide average that includes the wetter east and some irrigated fields, while the model point is in the drier west-central part of the state; (2) winter dormancy is not modelled, so the long autumn–winter development stage counts as water demand; (3) bare-soil evaporation in the summer fallow (FAO-56 dual-coefficient terms) leaves little stored water at sowing.</li>
        <li><b>Practical reading:</b> use Fihrist’s rainfed yields to compare rotations and years with each other, not as a yield forecast. Rainfed food numbers on the cards are likely conservative.</li>
      </ul>

      <H>Tested and rejected: stage-specific water stress</H>
      <p className="text-[13px]">We tested whether FAO’s stage-specific yield response factors for winter wheat (FAO Water Report 22, Table 1: initial 0.20, development 0.60, mid-season 0.50, late season blank → 0), combined multiplicatively across stages (Rao et al. 1988 — FAO gives no combination rule), would fit Kansas better than one seasonal factor (1.00). They did not, so the app keeps the seasonal factor.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="num w-full min-w-[380px] text-right text-[12px]">
          <thead className="text-[10.5px] uppercase tracking-[0.12em] text-slate">
            <tr><th className="text-left font-normal">Method</th><th className="font-normal">r</th><th className="font-normal">Direction</th><th className="font-normal">Level</th><th className="font-normal">MAE t/ha</th></tr>
          </thead>
          <tbody className="text-parchment">
            {([['Seasonal Ky (used)', v], ['Stage-specific Ky', vStage]] as const).map(([name, x]) => (
              <tr key={name} className="border-t border-white/5">
                <td className="py-1 text-left font-sans">{name}</td><td>{f(x.r)}</td><td>{x.directionHits}/{x.directionYears}</td>
                <td>{x.biasPct > 0 ? '+' : ''}{f(x.biasPct, 0)}%</td><td>{f(x.mae)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H>Evapotranspiration: OpenET comparison</H>
      <p className="text-[13px]"><b>Pending.</b> OpenET field-scale ET needs data access (a free API key) that was not available during the build. Until then, an internal cross-check of reference ET at this site: FAO-56 Penman–Monteith <span className="num">{f(pm, 0)}</span> mm/yr vs Hargreaves <span className="num">{f(hg, 0)}</span> mm/yr ({hg > pm ? '+' : ''}{f((100 * (hg - pm)) / pm, 0)}%). This checks consistency between two methods; it is not a validation against measurements.</p>

      <H>Sources and caveats</H>
      <ul className="list-disc space-y-1 pl-5 text-[12px] text-slate">
        <li>{NASS_SOURCE}. Statewide, all practices; Ellis County values need the NASS Quick Stats API and were not yet retrieved.</li>
        <li>The source table labels the column “Yield (bushels)” without naming winter wheat; Kansas wheat is overwhelmingly winter wheat.</li>
        <li>Bushels converted at 27.2155 kg (60 lb) per bushel and 0.404686 ha per acre.</li>
      </ul>
    </div>
  );
}
