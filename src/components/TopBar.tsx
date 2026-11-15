import { useTranslation } from 'react-i18next';
import { LANGS } from '../i18n';
import { useStore } from '../state';

function Wordmark() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="#C9CED6" strokeWidth="0.8" opacity="0.6" />
        <circle cx="18" cy="18" r="9" fill="none" stroke="#C98B66" strokeWidth="0.9" strokeDasharray="1.5 2.5" />
        <circle cx="18" cy="18" r="3" fill="#F2EFEA" />
        <circle cx="33" cy="18" r="2" fill="#C98B66" />
        <circle cx="11.6" cy="11.6" r="1.4" fill="#ECE8E1" />
      </svg>
      <div className="leading-none">
        <div className="font-display text-lg font-semibold uppercase tracking-[0.34em] text-parchment">{t('app.name')}</div>
        <div className="mt-1 hidden text-[10px] uppercase tracking-[0.22em] text-slate sm:block">{t('app.tagline')}</div>
      </div>
    </div>
  );
}

export function TopBar({ onMethodology, onValidation }: { onMethodology: () => void; onValidation: () => void }) {
  const { t, i18n } = useTranslation();
  const { state, set } = useStore();

  return (
    <header
      className="sticky z-[1000] border-b border-white/[0.06] bg-gradient-to-b from-[#0e1012]/95 to-[#16181b]/85"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Wordmark />

        <nav aria-label={t('nav.mode')} className="order-3 flex w-full items-center gap-5 sm:order-none sm:w-auto sm:gap-8">
          {(['farmer', 'scientist'] as const).map((m) => (
            <button key={m} className="tab" aria-pressed={state.mode === m} onClick={() => set({ mode: m })}>
              {t(`nav.${m}`)}
            </button>
          ))}
          <button className="tab" aria-pressed={false} data-action="methodology" onClick={onMethodology}>
            {t('nav.methodology')}
          </button>
          <button className="tab" aria-pressed={false} data-action="validation" onClick={onValidation}>
            {t('nav.validation')}
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <div role="group" aria-label={t('nav.language')} className="flex items-center gap-1.5">
            {LANGS.map((l) => (
              <button key={l.code} className="keycap" aria-pressed={i18n.resolvedLanguage === l.code} onClick={() => i18n.changeLanguage(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-2 lg:flex" aria-label={t('panel.location')}>
            <span className="num text-sm text-parchment">{state.lat.toFixed(2)}°</span>
            <span className="h-3 w-px bg-slate/50" />
            <span className="num text-sm text-parchment">{state.lon.toFixed(2)}°</span>
          </div>
        </div>
      </div>
    </header>
  );
}
