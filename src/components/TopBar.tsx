import { useTranslation } from 'react-i18next';
import { LANGS } from '../i18n';
import { useStore } from '../state';

function Wordmark() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="13" fill="none" stroke="#C9A55A" strokeWidth="1.2" />
        <circle cx="16" cy="16" r="7" fill="none" stroke="#C9A55A" strokeWidth="0.8" opacity="0.7" />
        <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="#EADFC8" strokeWidth="0.6" opacity="0.5" transform="rotate(-23 16 16)" />
        <path d="M16 3v26M3 16h26" stroke="#C9A55A" strokeWidth="0.6" opacity="0.6" />
        <circle cx="16" cy="16" r="1.8" fill="#C9A55A" />
      </svg>
      <div className="leading-tight">
        <div className="font-display text-xl tracking-wide text-parchment">
          Project <span className="text-brass">{t('app.name')}</span>
        </div>
        <div className="hidden text-[11px] italic text-slate sm:block">{t('app.tagline')}</div>
      </div>
    </div>
  );
}

export function TopBar({ onMethodology }: { onMethodology: () => void }) {
  const { t, i18n } = useTranslation();
  const { state, set } = useStore();

  return (
    <header className="sticky top-0 z-[1000] border-b border-brass/20 bg-ink/85 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Wordmark />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div role="group" aria-label={t('nav.language')} className="flex overflow-hidden rounded border border-brass/30">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => i18n.changeLanguage(l.code)}
                aria-pressed={i18n.resolvedLanguage === l.code}
                className={`px-2.5 py-1 text-xs font-medium tracking-wider transition-colors ${
                  i18n.resolvedLanguage === l.code ? 'bg-brass text-ink' : 'text-parchment/80 hover:bg-panel-2'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div role="group" aria-label={t('nav.mode')} className="relative flex rounded-full border border-brass/30 p-0.5 text-xs">
            {(['farmer', 'scientist'] as const).map((m) => (
              <button
                key={m}
                onClick={() => set({ mode: m })}
                aria-pressed={state.mode === m}
                className={`relative z-10 rounded-full px-3 py-1 font-medium transition-colors ${
                  state.mode === m ? 'bg-verdigris-light text-ink' : 'text-parchment/75 hover:text-parchment'
                }`}
              >
                {t(`nav.${m}`)}
              </button>
            ))}
          </div>

          <button onClick={onMethodology} className="rounded border border-brass/50 px-3 py-1 font-display text-sm text-brass hover:bg-brass/10">
            {t('nav.methodology')}
          </button>
        </div>
      </div>
    </header>
  );
}
