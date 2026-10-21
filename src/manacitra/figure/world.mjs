// world.mjs — pure layout model: bays, stations, jack slots, line strips,
// home box, and cord routes derived from data.json. No kit imports.

export const PITCH_X = 30;                 // station cell width
export const ROW_Z = [40, 74, 108];        // jack-row centre heights (bottom row first)
export const HOLE_PITCH = 6.4;             // jack-hole spacing inside a station (rOut 2.8 + 0.8 clearance)
export const LANE_Y0 = -12.2;              // shallowest cord lane (leaves room to bend out of a plug)
export const LANE_STEP = 3.2;              // cord diameter 2.4 + 0.8 gap
export const BOX_OUT_Y = 82;               // home-box cords leave the face and rise here
export const BOX_TOP_Z = 114;              // over the frame, above the top jack row
export const FACE_Y = -36;                 // wall panel front face
export const PANEL = { y: -44, d: 8, z0: 8, z1: 134 };
export const STRIP = { z0: 16, z1: 24, zc: 20, d: 1.6, faceY: -34.4, x0: 14, pitch: 8 };
export const DESK = { x: -224, y: -44, w: 440, d: 110, r: 10, top: 8 };
export const BOX = { x: -70, y: 17, w: 90, d: 36, r: 4, top: 40, faceY: 53, zc: 24 };
export const CORD_R = 1.2;
export const PLUG_LEN = 10.6;              // plug length beyond its 0.3 proud puck
export const CORD_END = 10.9;              // face -> cord end (0.3 puck + 10.6 plug)
export const BAY_X0 = -210;
export const BAY_GAP = 6;

export const rowsFor = (n) => (n <= 2 ? 1 : n <= 6 ? 2 : 3);

export function buildWorld(data) {
  const zoneIds = new Set(data.zones.map((z) => z.id));
  const nodeOf = (id) => (zoneIds.has(id) ? `zone:${id}` : `svc:${id}`);

  // --- bays along the back wall (edge -> data -> dev -> outside) -----------------
  const WALL_ORDER = ["cloudflare", "oradb", "oradev", "external"];
  const wallZones = data.zones
    .filter((z) => z.id !== "personal")
    .slice()
    .sort((a, b) => {
      const ia = WALL_ORDER.indexOf(a.id);
      const ib = WALL_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  const bays = [];
  let x = BAY_X0;
  for (const zone of wallZones) {
    const n = zone.services.length;
    const rows = rowsFor(n);
    const cols = Math.ceil(n / rows);
    const w = cols * PITCH_X + 16;
    bays.push({
      zone,
      x0: x,
      x1: x + w,
      w,
      rows,
      cols,
      stations: zone.services.map((svc, i) => ({
        svc,
        node: `svc:${svc.id}`,
        place: "wall",
        row: Math.floor(i / cols),
        col: i % cols,
        cx: x + 8 + PITCH_X / 2 + (i % cols) * PITCH_X,
        zc: ROW_Z[Math.floor(i / cols)],
        faceY: FACE_Y,
        holes: [],
      })),
      strip: { zone, node: `zone:${zone.id}`, holes: [] },
    });
    x += w + BAY_GAP;
  }

  // --- home subscriber box on the desk -----------------------------------------
  const home = data.zones.find((z) => z.id === "personal");
  const boxCentre = BOX.x + BOX.w / 2;
  const box = home
    ? {
        zone: home,
        stations: home.services.map((svc, i) => ({
          svc,
          node: `svc:${svc.id}`,
          place: "box",
          cx: boxCentre + (i - (home.services.length - 1) / 2) * PITCH_X,
          zc: BOX.zc,
          faceY: BOX.faceY,
          holes: [],
        })),
      }
    : null;

  const stations = [...bays.flatMap((b) => b.stations), ...(box ? box.stations : [])];
  const stationByNode = new Map(stations.map((s) => [s.node, s]));
  const bayByNode = new Map(bays.map((b) => [b.strip.node, b]));

  // --- which connections touch which node (slot = jack order) -------------------
  const conns = data.connections.map((c, idx) => ({ ...c, idx }));
  const touch = new Map();
  const add = (node, idx) => {
    if (!touch.has(node)) touch.set(node, []);
    touch.get(node).push(idx);
  };
  for (const c of conns) {
    const a = nodeOf(c.from);
    const b = nodeOf(c.to);
    add(a, c.idx);
    if (b !== a) add(b, c.idx);
  }

  // jack holes: n per station, k per zone line strip
  for (const st of stations) {
    const list = touch.get(st.node) || [];
    st.holes = list.map((idx, slot) => ({
      x: st.cx + (slot - (list.length - 1) / 2) * HOLE_PITCH,
      z: st.zc,
      slot,
      conn: idx,
    }));
  }
  for (const bay of bays) {
    const list = touch.get(bay.strip.node) || [];
    bay.strip.holes = list.map((idx, slot) => ({
      x: bay.x0 + STRIP.x0 + slot * STRIP.pitch,
      z: STRIP.zc,
      slot,
      conn: idx,
    }));
  }

  const holeOf = (nodeId, idx) => {
    const st = stationByNode.get(nodeId);
    if (st) return st.holes.find((h) => h.conn === idx);
    const bay = bayByNode.get(nodeId);
    return bay ? bay.strip.holes.find((h) => h.conn === idx) : null;
  };
  const faceOf = (nodeId) => {
    const st = stationByNode.get(nodeId);
    return st ? st.faceY : STRIP.faceY;
  };
  const placeOf = (nodeId) => stationByNode.get(nodeId)?.place || "wall";

  // --- cord routes ---------------------------------------------------------------
  // One cord per depth lane, and lane-mates are x-disjoint (greedy interval
  // colouring), so two cords in the same plane can never cross. Every cord
  // leaves and enters its jack exactly along the plug axis, which keeps the
  // plug tip flush on the jack face for the audit's terminal check.
  for (const c of conns) {
    c.a = nodeOf(c.from);
    c.b = nodeOf(c.to);
    const holeA = holeOf(c.a, c.idx);
    const holeB = holeOf(c.b, c.idx);
    const faceA = faceOf(c.a);
    const faceB = faceOf(c.b);
    c.endA = [holeA.x, faceA + CORD_END, holeA.z];
    c.endB = [holeB.x, faceB + CORD_END, holeB.z];
    c.boxSide = placeOf(c.a) === "box" ? "a" : placeOf(c.b) === "box" ? "b" : null;
    c.kind = c.boxSide ? "box-wall" : "wall-wall";
  }
  // Cord shape in the wall plane (x,z): out of the jack along the plug axis, a
  // flat-topped slack hang, then into the far jack. The depth lane (y) is picked
  // further down, once every jack fan the cord has to clear is known.
  for (const c of conns) {
    const [xA, , zA] = c.endA;
    const [xB, , zB] = c.endB;
    c.dx = xB - xA;
    c.floor = Math.max(12, Math.min(zA, zB) - 8 - Math.min(16, Math.abs(c.dx) * 0.06));
    // Jacks in the same column would send a sagging cord down and back up the
    // same line, so close pairs hang on a circular arc that bulges sideways.
    c.swing = c.boxSide || Math.abs(c.dx) >= 12 ? 0 : 8;
    c.span = !c.boxSide && Math.abs(c.dx) < 5
      ? arcSpan(xA, xB, zA, zB, Math.min(Math.abs(zA - zB) * 0.26, 14))
      : hang(xA, xB, zA, zB, c.floor, c.swing);
    c.lo = Math.min(...c.span.map((p) => p[0]));
    c.hi = Math.max(...c.span.map((p) => p[0]));
  }

  // A cord that falls past another cord's jack has to hang deeper than it: a
  // jack's plug fan spans every shallower lane, so a shallower cord would cut
  // straight through it. Order the wall cords by that constraint, then pack them
  // into lanes whose cords are x-disjoint (same-lane cords can then never meet).
  const wall = conns.filter((c) => !c.boxSide);
  const jacks = wall.map((c) => [[c.endA[0], c.endA[2]], [c.endB[0], c.endB[2]]]);
  const deeper = new Map(wall.map((c) => [c.idx, new Set()]));
  const shallower = new Map(wall.map((c) => [c.idx, new Set()]));
  for (const c of wall) {
    wall.forEach((q, k) => {
      if (q === c) return;
      for (const [jx, jz] of jacks[k]) {
        if (spanNear(c.span, jx, jz, 3.0)) {
          deeper.get(c.idx).add(q.idx);
          shallower.get(q.idx).add(c.idx);
          return;
        }
      }
    });
  }
  const order = [];
  const todo = new Set(wall.map((c) => c.idx));
  while (todo.size) {
    let pick = null;
    for (const idx of todo) {
      if (![...deeper.get(idx)].some((d) => todo.has(d))) { pick = idx; break; }
    }
    if (pick === null) pick = [...todo][0]; // constraint cycle: fall back to file order
    todo.delete(pick);
    order.push(pick);
  }
  const laneOfCord = new Map();
  const lanes = []; // [{ lo, hi }] per lane
  for (const idx of order) {
    const c = wall.find((w) => w.idx === idx);
    let lane = 0;
    for (const d of deeper.get(idx)) lane = Math.max(lane, (laneOfCord.get(d) ?? 0) + 1);
    while (lanes[lane] && lanes[lane].some((o) => !(c.hi < o.lo - 1e-6 || c.lo > o.hi + 1e-6))) lane++;
    (lanes[lane] ||= []).push(c);
    laneOfCord.set(idx, lane);
  }
  // box cords take the deepest lanes, past every wall cord
  for (const c of conns.filter((c) => c.boxSide)) laneOfCord.set(c.idx, lanes.length + conns.filter((b) => b.boxSide).indexOf(c));
  let boxRuns = 0;
  for (const c of conns) {
    const lane = LANE_Y0 + laneOfCord.get(c.idx) * LANE_STEP;
    c.lane = lane;
    if (!c.boxSide) {
      c.route = [c.endA, ...c.span.map(([x, z]) => [x, lane, z]), c.endB];
    } else {
      // Box cords leave the face, rise in front of the box, then run across the
      // frame above the top jack row and drop in their lane to the wall jack.
      // Each gets its own crossing height so the runs cannot meet.
      const topZ = BOX_TOP_Z + boxRuns++ * 4.2;
      const [bx, wx] = c.boxSide === "a" ? [c.endA[0], c.endB[0]] : [c.endB[0], c.endA[0]];
      const [bz, wz] = c.boxSide === "a" ? [c.endA[2], c.endB[2]] : [c.endB[2], c.endA[2]];
      const half = [
        [bx, BOX_OUT_Y, bz],
        [bx, BOX_OUT_Y, topZ],
        [bx, lane, topZ],
        [wx, lane, topZ],
        [wx, lane, wz],
      ];
      c.route = c.boxSide === "a"
        ? [c.endA, ...half, c.endB]
        : [c.endA, ...[...half].reverse(), c.endB];
    }
  }

  // --- graph --------------------------------------------------------------------
  const nodes = new Map();
  for (const st of stations) {
    nodes.set(st.node, {
      id: st.node,
      kind: "svc",
      svc: st.svc,
      zone: data.zones.find((z) => z.services.some((s) => s.id === st.svc.id)),
      station: st,
    });
  }
  for (const bay of bays) {
    nodes.set(bay.strip.node, { id: bay.strip.node, kind: "zone", zone: bay.zone, bay });
  }
  const edges = conns.map((c) => ({ idx: c.idx, a: c.a, b: c.b }));

  // health comes from the same data.json the page polls: a lamp burns only
  // while its service answers.
  const health = data.health || {};
  for (const st of stations) {
    const h = health[st.svc.id];
    st.online = Boolean(h?.online);
    st.checkedAt = h?.checked_at || null;
  }

  const online = Object.values(data.health || {}).filter((h) => h.online).length;
  return {
    data,
    bays,
    box,
    stations,
    conns,
    nodes,
    edges,
    nodeOf,
    stationByNode,
    stats: {
      zones: data.stats?.zones ?? data.zones.length,
      services: data.stats?.total_services ?? stations.length,
      conns: conns.length,
      online: data.stats?.online ?? online,
      generated_at: data.generated_at,
    },
  };
}

// Sample a hanging cord in the wall plane: long first and last gaps (so the
// bend at each plug has room for a soft fillet) and close spacing in between.
function hang(xA, xB, zA, zB, sag, swing = 0, steps = 240, lead = 13, mid = 4) {
  const at = (t) => {
    // flat-topped sag: the cord drops quickly off each plug, hangs level, and
    // climbs steeply into the far jack
    const s = 1 - Math.abs(2 * t - 1) ** 5;
    // the loop swings one way on the way down and the other on the way up, so
    // the cord keeps its speed through the bottom of the sag
    const loop = swing * Math.sin(2 * Math.PI * t);
    return [xA + (xB - xA) * t + loop, zA + (zB - zA) * t + (sag - zA - (zB - zA) * t) * s];
  };
  return resample(at, steps, lead, mid);
}

// Cord between two close jacks: a circular arc bulging away from the column, so
// the up and down legs stay apart and the cord keeps its speed right through the
// bottom of the loop.
function arcSpan(xA, xB, zA, zB, bulge, steps = 240, lead = 13, mid = 4) {
  const dx = xB - xA;
  const dz = zB - zA;
  const chord = Math.hypot(dx, dz);
  const m = [(xA + xB) / 2, (zA + zB) / 2];
  let nx = -dz / chord;
  let nz = dx / chord;
  if (nz > 0) { nx = -nx; nz = -nz; }
  if (nz > -0.2) { nx = -1; nz = 0; }          // near-vertical pair: bulge left
  const R = (chord * chord) / (8 * bulge) + bulge / 2;
  const cx = m[0] - nx * (R - bulge);
  const cz = m[1] - nz * (R - bulge);
  const a0 = Math.atan2(zA - cz, xA - cx);
  const far = Math.atan2(m[1] + nz * bulge - cz, m[0] + nx * bulge - cx);
  let sweep = Math.atan2(zB - cz, xB - cx) - a0;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  if (Math.abs(((far - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > Math.PI / 2) sweep += sweep > 0 ? -2 * Math.PI : 2 * Math.PI;
  const at = (t) => {
    const a = a0 + sweep * t;
    return [cx + R * Math.cos(a), cz + R * Math.sin(a)];
  };
  return resample(at, steps, lead, mid);
}

// Dense arc-length resample with long first/last gaps (room for the plug bends)
// and close spacing in between.
function resample(at, steps, lead, mid) {
  const dense = [];
  for (let i = 0; i <= steps; i++) dense.push(at(i / steps));
  const len = [0];
  for (let i = 1; i <= steps; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = len[steps];
  const pointAt = (s) => {
    let i = 1;
    while (i < steps && len[i] < s) i++;
    const t = (s - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]);
    return [0, 1].map((k) => dense[i - 1][k] + (dense[i][k] - dense[i - 1][k]) * t);
  };
  const gap = Math.min(lead, total * 0.3);
  const out = [dense[0]];
  for (let s = gap; s < total - gap; s += mid) out.push(pointAt(s));
  const last = pointAt(total - gap);
  if (out.at(-1)[0] !== last[0] || out.at(-1)[1] !== last[1]) out.push(last);
  out.push(dense[steps]);
  return out;
}

// Is the [x,z] polyline within `d` of the point (px,pz)?
function spanNear(span, px, pz, d) {
  for (let i = 1; i < span.length; i++) {
    const [x0, z0] = span[i - 1];
    const [x1, z1] = span[i];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const l = dx * dx + dz * dz;
    const t = l < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / l));
    if (Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t)) < d) return true;
  }
  return false;
}
