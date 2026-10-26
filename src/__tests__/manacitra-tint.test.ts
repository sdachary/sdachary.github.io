import { describe, it, expect } from 'vitest';
import { tint } from '../manacitra/ui/ServiceIcon';

const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const relLum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
// the dark board is #0b0b0b — the number that actually decides readability
const BOARD = relLum('#0b0b0b');
const contrast = (hex: string) => (Math.max(relLum(hex), BOARD) + 0.05) / (Math.min(relLum(hex), BOARD) + 0.05);

describe('ServiceIcon tint', () => {
  it('leaves every brand color alone on the light board', () => {
    for (const hex of ['#000000', '#181717', '#362D59', '#C72E49', '#F38020'])
      expect(tint(hex, false)).toBe(hex);
  });

  it('lifts unreadable marks to AA contrast without darkening them', () => {
    for (const hex of ['#000000', '#181717', '#362D59', '#96060C', '#C72E49']) {
      expect(contrast(hex)).toBeLessThan(4.5);      // the case being fixed
      const out = tint(hex, true);
      expect(contrast(out)).toBeGreaterThanOrEqual(4.5);
      expect(relLum(out)).toBeGreaterThanOrEqual(relLum(hex));
    }
  });

  it('keeps already-readable brand colors untouched on the dark board', () => {
    for (const hex of ['#F38020', '#FF4438', '#ffffff']) {
      expect(contrast(hex)).toBeGreaterThanOrEqual(4.5);
      expect(tint(hex, true)).toBe(hex);
    }
  });

  it('passes through anything that is not a 6-digit hex', () => {
    expect(tint('currentColor', true)).toBe('currentColor');
    expect(tint('#fff', true)).toBe('#fff');
    expect(tint('rgb(0,0,0)', true)).toBe('rgb(0,0,0)');
  });
});
