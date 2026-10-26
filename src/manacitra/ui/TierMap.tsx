import { useMemo } from 'react';
import type { ManacitraData } from '../types';
import ServiceIcon from './ServiceIcon';
import { HOLE_PITCH, PANEL, PITCH_X, ROW_Z } from '../figure/world.mjs';

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

// The dimensional-drawing overlay lives in margins of its own: the rails run
// down the left, the station-width dimension sits above the first column. The
// drawing is schematic (not to scale), so the numbers — pulled straight from
// world.mjs — are the source of truth, exactly as on an engineering sheet where
// the dimension text governs and the drawn length only illustrates.
const LM = 64; // left annotation margin
const TM = 34; // top annotation margin

// one 45° architectural tick at the end of a dimension line
const Tick = ({ x, y }: { x: number; y: number }) => (
  <line className="mc-dim-tick" x1={x - 3.5} y1={y + 3.5} x2={x + 3.5} y2={y - 3.5} />
);

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

  // --- dimensional-drawing annotation ---------------------------------------
  // Real world.mjs constants, drawn as a drafting overlay over the first
  // column: a station-width dimension, a panel-height rail, the three ROW_Z
  // stops, and a leader bubble magnifying a station's jack fan at HOLE_PITCH.
  const col0 = PAD;
  const pill0Y = PAD + HEAD;
  const rect0Top = PAD - 26;
  const rows0 = Math.max(1, zones[0].services.length);
  const rect0Bottom = rect0Top + HEAD + rows0 * ROW + 4;
  const panelH = PANEL.z1 - PANEL.z0; // panel height, from the board itself
  const ringX = col0 + 22; // the lamp + jack icon on a pill
  const ringY = pill0Y + 13;
  const insetX = col0 + COL_W + 44; // the bubble sits in the gap, same height
  const insetY = ringY;
  const insetR = 28;
  const holeGap = HOLE_PITCH * 3; // magnified jack spacing inside the bubble
  // map the ROW_Z stops onto the panel height (bottom row first, as on the board)
  const zSpan = ROW_Z[ROW_Z.length - 1] - ROW_Z[0];
  const railTop = rect0Top + 8;
  const railBot = rect0Bottom - 4;
  const zY = (z: number) => railBot - ((z - ROW_Z[0]) / zSpan) * (railBot - railTop);

  const dims = (
    <g className="mc-map-dims">
      {/* station-cell width, over the first column */}
      <line className="mc-dim-line" x1={col0 + LM} y1={22} x2={col0 + COL_W + LM} y2={22} />
      <Tick x={col0 + LM} y={22} />
      <Tick x={col0 + COL_W + LM} y={22} />
      <line className="mc-dim-ext" x1={col0 + LM} y1={22} x2={col0 + LM} y2={pill0Y + TM} />
      <line className="mc-dim-ext" x1={col0 + COL_W + LM} y1={22} x2={col0 + COL_W + LM} y2={pill0Y + TM} />
      <text className="mc-dim-text" x={col0 + COL_W / 2 + LM} y={15} textAnchor="middle">PITCH_X {PITCH_X}</text>

      {/* panel height, on the outer rail */}
      <line className="mc-dim-line" x1={14} y1={rect0Top + TM} x2={14} y2={rect0Bottom + TM} />
      <Tick x={14} y={rect0Top + TM} />
      <Tick x={14} y={rect0Bottom + TM} />
      <line className="mc-dim-ext" x1={14} y1={rect0Top + TM} x2={col0 - 12 + LM} y2={rect0Top + TM} />
      <line className="mc-dim-ext" x1={14} y1={rect0Bottom + TM} x2={col0 - 12 + LM} y2={rect0Bottom + TM} />
      <text className="mc-dim-text" transform={`translate(7 ${(rect0Top + rect0Bottom) / 2 + TM}) rotate(-90)`} textAnchor="middle">PANEL {panelH}</text>

      {/* the jack-row scale: ROW_Z's three stops, bottom row first */}
      <line className="mc-dim-line" x1={32} y1={zY(ROW_Z[0]) + TM} x2={32} y2={zY(ROW_Z[ROW_Z.length - 1]) + TM} />
      {ROW_Z.map((z) => (
        <g key={z}>
          <Tick x={32} y={zY(z) + TM} />
          <line className="mc-dim-ext" x1={32} y1={zY(z) + TM} x2={col0 - 12 + LM} y2={zY(z) + TM} />
          <text className="mc-dim-text" x={37} y={zY(z) + TM + 3}>{z}</text>
        </g>
      ))}
      <text className="mc-dim-text" x={32} y={zY(ROW_Z[ROW_Z.length - 1]) + TM - 8} textAnchor="middle">ROW_Z</text>

      {/* jack-pitch detail: a leader circle on the pill, magnified in the gap */}
      <circle className="mc-dim-ring" cx={ringX + LM} cy={ringY + TM} r={18} />
      <line className="mc-dim-ext" x1={ringX + 18 + LM} y1={ringY + TM} x2={insetX - insetR + LM} y2={insetY + TM} />
      <text className="mc-dim-text" x={ringX + LM} y={ringY - 23 + TM} textAnchor="middle">A</text>
      <circle className="mc-dim-inset" cx={insetX + LM} cy={insetY + TM} r={insetR} />
      {[-1, 0, 1].map((i) => (
        <circle key={i} className="mc-dim-hole" cx={insetX + i * holeGap + LM} cy={insetY + TM} r={6} />
      ))}
      <line className="mc-dim-line" x1={insetX - holeGap + LM} y1={insetY + 14 + TM} x2={insetX + LM} y2={insetY + 14 + TM} />
      <Tick x={insetX - holeGap + LM} y={insetY + 14 + TM} />
      <Tick x={insetX + LM} y={insetY + 14 + TM} />
      <text className="mc-dim-text" x={insetX - holeGap / 2 + LM} y={insetY + 21 + TM} textAnchor="middle">{HOLE_PITCH}</text>
      <text className="mc-dim-text" x={insetX + LM} y={insetY + insetR + 12 + TM} textAnchor="middle">HOLE_PITCH {HOLE_PITCH}</text>

      {/* the sheet is schematic — say so, as a real drawing would */}
      <text className="mc-dim-note" x={w + LM - 6} y={16} textAnchor="end">SCHEMATIC — NOT TO SCALE</text>
    </g>
  );

  return (
    <div className="mc-map">
      <svg viewBox={`0 0 ${w + LM} ${h + TM}`} role="img" aria-label="Tier map: five tiers, one pill per service, one curve per connection">
        <g transform={`translate(${LM},${TM})`}>
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
                      <circle className="mc-map-lamp" data-on={on ? '' : on === false ? 'off' : undefined} cx={12} cy={13} r={4} />
                      <g className="mc-map-icon" transform="translate(23, 6)"><ServiceIcon svc={svc} size={14} /></g>
                      <text x={41} y={17}>{svc.name}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>

        {dims}
      </svg>
    </div>
  );
}
