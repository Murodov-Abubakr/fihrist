import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state';
import { Icon, Icons, type IconName } from './icons';
import { OrbitDecor } from './OrbitDecor';
import { CountUp } from './CountUp';
import type { Analysis } from '../data/useRotations';
import type { RotationId, RotationResult } from '../engine/rotation';
import type { PriorityKey } from '../engine/ranking';
import type { Param } from '../engine/params';

export type { RotationId };
type Crop = 'wheat' | 'cotton' | 'chickpea' | 'sorghum' | 'mung' | 'cover';

/** Ring accent per rotation (outer ring of each crop node). */
const ACCENT: Record<RotationId, string> = { baseline: '#A3A9B1', waterSaving: '#6FD6BF', regenerative: '#E8B391' };
const FALLBACK_SEQ: Record<RotationId, Crop[]> = { baseline: ['wheat', 'wheat', 'wheat'], waterSaving: ['wheat', 'chickpea', 'sorghum'], regenerative: ['wheat', 'mung', 'cover'] };
const SECTIONS = ['why', 'evidence', 'benefits', 'gaps', 'risks'] as const;
const SECTION_ICON: Record<(typeof SECTIONS)[number], IconName> = { why: 'spark', evidence: 'satellite', benefits: 'trend', gaps: 'gap', risks: 'alert' };
const SUMMER: Crop[] = ['sorghum', 'mung', 'cotton'];
const LEGUMES: Crop[] = ['chickpea', 'mung'];
const PRIORITIES: PriorityKey[] = ['water', 'nitrogen', 'erosion', 'organic', 'forage', 'income'];

/** Rotation as an unlocked skill-tree path: white glowing nodes joined by a glowing line. */
function CropChain({ crops, accent, big }: { crops: Crop[]; accent: string; big: boolean }) {
  const { t } = useTranslation();
  const node = big ? 54 : 46;
  return (
    <ol className="relative flex items-start justify-between">
      <span aria-hidden className="absolute left-[16%] right-[16%] h-[2px] rounded-full"
        style={{ top: node / 2 - 1, background: '#F2EFEA', boxShadow: '0 0 6px rgba(255,255,255,.8), 0 0 16px rgba(255,255,255,.35)' }} />
      {crops.map((c, i) => (
        <li key={i} className="relative z-10 flex w-1/3 flex-col items-center text-center">
          <span className="flex items-center justify-center rounded-full"
            style={{ width: node, height: node, background: '#F2EFEA', color: '#17191C', boxShadow: `0 0 0 3px #1E2126, 0 0 0 4.5px ${accent}, 0 0 14px rgba(255,255,255,.55), 0 0 30px -4px ${accent}` }}>
            <Icon name={c} size={big ? 28 : 24} strokeWidth={1.7} />
          </span>
          <span className="mt-3 font-display text-[10px] font-medium uppercase tracking-[0.22em] text-slate">{t('card.year', { n: i + 1 })}</span>
          <span className="mt-0.5 text-xs font-medium leading-tight text-parchment">{t(`crops.${c}`)}</span>
        </li>
      ))}
    </ol>
  );
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((Math.abs(a - b) / b) * 100) : 0);
const sign = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: d })}`;
const waterOf = (r: RotationResult, rainfed: boolean) => (rainfed ? r.mean.unmetM3 : r.mean.grossIrrigationM3);

function Section({ id, open, onToggle, children }: { id: (typeof SECTIONS)[number]; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mx-3">
      <button onClick={onToggle} aria-expanded={open}
        className={`group flex w-full items-center gap-3 rounded-full px-3 py-2 text-left transition-all ${open ? 'bg-pill text-ink shadow-select' : 'text-parchment hover:bg-white/[0.06]'}`}>
        <span className={open ? 'text-ink' : 'text-brass-glow'}><Icon name={SECTION_ICON[id]} size={15} /></span>
        <span className="flex-1 font-display text-[12px] font-medium uppercase tracking-[0.16em]">{t(`card.${id}`)}</span>
        <Icons.chevron size={13} className={`transition-transform ${open ? 'rotate-90 text-ink' : 'text-slate'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-2 px-3 pb-3 pl-10 pt-2 text-[13px] leading-relaxed text-parchment/90">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RotationCard({ id, index, total, analysis }: { id: RotationId; index: number; total: number; analysis: Analysis | null }) {
  const { t, i18n } = useTranslation();
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const sci = state.mode === 'scientist';
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'ru-RU';
  const r = analysis?.results[id];
  const b = analysis?.results.baseline;
  const rk = analysis?.ranked[id];
  const rank = rk?.rank ?? index + 1;
  const rainfed = analysis?.irrigation === 'rainfed';
  const seq = (r?.def.display as Crop[] | undefined) ?? FALLBACK_SEQ[id];
  const toggle = (s: string) => setOpen(open === s ? null : s);

  // ---- section content (only when results exist) ----
  let body: Record<(typeof SECTIONS)[number], React.ReactNode> | null = null;
  if (analysis && r && b) {
    const c = analysis.climate;
    const n = r.years.length;
    const etcYr = r.seasons.reduce((t2, s) => t2 + s.etc, 0) / n;
    const peffYr = r.seasons.reduce((t2, s) => t2 + (rainfed ? s.eta : s.etc - s.netIrrigation), 0) / n;
    const crops = [...new Set(r.def.plantings.map((p) => p.crop))] as Crop[];
    const newCrops = crops.filter((x) => x !== 'cover' && !b.def.plantings.some((p) => p.crop === x));
    const cropNames = newCrops.map((x) => t(`crops.${x}`)).join(', ');
    const flagged = [...new Map(r.paramsUsed.filter((p) => p.quality !== 'sourced').map((p) => [p.source, p])).values()] as Param[];
    const isBase = id === 'baseline';
    const wR = waterOf(r, rainfed);
    const wB = waterOf(b, rainfed);

    const deltas: { k: string; v: string; good: boolean | null }[] = [
      { k: 'water', v: `${sign(wR - wB)} m³`, good: wR === wB ? null : wR < wB },
      { k: 'food', v: sign(r.peopleFedP.p50 - b.peopleFedP.p50, 1), good: r.peopleFedP.p50 === b.peopleFedP.p50 ? null : r.peopleFedP.p50 > b.peopleFedP.p50 },
      { k: 'nitrogen', v: `${sign(r.mean.nFixedKg - r.mean.nRemovedKg - (b.mean.nFixedKg - b.mean.nRemovedKg))} kg`, good: null },
      { k: 'profit', v: `${sign(r.mean.trueProfitUsd - b.mean.trueProfitUsd)} $`, good: r.mean.trueProfitUsd === b.mean.trueProfitUsd ? null : r.mean.trueProfitUsd > b.mean.trueProfitUsd },
      { k: 'erosion', v: `${sign(r.mean.bareRainMm - b.mean.bareRainMm)} mm`, good: r.mean.bareRainMm === b.mean.bareRainMm ? null : r.mean.bareRainMm < b.mean.bareRainMm },
    ];
    const nDelta = r.mean.nFixedKg - r.mean.nRemovedKg - (b.mean.nFixedKg - b.mean.nRemovedKg);
    deltas[2].good = Math.abs(nDelta) < 0.5 ? null : nDelta > 0;

    body = {
      why: (
        <>
          <p>{t(`why.${id}`)}</p>
          {!isBase && <p>{t(wR <= wB ? 'why.lessWater' : 'why.moreWater', { pct: pct(wR, wB) })}</p>}
          {!isBase && r.peopleFedP.p50 !== b.peopleFedP.p50 && <p>{t(r.peopleFedP.p50 > b.peopleFedP.p50 ? 'why.moreFood' : 'why.lessFood', { pct: pct(r.peopleFedP.p50, b.peopleFedP.p50) })}</p>}
          {crops.includes('cotton') && <p className="text-slate">{t('card.notFood')}</p>}
        </>
      ),
      evidence: (
        <>
          <p>{t('evidence.climate', { from: c.from, to: c.to, et0: Math.round(c.et0), rain: Math.round(c.rain), tmax: c.julyTmax.toFixed(1), frost: Math.round(c.frostDays) })}</p>
          <p>{t('evidence.season', { etc: Math.round(etcYr), peff: Math.round(peffYr) })}</p>
          <p className="text-xs text-slate">{t('evidence.sources')}</p>
        </>
      ),
      benefits: (
        <>
          {isBase ? <p className="text-slate">{t('card.reference')}</p> : <p className="text-xs uppercase tracking-[0.14em] text-slate">{t('card.vsCurrent')} ({t('card.perYr')})</p>}
          {!isBase && (
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              {deltas.map((d) => (
                <div key={d.k} className="contents">
                  <dt className="text-slate">{t(`benefit.${d.k}`)}</dt>
                  <dd className={`num text-right ${d.good === null ? 'text-parchment' : d.good ? 'text-verdigris-light' : 'text-terracotta-light'}`}>{d.v}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="num text-xs text-parchment">
            {t('card.year1')}: {Math.round(r.years[0].trueProfitUsd).toLocaleString(locale)} $ · {t('card.avg10')}: {Math.round(r.mean.trueProfitUsd).toLocaleString(locale)} $
          </p>
          <p className="text-xs text-slate">{t('benefit.profitNote')}</p>
        </>
      ),
      gaps: (
        <ul className="list-disc space-y-1 pl-4 marker:text-brass">
          <li>{t('gap.grid', { elev: Math.round(c.elevation) })}</li>
          <li>{t('gap.rainDoubt')}</li>
          {rainfed && <li>{t('gap.soil')}</li>}
          <li>{t('gap.nLoss')}</li>
          <li>{t('gap.prices')}</li>
          {crops.includes('wheat') && <li>{t('gap.dormancy')}</li>}
          {analysis.outOfRegion && <li>{t('gap.region')}</li>}
          {flagged.length > 0 && (
            <li>
              {t('gap.params', { n: flagged.length })}
              <ul className="mt-1 space-y-0.5 pl-2 text-xs text-slate">
                {flagged.map((p) => <li key={p.source}>· {p.note ?? p.source}</li>)}
              </ul>
            </li>
          )}
        </ul>
      ),
      risks: (
        <ul className="list-disc space-y-1 pl-4 marker:text-terracotta">
          {newCrops.length > 0 && <li>{t('risk.seed', { crops: cropNames })}</li>}
          {newCrops.length > 0 && <li>{t('risk.market', { crops: cropNames })}</li>}
          {crops.some((x) => LEGUMES.includes(x)) && <li>{t('risk.machinery')}</li>}
          {!rainfed && crops.some((x) => SUMMER.includes(x)) && <li>{t('risk.water')}</li>}
          {newCrops.length > 0 && <li>{t('risk.pests')}</li>}
          {rainfed && r.peopleFedP.p10 < r.peopleFedP.p50 - 0.05 && <li>{t('risk.drought', { p10: r.peopleFedP.p10.toFixed(1), p50: r.peopleFedP.p50.toFixed(1) })}</li>}
          {r.nBalance10yKg < 0 && <li>{t('risk.nDebt', { n: Math.abs(Math.round(r.nBalance10yKg)) })}</li>}
          {r.def.plantings.filter((p) => p.crop !== 'cover').length / r.def.cycleYears > 1 && <li>{t('risk.labour')}</li>}
        </ul>
      ),
    };
  }

  const metrics = r
    ? [
        { key: rainfed ? 'waterRain' : 'waterIrr', v: waterOf(r, !!rainfed), d: 0, unit: 'm³/ha' },
        { key: 'peopleFed', v: r.peopleFedP.p50, d: 1, unit: `P10 ${r.peopleFedP.p10.toFixed(1)} · P90 ${r.peopleFedP.p90.toFixed(1)}`, wide: true },
        { key: 'nBalance', v: r.mean.nFixedKg - r.mean.nRemovedKg, d: 0, unit: 'kg N/ha' },
        { key: 'protein', v: r.mean.proteinKg, d: 0, unit: 'kg/ha' },
        { key: 'trueProfit', v: r.mean.trueProfitUsd, d: 0, unit: 'USD/ha' },
      ]
    : null;

  return (
    <motion.article layout="position" className="flex flex-col"
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 * index, duration: 0.45, ease: 'easeOut', layout: { duration: 0.5 } }}>
      <h2 className="title-caps mb-3 flex min-h-[2.3em] items-end text-xl leading-[1.1] sm:text-[22px]">{t(`rotations.${id}`)}</h2>

      <div className="slab flex flex-1 flex-col">
        <span className="num absolute -left-3 top-4 z-20 rounded-full border border-brass/70 bg-ink/90 px-3 py-1 text-[13px] tracking-[0.18em] text-parchment" aria-label={`${t('card.rank')} ${rank} / ${total}`}>
          {String(rank).padStart(2, '0')} <span className="text-slate">/</span> {String(total).padStart(2, '0')}
        </span>

        <div className="relative overflow-hidden px-4 pb-5 pt-14" style={{ borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
          <OrbitDecor variant={index} />
          <div className="relative"><CropChain crops={seq} accent={ACCENT[id]} big={!sci} /></div>
        </div>

        <div className="node-rule mx-5" />

        {!r ? (
          <p className="px-5 py-4 text-[15px] leading-relaxed text-slate">{t('card.loadingSim')}</p>
        ) : sci ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4">
            {metrics!.map((m) => (
              <div key={m.key} className={m.wide ? 'col-span-2' : ''}>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-slate">{t(`card.${m.key}`)} {t('card.perYr')}</dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="num text-lg text-parchment"><CountUp value={m.v} decimals={m.d} locale={locale} /></span>
                  <span className="num text-[10px] text-slate">{m.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-end gap-6">
              <div>
                <div className="num text-3xl leading-none text-parchment"><CountUp value={r.peopleFedP.p50} decimals={0} locale={locale} /></div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate">{t('card.peopleFed')}</div>
              </div>
              <div>
                <div className="num text-3xl leading-none text-parchment"><CountUp value={waterOf(r, !!rainfed)} decimals={0} locale={locale} /></div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate">m³ {t(rainfed ? 'card.waterRain' : 'card.waterIrr')}</div>
              </div>
            </div>
            <p className="text-[14px] leading-relaxed text-parchment/90">
              {t(rainfed ? 'card.farmerRain' : 'card.farmerIrr', { people: Math.round(r.peopleFedP.p50), water: Math.round(waterOf(r, !!rainfed)).toLocaleString(locale) })}
            </p>
          </div>
        )}

        {sci && rk && (
          <div className="mx-5 mb-3 rounded-md border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-slate">{t('card.scoreTitle')} · <span className="num text-parchment">{(rk.score * 100).toFixed(0)}</span></div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
              {PRIORITIES.map((k) => (
                <div key={k} title={`${t(`rank.${k}`)}: ${rk.parts[k].value.toFixed(0)}`}>
                  <div className="flex justify-between text-[10px] text-slate"><span>{t(`rank.${k}`)}</span><span className="num">{state.priorities[k]}</span></div>
                  <div className="mt-0.5 h-1 rounded-full bg-black/50"><div className="h-1 rounded-full bg-brass" style={{ width: `${rk.parts[k].scaled * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pb-3">
          {SECTIONS.map((s) => (
            <Section key={s} id={s} open={open === s} onToggle={() => toggle(s)}>
              {body ? body[s] : <p className="text-xs text-slate">{t('card.placeholder')}</p>}
            </Section>
          ))}
        </div>
      </div>
    </motion.article>
  );
}
