import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, CircleMarker, Marker, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../state';
import { PRESETS } from '../data/presets';
import { clampLat, wrapLon } from '../lib/geo';
import { FIELD_MAX_VERTICES, makeField, type LonLat } from '../lib/field';

/** Map clicks: move the analysis point, or (in drawing mode) add a field corner. */
function ClickHandler({ drawing, onCorner }: { drawing: boolean; onCorner: (p: LonLat) => void }) {
  const { set } = useStore();
  const map = useMap();
  useEffect(() => {
    // double-click would zoom while the user is tapping corners
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [drawing, map]);
  useMapEvents({
    click(e) {
      // Leaflet returns unbounded longitudes after panning across the antimeridian: normalise + clamp.
      const lat = clampLat(e.latlng.lat);
      const lon = wrapLon(e.latlng.lng);
      if (drawing) onCorner([lon, lat]);
      else set({ lat, lon, presetId: null });
    },
  });
  return null;
}

/**
 * Fly to the selected point whenever it changes (instant when reduced motion is on). With an outlined
 * field, fit the whole outline in view instead — on a narrow phone map a fixed zoom can cut corners off.
 */
function FlyTo({ lat, lon, zoom, ring }: { lat: number; lon: number; zoom: number; ring?: LonLat[] }) {
  const map = useMap();
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (ring && ring.length >= 3) {
      const b = L.latLngBounds(ring.map(([x, y]) => [y, x] as [number, number]));
      if (reduce) map.fitBounds(b, { padding: [28, 28], maxZoom: 17 });
      else map.flyToBounds(b, { padding: [28, 28], maxZoom: 17, duration: 1.4 });
      return;
    }
    if (reduce) map.setView([lat, lon], zoom);
    else map.flyTo([lat, lon], zoom, { duration: 1.4 });
  }, [lat, lon, zoom, ring, map]);
  return null;
}

/** Draggable corner handle: styled entirely in CSS (.field-vertex); no HTML content is injected. */
const VERTEX_ICON = L.divIcon({ className: 'field-vertex', iconSize: [16, 16], iconAnchor: [8, 8] });

const toLatLng = (ring: LonLat[]) => ring.map(([lon, lat]) => [lat, lon] as [number, number]);

export function FieldMap() {
  const { t } = useTranslation();
  const { state, set } = useStore();
  const preset = PRESETS.find((p) => p.id === state.presetId);
  const zoom = state.field ? 15 : preset?.zoom ?? 8;
  const [drawing, setDrawing] = useState(false);
  const [ring, setRing] = useState<LonLat[]>([]);

  const field = ring.length >= 3 ? makeField(ring) : null;
  const fieldOk = field !== null && typeof field === 'object';
  const finish = () => {
    if (!field || typeof field !== 'object') return;
    set({ lat: field.centroid.lat, lon: field.centroid.lon, presetId: null, field });
    setDrawing(false);
    setRing([]);
  };
  const cancel = () => { setDrawing(false); setRing([]); };

  return (
    <div className="space-y-2">
      <div className="relative h-56 overflow-hidden border border-brass/50 sm:h-64" style={{ borderRadius: '6px 6px 28px 6px' }}>
        <MapContainer center={[state.lat, state.lon]} zoom={zoom} worldCopyJump className={`h-full w-full ${drawing ? 'cursor-crosshair' : ''}`} attributionControl>
          {/* Esri World Imagery satellite basemap (no key required; attribution required). Static string, no user input. */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, GIS User Community"
            maxZoom={18}
          />
          <ClickHandler drawing={drawing} onCorner={(p) => setRing((r) => (r.length >= FIELD_MAX_VERTICES ? r : [...r, p]))} />
          <FlyTo lat={state.lat} lon={state.lon} zoom={zoom} ring={state.field?.ring} />
          {PRESETS.map((p) => (
            <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={3.5} pathOptions={{ color: '#C98B66', weight: 1, fillColor: '#C98B66', fillOpacity: 0.7 }} />
          ))}
          {state.field && !drawing && (
            <Polygon positions={toLatLng(state.field.ring)} pathOptions={{ color: '#F2EFEA', weight: 2, fillColor: '#23A383', fillOpacity: 0.28 }} />
          )}
          {/* outline being drawn */}
          {drawing && ring.length >= 3 && <Polygon positions={toLatLng(ring)} pathOptions={{ color: '#F2EFEA', weight: 2, fillColor: '#23A383', fillOpacity: 0.28 }} />}
          {drawing && ring.length === 2 && <Polyline positions={toLatLng(ring)} pathOptions={{ color: '#F2EFEA', weight: 2 }} />}
          {/* corners: drag-and-drop to adjust (mouse and touch) */}
          {drawing && ring.map(([lon, lat], i) => (
            <Marker key={i} position={[lat, lon]} icon={VERTEX_ICON} draggable autoPan
              eventHandlers={{
                drag: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  const p: LonLat = [wrapLon(ll.lng), clampLat(ll.lat)];
                  setRing((r) => r.map((q, j) => (j === i ? p : q)));
                },
              }} />
          ))}
          {/* reticle: dashed copper ring + white glowing core */}
          {!drawing && <CircleMarker center={[state.lat, state.lon]} radius={17} pathOptions={{ color: '#C98B66', weight: 1.2, opacity: 1, fill: false, dashArray: '2 4', className: 'reticle' }} />}
          {!drawing && <CircleMarker center={[state.lat, state.lon]} radius={5} pathOptions={{ color: '#FFFFFF', weight: 1.5, fillColor: '#F2EFEA', fillOpacity: 1, className: 'reticle' }} />}
        </MapContainer>
        {/* drawing toggle, over the map (outside Leaflet, so its clicks never reach the map) */}
        <div className="absolute right-2 top-2 z-[500]">
          <button className="chip !bg-[#1E2126] !px-3 !py-1 text-xs" aria-pressed={drawing}
            onClick={() => { if (drawing) cancel(); else { setRing(state.field?.ring ?? []); setDrawing(true); } }}>
            {drawing ? t('globe.stopDrawing') : state.field ? t('field.edit') : t('globe.draw')}
          </button>
        </div>
      </div>

      {drawing && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3" role="group" aria-label={t('globe.step2')}>
          <p className="text-xs text-parchment">{t('field.drawHint', { n: ring.length })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button className="chip !px-3 !py-1 text-xs" disabled={!ring.length} onClick={() => setRing((r) => r.slice(0, -1))}>{t('globe.undo')}</button>
            <button className="chip !px-3 !py-1 text-xs" disabled={!ring.length} onClick={() => setRing([])}>{t('globe.clear')}</button>
            <button className="chip !border-white !bg-pill !px-3 !py-1 text-xs font-medium !text-[#17191C] disabled:opacity-40" disabled={!fieldOk} onClick={finish}>{t('field.useField')}</button>
          </div>
          {fieldOk && <p className="num text-sm text-verdigris-light" role="status">{t('globe.area', { ha: field.areaHa.toFixed(field.areaHa < 10 ? 2 : 1) })}</p>}
          {field && !fieldOk && <p className="text-xs text-terracotta-light" role="alert">{t(`globe.err.${field}`)}</p>}
        </div>
      )}
    </div>
  );
}
