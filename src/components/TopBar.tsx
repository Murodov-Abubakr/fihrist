import { useTranslation } from 'react-i18next';
import { LANGS } from '../i18n';
import { useStore } from '../state';

function Wordmark() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden className="overflow-visible">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#C9A55A" strokeWidth="1" opacity="0.9" />
        <ellipse cx="18" cy="18" rx="15" ry="5.5" fill="none" stroke="#A3AAC2" strokeWidth="0.7" opacity="0.6" transform="rotate(-25 18 18)" />
        <circle cx="18" cy="18" r="4" fill="#C9A55A" style={{ filter: 'drop-shadow(0 0 4px rgba(201,165,90,.8))' }} />
        <circle cx="31.5" cy="11.7" r="1.8" fill="#5FB3A1" />
      </svg>
      <div className="leading-none">
        <div className="font-display text-lg font-semibold uppercase tracking-[0.32em] text-parchment">
          {t('app.name')}
        </div>
        <div className="mt-1 hidden text-[10px] uppercase tracking-[0.2em] text-slate sm:block">{t('app.tagline')}</div>
      </div>
    </div>
  );
}

export function TopBar({ onMethodology }: { onMethodology: () => void }) {
  const { t, i18n } = useTranslation();
  const { state, set } = useStore();

  const seg = (active: boolean) =>
    `px-3 py-1 text-[11px] font-display font-medium uppercase tracking-[0.16em] transition-all ${
      active ? 'text-ink bg-brass shadow-glow' : 'text-parchment/70 hover:text-parchment'
    }`;

  return (
    <header className="sticky z-[1000] border-b border-brass/10 bg-ink/70 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Wordmark />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div role="group" aria-label={t('nav.language')} className="flex overflow-hidden rounded-full border border-brass/25">
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => i18n.changeLanguage(l.code)} aria-pressed={i18n.resolvedLanguage === l.code} className={seg(i18n.resolvedLanguage === l.code)}>
                {l.label}
              </button>
            ))}
          </div>

          <div role="group" aria-label={t('nav.mode')} className="flex overflow-hidden rounded-full border border-brass/25">
            {(['farmer', 'scientist'] as const).map((m) => (
              <button key={m} onClick={() => set({ mode: m })} aria-pressed={state.mode === m} className={seg(state.mode === m)}>
                {t(`nav.${m}`)}
              </button>
            ))}
          </div>

          <button
            onClick={onMethodology}
            data-action="methodology"
            className="rounded-full border border-brass/50 px-4 py-1 font-display text-[11px] font-medium uppercase tracking-[0.18em] text-brass transition-all hover:bg-brass/10 hover:shadow-glow-soft"
          >
            {t('nav.methodology')}
          </button>
        </div>
      </div>
    </header>
  );
}
