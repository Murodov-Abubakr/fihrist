import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { initialState, StoreContext, type AppState } from './state';
import { StarChart } from './components/StarChart';
import { TopBar } from './components/TopBar';
import { Banner } from './components/Banner';
import { LeftPanel } from './components/LeftPanel';
import { RotationCard, type RotationId } from './components/RotationCard';
import { Timeline, ChartsShell } from './components/Timeline';
import { Drawer } from './components/Drawer';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>(initialState);
  const set = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);
  const store = useMemo(() => ({ state, set }), [state, set]);
  const [methodOpen, setMethodOpen] = useState(false);
  const closeMethod = useCallback(() => setMethodOpen(false), []);

  // Ranking is a placeholder order until the engine produces scores (step 3).
  const cards: RotationId[] = ['baseline', 'waterSaving', 'regenerative'];

  return (
    <StoreContext.Provider value={store}>
      <StarChart />
      <TopBar onMethodology={() => setMethodOpen(true)} />
      <Banner />
      <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <LeftPanel />
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((id, i) => (
              <RotationCard key={id} id={id} rank={i + 1} index={i} />
            ))}
          </div>
          <Timeline />
          <ChartsShell />
        </div>
      </main>
      <Drawer open={methodOpen} title={t('nav.methodology')} onClose={closeMethod}>
        <p className="text-sm text-parchment/85">{t('drawer.methodologyBody')}</p>
      </Drawer>
    </StoreContext.Provider>
  );
}
