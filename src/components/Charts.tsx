import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Analysis } from '../data/useRotations';
import { ROTATION_IDS } from '../data/useRotations';
import type { Band, McSummary } from '../engine/montecarlo';
import type { RotationId } from '../engine/rotation';
import { IRRIGATION_EFFICIENCY } from '../engine/params';
import { ROTATION_COLOR } from '../lib/palette';
import { Astrolabe } from './Astrolabe';
import { SectionTitle } from './SectionTitle';

type Row = { year: number } & Partial<Record<RotationId, number>>;
const AXIS = { fill: '#A3A9B1', fontSize: 11, fontFamily: '"IBM Plex Mono", ui-monospace, monospace' };
const fmt = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

function ChartTooltip({ active, payload, label, unit, names }: { active?: boolean; payload?: { dataKey: RotationId; value: number }[]; label?: number; unit: string; names: Record<RotationId, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/15 bg-[#17191C] px-3 py-2 text-xs shadow-lg">
      <div className="num mb-1 text-slate">{label}</div>
      {ROTATION_IDS.map((id) => {
        const p = payload.find((x) => x.dataKey === id);
        if (!p) return null;
        return (
          <div key={id} className="flex items-center gap-2 text-parchment">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ROTATION_COLOR[id] }} />
            <span className="flex-1">{names[id]}</span>
            <span className="num pl-3">{fmt(p.value)} {unit}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Legend that doubles as the direct label: name + final value, so identity is never colour-alone. */
function Legend({ rows, names, unit, mean }: { rows: Row[]; names: Record<RotationId, string>; unit: string; mean?: boolean }) {
  const { t } = useTranslation();
  // cumulative series → final value; yearly series → mean over the years (the final year depends on the cycle phase)
  const last: Partial<Record<RotationId, number>> = mean
    ? Object.fromEntries(ROTATION_IDS.map((id) => [id, rows.reduce((s, r) => s + (r[id] ?? 0), 0) / rows.length]))
    : rows[rows.length - 1];
  const suffix = mean ? ` ${t('charts.mean')}` : '';
  return (
    <ul className="relative mb-2 space-y-0.5 text-[11px] text-parchment">
      {ROTATION_IDS.map((id) => (
        <li key={id} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: ROTATION_COLOR[id] }} />
          <span className="flex-1 truncate">{names[id]}</span>
          <span className="num text-slate">{last?.[id] !== undefined ? `${fmt(last[id]!)} ${unit}${suffix}` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

function DataTable({ rows, names, label }: { rows: Row[]; names: Record<RotationId, string>; label: string }) {
  const { t } = useTranslation();
  return (
    <details className="relative mt-2 text-[11px] text-slate">
      <summary className="cursor-pointer select-none hover:text-parchment">{t('charts.table')}</summary>
      <div className="mt-2 max-h-48 overflow-auto">
        <table className="num w-full text-right">
          <caption className="sr-only">{label}</caption>
          <thead><tr><th className="text-left font-normal">{t('charts.year')}</th>{ROTATION_IDS.map((id) => <th key={id} className="font-normal">{names[id]}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.year} className="text-parchment"><td className="text-left">{r.year}</td>{ROTATION_IDS.map((id) => <td key={id}>{r[id] !== undefined ? fmt(r[id]!) : '–'}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

function LinePanel({ title, sub, rows, unit, names, zeroLine, mean }: { title: string; sub: string; rows: Row[]; unit: string; names: Record<RotationId, string>; zeroLine?: boolean; mean?: boolean }) {
  return (
    <div className="slab flex flex-col p-5">
      <h3 className="eyebrow relative">{title}</h3>
      <p className="relative mb-3 mt-1 text-[11px] leading-snug text-slate">{sub}</p>
      <Legend rows={rows} names={names} unit={unit} mean={mean} />
      <div className="relative h-48" role="img" aria-label={`${title}. ${sub}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
            <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,.15)' }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => fmt(v)} />
            {zeroLine && <ReferenceLine y={0} stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />}
            <Tooltip content={<ChartTooltip unit={unit} names={names} />} cursor={{ stroke: 'rgba(255,255,255,.3)', strokeWidth: 1 }} />
            {ROTATION_IDS.map((id) => (
              <Line key={id} dataKey={id} type="linear" stroke={ROTATION_COLOR[id]} strokeWidth={2} dot={false}
                activeDot={{ r: 4, stroke: '#1E2126', strokeWidth: 2 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable rows={rows} names={names} label={title} />
    </div>
  );
}

/** One group of P10–P90 range bars with the P50 dot, one row per rotation, on a shared 0-based scale. */
function RangeGroup({ title, bands, names, digits, unit }: { title: string; bands: { id: RotationId; b: Band }[]; names: Record<RotationId, string>; digits: number; unit: string }) {
  const { t } = useTranslation();
  const max = Math.max(...bands.map((x) => x.b.p90), 0.1) * 1.1;
  const pct = (v: number) => `${(100 * v) / max}%`;
  const flat = bands.every(({ b }) => b.p90 - b.p10 <= Math.abs(b.p50) * 0.005);
  return (
    <div className="relative min-w-0 flex-1">
      <h4 className="mb-3 text-[11px] uppercase tracking-[0.14em] text-parchment">{title} <span className="normal-case tracking-normal text-slate">({unit})</span></h4>
      <ul className="space-y-4" aria-label={title}>
        {bands.map(({ id, b }) => (
          <li key={id} title={`${names[id]}: P10 ${fmt(b.p10, digits)} · P50 ${fmt(b.p50, digits)} · P90 ${fmt(b.p90, digits)} ${unit}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-2 truncate text-parchment">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: ROTATION_COLOR[id] }} />{names[id]}
              </span>
              <span className="num shrink-0 text-slate">P10 {fmt(b.p10, digits)} · <span className="text-parchment">P50 {fmt(b.p50, digits)}</span> · P90 {fmt(b.p90, digits)}</span>
            </div>
            <div className="relative h-3 rounded-full bg-black/30">
              <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ left: pct(b.p10), width: `max(4px, ${pct(b.p90 - b.p10)})`, background: ROTATION_COLOR[id], opacity: 0.55 }} />
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pct(b.p50), background: ROTATION_COLOR[id], boxShadow: '0 0 0 2px #1E2126' }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="num mt-2 flex justify-between text-[10px] text-slate"><span>0</span><span>{fmt(max, digits)}</span></div>
      {flat && <p className="mt-2 text-[11px] leading-snug text-slate">{t('charts.noSpread')}</p>}
    </div>
  );
}

/** Uncertainty bands: people fed, and (when irrigated) water withdrawn — Monte Carlo when finished, replay cycles until then. */
function RangePanel({ analysis, mc, names }: { analysis: Analysis; mc: McSummary | null; names: Record<RotationId, string> }) {
  const { t } = useTranslation();
  const people = ROTATION_IDS.map((id) => ({ id, b: mc ? mc[id].peopleFed : analysis.results[id].peopleFedP }));
  const water = mc && analysis.irrigation !== 'rainfed' ? ROTATION_IDS.map((id) => ({ id, b: mc[id].waterM3 })) : null;
  const sub = mc ? t('charts.uncertaintySub', { runs: fmt(mc.runs) }) : t('charts.uncertaintyReplay', { from: Math.max(analysis.climate.from, 2015), to: analysis.climate.to });
  return (
    <div className="slab flex flex-col p-5 lg:col-span-2 2xl:col-span-1">
      <h3 className="eyebrow relative">{t('charts.uncertainty')}</h3>
      <p className="relative mb-4 mt-1 text-[11px] leading-snug text-slate">{sub}</p>
      <div className="flex flex-col gap-6 md:flex-row 2xl:flex-col">
        <RangeGroup title={t('charts.peopleFed')} unit={t('charts.peopleUnit')} bands={people} names={names} digits={1} />
        {water && <RangeGroup title={t('charts.water')} unit="m³/ha/yr" bands={water} names={names} digits={0} />}
      </div>
    </div>
  );
}

export function Charts({ analysis, mc }: { analysis: Analysis | null; mc: McSummary | null }) {
  const { t } = useTranslation();
  const names = useMemo(() => Object.fromEntries(ROTATION_IDS.map((id) => [id, t(`rotations.${id}`)])) as Record<RotationId, string>, [t]);

  const data = useMemo(() => {
    if (!analysis) return null;
    const years = analysis.results.baseline.years.map((y) => y.year);
    const soil: Row[] = [{ year: years[0] - 1, baseline: 0, waterSaving: 0, regenerative: 0 }];
    const water: Row[] = [];
    const cum: Record<RotationId, number> = { baseline: 0, waterSaving: 0, regenerative: 0 };
    const rainfed = analysis.irrigation === 'rainfed';
    years.forEach((year, i) => {
      const s: Row = { year };
      const w: Row = { year };
      for (const id of ROTATION_IDS) {
        const y = analysis.results[id].years[i];
        cum[id] += y.nFixedKg - y.nRemovedKg;
        s[id] = Math.round(cum[id]);
        w[id] = Math.round(rainfed ? y.unmetM3 : y.grossIrrigationM3);
      }
      soil.push(s);
      water.push(w);
    });
    return { soil, water, rainfed, from: years[0], to: years[years.length - 1] };
  }, [analysis]);

  if (!analysis || !data) {
    return (
      <section className="space-y-4">
        <SectionTitle>{t('charts.title')}</SectionTitle>
        <div className="slab flex h-40 items-center justify-center p-5"><Astrolabe size={46} label={t('charts.waiting')} /></div>
      </section>
    );
  }
  const eff = analysis.irrigation === 'drip' ? IRRIGATION_EFFICIENCY.drip.value : IRRIGATION_EFFICIENCY.canal.value;
  return (
    <section className="space-y-4">
      <SectionTitle>{t('charts.title')}</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <LinePanel title={t('charts.soilN')} sub={t('charts.soilNSub', { from: data.from, to: data.to })} rows={data.soil} unit="kg N/ha" names={names} zeroLine />
        <LinePanel
          title={data.rainfed ? t('charts.waterRainfed') : t('charts.water')}
          sub={data.rainfed ? t('charts.waterRainfedSub') : t('charts.waterSub', { eff: eff.toFixed(2) })}
          rows={data.water} unit="m³/ha" names={names} mean
        />
        <RangePanel analysis={analysis} mc={mc} names={names} />
      </div>
    </section>
  );
}
