// live.mjs — runtime wiring for the switchboard plate. No imports.
//
// The figure is build-time topology: every jack hole, lamp and cord carries a
// stable id. This module only reads health and drives selection, so the plate
// never has to be rebuilt when a service goes dark.
//
//   station  <g class="station" data-svc data-node data-state="on|off">
//   jack     <g class="jack" data-conn="<connection index>">
//   cord     <g class="cord"  data-conn="<connection index>">
//
// mountLive(root, world, data, opts) →
//   { select, clear, hover, applyHealth, setQuery, pointOf, destroy }
//
// opts: onSelect(svcId|null)  onHover(svcId|null)  onHealth(health)  defaultReadout

const STILL = "(prefers-reduced-motion: reduce)";
const HOP_DELAY = 130;   // ms between hop levels, so a call lights plug to plug
const TOUR_IDLE = 9000;  // ms of stillness before the idle tour starts
const TOUR_STEP = 5200;  // ms per route in the tour

export function mountLive(root, world, data, opts = {}) {
  const pollMs = opts.pollMs ?? 60000;
  const stage = root.querySelector(".mc-stage") || root;
  const readout = root.querySelector("[data-readout]");
  const reduced = window.matchMedia(STILL);

  const conns = world.conns || [];
  const connByIndex = new Map(conns.map((c) => [c.idx, c]));

  // node id → the cords that touch it
  const connsOf = new Map();
  for (const c of conns) {
    for (const n of [c.a, c.b]) {
      if (!connsOf.has(n)) connsOf.set(n, []);
      connsOf.get(n).push(c);
    }
  }

  // node id → the element that draws it
  const nodeEl = (node) => {
    if (!node) return null;
    if (node.startsWith("svc:")) return stage.querySelector(`.station[data-node="${node}"]`);
    if (node.startsWith("zone:")) return stage.querySelector(`.strip[data-zone="${node.slice(5)}"]`);
    return null;
  };
  const cordEls = (idx) => Array.from(stage.querySelectorAll(`.cord[data-conn="${idx}"]`));

  // service id → display name, for the readout
  const nameOf = new Map();
  for (const st of world.stations || []) nameOf.set(st.svc.id, st.svc.name);

  const stations = () => Array.from(stage.querySelectorAll(".station"));
  const jacks = () => Array.from(stage.querySelectorAll(".jack"));

  let selected = null;
  let hovered = null;
  let tourTimer = 0;
  let tourIndex = 0;
  let idleTimer = 0;

  const say = (text) => {
    if (readout && readout.textContent !== text) readout.textContent = text;
  };

  const clear = () => {
    selected = null;
    for (const el of stage.querySelectorAll("[data-hop],[data-selected]")) {
      el.removeAttribute("data-hop");
      el.removeAttribute("data-selected");
      el.style.transitionDelay = "";
    }
    opts.onSelect?.(null);
  };

  // Light the route out of a node: the node itself, then every cord it holds,
  // then the service on the far end — hop by hop, each level a beat later.
  const select = (node) => {
    clear();
    if (!node) return;
    selected = node;
    const el = nodeEl(node);
    if (el) {
      el.setAttribute("data-selected", "");
      el.style.transitionDelay = "0ms";
    }

    const seen = new Set([node]);
    let frontier = [node];
    for (let hop = 1; hop <= 2 && frontier.length; hop++) {
      const next = [];
      for (const cur of frontier) {
        for (const c of connsOf.get(cur) || []) {
          for (const e of cordEls(c.idx)) {
            e.setAttribute("data-hop", String(hop));
            e.style.transitionDelay = `${hop * HOP_DELAY}ms`;
          }
          const far = c.a === cur ? c.b : c.a;
          if (seen.has(far)) continue;
          seen.add(far);
          const fe = nodeEl(far);
          if (fe) {
            fe.setAttribute("data-hop", String(hop));
            fe.style.transitionDelay = `${hop * HOP_DELAY}ms`;
          }
          // Zone strips are trunk buses: a cord into one is the end of that
          // call, so the walk stops there instead of flooding the bus.
          if (!far.startsWith("zone:")) next.push(far);
        }
      }
      frontier = next;
    }

    const svc = node.startsWith("svc:") ? node.slice(4) : null;
    const label = svc ? nameOf.get(svc) || svc : node.slice(5);
    const health = data?.health?.[svc];
    const state = health ? (health.online ? "online" : "offline") : "unchecked";
    say(`${label} · ${state} · ${seen.size - 1} hop${seen.size === 2 ? "" : "s"}`);
    opts.onSelect?.(svc);
  };

  // The engraved nameplates on the plate are 3-unit type — a diagram, not a
  // label. Hovering a jack shows the real name beside the cursor.
  const tip = document.createElement("div");
  tip.className = "mc-tip";
  tip.setAttribute("aria-hidden", "true");
  root.appendChild(tip);

  const showTip = (svcId, x, y) => {
    if (!svcId) {
      tip.removeAttribute("data-on");
      return;
    }
    const health = data?.health?.[svcId];
    const state = health ? (health.online ? "online" : "offline") : "unchecked";
    tip.textContent = `${nameOf.get(svcId) || svcId} · ${state}`;
    tip.setAttribute("data-on", state);
    const box = root.getBoundingClientRect();
    tip.style.left = `${x - box.left}px`;
    tip.style.top = `${y - box.top}px`;
  };

  // mark a service's jack as hovered without a tooltip (the rail hovers a row,
  // the plate hovers a jack — the tooltip belongs to the pointer)
  const mark = (svcId) => {
    if (hovered === svcId) return;
    for (const el of stage.querySelectorAll("[data-hover]")) el.removeAttribute("data-hover");
    hovered = svcId;
    if (svcId) {
      const el = stage.querySelector(`.station[data-svc="${svcId}"]`);
      if (el) el.setAttribute("data-hover", "");
    }
    opts.onHover?.(svcId);
  };

  const hover = (svcId, x, y) => {
    mark(svcId);
    showTip(svcId, x, y);
  };

  const applyHealth = (d) => {
    if (!d?.health) return;
    for (const st of stations()) {
      const h = d.health[st.dataset.svc];
      st.dataset.state = h?.online ? "on" : "off";
    }
    opts.onHealth?.(d.health);
  };

  // --- pointer ------------------------------------------------------------------
  const onPick = (e) => {
    const jack = e.target.closest?.(".jack");
    if (jack) {
      const c = connByIndex.get(Number(jack.dataset.conn));
      if (c) {
        const far = c.a.startsWith("svc:") ? c.a : c.b;
        select(far);
        return;
      }
    }
    const station = e.target.closest?.(".station");
    if (station) {
      select(station.dataset.node);
      return;
    }
    if (e.target.closest?.(".mc-stage")) clear();
  };
  stage.addEventListener("click", onPick);

  const onMove = (e) => {
    const station = e.target.closest?.(".station");
    const jack = e.target.closest?.(".jack");
    let svcId = null;
    if (station) svcId = station.dataset.svc;
    else if (jack) {
      const c = connByIndex.get(Number(jack.dataset.conn));
      if (c) {
        const far = c.a.startsWith("svc:") ? c.a : c.b;
        svcId = far.startsWith("svc:") ? far.slice(4) : null;
      }
    }
    hover(svcId, e.clientX, e.clientY);
  };
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerleave", () => hover(null, 0, 0));

  // --- keyboard: arrows move between jacks, Enter traces, Escape clears ---------
  const ordered = () => {
    // reading order: by the jack's own position on the plate
    return jacks().sort((a, b) => {
      const pa = a.getBoundingClientRect();
      const pb = b.getBoundingClientRect();
      return pa.top - pb.top || pa.left - pb.left;
    });
  };
  const focusJack = (el) => {
    if (!el) return;
    for (const j of jacks()) j.removeAttribute("data-focus");
    el.setAttribute("data-focus", "");
    el.focus?.();
  };
  const currentJack = () => jacks().find((j) => j.getAttribute("data-focus") !== null);

  stage.addEventListener("keydown", (e) => {
    const list = ordered();
    if (!list.length) return;
    const at = list.indexOf(currentJack());
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusJack(list[(at + 1) % list.length]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusJack(list[(at - 1 + list.length) % list.length]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const jack = currentJack();
      const c = jack && connByIndex.get(Number(jack.dataset.conn));
      if (c) select(c.a.startsWith("svc:") ? c.a : c.b);
    } else if (e.key === "Escape") {
      clear();
      say(opts.defaultReadout || "");
    }
  });

  // --- search: "find a jack" -----------------------------------------------------
  const setQuery = (q) => {
    const needle = String(q || "").trim().toLowerCase();
    if (!needle) return null;
    for (const st of stations()) {
      const id = st.dataset.svc;
      const name = (nameOf.get(id) || "").toLowerCase();
      if (id.toLowerCase().includes(needle) || name.includes(needle)) {
        select(st.dataset.node);
        return id;
      }
    }
    return null;
  };

  // --- health poll ----------------------------------------------------------------
  let pollTimer = 0;
  let stopped = false;
  const poll = async () => {
    try {
      const res = await fetch(opts.dataUrl || "/manacitra/data.json", { cache: "no-store" });
      if (res.ok) applyHealth(await res.json());
    } catch {
      /* offline: the lamps keep their last reading */
    }
    if (!stopped) pollTimer = setTimeout(poll, pollMs);
  };

  // --- idle tour ------------------------------------------------------------------
  const stopTour = () => {
    clearTimeout(tourTimer);
    clearTimeout(idleTimer);
    tourTimer = 0;
    idleTimer = 0;
  };
  const tick = () => {
    if (reduced.matches) return;
    const list = stations();
    if (!list.length) return;
    const st = list[tourIndex++ % list.length];
    select(st.dataset.node);
    tourTimer = setTimeout(tick, TOUR_STEP);
  };
  const armTour = () => {
    stopTour();
    if (reduced.matches) return;
    idleTimer = setTimeout(tick, TOUR_IDLE);
  };
  for (const ev of ["pointerdown", "keydown", "wheel"]) {
    window.addEventListener(ev, armTour, { passive: true });
  }
  armTour();

  applyHealth(data);
  if (opts.defaultReadout) say(opts.defaultReadout);
  pollTimer = setTimeout(poll, pollMs);

  return {
    select,
    clear,
    hover,
    mark,
    applyHealth,
    setQuery,
    // viewBox point of a service's lamp, so the page can centre on it
    pointOf(svcId) {
      const el = stage.querySelector(`.station[data-svc="${svcId}"]`);
      if (!el) return null;
      const b = el.getBBox();
      return [b.x + b.width / 2, b.y + b.height / 2];
    },
    destroy() {
      stopped = true;
      clearTimeout(pollTimer);
      stopTour();
      stage.removeEventListener("click", onPick);
      stage.removeEventListener("pointermove", onMove);
      tip.remove();
    },
  };
}
