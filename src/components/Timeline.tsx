import { useTranslation } from 'react-i18next';
import { Astrolabe } from './Astrolabe';
import { SectionTitle } from './SectionTitle';

/** Placeholder shell: month track + legend, no data until step 5 (no invented values). */
export function Timeline() {
  const { t } = useTranslation();
  const months = t('months', { returnObjects: true }) as string[];
  const legend = [
    { k: 'canopy', c: '#3E8E7E' },
    { k: 'bare', c: '#8C7440' },
    { k: 'heat', c: '#C8553D' },
    { k: 'frost', c: '#7FA7D9' },
    { k: 'compound', c: '#C9A55A' },
  ];
  return (
    <section className="hud p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>{t('timeline.title')}</SectionTitle>
        <ul className="flex flex-wrap gap-3 text-[11px] text-slate">
          {legend.map((l) => (
            <li key={l.k} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.c, boxShadow: `0 0 6px ${l.c}` }} />
              {t(`timeline.${l.k}`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto">
        <div className="relative min-w-[560px]">
          <div aria-hidden className="node-rule absolute left-2 right-2 top-[30px]" />
          <div className="grid grid-cols-12 gap-1">
            {months.map((m) => (
              <div key={m} className="flex flex-col items-center">
                <div className="h-[60px] w-full rounded-md border border-slate/10 bg-ink/30" />
                <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-slate">{m}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate">{t('timeline.placeholder')}</p>
    </section>
  );
}

export function ChartsShell() {
  const { t } = useTranslation();
  return (
    <section className="space-y-4">
      <SectionTitle>{t('charts.title')}</SectionTitle>
      <div className="grid gap-4 md:grid-cols-3">
        {(['soilN', 'water', 'uncertainty'] as const).map((k) => (
          <div key={k} className="hud flex h-52 flex-col p-4">
            <h3 className="eyebrow">{t(`charts.${k}`)}</h3>
            <div className="flex flex-1 items-center justify-center">
              <Astrolabe size={44} label={t('charts.placeholder')} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
