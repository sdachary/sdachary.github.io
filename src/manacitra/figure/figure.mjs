// figure.mjs — geometry for the Manacitra switchboard plate.
// Draws with the iso kit; when an audit recorder (A + R + settle) is passed,
// registers every solid/tube so painter keys can be solved to zero problems.
import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { tubePieces, tubeSvg } from "../../iso/tube.mjs";
import { DESK, BOX, PANEL, STRIP, FACE_Y, CORD_R, CORD_END } from "./world.mjs";

export const WIDTH = 780;
export const HEIGHT = 560;
const ELEVATION = 27;

const LAMP = { r: 3.4, h: 2.2, dz: 10, glow: 9 };
const JACK = { rIn: 2.0, rOut: 2.8, depth: 1.4, puck: 0.3 };
const PLATE = { w: 26, h: 5, d: 1.4, dz: -10.5 };
const Z0 = PANEL.z0;          // 8 — desk top
const SKIRT_H = 8;            // bay plinth
const BODY_Z = Z0 + SKIRT_H;  // 16
const HEADER_Z = 128;
const RULE_TOP = 132.5;
const RULE_BOTTOM = 124.5;
const DUCT = { y: 56, d: 8, z0: 8, z1: 14 };

const LENS = [
  [LAMP.h, 0], [LAMP.h, 2.85], [LAMP.h + 0.25, 2.75], [LAMP.h + 0.5, 2.5],
  [LAMP.h + 0.7, 2.1], [LAMP.h + 0.85, 1.6], [LAMP.h + 0.95, 1.0],
  [LAMP.h + 1.0, 0.4], [LAMP.h + 1.02, 0],
];
// tip cap radius (2.0) is wider than the cord radius (1.6) so the cord's rim
// lands flat on the plug face and the terminal check reads a clean mount.
const PLUG = [
  [0, 0], [0, 1.0], [2.0, 1.0], [2.8, 1.7], [3.8, 1.7],
  [4.2, 2.2], [9.2, 2.2], [10.6, 2.0], [10.6, 0],
];

export const FIGURE_CSS = `
.mc-stage{position:relative;outline:none}
.mc-stage:focus-visible{outline:2px solid var(--anatomy-blue);outline-offset:2px}
.mc-svg .station{cursor:pointer}
.mc-hit{fill:transparent;stroke:none;pointer-events:all}
.mc-focus{fill:none;stroke:var(--anatomy-blue);stroke-width:1;opacity:0;pointer-events:none}
.station[data-focus] .mc-focus,.station[data-selected] .mc-focus{opacity:1}
.station[data-selected] .mc-focus{stroke:var(--anatomy-strong)}
.lamp-glow{fill:var(--mc-lamp);opacity:0;pointer-events:none;transition:opacity .5s var(--anatomy-ease)}
.station[data-state="on"] .lamp-glow{opacity:.5}
.station[data-hop] .lamp-glow{opacity:.9}
.lamp-lens>.iso-fill,.lamp-lens>.iso-top,.lamp-lens>.iso-shade{fill:var(--mc-lens-off)}
.station[data-state="on"] .lamp-lens>.iso-fill{fill:var(--mc-lens-on)}
.station[data-state="on"] .lamp-lens>.iso-top{fill:var(--mc-lens-top)}
.station[data-state="on"] .lamp-lens>.iso-shade{fill:var(--mc-lens-shade)}
.station[data-hop] .jack-ring>.iso-edge{stroke:var(--mc-lamp)}
.jack{cursor:pointer}
.jack[data-focus] .jack-ring>.iso-edge{stroke:var(--anatomy-blue);stroke-width:1.4}
.cord .tb-body{transition:fill .5s var(--anatomy-ease)}
.cord[data-hop] .tb-body{fill:var(--mc-cord-lit)}
.cord[data-hop] .tb-shine{fill:var(--mc-cord-lit-shine)}
.iso{--mc-lamp:#ffb454;--mc-lens-on:#ffd9a0;--mc-lens-top:#fff0d8;--mc-lens-shade:#d99a4e;--mc-lens-off:#2e2e2e;--mc-cord:#3f3f3f;--mc-cord-lit:#ffb454;--mc-cord-lit-shine:#ffe2b8}
.iso[data-theme="light"]{--mc-lamp:#c26a00;--mc-lens-on:#f0a53a;--mc-lens-top:#ffc879;--mc-lens-shade:#d08b2a;--mc-lens-off:#c9c9cc;--mc-cord:#8a8a8f;--mc-cord-lit:#c26a00;--mc-cord-lit-shine:#f0a53a}
`;

export function computeCamera(world, width = WIDTH, height = HEIGHT) {
  const pts = [
    ...k.boxCorners(DESK, -6, DESK.top),
    ...k.boxCorners({ x: BOX.x, y: BOX.y, w: BOX.w, d: BOX.d, r: BOX.r }, 0, BOX.top + 2),
    ...k.boxCorners({ x: -220, y: DUCT.y - 2, w: 432, d: 12, r: 3 }, 0, DUCT.z1 + 3),
    [120, 10, 12], [190, 34, 12],
  ];
  for (const bay of world.bays) {
    pts.push(...k.boxCorners({ x: bay.x0 - 6, y: PANEL.y - 6, w: bay.w + 12, d: PANEL.d + 14, r: 3 }, 0, 136));
  }
  for (const c of world.conns) pts.push(...c.route);
  return k.fitProjection(pts, width, height, { pad: 34, azimuth: 45, elevation: ELEVATION });
}

export function buildFigure(world, { P, A = null, R = null, settle = null, keys = null } = {}) {
  const items = [];
  let bucket = null;
  const reg = (build) => {
    if (!A || !R) return null;
    const shape = R.solid(build());
    if (bucket) bucket.push(shape);
    return shape;
  };
  const draw = (piece, at, bias, fn) => {
    const shapes = [];
    const prev = bucket;
    bucket = shapes;
    const svg = fn();
    bucket = prev;
    items.push({ piece, at, bias, svg, shapes });
    return svg;
  };

  const L = (d, style) => k.lineSvg(d, style);
  const S = (paths, style) => k.solidSvg(paths, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const path3 = (pts, close = false) =>
    pts.map((p, i) => `${i ? "L" : "M"}${k.iso(p, P).map((n) => Math.round(n * 10) / 10).join(" ")}`).join("") + (close ? "Z" : "");
  const faceRule = (x0, x1, z) => path3([[x0, FACE_Y, z], [x1, FACE_Y, z]]);
  const Fface = (x, z, face = FACE_Y) => G.frameAlong([x, face, z], [0, 1, 0]);

  const discPart = (F, s0, s1, r, tone, name, style = {}) => {
    reg(() => A.disc(F, s0, s1, r, { name }));
    return S(G.disc(s0, s1, r, F, P), { tone, ...style });
  };
  const ringPart = (F, s0, s1, rIn, rOut, tone, name, className) => {
    reg(() => A.ring(F, s0, s1, rIn, rOut, { name }));
    return S(G.ringBand(s0, s1, rIn, rOut, F, P), { tone, className });
  };
  const solidPart = (F, profile, tone, name, className, opts = {}) => {
    reg(() => A.solid(F, profile, { name }));
    return S(G.solidOf(profile, F, P, opts), { tone, className });
  };
  const slabPart = (plan, z, h, tone, name, steps = 6, bevel = 0.4) => {
    reg(() => A.slab(plan, z, h, { name }, steps));
    return S(k.slabOf(plan, z, h, P, steps, bevel), { tone });
  };

  // --- one jack-and-lamp station ------------------------------------------------
  const stationSvg = (st) => {
    const { svc, cx, zc, faceY } = st;
    const out = [];
    const lampZ = zc + LAMP.dz;
    const [lx, ly] = k.iso([cx, faceY + 3.4, lampZ], P);
    out.push(`<circle class="lamp-glow" cx="${Math.round(lx * 10) / 10}" cy="${Math.round(ly * 10) / 10}" r="${LAMP.glow}" filter="url(#mc-glow)"/>`);
    out.push(discPart(Fface(cx, lampZ, faceY), 0, LAMP.h, LAMP.r, "hi", `lamp.${svc.id}`));
    out.push(solidPart(Fface(cx, lampZ, faceY), LENS, "hi", `lens.${svc.id}`, "lamp-lens"));
    st.holes.forEach((h, i) => {
      const F = Fface(h.x, h.z, faceY);
      out.push(`<g class="jack" data-conn="${h.conn}">`);
      out.push(discPart(F, 0, JACK.puck, JACK.rIn, "faint", `puck.${svc.id}.${i}`, { crease: "none" }));
      out.push(ringPart(F, 0, JACK.depth, JACK.rIn, JACK.rOut, "hi", `ring.${svc.id}.${i}`, "jack-ring"));
      out.push("</g>");
    });
    const plate = { x: cx - PLATE.w / 2, y: faceY, w: PLATE.w, d: PLATE.d, r: 0.8 };
    out.push(slabPart(plate, zc - 13, PLATE.h, "lo", `plate.${svc.id}`, 3, 0.2));
    out.push(k.faceTextSvg(k.sideMatrix([cx, faceY + PLATE.d], zc + PLATE.dz, P, "left"), svc.name, { size: 3.1, tone: "hi", anchor: "middle" }));
    const [hx0, hy0] = k.iso([cx - 14, faceY, zc - 15.5], P);
    const [hx1, hy1] = k.iso([cx + 14, faceY, zc + 15.5], P);
    const hit = `<rect class="mc-hit" x="${Math.min(hx0, hx1)}" y="${Math.min(hy0, hy1)}" width="${Math.abs(hx1 - hx0)}" height="${Math.abs(hy1 - hy0)}"/>`;
    const focus = `<rect class="mc-focus" x="${Math.min(hx0, hx1) - 1}" y="${Math.min(hy0, hy1) - 1}" width="${Math.abs(hx1 - hx0) + 2}" height="${Math.abs(hy1 - hy0) + 2}"/>`;
    const state = st.online ? "on" : "off";
    return `<g class="station" data-svc="${svc.id}" data-node="${st.node}" data-state="${state}">${out.join("")}${hit}${focus}</g>`;
  };

  // --- line strip (zone trunk jacks) --------------------------------------------
  const stripSvg = (bay) => {
    const { strip } = bay;
    const out = [];
    const plan = { x: bay.x0 + 8, y: FACE_Y, w: bay.w - 16, d: STRIP.d, r: 1 };
    out.push(slabPart(plan, STRIP.z0, STRIP.z1 - STRIP.z0, "mid", `strip.${bay.zone.id}`, 3, 0.2));
    strip.holes.forEach((h, i) => {
      const F = Fface(h.x, h.z, STRIP.faceY);
      out.push(`<g class="jack" data-conn="${h.conn}">`);
      out.push(discPart(F, 0, JACK.puck, JACK.rIn, "faint", `puck.${bay.zone.id}.${i}`, { crease: "none" }));
      out.push(ringPart(F, 0, JACK.depth, JACK.rIn, JACK.rOut, "hi", `ring.${bay.zone.id}.${i}`, "jack-ring"));
      out.push("</g>");
    });
    return `<g class="strip" data-zone="${bay.zone.id}">${out.join("")}</g>`;
  };

  // --- one upright bay -----------------------------------------------------------
  const baySvg = (bay) => {
    const out = [];
    const skirt = { x: bay.x0 - 2, y: PANEL.y - 1, w: bay.w + 4, d: PANEL.d + 2, r: 2 };
    out.push(slabPart(skirt, Z0, SKIRT_H, "lo", `skirt.${bay.zone.id}`, 4, 0.5));
    const body = { x: bay.x0, y: PANEL.y, w: bay.w, d: PANEL.d, r: 3 };
    out.push(slabPart(body, BODY_Z, PANEL.z1 - BODY_Z, "mid", `bay.${bay.zone.id}`, 10, 1.2));
    const cx = (bay.x0 + bay.x1) / 2;
    out.push(k.faceTextSvg(k.sideMatrix([cx, FACE_Y], HEADER_Z, P, "left"), bay.zone.label, { size: 4.6, tone: "hi", anchor: "middle" }));
    out.push(L(faceRule(bay.x0 + 10, bay.x1 - 10, RULE_TOP), { tone: "lo", free: true }));
    out.push(L(faceRule(bay.x0 + 10, bay.x1 - 10, RULE_BOTTOM), { tone: "lo", free: true }));
    for (const [sx, sz] of [[bay.x0 + 5, 30], [bay.x1 - 5, 30], [bay.x0 + 5, 129], [bay.x1 - 5, 129]]) {
      out.push(discPart(Fface(sx, sz), 0, 0.5, 1.5, "lo", `screw.${bay.zone.id}.${sx}.${sz}`, { crease: "none" }));
      out.push(D([k.iso([sx, FACE_Y + 0.5, sz], P)], { size: 0.4, tone: "lo" }));
    }
    out.push(stripSvg(bay));
    bay.stations.forEach((st) => out.push(stationSvg(st)));
    return out.join("");
  };

  // --- home subscriber box --------------------------------------------------------
  const boxPlan = { x: BOX.x, y: BOX.y, w: BOX.w, d: BOX.d, r: BOX.r };
  const boxSvg = () => {
    const out = [];
    out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(boxPlan, 2), Z0, 0.5, P)}"/>`);
    out.push(slabPart(boxPlan, Z0, BOX.top - Z0, "mid", "box", 8, 1));
    out.push(L(k.planOutline(k.insetPlan(boxPlan, 3), BOX.top, P), { tone: "faint" }));
    const zone = world.box.zone;
    out.push(k.faceTextSvg(k.topMatrix([BOX.x + 10, BOX.y + 16], BOX.top, P, "x"), zone.label, { size: 4.2, tone: "hi" }));
    out.push(L(k.lineOnTop([BOX.x + 10, BOX.y + 23], [BOX.x + 58, BOX.y + 23], BOX.top, P), { tone: "lo", free: true }));
    world.box.stations.forEach((st) => out.push(stationSvg(st)));
    return out.join("");
  };

  // --- desk plate ------------------------------------------------------------------
  const deskSvg = () => {
    const out = [`<path class="iso-halo" d="${k.haloOf(DESK, -5, 5, P)}"/>`];
    const feet = [...k.corners(DESK, 22)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
    for (const [fx, fy] of feet) {
      out.push(S(k.cylinder(fx, fy, 6.5, -5, 5, P, 24), { tone: "lo" }));
      reg(() => A.cylinder(fx, fy, 6.5, -5, 5, { name: "stand.foot" }));
    }
    out.push(slabPart(DESK, 0, DESK.top, "lo", "stand.desk", 10, 1.2));
    out.push(L(k.planOutline(k.insetPlan(DESK, 5), DESK.top, P), { tone: "faint" }));
    const screws = k.corners(DESK, 12);
    out.push(L(screws.map(([sx, sy]) => k.ring(sx, sy, 2.2, DESK.top, P, 16)).join(""), { tone: "lo" }));
    out.push(D(screws.map(([sx, sy]) => k.iso([sx, sy, DESK.top], P)), { size: 0.5 }));
    const strip = { x: -218, y: 44, w: 142, d: 7, r: 1 };
    out.push(slabPart(strip, DESK.top, 0.6, "lo", "tickstrip", 3, 0));
    const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, DESK.top + 0.6, [2, 3.6], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(D([k.iso([strip.x + 2, strip.y + 3.5, DESK.top + 0.6], P), k.iso([strip.x + strip.w - 2, strip.y + 3.5, DESK.top + 0.6], P)], { size: 0.45 }));
    const label = { x: 40, y: 44, w: 150, d: 10, r: 2 };
    out.push(slabPart(label, DESK.top, 1.5, "mid", "desklabel", 3, 0.2));
    out.push(k.faceTextSvg(k.topMatrix([46, 50.5], DESK.top + 1.5, P, "x"), "MANACITRA \u00b7 ACHARYLAB \u00b7 BOARD No. 1", { size: 3.1, tone: "hi" }));
    out.push(L(k.lineOnTop([42, 52.5], [188, 52.5], DESK.top + 1.5, P), { tone: "lo", free: true }));
    return out.join("");
  };

  // --- cable duct (split for depth) -----------------------------------------------
  const ductSvg = (x0, x1, tag) => {
    const out = [];
    const duct = { x: x0, y: DUCT.y, w: x1 - x0, d: DUCT.d, r: 3 };
    out.push(slabPart(duct, DUCT.z0, DUCT.z1 - DUCT.z0, "lo", `duct.${tag}`, 4, 0.4));
    for (const cx of [-160, -60, 40, 140]) {
      if (cx <= x0 + 5 || cx >= x1 - 5) continue;
      out.push(slabPart({ x: cx - 3, y: DUCT.y - 1.5, w: 6, d: DUCT.d + 3, r: 2 }, DUCT.z1, 3, "mid", `ductclamp.${tag}.${cx}`, 3, 0.3));
    }
    return out.join("");
  };

  // --- coiled spare cords -----------------------------------------------------------
  const coilSvg = (cx, cy, r, tag) => {
    const pts = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a), Z0 + CORD_R];
    });
    const runs = A && R ? R.route(`coil.${tag}`, pts, CORD_R, { limp: true, closed: true, touch: ["stand.desk"] }) : [];
    const pieces = tubePieces(pts, CORD_R, P, { closed: true, maxLength: 80, spacing: 2 });
    const svg = `<g class="cord cord-deco" data-coil="${tag}">${pieces.map((pc) => tubeSvg(pc, { tone: "mid" })).join("")}</g>`;
    items.push({ piece: `coil:${tag}`, at: [cx, cy, Z0 + CORD_R], bias: 0, svg, shapes: runs });
  };

  // --- plugs and cords -----------------------------------------------------------------
  const plugSvg = (c, side) => {
    const hole = side === "a" ? c.endA : c.endB;
    const face = (side === "a" ? c.endA : c.endB)[1] - CORD_END;
    const F = G.frameAlong([hole[0], face + JACK.puck, hole[2]], [0, 1, 0]);
    draw(`plug:${c.idx}:${side}`, [hole[0], face + 5, hole[2]], 0, () => solidPart(F, PLUG, "hi", `plug${c.idx}.${side}`));
  };

  // Each cord is one route for the clearance and fold checks, but every short
  // piece of it is its own drawn item: a long cord carries one depth key, and
  // where two cords cross on screen no single key can order them.
  const cordSvg = (c) => {
    const filleted = G.fillet(c.route, 6.5, 10, { P, tube: CORD_R });
    const id = `cord${c.idx}`;
    if (A && R) R.route(id, filleted, CORD_R, { limp: true });
    const pieces = tubePieces(filleted, CORD_R, P, { maxLength: 14, spacing: 2.4, caps: true });
    pieces.forEach((part, index) => {
      const svg = tubeSvg(part, { tone: "mid" });
      if (!svg) return;
      items.push({
        piece: `${id}:${index}`,
        at: part.mid,
        bias: 0,
        svg: `<g class="cord" data-conn="${c.idx}">${svg}</g>`,
        shapes: A && R ? [A.tube(part.points, part.radii)] : [],
        route: id,
        chunk: index,
      });
    });
  };

  // --- assemble -------------------------------------------------------------------------
  draw("desk", [DESK.x, DESK.y, 0], 0, deskSvg);
  for (const bay of world.bays) {
    draw(`bay:${bay.zone.id}`, [(bay.x0 + bay.x1) / 2, PANEL.y, 70], 0, () => baySvg(bay));
  }
  if (world.box) draw("box", [BOX.x + BOX.w / 2, BOX.y, 24], 0, boxSvg);
  draw("duct:left", [-112, DUCT.y, DUCT.z1], 0, () => ductSvg(-220, -4, "left"));
  draw("duct:right", [104, DUCT.y, DUCT.z1], 0, () => ductSvg(-4, 212, "right"));
  coilSvg(140, 24, 13, "0");
  coilSvg(176, 20, 9, "1");
  for (const c of world.conns) {
    plugSvg(c, "a");
    plugSvg(c, "b");
    cordSvg(c);
  }

  if (R && settle) {
    const puts = items.map((it) => R.put({ piece: it.piece, at: it.at, bias: it.bias, svg: it.svg, shapes: it.shapes, route: it.route, chunk: it.chunk }));
    settle(R, P);
    puts.forEach((p, i) => (items[i].key = p.key));
  } else {
    items.forEach((it) => {
      it.key = keys && keys[it.piece] !== undefined ? keys[it.piece] : k.depthOf(it.at, P) + it.bias;
    });
  }
  items.sort((a, b) => a.key - b.key || (a.piece < b.piece ? -1 : 1));

  const defs = `<defs><filter id="mc-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3"/></filter></defs>`;
  const body = defs + items.map((it) => it.svg).join("");
  const label =
    `Isometric technical plate of the AcharyLab cord switchboard: ${world.bays.length} upright bays and a home subscriber box hold ` +
    `${world.stations.length} service jacks with lamps, ${world.conns.length} patch cords carry the connections, and ${world.stats.online} of ` +
    `${world.stats.services} lamps show live services. Click a jack to connect the call.`;
  return {
    svg: k.figureSvg({ width: WIDTH, height: HEIGHT, label, body, className: "mc-svg" }),
    keys: Object.fromEntries(items.map((it) => [it.piece, it.key])),
    width: WIDTH,
    height: HEIGHT,
  };
}
