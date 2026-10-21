import { create } from 'zustand';
import type { ManacitraData } from './types';

// The switchboard is one figure with one dataset, so the store holds three
// things: the data, the two theme/motion preferences, and nothing else. The
// old flat map's filter/layer/selection state went with it — a jack is selected
// by lighting it, not by a filter panel.
interface ManacitraStore {
  data: ManacitraData | null;
  reducedMotion: boolean;
  highContrast: boolean;
  setData: (data: ManacitraData) => void;
  setReducedMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
}

const ls = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return JSON.parse(v);
  } catch (err) {
    console.warn(`manacitra: ignoring corrupt stored value for "${key}"`, err);
    return fallback;
  }
};

export const useManacitraStore = create<ManacitraStore>((set) => ({
  data: null,
  reducedMotion: ls('manacitra_reducedMotion', false),
  highContrast: ls('manacitra_highContrast', false),
  setData: data => set({ data }),
  setReducedMotion: v => { localStorage.setItem('manacitra_reducedMotion', JSON.stringify(v)); set({ reducedMotion: v }); },
  setHighContrast: v => { localStorage.setItem('manacitra_highContrast', JSON.stringify(v)); set({ highContrast: v }); },
}));
