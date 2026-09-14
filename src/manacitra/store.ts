import { create } from 'zustand';
import type { ManacitraData } from './types';

interface Filters {
  status: ('online' | 'offline')[];
  type: string[];
}

export interface VisibleLayers {
  zones: boolean;
  services: boolean;
  connections: boolean;
  labels: boolean;
}

interface ManacitraStore {
  data: ManacitraData | null;
  selectedId: string | null;
  hoveredId: string | null;
  focusId: string | null;
  filters: Filters;
  visibleLayers: VisibleLayers;
  searchQuery: string;
  reducedMotion: boolean;
  highContrast: boolean;
  audioMuted: boolean;
  audioAvailable: boolean;
  loadError: boolean;
  resetToken: number;
  setData: (data: ManacitraData) => void;
  setLoadError: (v: boolean) => void;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setFocusId: (id: string | null) => void;
  setFilters: (filters: Filters) => void;
  toggleLayer: (layer: keyof VisibleLayers) => void;
  setSearchQuery: (q: string) => void;
  setReducedMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setAudioAvailable: (v: boolean) => void;
  toggleAudio: () => void;
  resetView: () => void;
}

const ls = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    return JSON.parse(v)
  } catch (err) {
    console.warn(`manacitra: ignoring corrupt stored value for "${key}"`, err)
    return fallback
  }
};

export const useManacitraStore = create<ManacitraStore>((set, get) => ({
  data: null,
  selectedId: null,
  hoveredId: null,
  focusId: null,
  filters: { status: [], type: [] },
  visibleLayers: { zones: true, services: true, connections: true, labels: true },
  searchQuery: '',
  reducedMotion: ls('manacitra_reducedMotion', false),
  highContrast: ls('manacitra_highContrast', false),
  audioMuted: ls('manacitra_audioMuted', true),
  audioAvailable: false,
  loadError: false,
  resetToken: 0,
  setData: data => set({ data }),
  setSelected: selectedId => set({ selectedId }),
  setHovered: hoveredId => set({ hoveredId }),
  setFocusId: focusId => set({ focusId }),
  setFilters: filters => set({ filters }),
  toggleLayer: layer => set(s => ({ visibleLayers: { ...s.visibleLayers, [layer]: !s.visibleLayers[layer] } })),
  setSearchQuery: searchQuery => set({ searchQuery }),
  setReducedMotion: v => { localStorage.setItem('manacitra_reducedMotion', JSON.stringify(v)); set({ reducedMotion: v }); },
  setHighContrast: v => { localStorage.setItem('manacitra_highContrast', JSON.stringify(v)); set({ highContrast: v }); },
  setAudioAvailable: v => set({ audioAvailable: v }),
  setLoadError: v => set({ loadError: v }),
  toggleAudio: () => { const v = !get().audioMuted; localStorage.setItem('manacitra_audioMuted', JSON.stringify(v)); set({ audioMuted: v }); },
  resetView: () => set(s => ({ resetToken: s.resetToken + 1 })),
}));
