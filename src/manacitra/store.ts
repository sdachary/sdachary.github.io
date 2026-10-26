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

// The portfolio embeds this page in an iframe; opened from "Open full screen"
// it stands alone. Embedded, the portfolio's own toggle owns the theme, so we
// read the `theme` key it already writes and hide our button — two toggles on
// one screen, one of which cannot reach the other, is worse than none.
// Same origin, so `storage` fires here when the parent's toggle writes: that is
// the whole sync. `self !== top` never throws, even cross-origin (only touching
// properties of `top` would).
export const embedded = (() => {
  try { return window.self !== window.top; } catch { return false; }
})();

const prefersLight = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;

// Mirrors the portfolio's own first-load fallback, or the two disagree on the
// very first paint — before either has ever been toggled.
const readTheme = (): boolean => {
  if (!embedded) return ls('manacitra_highContrast', false);
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored === 'light';
  return prefersLight();
};

export const useManacitraStore = create<ManacitraStore>((set) => ({
  data: null,
  reducedMotion: ls('manacitra_reducedMotion', false),
  highContrast: readTheme(),
  setData: data => set({ data }),
  setReducedMotion: v => { localStorage.setItem('manacitra_reducedMotion', JSON.stringify(v)); set({ reducedMotion: v }); },
  setHighContrast: v => {
    // embedded, the parent's toggle is the only writer — don't fight it
    if (!embedded) localStorage.setItem('manacitra_highContrast', JSON.stringify(v));
    set({ highContrast: v });
  },
}));

if (embedded) {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'theme') return;
    useManacitraStore.setState({
      highContrast: e.newValue === 'light' || (e.newValue !== 'dark' && prefersLight()),
    });
  });
}
