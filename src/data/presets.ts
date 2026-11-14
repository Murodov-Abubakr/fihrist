// Preset locations — coordinates from CLAUDE.md §4.
export type PresetId = 'gissar' | 'khatlon' | 'balkh' | 'kansas';

export interface Preset {
  id: PresetId;
  lat: number;
  lon: number;
  zoom: number;
  baseline: 'wheat' | 'wheatCotton';
  validation?: boolean;
}

export const PRESETS: Preset[] = [
  { id: 'gissar', lat: 38.5598, lon: 68.787, zoom: 9, baseline: 'wheat' },
  { id: 'khatlon', lat: 37.8333, lon: 68.78, zoom: 9, baseline: 'wheatCotton' },
  { id: 'balkh', lat: 36.7581, lon: 66.8972, zoom: 9, baseline: 'wheat' },
  { id: 'kansas', lat: 38.8, lon: -99.3, zoom: 8, baseline: 'wheat', validation: true },
];
