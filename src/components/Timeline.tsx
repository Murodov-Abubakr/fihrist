import { useTranslation } from 'react-i18next';
import { Astrolabe } from './Astrolabe';
import { OrbitDecor } from './OrbitDecor';
import { SectionTitle } from './SectionTitle';

/** Placeholder shell: month track + legend, no data until step 5 (no invented values). */
export function Timeline() {
  const { t } = useTranslation();
  const months = t('months', { returnObjects: true }) as string[];
  const legend = [
    { k: 'canopy', c: '#6FD6BF' },
    { k: 'bare', c: '#B98A5C' },
    { k: 'heat', c: '#F08C74' },
    { k: 'frost', c: '#9CC2F2' },
    { k: 'compound', c: '#E8B391' },
  ];
  return (
    <section className="space-y-4">
      <SectionTitle>{t('timeline.title')}</SectionTitle>
      <div className="slab p-5">
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-slate">
          {legend.map((l) => (
            <li key={l.k} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.c, boxShadow: `0 0 6px ${l.c}` }} />
              {t(`timeline.${l.k}`)}
            </li>
          ))}
        </ul>
        <div className="overflow-x-auto">
          <div className="relative min-w-[560px]">
            <div className="grid grid-cols-12 gap-1.5">
              {months.map((m) => (
                <div key={m} className="flex flex-col items-center">
                  <div className="h-[60px] w-full rounded-sm border border-white/10 bg-black/25" />
                  <div className="mt-2 font-display text-[10px] uppercase tracking-[0.18em] text-slate">{m}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate">{t('timeline.placeholder')}</p>
      </div>
    </section>
  );
}

export function ChartsShell() {
  const { t } = useTranslation();
  return (
    <section className="space-y-4">
      <SectionTitle>{t('charts.title')}</SectionTitle>
      <div className="grid gap-5 md:grid-cols-3">
        {(['soilN', 'water', 'uncertainty'] as const).map((k, i) => (
          <div key={k} className="slab flex h-56 flex-col overflow-hidden p-5">
            <OrbitDecor variant={i + 1} />
            <h3 className="eyebrow relative">{t(`charts.${k}`)}</h3>
            <div className="relative flex flex-1 items-center justify-center">
              <Astrolabe size={46} label={t('charts.placeholder')} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
