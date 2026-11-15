import { useTranslation } from 'react-i18next';
import type { Analysis } from '../data/useRotations';
import { ROTATION_IDS } from '../data/useRotations';
import { HOT_DAY_C } from '../engine/stress';
import type { MonthCover } from '../engine/rotation';
import { ROTATION_COLOR } from '../lib/palette';
import { Astrolabe } from './Astrolabe';
import { SectionTitle } from './SectionTitle';

const HOT = '#F08C74';
const FROST = '#9CC2F2';
const COMPOUND = '#E8B391';
const BARE = '#B98A5C';
const SOIL = '#C8A27A';
const VEG = '#6FD6BF';

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

const GRID = 'grid grid-cols-[minmax(10rem,12rem)_repeat(12,minmax(0,1fr))] items-center gap-1';

/** 12-month field calendar per rotation (living crop vs bare soil) plus hot, frost and heat + dry months. */
export function Timeline({ analysis }: { analysis: Analysis | null }) {
  const { t } = useTranslation();
  const months = t('months', { returnObjects: true }) as string[];

  const legend = [
    { k: 'living', swatch: { background: rgba('#A3A9B1', 0.7) } },
    { k: 'bare', swatch: { border: `1px dashed ${BARE}` } },
    { k: 'hot', swatch: { background: HOT } },
    { k: 'frost', swatch: { background: FROST } },
    { k: 'compound', swatch: { background: COMPOUND } },
  ];

  if (!analysis) {
    return (
      <section className="space-y-4">
        <SectionTitle>{t('timeline.title')}</SectionTitle>
        <div className="slab flex h-40 items-center justify-center p-5"><Astrolabe size={46} label={t('timeline.waiting')} /></div>
      </section>
    );
  }

  const { from, to } = analysis.climate;
  const st = analysis.stress;
  const cropText = (c: MonthCover) => c.crops.filter((x) => x.share >= 0.25).slice(0, 2).map((x) => t(`cropShort.${x.crop}`)).join(' / ');
  const cellTitle = (m: number, c: MonthCover) =>
    `${months[m]}: ${t('timeline.cellLive', { share: Math.round(c.live * 100) })}` +
    (c.crops.length ? ` (${c.crops.map((x) => `${t(`crops.${x.crop === 'cover' ? 'cover' : x.crop}`)} ${Math.round(x.share * 100)}%`).join(', ')})` : '');

  return (
    <section className="space-y-4">
      <SectionTitle>{t('timeline.title')}</SectionTitle>
      <div className="slab space-y-4 p-5">
        <p className="text-xs leading-relaxed text-slate">{t('timeline.subtitle', { from: Math.max(from, 2015), to })}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-slate">
          {legend.map((l) => (
            <li key={l.k} className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2.5 w-3.5 rounded-sm" style={l.swatch} />
              {t(`timeline.${l.k}`, { t: HOT_DAY_C })}
            </li>
          ))}
        </ul>

        <div className="overflow-x-auto">
          <div className="min-w-[720px] space-y-1" role="table" aria-label={t('timeline.title')}>
            <div className={GRID} role="row">
              <span role="columnheader" />
              {months.map((m) => <span key={m} role="columnheader" className="text-center font-display text-[10px] uppercase tracking-[0.18em] text-slate">{m}</span>)}
            </div>

            {ROTATION_IDS.map((id) => {
              const r = analysis.results[id];
              const color = ROTATION_COLOR[id];
              return r.calendar.map((row, cy) => (
                <div key={`${id}-${cy}`} className={GRID} role="row">
                  <span role="rowheader" className="flex items-center gap-2 truncate pr-2 text-xs text-parchment">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate">{cy === 0 ? t(`rotations.${id}`) : ''}</span>
                    {r.calendar.length > 1 && <span className="ml-auto shrink-0 text-[10px] text-slate">{t('timeline.cycleYear', { n: cy + 1 })}</span>}
                  </span>
                  {row.map((c, m) => {
                    const live = c.live >= 0.05;
                    return (
                      <div key={m} role="cell" title={cellTitle(m, c)} aria-label={cellTitle(m, c)}
                        className="flex h-9 items-center justify-center overflow-hidden rounded-sm px-0.5 text-center text-[9.5px] leading-tight text-parchment"
                        style={live ? { background: rgba(color, 0.25 + 0.6 * c.live) } : { border: `1px dashed ${rgba(BARE, 0.7)}` }}>
                        {live ? cropText(c) : ''}
                      </div>
                    );
                  })}
                </div>
              ));
            })}

            <div className="node-rule !my-3" aria-hidden />

            {([
              ['hot', HOT, (m: (typeof st.months)[number]) => m.hotDays, (v: number) => v / 31, (v: number) => (v >= 0.5 ? v.toFixed(0) : '')],
              ['frost', FROST, (m: (typeof st.months)[number]) => m.frostDays, (v: number) => v / 31, (v: number) => (v >= 0.5 ? v.toFixed(0) : '')],
            ] as const).map(([k, color, get, alpha, fmt]) => (
              <div key={k} className={GRID} role="row">
                <span role="rowheader" className="truncate pr-2 text-xs text-parchment">{t(`timeline.${k}`, { t: HOT_DAY_C })}</span>
                {st.months.map((m) => {
                  const v = get(m);
                  return (
                    <div key={m.month} role="cell" title={`${months[m.month - 1]}: ${v.toFixed(1)}`}
                      className="num flex h-7 items-center justify-center rounded-sm text-[10.5px] text-parchment"
                      style={{ background: v >= 0.5 ? rgba(color, 0.15 + 0.7 * alpha(v)) : 'rgba(0,0,0,.25)' }}>{fmt(v)}</div>
                  );
                })}
              </div>
            ))}
            {/* satellite signals (presets): share of years in which the month was abnormal (z > 1) */}
            {(['soil', 'veg'] as const).filter((sig) => st.signalsUsed.includes(sig)).map((sig) => (
              <div key={sig} className={GRID} role="row">
                <span role="rowheader" className="truncate pr-2 text-xs text-parchment">{t(`timeline.sig.${sig}`)}</span>
                {st.months.map((m) => {
                  const v = m.share[sig];
                  return (
                    <div key={m.month} role="cell" title={`${months[m.month - 1]}: ${v === null ? '–' : `${Math.round(v * 100)}%`}`}
                      className="num flex h-7 items-center justify-center rounded-sm text-[10.5px] text-parchment"
                      style={{ background: v ? rgba(sig === 'soil' ? SOIL : VEG, 0.15 + 2.5 * v) : 'rgba(0,0,0,.25)' }}>
                      {v === null ? '–' : v > 0 ? `${Math.round(v * 100)}%` : ''}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className={GRID} role="row">
              <span role="rowheader" className="truncate pr-2 text-xs text-parchment">{t(st.signalsUsed.length === 4 ? 'timeline.compound4' : 'timeline.compound')}</span>
              {st.months.map((m) => (
                <div key={m.month} role="cell"
                  title={`${months[m.month - 1]}: ${m.compoundShare === null ? '–' : `${Math.round(m.compoundShare * 100)}%`}`}
                  className="num flex h-7 items-center justify-center rounded-sm text-[10.5px] text-parchment"
                  style={{ background: m.compoundShare ? rgba(COMPOUND, 0.15 + 2.5 * m.compoundShare) : 'rgba(0,0,0,.25)' }}>
                  {m.compoundShare === null ? '–' : m.compoundShare > 0 ? `${Math.round(m.compoundShare * 100)}%` : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-slate">
          {st.signalsUsed.length === 4 ? t('timeline.compoundNote4', { from, to }) : t('timeline.compoundNote', { from, to })}
        </p>
        {analysis.sat?.layers.slope && (
          <p className="text-[11px] text-slate">{t('timeline.terrain', { slope: analysis.sat.layers.slope.meanSlopeDeg.toFixed(1), max: analysis.sat.layers.slope.maxSlopeDeg.toFixed(1), elev: analysis.sat.layers.slope.elevationM })}</p>
        )}
        {analysis.sat?.layers.ndvi && (
          <p className="text-[11px] text-slate">{t('timeline.ndviSource', { share: Math.round(analysis.sat.layers.ndvi.croplandShare * 100), km: analysis.sat.layers.ndvi.radiusKm })}</p>
        )}
        <div>
          <h3 className="eyebrow mb-2">{t('timeline.events')}</h3>
          {st.events.length ? (
            <ul className="space-y-1 text-xs text-parchment">
              {st.events.slice(0, 4).map((e) => (
                <li key={`${e.year}-${e.month}`} className="num flex items-center gap-2">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: COMPOUND }} />
                  {t('timeline.eventLine', { month: months[e.month - 1], year: e.year, t: e.tmax.toFixed(1), tn: e.tmaxNormal.toFixed(1), r: e.rain.toFixed(0), rn: e.rainNormal.toFixed(0) })}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-slate">{t('timeline.none')}</p>}
        </div>

        {/* Fihrist decoupling detector: what no single dataset shows */}
        {st.signalsUsed.includes('veg') && (
          <div className="rounded-lg border border-brass/40 bg-black/25 p-4">
            <h3 className="eyebrow mb-1 !text-brass-glow">{t('timeline.hidden')}</h3>
            <p className="mb-3 text-[11px] leading-snug text-slate">{t('timeline.hiddenIntro')}</p>
            {(['unexplained', 'buffered'] as const).map((kind) => {
              const list = st.decoupled.filter((d) => d.kind === kind);
              return (
                <div key={kind} className="mb-3 last:mb-0">
                  <div className="mb-1 text-xs font-medium text-parchment">{t(`timeline.${kind}`)} <span className="num text-slate">({list.length})</span></div>
                  <p className="mb-1 text-[11px] leading-snug text-slate">{t(`timeline.${kind}Hint`)}</p>
                  {list.length ? (
                    <ul className="space-y-0.5 text-xs text-parchment">
                      {list.slice(0, 4).map((d) => (
                        <li key={`${d.year}-${d.month}`} className="num">
                          {months[d.month - 1]} {d.year}: NDVI {d.ndvi?.toFixed(2)} ({t('timeline.normal')} {d.ndviNormal?.toFixed(2)})
                          {d.z.dry !== undefined ? ` · ${t('timeline.zDry')} ${d.z.dry.toFixed(1)}` : ''}
                          {d.z.soil !== undefined ? ` · ${t('timeline.zSoil')} ${d.z.soil.toFixed(1)}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-[11px] text-slate">{t('timeline.noneFound')}</p>}
                </div>
              );
            })}
          </div>
        )}
        {!st.signalsUsed.includes('veg') && <p className="text-[11px] text-slate">{t('timeline.satPresetsOnly')}</p>}
      </div>
    </section>
  );
}
