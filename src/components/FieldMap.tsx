import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../state';
import { PRESETS } from '../data/presets';
import { clampLat, wrapLon } from '../lib/geo';

function ClickHandler() {
  const { set } = useStore();
  useMapEvents({
    click(e) {
      // Leaflet returns unbounded longitudes after panning across the antimeridian: normalise + clamp.
      set({ lat: clampLat(e.latlng.lat), lon: wrapLon(e.latlng.lng), presetId: null });
    },
  });
  return null;
}

/** Fly to the selected point whenever it changes (instant when reduced motion is on). */
function FlyTo({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) map.setView([lat, lon], zoom);
    else map.flyTo([lat, lon], zoom, { duration: 1.4 });
  }, [lat, lon, zoom, map]);
  return null;
}

export function FieldMap() {
  const { state } = useStore();
  const preset = PRESETS.find((p) => p.id === state.presetId);
  const zoom = preset?.zoom ?? 8;

  return (
    <div className="relative h-56 overflow-hidden rounded-lg border border-brass/20 sm:h-64">
      <MapContainer center={[state.lat, state.lon]} zoom={zoom} worldCopyJump className="h-full w-full" attributionControl>
        {/* Esri World Imagery satellite basemap (no key required; attribution required). Static string, no user input. */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, GIS User Community"
          maxZoom={18}
        />
        <ClickHandler />
        <FlyTo lat={state.lat} lon={state.lon} zoom={zoom} />
        {PRESETS.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={3.5} pathOptions={{ color: '#C9A55A', weight: 1, fillColor: '#C9A55A', fillOpacity: 0.5 }} />
        ))}
        {/* reticle: outer hairline ring + glowing core */}
        <CircleMarker center={[state.lat, state.lon]} radius={16} pathOptions={{ color: '#C9A55A', weight: 1, opacity: 0.8, fill: false, dashArray: '3 4' }} />
        <CircleMarker center={[state.lat, state.lon]} radius={5} pathOptions={{ color: '#F4ECDA', weight: 1.5, fillColor: '#C9A55A', fillOpacity: 1 }} />
      </MapContainer>
      {/* HUD corner ticks over the map */}
      <div aria-hidden className="pointer-events-none absolute inset-2 z-[500]">
        <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-brass/70" />
        <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-brass/70" />
        <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-brass/70" />
        <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-brass/70" />
      </div>
    </div>
  );
}
