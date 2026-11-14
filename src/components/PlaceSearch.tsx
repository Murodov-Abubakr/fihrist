import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GeocodeError, parseCoordinates, searchPlaces, type Place } from '../data/geocode';
import { useStore } from '../state';
import { Icons } from './icons';

type Status = 'idle' | 'loading' | 'done' | 'error';

/**
 * Place search with a suggestion dropdown (WAI-ARIA combobox pattern):
 * ↑/↓ to move, Enter to choose, Esc to close. Coordinates typed as "lat, lon" work offline.
 */
export function PlaceSearch() {
  const { t, i18n } = useTranslation();
  const { set } = useStore();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Place[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  // debounced search; stale requests aborted
  useEffect(() => {
    const text = q.trim();
    const coords = parseCoordinates(text);
    if (coords) {
      setItems([{ name: `${coords.lat.toFixed(4)}°, ${coords.lon.toFixed(4)}°`, detail: t('search.coords'), kind: 'coordinates', ...coords }]);
      setStatus('done');
      setActive(0);
      return;
    }
    if (text.length < 3) { setItems([]); setStatus('idle'); return; }
    const ctrl = new AbortController();
    setStatus('loading');
    const timer = setTimeout(() => {
      searchPlaces(text, i18n.resolvedLanguage ?? 'en', ctrl.signal)
        .then((r) => { setItems(r); setStatus('done'); setActive(r.length ? 0 : -1); })
        .catch((e: GeocodeError) => { if (e.message !== 'aborted') { setItems([]); setStatus('error'); } });
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, i18n.resolvedLanguage, t]);

  // close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (p: Place) => {
    set({ lat: p.lat, lon: p.lon, presetId: null });
    setQ(p.name);
    setOpen(false);
    setActive(-1);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { const p = items[active] ?? items[0]; if (p) { e.preventDefault(); choose(p); } }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const showList = open && (q.trim().length >= 3 || items.length > 0);

  return (
    <div ref={wrap} className="relative">
      <div className="flex items-center gap-2 rounded-full border border-parchment/25 bg-black/30 px-3 py-1.5 focus-within:border-white focus-within:shadow-select">
        <span className="text-slate"><Icons.search size={16} /></span>
        <input
          type="search"
          role="combobox"
          aria-expanded={!!showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label={t('search.label')}
          placeholder={t('search.placeholder')}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="w-full bg-transparent text-sm text-parchment placeholder:text-slate focus:outline-none"
        />
        {status === 'loading' && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-brass" aria-hidden />}
      </div>

      {showList && (
        <div className="stone absolute left-0 right-0 top-full z-[1200] mt-1.5 overflow-hidden !rounded-xl border !border-brass/50 !bg-[#1E2126] shadow-2xl">
          <ul id={listId} role="listbox" aria-label={t('search.label')} className="max-h-72 overflow-y-auto py-1">
            {items.map((p, i) => (
              <li
                key={`${p.name}-${p.lat}-${p.lon}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                onMouseEnter={() => setActive(i)}
                className={`mx-1 cursor-pointer rounded-lg px-3 py-2 ${i === active ? 'bg-pill text-ink' : 'text-parchment'}`}
              >
                <div className="text-sm font-medium">{p.name}</div>
                <div className={`flex justify-between gap-2 text-[11px] ${i === active ? 'text-ink/70' : 'text-slate'}`}>
                  <span className="truncate">{p.detail}</span>
                  <span className="num shrink-0">{p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°</span>
                </div>
              </li>
            ))}
            {status === 'done' && items.length === 0 && <li className="px-4 py-2 text-xs text-slate">{t('search.none')}</li>}
            {status === 'loading' && items.length === 0 && <li className="px-4 py-2 text-xs text-slate">{t('search.loading')}</li>}
            {status === 'error' && <li className="px-4 py-2 text-xs text-terracotta-light">{t('search.error')}</li>}
          </ul>
          <div className="border-t border-white/10 px-4 py-1.5 text-[10px] text-slate">{t('search.attribution')}</div>
        </div>
      )}
    </div>
  );
}
