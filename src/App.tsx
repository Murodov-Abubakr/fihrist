import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MotionConfig } from 'framer-motion';
import { initialState, StoreContext, type AppState } from './state';
import { SpaceMap } from './components/SpaceMap';
import { TopBar } from './components/TopBar';
import { Banner } from './components/Banner';
import { LeftPanel } from './components/LeftPanel';
import { RotationCard, type RotationId } from './components/RotationCard';
import { Timeline, ChartsShell } from './components/Timeline';
import { Drawer } from './components/Drawer';
import { useClimate } from './data/useClimate';
import { ROTATION_IDS, useRotations } from './data/useRotations';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>(initialState);
  const set = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);
  const store = useMemo(() => ({ state, set }), [state, set]);
  const [methodOpen, setMethodOpen] = useState(false);
  const closeMethod = useCallback(() => setMethodOpen(false), []);
  const { state: climate, retry } = useClimate(state.lat, state.lon, state.presetId);

  const series = climate.status === 'ready' ? climate.result.series : null;
  const analysis = useRotations(series, state.irrigation, state.rotation, state.priorities);
  // Cards are ordered by the farmer's priorities; canonical order until results exist.
  const cards: RotationId[] = analysis?.order ?? ROTATION_IDS;

  return (
    <StoreContext.Provider value={store}>
      {/* Framer Motion honours the OS "reduce motion" setting only when told to */}
      <MotionConfig reducedMotion="user">
      <SpaceMap />
      <TopBar onMethodology={() => setMethodOpen(true)} />
      <Banner />
      <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <LeftPanel climate={climate} onRetry={retry} />
        <div className="relative min-w-0 space-y-8">
          {/* huge faded section word behind the content */}
          <div aria-hidden className="pointer-events-none absolute -top-6 left-0 right-0 -z-0 select-none overflow-hidden">
            <span className="block whitespace-nowrap font-display text-[clamp(5rem,13vw,13rem)] font-bold uppercase leading-none tracking-[0.04em] text-black/30">
              {t(`nav.${state.mode}`)}
            </span>
          </div>
          <div className="relative grid gap-x-6 gap-y-8 pt-10 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((id, i) => (
              <RotationCard key={id} id={id} total={cards.length} index={i} analysis={analysis} />
            ))}
          </div>
          <div className="relative"><Timeline /></div>
          <div className="relative"><ChartsShell /></div>
        </div>
      </main>
      <Drawer open={methodOpen} title={t('nav.methodology')} onClose={closeMethod}>
        <p className="text-sm leading-relaxed text-parchment">{t('drawer.methodologyBody')}</p>
      </Drawer>
      </MotionConfig>
    </StoreContext.Provider>
  );
}
