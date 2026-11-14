import { useTranslation } from 'react-i18next';
import { PRESETS } from '../data/presets';
import { PRIORITY_KEYS, useStore, type Irrigation, type PriorityKey, type Soil } from '../state';
import { FieldMap } from './FieldMap';
import { PlaceSearch } from './PlaceSearch';
import { Icon, type IconName } from './icons';
import { DataStatus } from './DataStatus';
import type { ClimateState } from '../data/useClimate';

const PRIORITY_ICONS: Record<PriorityKey, IconName> = { water: 'water', nitrogen: 'nitrogen', erosion: 'erosion', organic: 'organic', forage: 'forage', income: 'income' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="eyebrow shrink-0">{title}</h3>
        <div aria-hidden className="node-rule flex-1" />
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} className="chip" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, format, onChange, icon }: {
  label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void; icon: IconName;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2.5 text-parchment">
          <span className="text-brass-glow"><Icon name={icon} size={17} /></span>
          {label}
        </span>
        <span className="num text-xs text-parchment">{format(value)}</span>
      </div>
      <input
        type="range" className="range" min={min} max={max} step={step} value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
      />
    </label>
  );
}

/** Farmer mode shows three pips instead of a number */
const pips = (v: number) => (v >= 67 ? '●●●' : v >= 34 ? '●●○' : '●○○');

export function LeftPanel({ climate, onRetry }: { climate: ClimateState; onRetry: () => void }) {
  const { t } = useTranslation();
  const { state, set } = useStore();
  const sci = state.mode === 'scientist';

  return (
    <aside className="stone space-y-6 p-4 sm:p-5">
      <Section title={t('panel.location')}>
        <PlaceSearch />
        <FieldMap />
        <DataStatus state={climate} onRetry={onRetry} />
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate">{t('panel.mapHint')}</span>
          <span className="num shrink-0 rounded-full border border-brass/60 px-2.5 py-0.5 text-parchment">
            {state.lat.toFixed(3)}° / {state.lon.toFixed(3)}°
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button key={p.id} className="chip text-left" aria-pressed={state.presetId === p.id}
              onClick={() => set({ lat: p.lat, lon: p.lon, presetId: p.id, rotation: p.baseline })}>
              {t(`presets.${p.id}`)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('panel.field')}>
        <div className="space-y-3.5">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.14em] text-slate">{t('panel.soil')}</div>
            <Segmented<Soil> label={t('panel.soil')} value={state.soil} onChange={(v) => set({ soil: v })}
              options={(['sand', 'loam', 'clay'] as Soil[]).map((v) => ({ v, label: t(`soil.${v}`) }))} />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.14em] text-slate">{t('panel.irrigation')}</div>
            <Segmented<Irrigation> label={t('panel.irrigation')} value={state.irrigation} onChange={(v) => set({ irrigation: v })}
              options={(['rainfed', 'canal', 'drip'] as Irrigation[]).map((v) => ({ v, label: t(`irrigation.${v}`) }))} />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.14em] text-slate">{t('panel.rotation')}</div>
            <Segmented label={t('panel.rotation')} value={state.rotation} onChange={(v) => set({ rotation: v })}
              options={[{ v: 'wheat' as const, label: t('rotations.wheat') }, { v: 'wheatCotton' as const, label: t('rotations.wheatCotton') }]} />
          </div>
        </div>
      </Section>

      <Section title={t('panel.priorities')}>
        <div className="space-y-4">
          {PRIORITY_KEYS.map((k) => (
            <Slider key={k} icon={PRIORITY_ICONS[k]} label={t(`priorities.${k}`)} value={state.priorities[k]} min={0} max={100} step={5}
              format={(v) => (sci ? `${v}` : pips(v))}
              onChange={(v) => set({ priorities: { ...state.priorities, [k]: v } })} />
          ))}
        </div>
      </Section>

      <Section title={t('panel.climate')}>
        <div className="space-y-4">
          <Slider icon="temp" label={t('panel.dT')} value={state.dT} min={0} max={3.5} step={0.5} format={(v) => `+${v.toFixed(1)} °C`} onChange={(v) => set({ dT: v })} />
          <Slider icon="rain" label={t('panel.dP')} value={state.dP} min={-40} max={20} step={5} format={(v) => `${v > 0 ? '+' : ''}${v}%`} onChange={(v) => set({ dP: v })} />
        </div>
      </Section>
    </aside>
  );
}
