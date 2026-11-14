import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state';
import { Icon, Icons, type IconName } from './icons';
import { OrbitDecor } from './OrbitDecor';

export type RotationId = 'baseline' | 'waterSaving' | 'regenerative';
type Crop = 'wheat' | 'cotton' | 'chickpea' | 'sorghum' | 'mung' | 'cover';

/** Ring accent per rotation (outer ring of each crop node). */
const ACCENT: Record<RotationId, string> = {
  baseline: '#A3A9B1',
  waterSaving: '#6FD6BF',
  regenerative: '#E8B391',
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

/** Rotation as an unlocked skill-tree path: white glowing nodes joined by a glowing line. */
function CropChain({ crops, accent, big }: { crops: Crop[]; accent: string; big: boolean }) {
  const { t } = useTranslation();
  const node = big ? 54 : 46;
  return (
    <ol className="relative flex items-start justify-between">
      <span
        aria-hidden
        className="absolute left-[16%] right-[16%] h-[2px] rounded-full"
        style={{ top: node / 2 - 1, background: '#F2EFEA', boxShadow: '0 0 6px rgba(255,255,255,.8), 0 0 16px rgba(255,255,255,.35)' }}
      />
      {crops.map((c, i) => (
        <li key={i} className="relative z-10 flex w-1/3 flex-col items-center text-center">
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              width: node, height: node,
              background: '#F2EFEA',
              color: '#17191C',
              boxShadow: `0 0 0 3px #1E2126, 0 0 0 4.5px ${accent}, 0 0 14px rgba(255,255,255,.55), 0 0 30px -4px ${accent}`,
            }}
          >
            <Icon name={c} size={big ? 28 : 24} strokeWidth={1.7} />
          </span>
          <span className="mt-3 font-display text-[10px] font-medium uppercase tracking-[0.22em] text-slate">{t('card.year', { n: i + 1 })}</span>
          <span className="mt-0.5 text-xs font-medium leading-tight text-parchment">{t(`crops.${c}`)}</span>
        </li>
      ))}
    </ol>
  );
}

export function RotationCard({ id, rank, total, index }: { id: RotationId; rank: number; total: number; index: number }) {
  const { t } = useTranslation();
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const sci = state.mode === 'scientist';

  return (
    <motion.article
      className="flex flex-col"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 * index, duration: 0.45, ease: 'easeOut' }}
    >
      {/* two-line slot keeps the three cards aligned when a translation wraps */}
      <h2 className="title-caps mb-3 flex min-h-[2.3em] items-end text-xl leading-[1.1] sm:text-[22px]">{t(`rotations.${id}`)}</h2>

      <div className="slab flex flex-1 flex-col">
        {/* counter pill overlapping the top-left edge */}
        <span
          className="num absolute -left-3 top-4 z-20 rounded-full border border-brass/70 bg-ink/90 px-3 py-1 text-[13px] tracking-[0.18em] text-parchment"
          aria-label={`${t('card.rank')} ${rank} / ${total}`}
        >
          {String(rank).padStart(2, '0')} <span className="text-slate">/</span> {String(total).padStart(2, '0')}
        </span>

        <div className="relative overflow-hidden px-4 pb-5 pt-14" style={{ borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
          <OrbitDecor variant={index} />
          <div className="relative">
            <CropChain crops={sequence(id, state.rotation)} accent={ACCENT[id]} big={!sci} />
          </div>
        </div>

        <div className="node-rule mx-5" />

        {sci ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4">
            {METRICS.map((m) => (
              <div key={m.key} className={m.key === 'peopleFed' ? 'col-span-2' : ''}>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-slate">{t(`card.${m.key}`)}</dt>
                <dd className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="num text-lg text-parchment/40">—</span>
                  <span className="num text-[10px] text-slate">{m.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-5 py-4 text-[15px] leading-relaxed text-parchment">{t('card.farmerPlaceholder')}</p>
        )}

        <div className="mt-auto pb-3">
          {SECTIONS.map((s) => {
            const isOpen = open === s;
            return (
              <div key={s} className="mx-3">
                <button
                  onClick={() => setOpen(isOpen ? null : s)}
                  aria-expanded={isOpen}
                  className={`group flex w-full items-center gap-3 rounded-full px-3 py-2 text-left transition-all ${
                    isOpen ? 'bg-pill text-ink shadow-select' : 'text-parchment hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={isOpen ? 'text-ink' : 'text-brass-glow'}><Icon name={SECTION_ICON[s]} size={15} /></span>
                  <span className="flex-1 font-display text-[12px] font-medium uppercase tracking-[0.16em]">{t(`card.${s}`)}</span>
                  <Icons.chevron size={13} className={`transition-transform ${isOpen ? 'rotate-90 text-ink' : 'text-slate'}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-3 pl-10 text-xs text-slate"
                    >
                      <span className="block py-2.5">{t('card.placeholder')}</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </motion.article>
  );
}
