import { logoFor, type LogoDef } from '../logos';
import { useManacitraStore } from '../store';

// One mark per service. A real brand logo wins when simple-icons has one
// (redis, pihole, tailscale, postgres…); otherwise a monoline type-glyph drawn
// in currentColor so it reads on both the dark and light board. Glyphs are keyed
// by the service's `type` (and a few special `logo` hints), never invented per
// app — the own-apps all resolve to their type's glyph. The brand slugs kept in
// data.json's `logo` that have no simple-icons entry (rails, nextdotjs, hono,
// react, cloudflare, javascript, vite, html5) resolve through `logoFor` only if
// present; anything left over falls to the type glyph.

// map data `type` / `logo` → a drawn glyph key
const GLYPH: Record<string, GlyphKey> = {
  // by type
  database: 'database', cache: 'database',
  api: 'api', app: 'api', service: 'api', saas: 'api',
  auth: 'shield', security: 'shield',
  dns: 'dns', network: 'network',
  monitoring: 'monitor', host: 'server',
  ai: 'ai',
  // brand-ish `logo` hints with no simple-icons mark still get a real glyph
  mail: 'mail', terminal: 'terminal', scm: 'git',
};

export type GlyphKey = keyof typeof PATHS;

// the drawn mark for a service — brand logo if simple-icons has one, else the
// type glyph. Shared with the 3D model, which screen-prints the same marks.
export const glyphFor = (svc: { type: string; logo?: string }): GlyphKey =>
  GLYPH[svc.logo ?? ''] ?? GLYPH[svc.type] ?? 'box';

export { PATHS as GLYPH_PATHS };

// monoline, 24×24, single stroke path each
const PATHS: Record<string, string> = {
  database: 'M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Zm0 0v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
  api: 'M9 7 4 12l5 5M15 7l5 5-5 5M13 5l-2 14',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  monitor: 'M3 5h18v11H3zM9 20h6M12 16v4M7 12l2.5-3 2 2.5L15 8l2 4',
  dns: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.4 3.8 5.4 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3Z',
  network: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 7 6 15M13 7l5 8M7 18h10',
  shield: 'M12 3 5 6v5c0 4.4 3 8 7 10 4-2 7-5.6 7-10V6l-7-3ZM9 12l2 2 4-4',
  ai: 'M12 4v4M12 16v4M4 12h4M16 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8M12 9.5A2.5 2.5 0 1 0 12 14a2.5 2.5 0 0 0 0-4.5Z',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM7.5 7.5h.01M7.5 16.5h.01',
  terminal: 'M5 4h14v16H5zM8 9l2.5 2L8 13M12.5 14H16',
  git: 'M6 3v12M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 8v1a4 4 0 0 1-4 4H6',
  box: 'M4 7l8-3 8 3-8 3-8-3Zm0 0v10l8 3 8-3V7M12 10v10',
};

function Glyph({ k, size }: { k: GlyphKey; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[k]} />
    </svg>
  );
}

function Brand({ def, size, dark }: { def: LogoDef; size: number; dark: boolean }) {
  return (
    <svg width={size} height={size} viewBox={def.vb} aria-hidden="true" focusable="false">
      <path d={def.d} fill={tint(def.color, dark)} />
    </svg>
  );
}

// simple-icons ships each brand's own hex, and several of them are near-black
// (notion #000000, github #181717, sentry #362D59) — invisible on the #0b0b0b
// board. Measure that properly with the WCAG contrast ratio against the board
// rather than raw brightness (bright red scores low on brightness but reads
// fine), and lift only what falls short, blending toward white so the brand hue
// survives. Light board keeps every mark as its true brand color.
const BOARD = { r: 11, g: 11, b: 11 }; // #0b0b0b, --anatomy-page on the dark board
const MIN_CONTRAST = 4.5;

const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const relLum = ({ r, g, b }: { r: number; g: number; b: number }) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hexOf = ({ r, g, b }: { r: number; g: number; b: number }) =>
  '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');

export function tint(hex: string, dark: boolean): string {
  if (!dark) return hex;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  if (contrast(c, BOARD) >= MIN_CONTRAST) return hex;
  // walk toward white until the mark clears the bar; black ends up a light grey,
  // a dark brand red keeps its hue and just gains enough lift to read.
  for (let k = 0; k < 1.0001; k += 1 / 32) {
    const t = { r: c.r + (255 - c.r) * k, g: c.g + (255 - c.g) * k, b: c.b + (255 - c.b) * k };
    if (contrast(t, BOARD) >= MIN_CONTRAST) return hexOf(t);
  }
  return '#ffffff';
}

export default function ServiceIcon({ svc, size = 14 }: { svc: { type: string; logo?: string }; size?: number }) {
  const dark = !useManacitraStore(s => s.highContrast);
  const def = svc.logo ? logoFor(svc.logo) : null;
  if (def) return <Brand def={def} size={size} dark={dark} />;
  return <Glyph k={glyphFor(svc)} size={size} />;
}
