import { useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useManacitraStore } from './store';
import { logoFor } from './logos';
import { hostingFor } from './hosting';
import { TOKENS, TOKENS_HC } from './tokens';
import { usePanZoom } from './controls/usePanZoom';
import { layout, TILE, TILE_H, TILE_GAP, ROW_PITCH, HEADER, PAD } from './layout';
import type { Tile, ZoneCard } from './layout';
import type { ManacitraData, Zone } from './types';

// --- Label collision avoidance ---
const LABEL_FONT_SIZE = 9.5;
const LABEL_PAD_X = 4;
const LABEL_PAD_Y = 2;
const CHAR_WIDTH = 5.8;

function estimateLabelWidth(text: string): number {
  return text.length * CHAR_WIDTH + LABEL_PAD_X * 2;
}

function resolveLabelOverlaps(labels: { id: string; x: number; y: number; w: number; text: string }[]): Map<string, { x: number; y: number }> {
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const result = new Map<string, { x: number; y: number }>();
  const h = LABEL_FONT_SIZE + LABEL_PAD_Y * 2;

  for (const label of labels) {
    let bestX = label.x;
    let bestY = label.y;
    let found = false;

    // Try offset positions perpendicular to the typical route direction
    const candidates = [
      { dx: 0, dy: 0 },    // original position
      { dx: 0, dy: -14 },  // above
      { dx: 0, dy: 14 },   // below
      { dx: 0, dy: -28 },  // far above
      { dx: 0, dy: 28 },   // far below
      { dx: 12, dy: 0 },   // right
      { dx: -12, dy: 0 },  // left
      { dx: 12, dy: -14 }, // right+above
      { dx: -12, dy: -14 },// left+above
    ];

    for (const c of candidates) {
      const cx = label.x + c.dx;
      const cy = label.y + c.dy;
      const box = { x: cx - label.w / 2, y: cy - h / 2, w: label.w, h };
      const overlaps = placed.some(p =>
        box.x < p.x + p.w && box.x + box.w > p.x &&
        box.y < p.y + p.h && box.y + box.h > p.y
      );
      if (!overlaps) {
        bestX = cx;
        bestY = cy;
        found = true;
        break;
      }
    }

    if (!found) {
      // Brute-force scan for a free slot
      for (let dy = -60; dy <= 60; dy += 7) {
        for (let dx = -30; dx <= 30; dx += 7) {
          if (dx === 0 && dy === 0) continue;
          const cx = label.x + dx;
          const cy = label.y + dy;
          const box = { x: cx - label.w / 2, y: cy - h / 2, w: label.w, h };
          const overlaps = placed.some(p =>
            box.x < p.x + p.w && box.x + box.w > p.x &&
            box.y < p.y + p.h && box.y + box.h > p.y
          );
          if (!overlaps) {
            bestX = cx;
            bestY = cy;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    placed.push({ x: bestX - label.w / 2, y: bestY - h / 2, w: label.w, h });
    result.set(label.id, { x: bestX, y: bestY });
  }
  return result;
}

function cardById(cards: ZoneCard[], id: string) {
  return cards.find(c => c.zone.id === id);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// point on a card edge (face: l/r/t/b), t in 0..1 along that edge
function edgePoint(c: ZoneCard, face: 'l' | 'r' | 't' | 'b', t: number) {
  const pad = PAD;
  const t0 = clamp(t, 0.08, 0.92);
  if (face === 'l') return { x: c.x, y: c.y + pad + t0 * (c.h - pad * 2) };
  if (face === 'r') return { x: c.x + c.w, y: c.y + pad + t0 * (c.h - pad * 2) };
  if (face === 't') return { x: c.x + pad + t0 * (c.w - pad * 2), y: c.y };
  return { x: c.x + pad + t0 * (c.w - pad * 2), y: c.y + c.h };
}

interface Route {
  d: string;
  end: { x: number; y: number };
  angle: number;
  label: { x: number; y: number };
  from: string;
  to: string;
  labelText?: string;
}

function buildRoutes(data: ManacitraData, cards: ZoneCard[]) {
  const tileOf = new Map<string, { tile: Tile; zone: Zone }>();
  for (const card of cards) for (const t of card.tiles) tileOf.set(t.id, { tile: t, zone: card.zone });
  const cardOf = (id: string) => cardById(cards, id);
  const zoneOf = (id: string) => (tileOf.has(id) ? tileOf.get(id)!.zone : cardOf(id)?.zone ?? null);

  // spread exit/entry points along tile edges so multiple arrows to the same block don't stack
  const srcCount = new Map<string, number>();
  const dstCount = new Map<string, number>();
  const nextSrc = (t: Tile) => {
    const k = srcCount.get(t.id) ?? 0;
    srcCount.set(t.id, k + 1);
    return t.y + 12 + (k % 5) * 12;
  };
  const nextDst = (t: Tile) => {
    const k = dstCount.get(t.id) ?? 0;
    dstCount.set(t.id, k + 1);
    return t.x + 10 + (k % 6) * 10;
  };
  const nextDstLane = (t: Tile) => {
    const k = dstCount.get(t.id) ?? 0;
    return t.y - TILE_GAP + 4 + (k % 6) * 3;
  };

  // fan out arrows that share a gutter: intra-card tile-gutter x, and cross-card entry gutter x
  const gutterCount = new Map<number, number>();
  const gutterOffCount = new Map<string, number>();
  const gutterOff = (t: Tile) => {
    const k = gutterOffCount.get(t.id) ?? 0;
    gutterOffCount.set(t.id, k + 1);
    return k * 6;
  };

  // horizontal lane allocator: never let two routes place a horizontal run at the same y over an overlapping x-range
  const hBuckets = new Map<number, Set<number>>();
  const claimH = (x0: number, x1: number, prefY: number) => {
    if (x1 < x0) [x0, x1] = [x1, x0];
    const b0 = Math.floor(x0 / 20), b1 = Math.floor(x1 / 20);
    const used = (y: number) => {
      for (let b = b0; b <= b1; b++) {
        const s = hBuckets.get(b);
        if (s && s.has(y)) return true;
      }
      return false;
    };
    const base = Math.round(prefY);
    let y = base, delta = 0, dir = 6;
    while (used(y)) {
      delta += dir;
      y = base + delta;
      dir = -dir;
    }
    for (let b = b0; b <= b1; b++) {
      let s = hBuckets.get(b);
      if (!s) {
        s = new Set();
        hBuckets.set(b, s);
      }
      s.add(y);
    }
    return y;
  };

  const routes: Route[] = [];
  const intraRoutes: Route[] = [];

  // rightward families: (fromZone, toZone) -> ordered connections, lanes sliced per family
  const rightConnList = data.connections.filter(c => {
    const f = zoneOf(c.from), t = zoneOf(c.to);
    return f && t && f.id !== t.id && cardById(cards, t.id)!.x >= cardById(cards, f.id)!.x + cardById(cards, f.id)!.w;
  });
  const families = new Map<string, { from: Zone; to: Zone; conns: typeof data.connections }>();
  for (const c of rightConnList) {
    const f = zoneOf(c.from)!, t = zoneOf(c.to)!;
    const key = `${f.id}>${t.id}`;
    const fam = families.get(key) ?? { from: f, to: t, conns: [] };
    fam.conns.push(c);
    families.set(key, fam);
  }
  const famList = [...families.values()].map(fam => ({
    ...fam,
    conns: [...fam.conns].sort((x, y) => {
      const a = tileOf.get(x.from);
      const b = tileOf.get(y.from);
      return (a ? a.tile.y : 0) - (b ? b.tile.y : 0);
    }),
  }));
  // divide the corridor among families sharing the same destination card
  const familySlices = new Map<string, { min: number; max: number }>();
  const byToCard = new Map<string, typeof famList>();
  for (const fam of famList) {
    const tc = cardOf(fam.to.id)!;
    const key = `${tc.x},${tc.y}`;
    const list = byToCard.get(key) ?? [];
    list.push(fam);
    byToCard.set(key, list);
  }
  for (const list of byToCard.values()) {
    const fc = cardById(cards, list[0].from.id)!;
    const tc = cardById(cards, list[0].to.id)!;
    // a blocking card pokes into the corridor AND its y-range overlaps the travel band between the two cards
    const travelMin = Math.min(fc.y, tc.y);
    const travelMax = Math.max(fc.y + fc.h, tc.y + tc.h);
    const blockerRight = Math.max(
      0,
      ...cards.filter(c =>
        c.zone.id !== list[0].from.id &&
        c.zone.id !== list[0].to.id &&
        c.x < tc.x &&
        c.x + c.w > fc.x + fc.w &&
        c.y < travelMax &&
        c.y + c.h > travelMin,
      ).map(c => c.x + c.w + 12),
    );
    const corridorMin = Math.max(fc.x + fc.w + 12, blockerRight);
    const corridorMax = tc.x - 12;
    const total = list.reduce((s, f) => s + f.conns.length, 0);
    let offset = 0;
    for (const fam of list) {
      const min = corridorMin + (offset / total) * (corridorMax - corridorMin);
      offset += fam.conns.length;
      const max = corridorMin + (offset / total) * (corridorMax - corridorMin);
      familySlices.set(`${fam.from.id}>${fam.to.id}`, { min, max });
    }
  }

  // per-edge row stacking so arrows leaving/entering the same card row fan out
  const rowOf = (tileY: number, card: ZoneCard) => Math.round((tileY - card.y - HEADER - PAD) / ROW_PITCH);
  const srcRowKey = (c: (typeof data.connections)[number]) => {
    const st = tileOf.get(c.from);
    if (!st) return null;
    const fc = cardOf(zoneOf(c.from)!.id)!;
    return `${fc.y}|${rowOf(st.tile.y, fc)}`;
  };
  const dstRowKey = (c: (typeof data.connections)[number]) => {
    const dt = tileOf.get(c.to);
    if (!dt) return null;
    const tc = cardOf(zoneOf(c.to)!.id)!;
    return `${tc.y}|${rowOf(dt.tile.y, tc)}`;
  };
  const srcRowCounts = new Map<string, number>();
  const srcRowUsed = new Map<string, number>();
  const dstRowCounts = new Map<string, number>();
  const dstRowUsed = new Map<string, number>();
  const leftRowCounts = new Map<string, number>();
  for (const c of rightConnList) {
    const sk = srcRowKey(c);
    if (sk) srcRowCounts.set(sk, (srcRowCounts.get(sk) ?? 0) + 1);
    const dk = dstRowKey(c);
    if (dk) dstRowCounts.set(dk, (dstRowCounts.get(dk) ?? 0) + 1);
  }

  data.connections.forEach(conn => {
    const fromZone = zoneOf(conn.from);
    const toZone = zoneOf(conn.to);
    if (!fromZone || !toZone) return;
    const fromCard = cardOf(fromZone.id)!;
    const toCard = cardOf(toZone.id)!;

    // intra-zone: route inside the card through tile-gap lanes so no line crosses a tile
    if (fromZone.id === toZone.id) {
      const a = tileOf.get(conn.from);
      const b = tileOf.get(conn.to);
      if (!a || !b) return;
      const sy = nextSrc(a.tile);
      const baseLX = a.tile.x - TILE_GAP / 2;
      const gl = gutterCount.get(baseLX) ?? 0;
      gutterCount.set(baseLX, gl + 1);
      const lx = baseLX - gl * 4;
      const lane = nextDstLane(b.tile);
      const tx = nextDst(b.tile);
      const d = `M ${a.tile.x} ${sy} H ${lx} V ${lane} H ${tx} V ${b.tile.y}`;
      intraRoutes.push({
        d,
        end: { x: tx, y: b.tile.y },
        angle: 90,
        label: { x: lx - 8, y: (sy + lane) / 2 },
        from: conn.from,
        to: conn.to,
        labelText: conn.label,
      });
      return;
    }

    // rightward: target card is to the right of source card
    if (toCard.x >= fromCard.x + fromCard.w) {
      const srcT = tileOf.get(conn.from);
      const dstT = tileOf.get(conn.to);
      const slice = familySlices.get(`${fromZone.id}>${toZone.id}`)!;
      const fam = famList.find(f => f.from.id === fromZone.id && f.to.id === toZone.id)!;
      const pos = Math.max(0, fam.conns.findIndex(c => c.from === conn.from && c.to === conn.to));
      const laneX = slice.min + ((pos + 0.5) / Math.max(1, fam.conns.length)) * (slice.max - slice.min);

      // exit the source card on a per-edge stacked y so same-row tiles never share a horizontal run
      const src = srcT
        ? (() => {
            const k = srcRowKey(conn)!;
            const n = srcRowCounts.get(k) ?? 1;
            const u = srcRowUsed.get(k) ?? 0;
            srcRowUsed.set(k, u + 1);
            const y = srcT.tile.y + 10 + (n > 1 ? (u / (n - 1)) * (TILE - 20) : (TILE - 20) / 2);
            return { x: fromCard.x + fromCard.w, y: clamp(y, fromCard.y + PAD + 4, fromCard.y + fromCard.h - PAD - 4) };
          })()
        : edgePoint(fromCard, 'r', 0.5);

      if (dstT) {
        // enter the card on a per-edge stacked y, then through the left gutter to the tile's top edge
        const entry = (() => {
          const k = dstRowKey(conn)!;
          const n = dstRowCounts.get(k) ?? 1;
          const u = dstRowUsed.get(k) ?? 0;
          dstRowUsed.set(k, u + 1);
          const y = dstT.tile.y + 10 + (n > 1 ? (u / (n - 1)) * (TILE - 20) : (TILE - 20) / 2);
          return { x: toCard.x, y: clamp(y, toCard.y + PAD + 4, toCard.y + toCard.h - PAD - 6) };
        })();
        const gutterX = toCard.x + PAD / 2 + gutterOff(dstT.tile);
        const tx = nextDst(dstT.tile);
        const lane = claimH(gutterX, tx, nextDstLane(dstT.tile));
        const srcY = claimH(src.x, laneX, src.y);
        const entryY = claimH(laneX, gutterX, entry.y);
        const d = `M ${src.x} ${srcY} H ${laneX} V ${entryY} H ${gutterX} V ${lane} H ${tx} V ${dstT.tile.y}`;
        routes.push({ d, end: { x: tx, y: dstT.tile.y }, angle: 90, label: { x: laneX + 8, y: (srcY + entryY) / 2 }, from: conn.from, to: conn.to, labelText: conn.label });
        return;
      }

      const dst = { x: toCard.x, y: toCard.y + PAD + (laneX - (fromCard.x + fromCard.w + 12)) / ((toCard.x - 12) - (fromCard.x + fromCard.w + 12)) * (toCard.h - PAD * 2) };
      const srcY = claimH(src.x, laneX, src.y);
      const dY = claimH(laneX, dst.x, dst.y);
      const d = `M ${src.x} ${srcY} H ${laneX} V ${dY} H ${dst.x}`;
      routes.push({ d, end: dst, angle: 0, label: { x: laneX + 8, y: (srcY + dY) / 2 }, from: conn.from, to: conn.to, labelText: conn.label });
      return;
    }

    // leftward: target card is to the left of source card (e.g. oradev → oradb)
    if (toCard.x + toCard.w <= fromCard.x) {
      const srcT = tileOf.get(conn.from);
      const dstT = tileOf.get(conn.to);
      const exRow = srcT ? `${fromCard.y}|${rowOf(srcT.tile.y, fromCard)}` : null;
      const eIdx = exRow ? (() => {
        const n = leftRowCounts.get(exRow) ?? 0;
        leftRowCounts.set(exRow, n + 1);
        return n;
      })() : 0;
      const src = srcT
        ? { x: fromCard.x, y: clamp(srcT.tile.y + 6 + eIdx * 8, fromCard.y + PAD + 4, fromCard.y + fromCard.h - PAD - 4) }
        : edgePoint(fromCard, 'l', 0.5);
      const laneX = (fromCard.x + toCard.x + toCard.w) / 2;
      if (dstT) {
        const entry = { x: toCard.x + toCard.w, y: clamp(dstT.tile.y + TILE_H / 2, toCard.y + PAD + 4, toCard.y + toCard.h - PAD - 6) };
        const gutterX = toCard.x + toCard.w - PAD / 2 - gutterOff(dstT.tile);
        const tx = nextDst(dstT.tile);
        const lane = claimH(gutterX, tx, nextDstLane(dstT.tile));
        const sY = claimH(src.x, laneX, src.y);
        const eY = claimH(laneX, gutterX, entry.y);
        const d = `M ${src.x} ${sY} H ${laneX} V ${eY} H ${gutterX} V ${lane} H ${tx} V ${dstT.tile.y}`;
        routes.push({ d, end: { x: tx, y: dstT.tile.y }, angle: 90, label: { x: laneX - 8, y: (sY + eY) / 2 }, from: conn.from, to: conn.to, labelText: conn.label });
        return;
      }
      const dst = edgePoint(toCard, 'r', clamp((src.y - toCard.y) / toCard.h, 0.15, 0.85));
      const sY = claimH(src.x, laneX, src.y);
      const dY = claimH(laneX, dst.x, dst.y);
      const d = `M ${src.x} ${sY} H ${laneX} V ${dY} H ${dst.x}`;
      routes.push({ d, end: dst, angle: 180, label: { x: laneX - 8, y: (sY + dY) / 2 }, from: conn.from, to: conn.to, labelText: conn.label });
      return;
    }

    // same-column: target card directly below source card (e.g. oradev → external)
    if (Math.abs(toCard.x - fromCard.x) < 1 && toCard.y > fromCard.y) {
      const srcT = tileOf.get(conn.from);
      const dstT = tileOf.get(conn.to);
      const src = srcT
        ? { x: clamp(srcT.tile.x + TILE / 2, fromCard.x + PAD + 6, fromCard.x + fromCard.w - PAD - 6), y: fromCard.y + fromCard.h }
        : edgePoint(fromCard, 'b', 0.5);
      const dst = dstT
        ? { x: clamp(dstT.tile.x + TILE / 2, toCard.x + PAD + 6, toCard.x + toCard.w - PAD - 6), y: toCard.y }
        : edgePoint(toCard, 't', 0.5);
      const midY = claimH(src.x, dst.x, (src.y + dst.y) / 2);
      const d = `M ${src.x} ${src.y} V ${midY} H ${dst.x} V ${dst.y}`;
      routes.push({ d, end: dst, angle: 90, label: { x: (src.x + dst.x) / 2, y: midY - 6 }, from: conn.from, to: conn.to, labelText: conn.label });
      return;
    }

    // upward: target card is above source card
    if (toCard.y + toCard.h <= fromCard.y) {
      const srcT = tileOf.get(conn.from);
      const dstT = tileOf.get(conn.to);
      const src = srcT ? edgePoint(fromCard, 't', (srcT.tile.x - fromCard.x) / fromCard.w)
                       : edgePoint(fromCard, 't', 0.5);
      const dst = dstT ? edgePoint(toCard, 'b', (dstT.tile.x - toCard.x) / toCard.w)
                       : edgePoint(toCard, 'b', (src.x - toCard.x) / toCard.w);
      const corridorMin = toCard.y + toCard.h + 8;
      const corridorMax = fromCard.y - 8;
      const upConns = data.connections.filter(c => {
        const f = zoneOf(c.from), t = zoneOf(c.to);
        if (!f || !t || f.id !== fromZone.id || t.id !== toZone.id) return false;
        const fc = cardOf(f.id)!, tc = cardOf(t.id)!;
        return tc.y + tc.h <= fc.y;
      });
      const pos = Math.max(0, upConns.findIndex(c => c.from === conn.from && c.to === conn.to));
      const laneY = claimH(src.x, dst.x, corridorMin + ((pos + 0.5) / Math.max(1, upConns.length)) * (corridorMax - corridorMin));
      const d = `M ${src.x} ${src.y} V ${laneY} H ${dst.x} V ${dst.y}`;
      routes.push({ d, end: dst, angle: -90, label: { x: (src.x + dst.x) / 2, y: laneY - 6 }, from: conn.from, to: conn.to, labelText: conn.label });
      return;
    }
  });

  return { routes, intraRoutes };
}

function arrowPts(x: number, y: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const s = 8;
  const w = 4.5;
  const tip = `${x},${y}`;
  const b1 = `${x - s * Math.cos(a) + w * Math.cos(a + Math.PI / 2)},${y - s * Math.sin(a) + w * Math.sin(a + Math.PI / 2)}`;
  const b2 = `${x - s * Math.cos(a) - w * Math.cos(a + Math.PI / 2)},${y - s * Math.sin(a) - w * Math.sin(a + Math.PI / 2)}`;
  return `${tip} ${b1} ${b2}`;
}

function LogoMark({ logoKey, size }: { logoKey: string; size: number }) {
  const def = logoFor(logoKey);
  if (!def) return null;
  return (
    <svg viewBox={def.vb} width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={def.d} fill={def.color} />
    </svg>
  );
}

export default function FlatMap({ data }: { data: ManacitraData }) {
  const pz = usePanZoom();
  const { cards, W, H } = useMemo(() => layout(data), [data]);

  const hoveredId = useManacitraStore(s => s.hoveredId);
  const selectedId = useManacitraStore(s => s.selectedId);
  const focusId = useManacitraStore(s => s.focusId);
  const filters = useManacitraStore(s => s.filters);
  const visibleLayers = useManacitraStore(s => s.visibleLayers);
  const searchQuery = useManacitraStore(s => s.searchQuery);
  const reducedMotion = useManacitraStore(s => s.reducedMotion);
  const highContrast = useManacitraStore(s => s.highContrast);
  const resetToken = useManacitraStore(s => s.resetToken);
  const setHovered = useManacitraStore(s => s.setHovered);
  const setSelected = useManacitraStore(s => s.setSelected);
  const setFocusId = useManacitraStore(s => s.setFocusId);

  const T = highContrast ? TOKENS_HC : TOKENS;
  const q = searchQuery.trim().toLowerCase();
  const activeId = hoveredId ?? selectedId;

  const tileById = useMemo(() => {
    const m = new Map<string, { tile: Tile; zone: Zone }>();
    for (const card of cards) for (const t of card.tiles) m.set(t.id, { tile: t, zone: card.zone });
    return m;
  }, [cards]);

  const dimmed = useMemo(() => {
    const s = new Set<string>();
    for (const [id, { zone }] of tileById) {
      const h = data.health[id];
      const statusOk = filters.status.length === 0 || (h && filters.status.includes(h.online ? 'online' : 'offline'));
      const queryOk = !q || id.toLowerCase().includes(q) || zone.name.toLowerCase().includes(q) || zone.label.toLowerCase().includes(q);
      if (!statusOk || !queryOk) s.add(id);
    }
    return s;
  }, [tileById, filters.status, q, data.health]);

  const { routes, intraRoutes } = useMemo(() => buildRoutes(data, cards), [data, cards]);

  // Resolve label overlaps across all routes
  const resolvedLabels = useMemo(() => {
    const allRoutes = [...routes, ...intraRoutes];
    const labelInputs = allRoutes
      .filter(r => r.labelText)
      .map(r => ({
        id: `${r.from}>${r.to}`,
        x: r.label.x,
        y: r.label.y,
        w: estimateLabelWidth(r.labelText!),
        text: r.labelText!,
      }));
    return resolveLabelOverlaps(labelInputs);
  }, [routes, intraRoutes]);

  const allServices = useMemo(() => data.zones.flatMap(z => z.services), [data]);

  const visibleTiles = useMemo(
    () => [...tileById.values()].filter(({ tile }) => !dimmed.has(tile.id)),
    [tileById, dimmed],
  );

  const moveFocus = useCallback((key: string) => {
    if (visibleTiles.length === 0) return null;
    let cur: { cx: number; cy: number };
    const focused = focusId ? tileById.get(focusId) : undefined;
    if (focused) {
      cur = { cx: focused.tile.x + focused.tile.w / 2, cy: focused.tile.y + focused.tile.h / 2 };
    } else {
      cur = { cx: W / 2, cy: H / 2 };
    }
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    let best: string | null = null;
    let bestScore = Infinity;
    for (const { tile } of visibleTiles) {
      const dx = tile.x + tile.w / 2 - cur.cx;
      const dy = tile.y + tile.h / 2 - cur.cy;
      const ok = horizontal
        ? (key === 'ArrowRight' ? dx > 2 : dx < -2)
        : (key === 'ArrowDown' ? dy > 2 : dy < -2);
      if (!ok || (focused && tile.id === focusId)) continue;
      const perp = horizontal ? dy : dx;
      const dist = Math.abs(perp) * 3 + Math.abs(horizontal ? dx : dy);
      if (dist < bestScore) {
        bestScore = dist;
        best = tile.id;
      }
    }
    return best;
  }, [visibleTiles, tileById, focusId, W, H]);

  const openService = useCallback((id: string) => {
    setSelected(id);
    const svc = allServices.find(s => s.id === id);
    if (svc?.url) window.open(svc.url, '_blank', 'noopener,noreferrer');
  }, [allServices, setSelected]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const k = e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'].indexOf(k) === -1) return;
    e.preventDefault();
    if (k === 'Escape') {
      setFocusId(null);
      setHovered(null);
      setSelected(null);
      return;
    }
    if (k === 'Enter' || k === ' ') {
      if (focusId) openService(focusId);
      return;
    }
    const next = moveFocus(k);
    if (next && next !== focusId) {
      setFocusId(next);
      setHovered(next);
    }
  }, [focusId, moveFocus, openService, setFocusId, setHovered, setSelected]);

  useEffect(() => {
    if (focusId && dimmed.has(focusId)) setFocusId(null);
  }, [focusId, dimmed, setFocusId]);

  const resetView = pz.reset;
  useEffect(() => { resetView(); }, [resetToken, resetView]);

  const linkActive = (from: string, to: string) => {
    if (!activeId) return true;
    return from === activeId || to === activeId;
  };

  return (
    <svg
      ref={pz.ref}
      className="mc-map"
      tabIndex={0}
      role="group"
      aria-label="AchayLab infrastructure map. Use arrow keys to move between services, Enter to open, Escape to clear. Pinch, scroll, or drag to zoom."
      onKeyDown={onKeyDown}
      onBlur={() => { if (!pz.ref.current?.contains(document.activeElement)) { setFocusId(null); setHovered(null); } }}
      onClick={e => { if (e.target === pz.ref.current) { setSelected(null); setFocusId(null); } }}
      onClickCapture={e => { if (pz.isMoved()) { e.preventDefault(); e.stopPropagation(); } }}
      {...pz.pointerHandlers}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: T.bgCanvas, touchAction: 'none', transform: pz.style.transform, transformOrigin: pz.style.transformOrigin }}
    >
      <defs>
        <filter id="halo" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor={T.bg} floodOpacity="0.95" />
        </filter>
        <pattern id="mc-dots" width={22} height={22} patternUnits="userSpaceOnUse">
          <circle cx={2} cy={2} r={1} fill={T.ink} opacity={0.45} />
        </pattern>
        <radialGradient id="mc-vignette" cx="50%" cy="44%" r="78%">
          <stop offset="55%" stopColor={T.bgCanvas} stopOpacity="0" />
          <stop offset="100%" stopColor={T.bgCanvas} stopOpacity="0.85" />
        </radialGradient>
      </defs>

      {/* canvas backdrop: dot grid + soft vignette, then one faint tier label per column */}
      <rect x={0} y={0} width={W} height={H} fill="url(#mc-dots)" opacity={0.35} pointerEvents="none" />
      <rect x={0} y={0} width={W} height={H} fill="url(#mc-vignette)" pointerEvents="none" />
      {(() => {
        const cols = new Map<number, ZoneCard>();
        for (const c of cards) {
          const prev = cols.get(c.x);
          if (!prev || c.y < prev.y) cols.set(c.x, c);
        }
        return [...cols.values()].sort((a, b) => a.x - b.x).map((c, i) => (
          <text key={`tier${i}`} x={c.x + c.w / 2} y={c.y - 14} textAnchor="middle"
            fontFamily={T.fontMono} fontSize={9.5} letterSpacing={3} fill={T.inkMuted} opacity={0.6} pointerEvents="none">
            {c.zone.label}
          </text>
        ));
      })()}

      {/* zone cards */}
      {visibleLayers.zones && cards.map((card, zoneIdx) => {
        const zoneDim = card.tiles.every(t => dimmed.has(t.id));
        const tint = card.zone.color;
        const zhLogo = logoFor(card.zone.id);
        const zoneTextX = card.x + PAD + 12 + (zhLogo ? 36 : 0);
        return (
          <motion.g key={`${card.zone.id}-wrap`}
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { delay: zoneIdx * 0.09, duration: 0.45, ease: 'easeOut' }}>
          <g key={card.zone.id} opacity={zoneDim ? 0.4 : 1} style={{ transition: 'opacity .2s' }}>
            <rect x={card.x} y={card.y} width={card.w} height={card.h} rx={16} fill={T.surface} stroke={T.lineStrong} strokeWidth={1.2}
              style={{ filter: 'drop-shadow(0 1px 3px rgba(28,28,26,0.05))' }} />
            <path
              d={`M${card.x + 16},${card.y} H${card.x + card.w - 16} Q${card.x + card.w},${card.y} ${card.x + card.w},${card.y + 16} V${card.y + HEADER} H${card.x} V${card.y + 16} Q${card.x},${card.y} ${card.x + 16},${card.y} Z`}
              fill={tint} opacity={0.10}
            />
            <path
              d={`M${card.x + 1},${card.y + 1} H${card.x + card.w - 1} V${card.y + HEADER - 1} H${card.x + 1} Z`}
              fill="none" stroke={tint} strokeWidth={1} opacity={0.28}
            />
            <rect x={card.x + 1} y={card.y + 1} width={6} height={card.h - 2} rx={3} fill={tint} opacity={0.85} />
            {zhLogo && (
              <g transform={`translate(${card.x + PAD + 12}, ${card.y + 16})`} aria-hidden="true">
                <LogoMark logoKey={card.zone.id} size={20} />
              </g>
            )}
            <text x={zoneTextX} y={card.y + 30} fontFamily={T.fontMono} fontSize={15} fontWeight={600} fill={T.ink} letterSpacing={1}>
              {card.zone.name}
            </text>
            <text x={zoneTextX} y={card.y + 48} fontFamily={T.fontMono} fontSize={10} letterSpacing={2} fill={T.inkMuted}>
              {card.zone.label}{card.zone.subtitle ? ` · ${card.zone.subtitle}` : ''}
            </text>
            {(() => {
              const hosting = hostingFor(card.zone);
              const liveCount = card.tiles.filter(t => data.health[t.id]?.online).length;
              return (
                <>
                  {hosting && (
                    <text x={card.x + card.w - PAD} y={card.y + 30} textAnchor="end" fontFamily={T.fontMono} fontSize={9} letterSpacing={1.5} fill={T.inkMuted}>
                      <tspan fill={tint} fontWeight={700} fontSize={8}>▪ </tspan>{hosting.short}
                    </text>
                  )}
                  <text x={card.x + card.w - PAD} y={card.y + 48} textAnchor="end" fontFamily={T.fontMono} fontSize={10} letterSpacing={1} fill={liveCount === card.tiles.length ? T.inkMuted : tint}>
                    {liveCount}/{card.tiles.length} live
                  </text>
                </>
              );
            })()}
            <line x1={card.x + PAD} y1={card.y + HEADER} x2={card.x + card.w - PAD} y2={card.y + HEADER} stroke={tint} strokeWidth={1} opacity={0.45} />

            {visibleLayers.services && card.tiles.map((tile, tileIdx) => {
              const svc = card.zone.services.find(s => s.id === tile.id)!;
              const h = data.health[tile.id];
              const online = h?.online ?? null;
              const isActive = tile.id === activeId;
              const dim = dimmed.has(tile.id);
              const statusColor = online === null ? T.unknown : online ? T.online : T.offline;
              return (
          <motion.g
            key={`${tile.id}-enter`}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.25 + zoneIdx * 0.09 + tileIdx * 0.03, duration: 0.35, ease: 'easeOut' }}
          >
          <g
            key={tile.id}
            opacity={isActive ? 1 : dim ? 0.3 : 1}
            style={{
              transition: 'opacity .2s, transform .2s ease-out',
              cursor: svc.url ? 'pointer' : 'default',
              transform: isActive && !reducedMotion ? 'translateY(-2px)' : undefined,
            }}
            onMouseEnter={() => setHovered(tile.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={e => {
              e.stopPropagation();
              setSelected(tile.id);
              setFocusId(tile.id);
              if (svc.url) window.open(svc.url, '_blank', 'noopener,noreferrer');
            }}
          >
                  <rect
                    x={tile.x} y={tile.y} width={tile.w} height={tile.h} rx={16}
                    fill={isActive ? T.surfaceBorder : T.bg}
                    stroke={isActive ? T.ink : T.surfaceBorder}
                    strokeWidth={isActive ? 1.6 : 1}
                  />
                  <rect x={tile.x + 5} y={tile.y + tile.h - 5} width={tile.w - 10} height={3} rx={1.5}
                    fill={tint} opacity={isActive ? 0.9 : 0.4} />
                  <g transform={`translate(${tile.x + (tile.w - 26) / 2}, ${tile.y + 8})`}>
                    <LogoMark logoKey={svc.logo} size={26} />
                  </g>
                  <text
                    x={tile.x + tile.w / 2} y={logoFor(svc.logo) ? tile.y + 56 : tile.y + 40}
                    fontFamily={T.fontSans} fontSize={logoFor(svc.logo) ? 10 : 11} fontWeight={600} fill={T.ink}
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {svc.name}
                  </text>
                  <text
                    x={tile.x + tile.w / 2} y={logoFor(svc.logo) ? tile.y + 71 : tile.y + 55}
                    fontFamily={T.fontMono} fontSize={7} fontWeight={500} letterSpacing={1.6}
                    fill={T.inkMuted} textAnchor="middle" opacity={0.75}
                    style={{ pointerEvents: 'none' }}
                  >
                    {svc.type.toUpperCase()}
                  </text>
                  {visibleLayers.labels && (
                    <>
                      {online === false && !reducedMotion && (
                        <circle cx={tile.x + tile.w - 9} cy={tile.y + 9} r={8} fill="none" stroke={T.offline} strokeWidth={1}
                          opacity={0.4} className="mc-offline-halo" />
                      )}
                      <circle cx={tile.x + tile.w - 9} cy={tile.y + 9} r={4.5} fill={statusColor} stroke={T.bg} strokeWidth={1.5}
                        className={online && !reducedMotion ? 'mc-dot-online' : undefined} />
                    </>
                  )}
                  {focusId === tile.id && (
                    <rect x={tile.x} y={tile.y} width={tile.w} height={tile.h} rx={16} fill="none"
                      stroke={T.accent} strokeWidth={1.8} strokeDasharray="5 4" strokeLinecap="round" />
                  )}
                </g>
          </motion.g>
              );
            })}
          </g>
          </motion.g>
        );
      })}

      {/* inter-zone connections (above cards, below intra-zone) */}
      {visibleLayers.connections && routes.map((conn, i) => {
        const isActive = linkActive(conn.from, conn.to);
        const dim = dimmed.has(conn.from) || dimmed.has(conn.to);
        const opacity = isActive ? 0.8 : dim ? 0.12 : 0.42;
        const stroke = isActive ? T.accent : T.ink;
        const dur = (8 + (i % 5) * 2).toFixed(1);
        return (
          <motion.g key={`r${i}`}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.9 + i * 0.04, duration: 0.25 }}>
          <g opacity={opacity} style={{ transition: 'opacity .2s' }}>
            <motion.path d={conn.d} fill="none" stroke={stroke} strokeWidth={isActive ? 2.2 : 1.5} strokeLinecap="round"
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: reducedMotion ? 0 : 0.35 + i * 0.06, duration: 0.55, ease: 'easeOut' }} />
            {!reducedMotion && (
              <circle r={2.4} fill={T.accent}>
                <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={conn.d} />
              </circle>
            )}
          </g>
          </motion.g>
        );
      })}

      {/* intra-zone connections (above cards) */}
      {visibleLayers.connections && intraRoutes.map((conn, i) => {
        const isActive = linkActive(conn.from, conn.to);
        const dim = dimmed.has(conn.from) || dimmed.has(conn.to);
        const opacity = isActive ? 0.9 : dim ? 0.15 : 0.5;
        const stroke = isActive ? T.accent : T.ink;
        return (
          <g key={`i${i}`} opacity={opacity} style={{ transition: 'opacity .2s' }}>
            <motion.path d={conn.d} fill="none" stroke={stroke} strokeWidth={isActive ? 2.2 : 1.5}
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: reducedMotion ? 0 : 0.45 + i * 0.05, duration: 0.5, ease: 'easeOut' }}
              strokeLinecap="round" />
          </g>
        );
      })}

      {/* arrowheads */}
      {visibleLayers.connections && [...routes, ...intraRoutes].map((conn, i) => {
        const isActive = linkActive(conn.from, conn.to);
        const dim = dimmed.has(conn.from) || dimmed.has(conn.to);
        const opacity = isActive ? 0.95 : dim ? 0.15 : 0.5;
        return (
          <g key={`ar${i}`} opacity={opacity} style={{ transition: 'opacity .2s' }}>
            <motion.polygon points={arrowPts(conn.end.x, conn.end.y, conn.angle)} fill={isActive ? T.accent : T.ink}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reducedMotion ? { duration: 0 } : { delay: 0.85 + i * 0.03, duration: 0.25 }} />
          </g>
        );
      })}

      {/* connection labels */}
      {visibleLayers.labels && [...routes, ...intraRoutes].map((conn, i) => {
        const label = conn.labelText ?? data.connections.find(c => c.from === conn.from && c.to === conn.to)?.label;
        if (!label) return null;
        const isActive = linkActive(conn.from, conn.to);
        const dim = dimmed.has(conn.from) || dimmed.has(conn.to);
        const opacity = isActive ? 1 : dim ? 0.15 : 0.6;
        const resolved = resolvedLabels.get(`${conn.from}>${conn.to}`);
        const lx = resolved?.x ?? conn.label.x;
        const ly = resolved?.y ?? conn.label.y;
        return (
          <motion.g key={`l${i}`}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 1.05 + i * 0.03, duration: 0.3 }}>
            <text x={lx} y={ly} fontFamily={T.fontMono} fontSize={9.5}
              fill={isActive ? T.accent : T.ink} opacity={opacity} filter="url(#halo)" style={{ transition: 'opacity .2s' }}>
              {label}
            </text>
          </motion.g>
        );
      })}
      <style>{`
        @keyframes mc-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .mc-dot-online { animation: mc-breathe 3.2s ease-in-out infinite; }
        @keyframes mc-halo { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.12; } }
        .mc-offline-halo { animation: mc-halo 2.4s ease-in-out infinite; }
        .mc-map:focus { outline: none; }
        .mc-map:focus-visible { outline: 1.5px dashed #b5472e; outline-offset: 3px; border-radius: 12px; }
      `}</style>
    </svg>
  );
}
