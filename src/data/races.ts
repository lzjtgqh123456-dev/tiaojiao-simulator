import { Ultrawoman } from '../types';
import { queueServerSave } from '../services/storageSync';

export interface RaceDefinition {
  id: string;
  name: string;
  traits: string[];
  description?: string;
  isPreset?: boolean;
}

export const DEFAULT_RACES: RaceDefinition[] = [];

export function loadRacesFromStorage(): RaceDefinition[] {
  try {
    const saved = localStorage.getItem('ultra_races_v1');
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load races from localStorage:', e);
  }
  return DEFAULT_RACES;
}

export function saveRacesToStorage(races: RaceDefinition[]): void {
  try {
    localStorage.setItem('ultra_races_v1', JSON.stringify(races));
    queueServerSave({ ultra_races_v1: races });
  } catch (e) {
    console.warn('Failed to save races to localStorage:', e);
  }
}
