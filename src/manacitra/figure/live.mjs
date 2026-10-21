// live.mjs — runtime wiring for the switchboard (no imports).
// mountLive(root, world, data, opts) mounts selection, hop lighting, polling, tour.
export function mountLive(root, world, data, opts = {}) {
  const { pollMs = 60000, tour = true } = opts;
  const stage = root.querySelector('.mc-stage') || root;
  const readout = root.querySelector('[data-readout]');
  const keys = opts.keys || {};
  const search = opts.search;

  const stations = new Map();
  for (const bay of world.bays || []) {
    for (const st of bay.stations) stations.set(st.node, st);
  }
  if (world.box) {
    for (const st of world.box.stations) stations.set(st.node, st);
  }
  const nodeOf = (id) => (new Set((world.bays || []).map(b => b.zone.id)).has(id) || world.box?.zone.id === id ? `zone:${id}` : `svc:${id}`);
  const connsByNode = new Map();
  for (const c of world.conns) {
    if (!connsByNode.has(c.a)) connsByNode.set(c.a, []);
    if (!connsByNode.has(c.b)) connsByNode.set(c.b, []);
    connsByNode.get(c.a).push(c);
    connsByNode.get(c.b).push(c);
  }

  const jacks = Array.from(stage.querySelectorAll('.station'));
  const lamps = Array.from(stage.querySelectorAll('.station .lamp'));
  const cords = Array.from(stage.querySelectorAll('.cord'));

  const setLamp = (node, state) => {
    for (const el of jacks) {
      if (el.dataset.node === node) el.dataset.state = state;
    }
  };

  const clearHops = () => {
    for (const el of jacks) el.removeAttribute('data-hop');
    for (const el of cords) el.removeAttribute('data-hop');
  };

  const trace = (node, depth = 3) => {
    clearHops();
    const seen = new Set([node]);
    const q = [[node, 0]];
    const hitCords = new Set();
    while (q.length) {
      const [cur, d] = q.shift();
      for (const el of jacks) if (el.dataset.node === cur) el.dataset.hop = String(Math.min(d, 3));
      if (d >= depth) continue;
      for (const c of connsByNode.get(cur) || []) {
        const next = c.a === cur ? c.b : c.a;
        if (!seen.has(next)) { seen.add(next); q.push([next, d + 1]); }
        const cord = Array.from(cords).find(e => e.dataset.conn === String(c.idx));
        if (cord) { cord.dataset.hop = String(Math.min(d + 1, 3)); hitCords.add(cord); }
      }
    }
  };

  const applyHealth = (h) => {
    if (!h) return;
    for (const [id, val] of Object.entries(h)) {
      const st = stations.get(`svc:${id}`) || Array.from(stations.values()).find(s => s.svc?.id === id);
      const node = st ? st.node : `svc:${id}`;
      if (val && val.online) setLamp(node, 'on');
      else setLamp(node, 'off');
    }
  };

  if (data?.health) applyHealth(data.health);

  let timer;
  const poll = async () => {
    try {
      const r = await fetch('/manacitra/data.json', { cache: 'no-store' });
      if (r.ok) applyHealth((await r.json()).health);
    } catch {}
    timer = setTimeout(poll, pollMs);
  };
  timer = setTimeout(poll, pollMs);

  jacks.forEach(el => {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('click', (e) => { e.stopPropagation(); const n = el.dataset.node; trace(n); if (readout) readout.textContent = el.dataset.name || n; });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const n = el.dataset.node; trace(n); }
      if (e.key === 'Escape') { clearHops(); if (readout) readout.textContent = opts.defaultReadout || ''; }
    });
  });

  if (stage) {
    stage.addEventListener('click', (e) => { if (e.target === stage) { clearHops(); if (readout) readout.textContent = opts.defaultReadout || ''; } });
  }

  if (search && typeof search.register === 'function') {
    search.register((q) => {
      const n = q.toLowerCase();
      for (const el of jacks) {
        if ((el.dataset.name || '').toLowerCase().includes(n) || (el.dataset.node || '').includes(n)) { trace(el.dataset.node); el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); break; }
      }
    });
  }

  let tourId = 0;
  if (tour && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && jacks.length) {
    const run = () => {
      const el = jacks[Math.floor(Math.random() * jacks.length)];
      trace(el.dataset.node);
      if (readout) readout.textContent = el.dataset.name || el.dataset.node;
      tourId = setTimeout(run, 4500);
    };
    tourId = setTimeout(run, 2200);
  }

  return () => { clearTimeout(timer); clearTimeout(tourId); };
}
