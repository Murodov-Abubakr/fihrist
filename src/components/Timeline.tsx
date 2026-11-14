import { useTranslation } from 'react-i18next';
import { Astrolabe } from './Astrolabe';

/** Placeholder shell: month grid + legend, no data until step 5 (no invented values). */
export function Timeline() {
  const { t } = useTranslation();
  const months = t('months', { returnObjects: true }) as string[];
  const legend = [
    { k: 'canopy', c: 'bg-verdigris' },
    { k: 'bare', c: 'bg-[#6B5A3E]' },
    { k: 'heat', c: 'bg-terracotta' },
    { k: 'frost', c: 'bg-[#7FA7D9]' },
    { k: 'compound', c: 'bg-brass' },
  ];
  return (
    <section className="ledger p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl">{t('timeline.title')}</h2>
        <ul className="flex flex-wrap gap-3 text-xs text-slate">
          {legend.map((l) => (
            <li key={l.k} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${l.c}`} />
              {t(`timeline.${l.k}`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-12 gap-1">
          {months.map((m) => (
            <div key={m} className="text-center">
              <div className="h-16 rounded-sm border border-dashed border-brass/20" />
              <div className="mt-1 text-[11px] text-slate">{m}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs italic text-slate">{t('timeline.placeholder')}</p>
    </section>
  );
}

export function ChartsShell() {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="mb-3 font-display text-xl">{t('charts.title')}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {(['soilN', 'water', 'uncertainty'] as const).map((k) => (
          <div key={k} className="ledger flex h-48 flex-col p-4">
            <h3 className="eyebrow">{t(`charts.${k}`)}</h3>
            <div className="flex flex-1 items-center justify-center">
              <Astrolabe size={40} label={t('charts.placeholder')} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
