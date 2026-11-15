import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AUTUMN_CROPS, CUSTOM_MAX_YEARS, SPRING_CROPS, customDef, parseCustom,
  type AutumnCrop, type BaselineSpec, type CustomRotation, type SpringCrop,
} from '../engine/rotation';

/** The farmer's cycle expressed in the editor's terms, from whatever baseline is active. */
export function toCustom(b: BaselineSpec): CustomRotation {
  if (typeof b === 'object') return b;
  return b === 'wheatCotton'
    ? { kind: 'custom', years: [{ spring: 'cotton', autumn: 'wheat' }, { spring: null, autumn: null }] }
    : { kind: 'custom', years: [{ spring: null, autumn: 'wheat' }] };
}

/**
 * "My current rotation" editor: per year of the cycle, a spring/summer crop and an autumn/winter crop.
 * The draft is applied to the model only when the calendar is possible (no two crops in the field
 * on the same day); otherwise the clash is explained and the last valid rotation stays active.
 */
export function RotationEditor({ value, onApply }: { value: BaselineSpec; onApply: (c: CustomRotation) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CustomRotation>(() => toCustom(value));
  const result = customDef(draft);
  const ok = 'plantings' in result;

  // apply every valid change (skip the first render: the draft equals what is already active)
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) { setFirst(false); return; }
    const safe = parseCustom(draft);
    if (safe && 'plantings' in customDef(safe)) onApply(safe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setYear = (i: number, patch: Partial<{ spring: SpringCrop | null; autumn: AutumnCrop | null }>) =>
    setDraft((d) => ({ kind: 'custom', years: d.years.map((y, j) => (j === i ? { ...y, ...patch } : y)) }));

  const cropName = (c: string) => t(`crops.${c === 'cover' ? 'coverOnly' : c}`);
  const select = 'w-full rounded-md border border-white/15 bg-[#17191C] px-2 py-1.5 text-xs text-parchment focus:border-white focus:outline-none';

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-3">
      {draft.years.map((y, i) => (
        <fieldset key={i} className="space-y-1.5">
          <legend className="mb-1 flex w-full items-center justify-between text-[11px] uppercase tracking-[0.14em] text-slate">
            {t('editor.year', { n: i + 1 })}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] text-slate">
              <span>{t('editor.spring')}</span>
              <select className={select} value={y.spring ?? ''} onChange={(e) => setYear(i, { spring: (e.target.value || null) as SpringCrop | null })}>
                <option value="">{t('editor.none')}</option>
                {SPRING_CROPS.map((c) => <option key={c} value={c}>{cropName(c)}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[11px] text-slate">
              <span>{t('editor.autumn')}</span>
              <select className={select} value={y.autumn ?? ''} onChange={(e) => setYear(i, { autumn: (e.target.value || null) as AutumnCrop | null })}>
                <option value="">{t('editor.none')}</option>
                {AUTUMN_CROPS.map((c) => <option key={c} value={c}>{cropName(c)}</option>)}
              </select>
            </label>
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <button className="chip !px-3 !py-1 text-xs" disabled={draft.years.length >= CUSTOM_MAX_YEARS}
          onClick={() => setDraft((d) => ({ kind: 'custom', years: [...d.years, { spring: null, autumn: null }] }))}>{t('editor.addYear')}</button>
        <button className="chip !px-3 !py-1 text-xs" disabled={draft.years.length <= 1}
          onClick={() => setDraft((d) => ({ kind: 'custom', years: d.years.slice(0, -1) }))}>{t('editor.removeYear')}</button>
      </div>
      {ok
        ? <p className="text-[11px] text-verdigris-light" role="status">{t('editor.applied')}</p>
        : <p className="text-[11px] leading-snug text-terracotta-light" role="alert">
            {result.kind === 'empty'
              ? t('editor.empty')
              : t('editor.overlap', { a: cropName(result.first), ya: result.firstYear, b: cropName(result.second), yb: result.secondYear })}
          </p>}
      <p className="text-[11px] leading-snug text-slate">{t('editor.dates')}</p>
    </div>
  );
}
