import { useCallback, useEffect, useRef, useState } from 'react';

// viewBox-based zoom/pan for an SVG plate. Zooming the viewBox (rather than
// CSS-transforming the element) keeps the drawing vector-sharp at any zoom and
// lets the whole plate stay one flat coordinate space, so "centre on this jack"
// is a two-number operation.
//
// scale 1 = the whole plate visible. cx/cy are the viewBox point held at the
// centre of the viewport.

export interface Viewport {
  scale: number;
  cx: number;
  cy: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;

export function useViewport(host: HTMLElement | null, width: number, height: number) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [view, setView] = useState<Viewport>({ scale: 1, cx: width / 2, cy: height / 2 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const moved = useRef(false);

  // The plate is written into the host imperatively, so the svg may not exist
  // yet when the host is first known — watch for it instead of guessing.
  useEffect(() => {
    if (!host) return;
    const find = () => setSvg((host.querySelector('.mc-svg') as SVGSVGElement | null) ?? null);
    find();
    const observer = new MutationObserver(find);
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [host]);

  useEffect(() => {
    if (!svg) return;
    const vw = width / view.scale;
    const vh = height / view.scale;
    svg.setAttribute('viewBox', `${view.cx - vw / 2} ${view.cy - vh / 2} ${vw} ${vh}`);
  }, [svg, view, width, height]);

  // wheel zoom anchored on the cursor
  useEffect(() => {
    const el = svg;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const vw = width / view.scale;
      const px = view.cx - vw / 2 + ((e.clientX - r.left) / r.width) * vw;
      const py = view.cy - height / view.scale / 2 + ((e.clientY - r.top) / r.height) * (height / view.scale);
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      const k = next / view.scale;
      setView(v => ({ scale: next, cx: px + (v.cx - px) * k, cy: py + (v.cy - py) * k }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [svg, view.scale, width, height]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.buttons === 0) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    moved.current = false;
  }, [view.cx, view.cy]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = svg?.getBoundingClientRect();
    if (!r) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) moved.current = true;
    setView(v => ({ ...v, cx: d.cx - (dx / r.width) * (width / v.scale), cy: d.cy - (dy / r.height) * (height / v.scale) }));
  }, [svg, width, height]);

  const onPointerUp = useCallback(() => { drag.current = null; }, []);

  const zoomBy = useCallback((factor: number) => {
    setView(v => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      const k = scale / v.scale;
      return { scale, cx: width / 2 + (v.cx - width / 2) * k, cy: height / 2 + (v.cy - height / 2) * k };
    });
  }, [width, height]);

  const reset = useCallback(() => setView({ scale: 1, cx: width / 2, cy: height / 2 }), [width, height]);

  // put a viewBox point at the centre, at a given zoom
  const centerOn = useCallback((x: number, y: number, scale?: number) => {
    setView(v => ({ scale: scale ?? Math.max(v.scale, 2), cx: x, cy: y }));
  }, []);

  return {
    view,
    zoomBy,
    reset,
    centerOn,
    isMoved: () => moved.current,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
