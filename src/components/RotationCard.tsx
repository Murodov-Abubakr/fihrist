import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state';
import { Icon, Icons, type IconName } from './icons';

export type RotationId = 'baseline' | 'waterSaving' | 'regenerative';
type Crop = 'wheat' | 'cotton' | 'chickpea' | 'sorghum' | 'mung' | 'cover';

const ACCENT: Record<RotationId, { color: string; text: string }> = {
  baseline: { color: '#A3AAC2', text: 'text-slate' },
  waterSaving: { color: '#5FB3A1', text: 'text-verdigris-light' },
  regenerative: { color: '#C9A55A', text: 'text-brass' },
};

function sequence(id: RotationId, baseline: 'wheat' | 'wheatCotton'): Crop[] {
  if (id === 'waterSaving') return ['wheat', 'chickpea', 'sorghum'];
  if (id === 'regenerative') return ['wheat', 'mung', 'cover'];
  return baseline === 'wheatCotton' ? ['wheat', 'cotton', 'wheat'] : ['wheat', 'wheat', 'wheat'];
}

const METRICS = [
  { key: 'waterDeficit', unit: 'm³/ha' },
  { key: 'peopleFed', unit: 'P10 · P50 · P90' },
  { key: 'soilN', unit: 'kg N/ha' },
  { key: 'protein', unit: 'kg/ha' },
  { key: 'trueProfit', unit: 'USD/ha' },
] as const;
const SECTIONS = ['why', 'evidence', 'benefits', 'gaps', 'risks'] as const;
const SECTION_ICON: Record<(typeof SECTIONS)[number], IconName> = { why: 'spark', evidence: 'satellite', benefits: 'trend', gaps: 'gap', risks: 'alert' };

/** Rotation drawn as a chain of glowing nodes (one per year), like a constellation path. */
function CropChain({ crops, color, big }: { crops: Crop[]; color: string; big: boolean }) {
  const { t } = useTranslation();
  const node = big ? 52 : 44;
  return (
    <ol className="relative flex items-start justify-between px-1">
      <span aria-hidden className="absolute left-[16%] right-[16%] h-px" style={{ top: node / 2, background: `linear-gradient(90deg, ${color}99, ${color}44, ${color}99)` }} />
      {crops.map((c, i) => (
        <li key={i} className="relative z-10 flex w-1/3 flex-col items-center text-center">
          <span
            className="flex items-center justify-center rounded-full border bg-ink"
            style={{ width: node, height: node, borderColor: color, color, boxShadow: `0 0 16px -3px ${color}aa, inset 0 0 12px -6px ${color}` }}
          >
            <Icon name={c} size={big ? 26 : 22} />
          </span>
          <span className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate">{t('card.year', { n: i + 1 })}</span>
          <span className="mt-0.5 text-xs leading-tight text-parchment/90">{t(`crops.${c}`)}</span>
        </li>
      ))}
    </ol>
  );
}

export function RotationCard({ id, rank, index }: { id: RotationId; rank: number; index: number }) {
  const { t } = useTranslation();
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const sci = state.mode === 'scientist';
  const a = ACCENT[id];

  return (
    <motion.article
      className="hud flex flex-col"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 * index, duration: 0.45, ease: 'easeOut' }}
    >
      <header className="flex items-center justify-between px-4 pt-4">
        <span className={`flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.22em] ${a.text}`}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.color, boxShadow: `0 0 8px ${a.color}` }} />
          {t(`rotations.${id}`)}
        </span>
        <span
          title={`${t('card.rank')} ${rank}`}
          aria-label={`${t('card.rank')} ${rank}`}
          className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brass/60 text-xs text-brass shadow-glow-soft"
        >
          {String(rank).padStart(2, '0')}
        </span>
      </header>

      <div className="px-4 pb-4 pt-5">
        <CropChain crops={sequence(id, state.rotation)} color={a.color} big={!sci} />
      </div>

      <div className="node-rule mx-5" />

      {sci ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4">
          {METRICS.map((m) => (
            <div key={m.key} className={m.key === 'peopleFed' ? 'col-span-2' : ''}>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-slate">{t(`card.${m.key}`)}</dt>
              <dd className="mt-0.5 flex items-baseline gap-1.5">
                <span className="num text-lg text-parchment/40">—</span>
                <span className="num text-[10px] text-slate">{m.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-4 py-4 text-[15px] leading-relaxed text-parchment/90">{t('card.farmerPlaceholder')}</p>
      )}

      <div className="mt-auto border-t border-brass/10">
        {SECTIONS.map((s) => {
          const isOpen = open === s;
          return (
            <div key={s} className="border-b border-brass/[0.07] last:border-b-0">
              <button
                onClick={() => setOpen(isOpen ? null : s)}
                aria-expanded={isOpen}
                className="group flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-brass/[0.05]"
              >
                <span className="text-brass/80 group-hover:text-brass"><Icon name={SECTION_ICON[s]} size={16} /></span>
                <span className="flex-1 text-parchment/85 group-hover:text-parchment">{t(`card.${s}`)}</span>
                <Icons.chevron size={14} className={`text-slate transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden px-4 pl-11 text-xs text-slate"
                  >
                    <span className="block pb-3">{t('card.placeholder')}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.article>
  );
}
