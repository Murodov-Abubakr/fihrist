import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state';

export type RotationId = 'baseline' | 'waterSaving' | 'regenerative';

const ACCENT: Record<RotationId, { bar: string; text: string; glyph: string }> = {
  baseline: { bar: 'bg-slate/60', text: 'text-slate', glyph: '🌾' },
  waterSaving: { bar: 'bg-verdigris', text: 'text-verdigris-light', glyph: '💧' },
  regenerative: { bar: 'bg-brass', text: 'text-brass', glyph: '🌱' },
};

const SEQ_KEY: Record<RotationId, string> = { baseline: 'seqBaseline', waterSaving: 'seqWater', regenerative: 'seqRegen' };
const METRICS = [
  { key: 'waterDeficit', unit: 'm³/ha' },
  { key: 'peopleFed', unit: 'P10·P50·P90' },
  { key: 'soilN', unit: 'kg N/ha' },
  { key: 'protein', unit: 'kg/ha' },
  { key: 'trueProfit', unit: 'USD/ha' },
] as const;
const SECTIONS = ['why', 'evidence', 'benefits', 'gaps', 'risks'] as const;
const SECTION_ICON: Record<(typeof SECTIONS)[number], string> = { why: '✦', evidence: '🛰', benefits: '↗', gaps: '◌', risks: '⚠' };

export function RotationCard({ id, rank, index }: { id: RotationId; rank: number; index: number }) {
  const { t } = useTranslation();
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>('why');
  const sci = state.mode === 'scientist';
  const a = ACCENT[id];
  const seq = id === 'baseline' && state.rotation === 'wheatCotton' ? t('rotations.wheatCotton') : t(`rotations.${SEQ_KEY[id]}`);

  return (
    <motion.article
      className="ledger flex flex-col overflow-hidden"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 * index, duration: 0.45, ease: 'easeOut' }}
    >
      <div className={`h-1 w-full ${a.bar}`} />
      <header className="px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <span className={`eyebrow ${a.text}`}>{t(`rotations.${id}`)}</span>
          <span className="num rounded-full border border-brass/40 px-2 py-0.5 text-[11px] text-brass">
            {t('card.rank')} {rank}
          </span>
        </div>
        <h2 className="mt-2 font-display text-lg leading-snug text-parchment">
          {!sci && <span aria-hidden className="mr-2 text-2xl">{a.glyph}</span>}
          {seq}
        </h2>
      </header>

      <div className="brass-rule mx-4" />

      {sci ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4">
          {METRICS.map((m) => (
            <div key={m.key} className={m.key === 'peopleFed' ? 'col-span-2' : ''}>
              <dt className="text-[11px] text-slate">{t(`card.${m.key}`)}</dt>
              <dd className="num text-lg text-parchment/60">
                —<span className="ml-1.5 text-[10px] text-slate">{m.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex items-center gap-3 px-4 py-5">
          <span aria-hidden className="text-4xl">{a.glyph}</span>
          <p className="text-base leading-relaxed text-parchment/90">{t('card.farmerPlaceholder')}</p>
        </div>
      )}

      <div className="mt-auto border-t border-brass/15">
        {SECTIONS.map((s) => {
          const isOpen = open === s;
          return (
            <div key={s} className="border-b border-brass/10 last:border-b-0">
              <button
                onClick={() => setOpen(isOpen ? null : s)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-panel-2/60"
              >
                <span aria-hidden className="w-4 text-center text-brass">{SECTION_ICON[s]}</span>
                <span className="flex-1 text-parchment/90">{t(`card.${s}`)}</span>
                <span aria-hidden className={`text-xs text-slate transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
              </button>
              {isOpen && <p className="px-4 pb-3 pl-10 text-xs italic text-slate">{t('card.placeholder')}</p>}
            </div>
          );
        })}
      </div>
    </motion.article>
  );
}
