import { describe, it, expect } from 'vitest';
import { fitLabel } from '../manacitra/scene/Model3D';

// A cell is 30 world units; the label gets PITCH_X - 5 of it at PPU = 6 px/unit.
const AVAIL = 25 * 6;
// A stand-in for canvas measureText: system-ui is ~0.55em per character.
const measure = (name: string) => (fs: number) => fs * 6 * 0.55 * name.length;

describe('fitLabel', () => {
  it('leaves a short name at full size', () => {
    const { fs, mw } = fitLabel(15, AVAIL, measure('Redis'));
    expect(fs).toBeCloseTo(Math.min(4.2, 15 * 0.48));
    expect(mw).toBeCloseTo(Math.min(6.4, 15 * 0.6));
  });

  it('keeps mark + gap + name inside the cell for a long name', () => {
    for (const name of ['Vishwakarma', 'Chitragupta', 'PostgreSQL 16', 'Sampada API']) {
      const { mw, fs, tw } = fitLabel(15, AVAIL, measure(name));
      expect(mw * 6 + 2.5 * 6 + tw).toBeLessThanOrEqual(AVAIL);
      expect(fs).toBeGreaterThan(1.7 - 1e-9);   // never shrinks past legibility
      expect(mw).toBeGreaterThan(2.6 - 1e-9);
    }
  });

  it('shrinks type before the mark', () => {
    const short = fitLabel(15, AVAIL, measure('Redis'));
    const long = fitLabel(15, AVAIL, measure('Vishwakarma'));
    expect(long.fs).toBeLessThan(short.fs);
    expect(long.mw).toBeCloseTo(short.mw);      // mark untouched by type shrink
  });

  it('falls back to the mark only when type is already at the floor', () => {
    // ~20 chars: too wide for the cell at fs = 1.7 with a full-size mark, so
    // the mark gives way. (Type hits its floor first — never shrunk to nothing.)
    const { mw, fs, tw } = fitLabel(15, AVAIL, measure('x'.repeat(20)));
    expect(fs).toBeCloseTo(1.7);
    expect(mw).toBeLessThan(Math.min(6.4, 15 * 0.6));
    expect(mw * 6 + 2.5 * 6 + tw).toBeLessThanOrEqual(AVAIL);
  });

  it('fits every real service name in the dataset at full mark size', () => {
    // data.json's longest names — none should ever need the mark to shrink
    for (const name of ['PostgreSQL 16', 'Vishwakarma', 'Chitragupta', 'Better-Auth', 'Sampada API']) {
      const { mw, fs, tw } = fitLabel(15, AVAIL, measure(name));
      expect(mw).toBeCloseTo(Math.min(6.4, 15 * 0.6));
      expect(fs).toBeGreaterThan(1.7);
      expect(mw * 6 + 2.5 * 6 + tw).toBeLessThanOrEqual(AVAIL);
    }
  });
});
