import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AttributionControl, Map as MlMap, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre's worker, bundled by Vite as our own same-origin file (CSP worker-src 'self', no blob: workers)
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useStore } from '../state';
import { PRESETS } from '../data/presets';
import { FIELD_MAX_VERTICES, makeField, type LonLat } from '../lib/field';
import { clampLat, wrapLon } from '../lib/geo';
import { PlaceSearch } from './PlaceSearch';
import { Icons } from './icons';

setWorkerUrl(workerUrl);

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const DRAW_MIN_ZOOM = 12;

/** Static style: Esri imagery on a globe with a thin atmosphere. No user input reaches the style. */
const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    esri: { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 18, attribution: 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community' },
    field: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'space', type: 'background', paint: { 'background-color': '#000000' } },
    { id: 'imagery', type: 'raster', source: 'esri', paint: { 'raster-saturation': -0.35, 'raster-contrast': 0.08 } },
    { id: 'field-fill', type: 'fill', source: 'field', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#23A383', 'fill-opacity': 0.28 } },
    { id: 'field-line', type: 'line', source: 'field', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': '#F2EFEA', 'line-width': 2 } },
    { id: 'field-pts', type: 'circle', source: 'field', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#F2EFEA', 'circle-stroke-color': '#C98B66', 'circle-stroke-width': 2 } },
  ],
  sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
};

type FieldData = Parameters<GeoJSONSource['setData']>[0];
function fieldGeoJSON(ring: LonLat[]): FieldData {
  const feat = (geometry: object) => ({ type: 'Feature', properties: {}, geometry });
  const features = ring.map((p) => feat({ type: 'Point', coordinates: p }));
  if (ring.length >= 3) features.push(feat({ type: 'Polygon', coordinates: [[...ring, ring[0]]] }));
  else if (ring.length === 2) features.push(feat({ type: 'LineString', coordinates: ring }));
  return { type: 'FeatureCollection', features } as unknown as FieldData;
}

/**
 * Opening screen: a 3D globe (MapLibre GL, globe projection, Esri imagery). The user finds their land
 * (search or preset), zooms in, taps the corners of the field, and continues into the analysis.
 * The outline sets the field SIZE; the weather still comes from the ~50 km NASA POWER cell.
 */
export function GlobeIntro({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { state, set } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1.6);
  const [drawing, setDrawing] = useState(false);
  const [ring, setRing] = useState<LonLat[]>([]);
  const drawingRef = useRef(false);
  drawingRef.current = drawing;
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // create the globe once
  useEffect(() => {
    if (!box.current) return;
    let map: MlMap;
    try {
      map = new MlMap({ container: box.current, style: STYLE, center: [62, 30], zoom: 1.6, attributionControl: false, maxPitch: 60 });
      // imagery credit top-right (clear of the bottom panel); collapsed to an (i) button on phones
      map.addControl(new AttributionControl({ compact: true }), 'top-right');
      if (window.innerWidth < 640) map.once('load', () => box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
    } catch {
      setFailed(true); // no WebGL: fall back to the 2D app
      return;
    }
    mapRef.current = map;
    map.on('load', () => setReady(true));
    map.on('zoom', () => setZoom(map.getZoom()));
    map.on('error', () => { /* tile errors are non-fatal; nothing user-supplied is logged */ });
    map.on('click', (e) => {
      if (!drawingRef.current) return;
      const p: LonLat = [wrapLon(e.lngLat.lng), clampLat(e.lngLat.lat)];
      setRing((r) => (r.length >= FIELD_MAX_VERTICES ? r : [...r, p]));
    });
    // slow spin until the user touches the globe
    let spinning = !reduce;
    const stop = () => { spinning = false; };
    map.on('mousedown', stop); map.on('touchstart', stop); map.on('wheel', stop); map.on('dragstart', stop);
    let raf = 0;
    const spin = () => {
      if (spinning && map.getZoom() < 3) { const c = map.getCenter(); map.setCenter([c.lng + 0.06, c.lat]); }
      if (spinning) raf = requestAnimationFrame(spin);
    };
    map.once('load', () => { if (spinning) raf = requestAnimationFrame(spin); });
    (map as unknown as { __stopSpin: () => void }).__stopSpin = stop;
    return () => { cancelAnimationFrame(raf); map.remove(); mapRef.current = null; };
  }, [reduce]);

  // fly to the place chosen in the search box or a preset
  const flyTo = useCallback((lat: number, lon: number, z: number) => {
    const map = mapRef.current;
    if (!map) return;
    (map as unknown as { __stopSpin?: () => void }).__stopSpin?.();
    if (reduce) map.jumpTo({ center: [lon, lat], zoom: z });
    else map.flyTo({ center: [lon, lat], zoom: z, duration: 4500, essential: true });
  }, [reduce]);
  const lastPlace = useRef<string>(`${state.lat},${state.lon}`);
  useEffect(() => {
    const key = `${state.lat},${state.lon}`;
    if (key === lastPlace.current) return;
    lastPlace.current = key;
    flyTo(state.lat, state.lon, 14);
  }, [state.lat, state.lon, flyTo]);

  // show the outline being drawn
  useEffect(() => {
    const src = mapRef.current?.getSource('field') as GeoJSONSource | undefined;
    if (ready && src) src.setData(fieldGeoJSON(ring));
  }, [ring, ready]);

  const field = ring.length >= 3 ? makeField(ring) : null;
  const fieldOk = field !== null && typeof field === 'object';
  const canDraw = zoom >= DRAW_MIN_ZOOM;

  const analyse = () => {
    if (!field || typeof field !== 'object') return;
    set({ lat: field.centroid.lat, lon: field.centroid.lon, presetId: null, field });
    onDone();
  };
  const useCentre = () => {
    const c = mapRef.current?.getCenter();
    if (c) set({ lat: clampLat(c.lat), lon: wrapLon(c.lng), presetId: null, field: null });
    onDone();
  };

  if (failed) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black p-6 text-center">
        <div className="slab max-w-sm space-y-4 p-6">
          <p className="text-sm text-parchment">{t('globe.noWebgl')}</p>
          <button className="chip" onClick={onDone}>{t('globe.skip')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black" role="dialog" aria-modal="true" aria-label={t('globe.title')}>
      {/* MapLibre sets position: relative on its container, so the container fills a positioned wrapper */}
      <div className="absolute inset-0"><div ref={box} className="h-full w-full" /></div>

      <div className="pointer-events-none absolute inset-x-0 top-0 p-4 sm:p-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
        <div className="font-display text-xl font-semibold uppercase tracking-[0.34em] text-parchment drop-shadow">{t('app.name')}</div>
        <div className="mt-1 max-w-md text-[11px] uppercase tracking-[0.2em] text-slate drop-shadow">{t('globe.title')}</div>
      </div>

      <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[400px]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="slab max-h-[50vh] space-y-3 overflow-y-auto p-4 sm:max-h-[70vh] sm:space-y-4 sm:p-5">
          <section className="space-y-2">
            <h2 className="eyebrow">1 · {t('globe.step1')}</h2>
            <PlaceSearch />
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} className="chip !px-3 !py-1 text-xs"
                  onClick={() => {
                    lastPlace.current = `${p.lat},${p.lon}`;
                    set({ lat: p.lat, lon: p.lon, presetId: p.id, rotation: p.baseline, field: null });
                    flyTo(p.lat, p.lon, 13);
                  }}>
                  {t(`presets.${p.id}`)}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="eyebrow">2 · {t('globe.step2')}</h2>
            {!canDraw && !drawing && <p className="text-xs text-slate">{t('globe.zoomIn')}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button className="chip !px-3 !py-1 text-xs" disabled={!canDraw && !drawing} aria-pressed={drawing}
                onClick={() => { setDrawing((d) => !d); }}>
                {drawing ? t('globe.stopDrawing') : t('globe.draw')}
              </button>
              <button className="chip !px-3 !py-1 text-xs" disabled={!ring.length} onClick={() => setRing((r) => r.slice(0, -1))}>{t('globe.undo')}</button>
              <button className="chip !px-3 !py-1 text-xs" disabled={!ring.length} onClick={() => setRing([])}>{t('globe.clear')}</button>
            </div>
            {drawing && <p className="text-xs text-parchment">{t('globe.tapCorners', { n: ring.length })}</p>}
            {fieldOk && <p className="num text-sm text-verdigris-light" role="status">{t('globe.area', { ha: field.areaHa.toFixed(field.areaHa < 10 ? 2 : 1) })}</p>}
            {field && !fieldOk && <p className="text-xs text-terracotta-light" role="alert">{t(`globe.err.${field}`)}</p>}
          </section>

          <section className="space-y-2">
            <h2 className="eyebrow">3 · {t('globe.step3')}</h2>
            <div className="flex flex-wrap gap-2">
              <button className="chip !border-white !bg-pill !px-4 !py-1.5 text-sm font-medium !text-[#17191C] disabled:opacity-40" disabled={!fieldOk} onClick={analyse}>
                {t('globe.analyse')}
              </button>
              <button className="chip !px-3 !py-1 text-xs" disabled={zoom < 5} onClick={useCentre}>{t('globe.usePoint')}</button>
              <button className="chip !px-3 !py-1 text-xs" onClick={onDone}>{t('globe.skip')} <Icons.close size={11} /></button>
            </div>
            <p className="text-[11px] leading-snug text-slate">{t('globe.note')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
