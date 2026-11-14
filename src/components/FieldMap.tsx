import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../state';
import { PRESETS } from '../data/presets';

function ClickHandler() {
  const { set } = useStore();
  useMapEvents({
    click(e) {
      set({ lat: +e.latlng.lat.toFixed(4), lon: +e.latlng.lng.toFixed(4), presetId: null });
    },
  });
  return null;
}

/** Smoothly fly to the selected point whenever it changes (instant when reduced motion is on). */
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
    <div className="h-56 overflow-hidden rounded border border-brass/25 sm:h-64">
      <MapContainer center={[state.lat, state.lon]} zoom={zoom} worldCopyJump className="h-full w-full" attributionControl>
        {/* Esri World Imagery satellite basemap (no key required; attribution required) */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, GIS User Community"
          maxZoom={18}
        />
        <ClickHandler />
        <FlyTo lat={state.lat} lon={state.lon} zoom={zoom} />
        {PRESETS.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={4} pathOptions={{ color: '#C9A55A', weight: 1, fillOpacity: 0.4 }} />
        ))}
        <CircleMarker center={[state.lat, state.lon]} radius={9} pathOptions={{ color: '#EADFC8', weight: 2, fillColor: '#C9A55A', fillOpacity: 0.6 }} />
      </MapContainer>
    </div>
  );
}
