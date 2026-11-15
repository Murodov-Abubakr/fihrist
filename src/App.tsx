import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MotionConfig } from 'framer-motion';
import { initialState, StoreContext, type AppState } from './state';
import { SpaceMap } from './components/SpaceMap';
import { TopBar } from './components/TopBar';
import { Banner } from './components/Banner';
import { LeftPanel } from './components/LeftPanel';
import { RotationCard, type RotationId } from './components/RotationCard';
import { Timeline } from './components/Timeline';
import { FieldPlots3D } from './components/FieldPlots3D';
import { Charts } from './components/Charts';
import { Methodology } from './components/Methodology';
import { Validation } from './components/Validation';
import { FieldTotals } from './components/FieldTotals';
import { Astrolabe } from './components/Astrolabe';

// The globe (MapLibre GL, ~250 kB gzipped) loads in its own chunk, in parallel with the rest of the app.
const GlobeIntro = lazy(() => import('./components/GlobeIntro').then((m) => ({ default: m.GlobeIntro })));
import { Drawer } from './components/Drawer';
import { ComputeGridPanel } from './components/ComputeGridPanel';
import { useClimate } from './data/useClimate';
import { ROTATION_IDS, useRotations } from './data/useRotations';
import { useDerived } from './data/useDerived';
import { useMonteCarlo } from './data/useMonteCarlo';
import { useSatellite } from './data/useSatellite';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>(initialState);
  const set = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);
  const store = useMemo(() => ({ state, set }), [state, set]);
  const [methodOpen, setMethodOpen] = useState(false);
  const closeMethod = useCallback(() => setMethodOpen(false), []);
  const [validOpen, setValidOpen] = useState(false);
  const closeValid = useCallback(() => setValidOpen(false), []);
  // Opening globe: shown on every visit unless the URL asks to skip it (?app) — e.g. for direct links.
  const [globeOpen, setGlobeOpen] = useState(() => !new URLSearchParams(window.location.search).has('app'));
  const closeGlobe = useCallback(() => setGlobeOpen(false), []);
  // An outline belongs to one place: drop it when the location moves elsewhere (map click, search, preset).
  useEffect(() => {
    const f = state.field;
    if (f && (Math.abs(f.centroid.lat - state.lat) > 1e-6 || Math.abs(f.centroid.lon - state.lon) > 1e-6)) set({ field: null });
  }, [state.lat, state.lon, state.field, set]);
  const { state: climate, retry } = useClimate(state.lat, state.lon, state.presetId);

  const series = climate.status === 'ready' ? climate.result.series : null;
  // climate-stress sliders applied once (debounced), shared by the replay and the Monte Carlo
  const derived = useDerived(series, state.dT, state.dP);
  const sat = useSatellite(state.presetId, series?.lat ?? null, series?.lon ?? null);
  const analysis = useRotations(derived, state.irrigation, state.rotation, state.priorities, state.soil, sat);
  const mc = useMonteCarlo(derived, state.irrigation, state.rotation, analysis?.region ?? null, state.soil);
  // Cards are ordered by the farmer's priorities; canonical order until results exist.
  const cards: RotationId[] = analysis?.order ?? ROTATION_IDS;
  const stressed = !!analysis && (analysis.dT !== 0 || analysis.dP !== 0);

  return (
    <StoreContext.Provider value={store}>
      {/* Framer Motion honours the OS "reduce motion" setting only when told to */}
      <MotionConfig reducedMotion="user">
      <SpaceMap />
      <TopBar onMethodology={() => setMethodOpen(true)} onValidation={() => setValidOpen(true)} onGlobe={() => setGlobeOpen(true)} />
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
          <FieldTotals analysis={analysis} />
          <FieldPlots3D analysis={analysis} />
          <div className={`relative grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3 ${stressed ? 'pt-2' : 'pt-10'}`}>
            {cards.map((id, i) => (
              <RotationCard key={id} id={id} total={cards.length} index={i} analysis={analysis} mc={mc.status === 'done' ? mc.summary : null} />
            ))}
          </div>
          {state.mode === 'scientist' && <div className="relative"><ComputeGridPanel mc={mc} /></div>}
          <div className="relative"><Timeline analysis={analysis} sat={sat} /></div>
          <div className="relative"><Charts analysis={analysis} mc={mc.status === 'done' ? mc.summary : null} /></div>
        </div>
      </main>
      <Drawer open={methodOpen} title={t('nav.methodology')} onClose={closeMethod}>
        <Methodology />
      </Drawer>
      <Drawer open={validOpen} title={t('nav.validation')} onClose={closeValid}>
        <Validation soil={state.soil} />
      </Drawer>
      {globeOpen && (
        <Suspense fallback={
          // slow connections: never a blank black screen — show progress and a way out
          <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-6 bg-black">
            <Astrolabe size={56} label={t('globe.loading')} />
            <button className="chip !px-4 !py-1 text-xs" onClick={closeGlobe}>{t('globe.skip')}</button>
          </div>
        }>
          <GlobeIntro onDone={closeGlobe} />
        </Suspense>
      )}
      </MotionConfig>
    </StoreContext.Provider>
  );
}
