import { useTranslation } from 'react-i18next';
import type { ClimateState } from '../data/useClimate';
import { Icons } from './icons';

/** One-line provenance of the climate data currently in use (honesty: always show the source). */
export function DataStatus({ state, onRetry }: { state: ClimateState; onRetry: () => void }) {
  const { t, i18n } = useTranslation();

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex items-center gap-2 text-xs text-slate">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />
        {t('data.loading')}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-md border border-terracotta/60 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-light">
        <Icons.alert size={15} className="mt-px shrink-0" />
        <span className="flex-1">{t('data.error')}</span>
        <button onClick={onRetry} className="chip !px-2.5 !py-0.5 text-[11px]">{t('data.retry')}</button>
      </div>
    );
  }
  const { series, origin } = state.result;
  const end = new Date(Date.UTC(+series.start.slice(0, 4), +series.start.slice(5, 7) - 1, +series.start.slice(8, 10) + series.tmax.length - 1));
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate">
      <span className="flex items-center gap-1.5 text-parchment">
        <span className={`h-2 w-2 rounded-full ${origin === 'live' ? 'bg-verdigris-light' : 'bg-brass'}`} />
        NASA POWER · {t(`data.${origin}`)}
      </span>
      <span className="num">{series.start.slice(0, 4)}–{end.getUTCFullYear()}</span>
      <span className="num">{series.tmax.length.toLocaleString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'ru-RU')} {t('data.days')}</span>
      <span className="num">{t('data.grid')} {Math.round(series.elevation)} m</span>
    </div>
  );
}
