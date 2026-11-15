import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MotionConfig } from 'framer-motion';
import { initialState, StoreContext, type AppState } from './state';
import { SpaceMap } from './components/SpaceMap';
import { TopBar } from './components/TopBar';
import { Banner } from './components/Banner';
import { LeftPanel } from './components/LeftPanel';
import { RotationCard, type RotationId } from './components/RotationCard';
import { Timeline } from './components/Timeline';
import { Charts } from './components/Charts';
import { Methodology } from './components/Methodology';
import { Drawer } from './components/Drawer';
import { ComputeGridPanel } from './components/ComputeGridPanel';
import { useClimate } from './data/useClimate';
import { ROTATION_IDS, useRotations } from './data/useRotations';
import { useDerived } from './data/useDerived';
import { useMonteCarlo } from './data/useMonteCarlo';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>(initialState);
  const set = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);
  const store = useMemo(() => ({ state, set }), [state, set]);
  const [methodOpen, setMethodOpen] = useState(false);
  const closeMethod = useCallback(() => setMethodOpen(false), []);
  const { state: climate, retry } = useClimate(state.lat, state.lon, state.presetId);

  const series = climate.status === 'ready' ? climate.result.series : null;
  // climate-stress sliders applied once (debounced), shared by the replay and the Monte Carlo
  const derived = useDerived(series, state.dT, state.dP);
  const analysis = useRotations(derived, state.irrigation, state.rotation, state.priorities);
  const mc = useMonteCarlo(derived, state.irrigation, state.rotation, analysis?.region ?? null);
  // Cards are ordered by the farmer's priorities; canonical order until results exist.
  const cards: RotationId[] = analysis?.order ?? ROTATION_IDS;
  const stressed = !!analysis && (analysis.dT !== 0 || analysis.dP !== 0);

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
          {stressed && (
            <div role="status" className="relative z-10 inline-flex items-center gap-2 rounded-full border border-terracotta/70 bg-terracotta/15 px-4 py-1.5 text-xs text-terracotta-light">
              <span className="h-1.5 w-1.5 rounded-full bg-terracotta-light" />
              {t('band.stress', { dT: `${analysis!.dT >= 0 ? '+' : ''}${analysis!.dT.toFixed(1)}`, dP: `${analysis!.dP > 0 ? '+' : ''}${analysis!.dP}` })}
            </div>
          )}
          <div className={`relative grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3 ${stressed ? 'pt-2' : 'pt-10'}`}>
            {cards.map((id, i) => (
              <RotationCard key={id} id={id} total={cards.length} index={i} analysis={analysis} mc={mc.status === 'done' ? mc.summary : null} />
            ))}
          </div>
          {state.mode === 'scientist' && <div className="relative"><ComputeGridPanel mc={mc} /></div>}
          <div className="relative"><Timeline analysis={analysis} /></div>
          <div className="relative"><Charts analysis={analysis} mc={mc.status === 'done' ? mc.summary : null} /></div>
        </div>
      </main>
      <Drawer open={methodOpen} title={t('nav.methodology')} onClose={closeMethod}>
        <Methodology />
      </Drawer>
      </MotionConfig>
    </StoreContext.Provider>
  );
}
