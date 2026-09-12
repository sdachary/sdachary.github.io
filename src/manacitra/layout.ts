import type { ManacitraData, Zone } from './types';

export const TILE = 72;
export const TILE_H = 96;
export const TILE_GAP = 24;
export const ROW_PITCH = TILE_H + TILE_GAP;
export const PAD = 26;
export const HEADER = 58;
export const MARGIN = 48;
export const COL_GAP = 200;
export const ROW_GAP = 150;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Tile extends Rect { id: string }
export interface ZoneCard extends Rect { zone: Zone; tiles: Tile[] }

export function gridFor(n: number) {
  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
  return { cols, rows: Math.ceil(n / cols) };
}

export function zoneSize(n: number) {
  const { cols, rows } = gridFor(n);
  // MIN_CARD_W keeps zone-name + right-aligned hosting tag from colliding on tiny zones
  const w = Math.max(PAD * 2 + cols * (TILE + TILE_GAP) - TILE_GAP, 260);
  const h = HEADER + PAD + rows * ROW_PITCH - TILE_GAP + PAD;
  return { w, h };
}

export function layout(data: ManacitraData): { cards: ZoneCard[]; W: number; H: number } {
  const sized = data.zones.map(z => ({ zone: z, size: zoneSize(z.services.length) }));
  const get = (id: string) => sized.find(s => s.zone.id === id)!;

  const cloudflare = get('cloudflare');
  const oradb = get('oradb');
  const oradev = get('oradev');
  const external = get('external');
  const personal = get('personal');

  // Three-column facade: EDGE tier top-left, oradb middle (traffic sink),
  // oradev right (AI tier). Personal (home) sits below oradb in the middle
  // column so its Tailscale/DNS edges to oradev flow rightward through the
  // clear B→C corridor instead of a full-width lane that crossed oradb.
  // External sits below oradev so MCP→Notion drops straight down the column.
  const colB = Math.max(MARGIN + cloudflare.size.w, MARGIN + 316) + COL_GAP;
  const colC = colB + oradb.size.w + COL_GAP;

  const place = (entry: { zone: Zone; size: { w: number; h: number } }, x: number, y: number): ZoneCard => {
    const { zone, size } = entry;
    const { cols } = gridFor(zone.services.length);
    const tiles: Tile[] = zone.services.map((svc, i) => ({
      id: svc.id,
      x: x + PAD + (i % cols) * (TILE + TILE_GAP),
      y: y + HEADER + PAD + Math.floor(i / cols) * ROW_PITCH,
      w: TILE,
      h: TILE_H,
    }));
    return { zone, x, y, w: size.w, h: size.h, tiles };
  };

  const cards = [
    place(cloudflare, MARGIN, MARGIN),
    place(oradb, colB, MARGIN),
    place(oradev, colC, MARGIN),
    place(personal, colB, MARGIN + oradb.size.h + ROW_GAP),
    place(external, colC, MARGIN + oradev.size.h + ROW_GAP),
  ];

  const W = colC + oradev.size.w + MARGIN;
  const H = Math.max(
    MARGIN + oradb.size.h + ROW_GAP + personal.size.h,
    MARGIN + oradev.size.h + ROW_GAP + external.size.h,
  ) + MARGIN;
  return { cards, W, H };
}