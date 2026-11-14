import { createContext, useContext } from 'react';
import type { PresetId } from './data/presets';

export type Mode = 'farmer' | 'scientist';
export type Soil = 'sand' | 'loam' | 'clay';
export type Irrigation = 'rainfed' | 'canal' | 'drip';
export type PriorityKey = 'water' | 'nitrogen' | 'erosion' | 'organic' | 'forage' | 'income';

export interface AppState {
  mode: Mode;
  lat: number;
  lon: number;
  presetId: PresetId | null;
  soil: Soil;
  irrigation: Irrigation;
  rotation: 'wheat' | 'wheatCotton';
  priorities: Record<PriorityKey, number>; // 0..100
  dT: number; // °C, 0..3.5
  dP: number; // %, -40..+20
}

export const PRIORITY_KEYS: PriorityKey[] = ['water', 'nitrogen', 'erosion', 'organic', 'forage', 'income'];

export const initialState: AppState = {
  mode: 'farmer',
  lat: 38.5598,
  lon: 68.787,
  presetId: 'gissar',
  soil: 'loam',
  irrigation: 'canal',
  rotation: 'wheat',
  priorities: { water: 70, nitrogen: 50, erosion: 40, organic: 40, forage: 30, income: 60 },
  dT: 0,
  dP: 0,
};

export interface Store {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreContext missing');
  return s;
}
