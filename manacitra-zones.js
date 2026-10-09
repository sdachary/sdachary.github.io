/**
 * manacitra-zones: three zones with service nodes on them and a dashed trunk
 * that connects. The pointer picks a node; the path to it lights hop by hop.
 * Read-out names the zone and the node.
 *
 * Idea: zones/services/connections, hop-by-hop lighting (matches Manacitra).
 */
const {
  Cam, clamp, facing, fit, proj, rings, unproj, spring, stepS,
  mk, place, pointer, put, register, disposer, solid, bezier,
} = HL;

const Z = 3;
const NODE_R = 5;
const ZGAP = 90;
const Y0 = 60;
const YSTEP = ZGAP;
const XMIN = 60, XMAX = 340;

function rnd(a, b) { return a + Math.random() * (b - a); }

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let hopDelay = value;
  const C = Cam(45, 0.5, 1.58);
  fit(C, [[XMIN - 30, Y0 - 20, -8], [XMAX + 30, Y0 + (Z - 1) * YSTEP + 20, -8], [XMIN - 30, Y0 + (Z - 1) * YSTEP + 20, -8], [XMAX + 30, Y0 - 20, -8], [XMIN, Y0, 4], [XMAX, Y0 + YSTEP, 4]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);

  // trunk
  const trunk = mk("path", { class: "dash", d: "" }, g);
  const trunkP = [
    P((XMIN + XMAX) / 2, Y0 - 20, 0),
    P((XMIN + XMAX) / 2, Y0 + (Z - 1) * YSTEP + 20, 0),
  ];
  trunk.setAttribute("d", "M" + trunkP[0][0] + " " + trunkP[0][1] + " L" + trunkP[1][0] + " " + trunkP[1][1]);

  const zones = [];
  for (let z = 0; z < Z; z++) {
    const y = Y0 + z * YSTEP;
    const base = mk("g", {}, g);
    const [pr, pi] = rings(XMIN, y - 4, XMAX, y + 4, 3.2, 1.0);
    put(solid(base), { sil: pr, crease: pi, z0: 0, z1: 0.8 });
    const nodes = [];
    const n = 2 + z;
    for (let i = 0; i < n; i++) {
      const x = XMIN + 20 + i * ((XMAX - XMIN - 40) / (n - 1 || 1));
      const nx = P(x, y, 2);
      const el = mk("circle", { cx: nx[0], cy: nx[1], r: NODE_R, class: "lo" }, g);
      const elHi = mk("circle", { cx: nx[0], cy: nx[1], r: NODE_R * 0.45, class: "nf" }, g);
      nodes.push({ x, y, z, i, nx, el, elHi, lit: 0, t: tween(0), key: `z${z}n${i}` });
    }
    zones.push({ z, y, nodes });
  }

  // build links between nodes vertically-ish along trunk
  const links = [];
  for (let z = 0; z < Z - 1; z++) {
    for (const a of zones[z].nodes) {
      for (const b of zones[z + 1].nodes) {
        if (Math.random() < 0.45) {
          links.push({ a, b, p: mk("path", { class: "dash", d: "" }, g), lit: 0, t: tween(0) });
        }
      }
    }
  }

  function pathBetween(a, b) {
    const m = P((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
    const d = "M" + a.nx[0] + " " + a.nx[1] + " Q" + m[0] + " " + m[1] + " " + b.nx[0] + " " + b.nx[1];
    return d;
  }
  links.forEach((l) => l.p.setAttribute("d", pathBetween(l.a, l.b)));

  function tween(v) { return { v, t: v, s: 0, d: 0, from: v, start: 0 }; }
  function tset(o, v, now, d = 0) { if (v === o.t && d === 0) return; o.from = o.v; o.t = v; o.start = now; o.d = d; o.s = d > 0 ? 0 : 1; }
  function tval(o, now) { if (o.d <= 0) { o.v = o.t; return o.v; } const p = Math.min((now - o.start) / o.d, 1); const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; o.v = o.from + (o.t - o.from) * e; if (p === 1) o.v = o.t; return o.v; }
  function tdone(o, now) { return o.d <= 0 || now - o.start >= o.d; }

  let active = null;
  function resetLit() {
    const now = performance.now();
    zones.flatMap((z) => z.nodes).forEach((n) => { tset(n.t, 0, now, 0); n.el.classList.remove("hi"); n.elHi.setAttribute("opacity", "0"); });
    links.forEach((l) => { tset(l.t, 0, now, 0); l.p.classList.remove("hi"); l.p.classList.add("dash"); });
  }

  function lightPath(target) {
    const now = performance.now();
    resetLit();
    if (!target) { active = null; read.textContent = "rest"; B.wake(); return; }
    active = target;
    const order = [];
    const seen = new Set();
    function bfs(start) {
      const q = [{ n: start, d: 0 }];
      seen.add(start.key);
      const dist = new Map([[start.key, 0]]);
      const prev = new Map();
      let head = 0;
      while (head < q.length) {
        const cur = q[head++];
        for (const l of links) {
          const other = l.a.key === cur.n.key ? l.b : (l.b.key === cur.n.key ? l.a : null);
          if (!other || seen.has(other.key)) continue;
          seen.add(other.key);
          dist.set(other.key, cur.d + 1);
          prev.set(other.key, { n: cur.n, l });
          q.push({ n: other, d: cur.d + 1 });
        }
      }
      return { dist, prev };
    }
    const up = bfs(target);
    for (const nd of zones.flatMap((z) => z.nodes)) {
      if (nd.key === target.key) {
        const d = 0;
        tset(nd.t, 1, now, hopDelay * d);
      } else {
        const d = up.dist.get(nd.key);
        if (d !== undefined) tset(nd.t, 1, now, hopDelay * d);
        else tset(nd.t, 0, now, 0);
      }
    }
    for (const l of links) {
      const da = up.dist.get(l.a.key), db = up.dist.get(l.b.key);
      if ((da !== undefined && db === da + 1) || (db !== undefined && da === db + 1)) {
        const d = Math.min(da || 0, db || 0) + 1;
        tset(l.t, 1, now, hopDelay * d);
      } else {
        tset(l.t, 0, now, 0);
      }
    }
    read.textContent = `z${target.z + 1} · ${target.i + 1}`;
    B.wake();
  }

  const B = register(stage, (_dt, now) => {
    let m = false;
    for (const nd of zones.flatMap((z) => z.nodes)) {
      const v = tval(nd.t, now);
      if (!tdone(nd.t, now)) m = true;
      const op = 0.08 + v * 0.92;
      nd.elHi.setAttribute("opacity", op.toFixed(3));
      if (v > 0.5) { nd.el.classList.add("hi"); } else { nd.el.classList.remove("hi"); }
    }
    for (const l of links) {
      const v = tval(l.t, now);
      if (!tdone(l.t, now)) m = true;
      l.p.classList.toggle("hi", v > 0.4);
      l.p.classList.toggle("dash", v < 0.4);
    }
    return m;
  });
  bag.add(B.unregister);

  bag.add(pointer(stage, {
    move: (p) => {
      const pt = unproj(C, p[0], p[1], 2);
      let best = null, bd = Infinity;
      for (const nd of zones.flatMap((z) => z.nodes)) {
        const d = Math.hypot(pt[0] - nd.x, pt[1] - nd.y);
        if (d < bd) { bd = d; best = nd; }
      }
      if (bd > 28) best = null;
      lightPath(best);
    },
    leave: () => lightPath(null),
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { hopDelay = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "manacitra-zones",
  means: "Three infrastructure zones with service nodes; the path to the node lights hop by hop.",
  rules: [1, 2, 8, 9],
  range: [20, 60, 120],
  tour: [[120, 100], [200, 140], [280, 180], null],
  mount,
});
