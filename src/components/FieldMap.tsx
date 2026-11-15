import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polygon, useMap, useMapEvents } from 'react-leaflet';
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
  const zoom = state.field ? 15 : preset?.zoom ?? 8;

  return (
    <div className="relative h-56 overflow-hidden border border-brass/50 sm:h-64" style={{ borderRadius: '6px 6px 28px 6px' }}>
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
          <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={3.5} pathOptions={{ color: '#C98B66', weight: 1, fillColor: '#C98B66', fillOpacity: 0.7 }} />
        ))}
        {state.field && (
          <Polygon positions={state.field.ring.map(([lon, lat]) => [lat, lon] as [number, number])}
            pathOptions={{ color: '#F2EFEA', weight: 2, fillColor: '#23A383', fillOpacity: 0.28 }} />
        )}
        {/* reticle: dashed copper ring + white glowing core */}
        <CircleMarker center={[state.lat, state.lon]} radius={17} pathOptions={{ color: '#C98B66', weight: 1.2, opacity: 1, fill: false, dashArray: '2 4', className: 'reticle' }} />
        <CircleMarker center={[state.lat, state.lon]} radius={5} pathOptions={{ color: '#FFFFFF', weight: 1.5, fillColor: '#F2EFEA', fillOpacity: 1, className: 'reticle' }} />
      </MapContainer>
    </div>
  );
}
