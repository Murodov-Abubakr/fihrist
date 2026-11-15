import { useTranslation } from 'react-i18next';
import type { Analysis } from '../data/useRotations';
import { ROTATION_IDS } from '../data/useRotations';
import { ROTATION_COLOR } from '../lib/palette';
import { useStore } from '../state';

const fmt = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/** Whole-field totals = per-hectare replay means × the outlined area (shown only when a field was outlined). */
export function FieldTotals({ analysis }: { analysis: Analysis | null }) {
  const { t } = useTranslation();
  const { state, set } = useStore();
  const f = state.field;
  if (!f || !analysis) return null;
  const rainfed = analysis.irrigation === 'rainfed';
  const ha = f.areaHa;
  return (
    <section className="slab relative z-10 p-4 sm:p-5" aria-label={t('field.title', { ha: fmt(ha, ha < 10 ? 2 : 1) })}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="title-caps text-base">{t('field.title', { ha: fmt(ha, ha < 10 ? 2 : 1) })}</h2>
        <button className="chip !px-3 !py-0.5 text-[11px]" onClick={() => set({ field: null })}>{t('field.clear')}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="num w-full min-w-[420px] text-right text-[12.5px]">
          <thead className="text-[10.5px] uppercase tracking-[0.12em] text-slate">
            <tr>
              <th className="text-left font-normal" />
              <th className="font-normal">{rainfed ? t('field.waterRainfed') : t('field.water')} (m³)</th>
              <th className="font-normal">{t('field.people')}</th>
              <th className="font-normal">{t('field.profit')} (USD)</th>
            </tr>
          </thead>
          <tbody>
            {ROTATION_IDS.map((id) => {
              const m = analysis.results[id].mean;
              const water = (rainfed ? m.unmetM3 : m.grossIrrigationM3) * ha;
              return (
                <tr key={id} className="border-t border-white/5 text-parchment">
                  <td className="py-1.5 text-left font-sans">
                    <span className="flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ROTATION_COLOR[id] }} />{t(`rotations.${id}`)}</span>
                  </td>
                  <td>{fmt(water)}</td>
                  <td>{fmt(m.peopleFed * ha, ha < 10 ? 1 : 0)}</td>
                  <td>{fmt(m.trueProfitUsd * ha)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate">{t('field.perYear')} · {t('field.note')}</p>
    </section>
  );
}
