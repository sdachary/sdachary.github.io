import { useMemo } from 'react';
import type { ManacitraData } from '../types';

// The reading surface: the same topology as five labelled tier columns, one
// pill per service, one curve per connection. Plain SVG — no layout engine, no
// dependency. The plate shows the board as an object and the model lets you
// turn it; this answers "which tier talks to which, and through what" at a
// glance, which neither of those can.
//
// Column order matches the plate's wall (edge → data → AI → external) with the
// home tier last, so the two views rhyme. A connection whose far end is a zone
// (`to: "oradb"`) anchors to that tier's chip, not to a service.

const ORDER = ['cloudflare', 'oradb', 'oradev', 'external', 'personal'];
const COL_W = 172;
const GAP = 104;
const PAD = 36;
const HEAD = 40;
const ROW = 34;

interface Props {
  data: ManacitraData | null;
  health: { [id: string]: { online: boolean } | undefined };
  selected: string | null;
  hovered: string | null;
  onSelect?: (svcId: string | null) => void;
  onHover?: (svcId: string | null) => void;
}

interface Place { col: number; row: number; x: number; y: number }

export default function TierMap({ data, health, selected, hovered, onSelect, onHover }: Props) {
  const layout = useMemo(() => {
    if (!data) return null;
    const zones = data.zones.slice().sort((a, b) => {
      const ia = ORDER.indexOf(a.id);
      const ib = ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const place = new Map<string, Place>();
    const chip = new Map<string, { x: number; y: number }>();
    let maxRows = 0;
    zones.forEach((z, i) => {
      const x = PAD + i * (COL_W + GAP);
      maxRows = Math.max(maxRows, z.services.length);
      chip.set(z.id, { x: x - 12, y: PAD + 18 }); // land on the column's edge, not its title
      z.services.forEach((svc, j) => {
        place.set(svc.id, { col: i, row: j, x, y: PAD + HEAD + j * ROW });
      });
    });
    const h = PAD * 2 + HEAD + maxRows * ROW;
    const w = PAD * 2 + zones.length * COL_W + (zones.length - 1) * GAP;

    // one curve per connection: forward edges run through the gap between the
    // columns, backward ones dip under the board, same-tier ones loop outside
    // their own column, and zone targets land on the tier chip
    let dipN = 0;
    const forward: { lx: number; ly: number }[] = [];
    const wires = (data.connections || []).map((c, idx) => {
      const a = place.get(c.from);
      const toZone = !place.has(c.to);
      const b = place.get(c.to);
      const target = toZone ? chip.get(c.to) : b;
      if (!a || !target) return null;
      let d: string;
      let lx: number;
      let ly: number;
      if (toZone || (b && b.col > a.col)) {
        const x1 = a.x + COL_W;
        const x2 = target.x;
        const cx = (x1 + x2) / 2;
        d = `M ${x1} ${a.y + 13} C ${cx} ${a.y + 13}, ${cx} ${target.y}, ${x2} ${target.y}`;
        // several wires share one gap; nudge their labels apart so they read
        lx = cx + (toZone ? 14 : 0);
        ly = (a.y + 13 + target.y) / 2;
        const clash = forward.find((f) => Math.abs(f.ly - ly) < 13 && Math.abs(f.lx - lx) < 46);
        if (clash) ly = clash.ly + 13;
        forward.push({ lx, ly });
      } else if (b && b.col === a.col) {
        const x1 = a.x;
        const x2 = b.x;
        const cx = x1 - 44;
        d = `M ${x1} ${a.y + 13} C ${cx} ${a.y + 13}, ${cx} ${b.y + 13}, ${x2} ${b.y + 13}`;
        lx = cx - 4;
        ly = (a.y + b.y) / 2 + 13;
      } else {
        const x1 = a.x;
        const x2 = target.x + (toZone ? 0 : COL_W);
        const dip = h - PAD / 2 + 16 + dipN * 26; // one lane per wire, labels never stack
        dipN += 1;
        d = `M ${x1} ${a.y + 13} C ${x1 - 44} ${dip}, ${x2 + 44} ${dip}, ${x2} ${target.y}`;
        lx = (x1 + x2) / 2;
        ly = dip - 7;
      }
      return { idx, d, lx, ly, a: c.from, b: c.to, label: c.label || '' };
    }).filter(Boolean) as { idx: number; d: string; lx: number; ly: number; a: string; b: string; label: string }[];

    return { zones, place, chip, wires, w: w + 60, h: h + 44 };
  }, [data]);

  if (!layout) return <div className="mc-map" />;
  const { zones, w, h } = layout;

  // a service's wires light when it is selected; hovering lights them too
  const wiresOf = (id: string | null) =>
    id ? new Set(layout.wires.filter((x: { a: string; b: string }) => x.a === id || x.b === id).map((x: { idx: number }) => x.idx)) : null;
  const litWires = wiresOf(selected);
  const hoverWires = wiresOf(hovered);
  const isLit = (idx: number) => litWires?.has(idx) ?? false;
  const isWarm = (idx: number) => !isLit(idx) && (hoverWires?.has(idx) ?? false);

  return (
    <div className="mc-map">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Tier map: five tiers, one pill per service, one curve per connection">
        <g className="mc-map-wires">
          {layout.wires.map((x: { idx: number; d: string; lx: number; ly: number; label: string }) => (
            <g key={x.idx} data-lit={isLit(x.idx) ? '' : undefined} data-warm={isWarm(x.idx) ? '' : undefined}>
              <path d={x.d} className="mc-map-wire" />
              <text x={x.lx} y={x.ly - 5} className="mc-map-wire-label">{x.label}</text>
            </g>
          ))}
        </g>

        {zones.map((z, i) => {
          const x = PAD + i * (COL_W + GAP);
          const rows = Math.max(1, z.services.length);
          return (
            <g key={z.id}>
              <rect className="mc-map-col" x={x - 12} y={PAD - 26} width={COL_W + 24} height={HEAD + rows * ROW + 4} rx={10} />
              <text className="mc-map-tier" x={x + COL_W / 2} y={PAD - 8} textAnchor="middle">{z.label || z.name}</text>
              {z.services.map((svc, j) => {
                const y = PAD + HEAD + j * ROW;
                const on = health[svc.id]?.online;
                return (
                  <g
                    key={svc.id}
                    className="mc-map-svc"
                    data-selected={selected === svc.id ? '' : undefined}
                    data-hovered={hovered === svc.id ? '' : undefined}
                    transform={`translate(${x}, ${y})`}
                    onClick={() => onSelect?.(svc.id)}
                    onMouseEnter={() => onHover?.(svc.id)}
                    onMouseLeave={() => onHover?.(null)}
                  >
                    <title>{svc.name}{on === undefined ? '' : on ? ' · online' : ' · offline'}</title>
                    <rect width={COL_W} height={26} rx={13} />
                    <circle className="mc-map-lamp" data-on={on ? '' : on === false ? 'off' : undefined} cx={14} cy={13} r={4} />
                    <text x={26} y={17}>{svc.name}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
