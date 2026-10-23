import { useCallback, useEffect, useRef, useState } from 'react';

// viewBox zoom/pan plus a 3D tilt for an SVG plate.
//
// Zoom is the viewBox (not a CSS scale) so the drawing stays vector-sharp at any
// magnification and the whole plate stays one flat coordinate space — which is
// what makes "centre on this jack" two numbers instead of a pixel offset.
//
// The tilt is a CSS 3D rotation of the plate. The drawing is a flat panel, so
// rotating the plane is geometrically honest: no reordering, no occluded-by-
// accident geometry, just the board seen from somewhere else. It also means a
// jack under the pointer is still hit-tested by the browser, not by our maths.
//
// orbit  drag (or one finger)        pan  shift-drag / middle-drag / two fingers
// zoom   wheel or +-                 fit  the zoom readout button

export interface Viewport {
  scale: number;
  cx: number;
  cy: number;
  pitch: number;
  yaw: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const MAX_PITCH = 32;   // degrees; a flat panel past this reads as a card, not a board
const MAX_YAW = 46;
const ORBIT_PER_PX = 0.24;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function useViewport(host: HTMLElement | null, width: number, height: number) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [view, setView] = useState<Viewport>({ scale: 1, cx: width / 2, cy: height / 2, pitch: 0, yaw: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const moved = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ mode: 'orbit' | 'pan'; x: number; y: number; cx: number; cy: number; pitch: number; yaw: number } | null>(null);
  const pinch = useRef<{ d: number; mx: number; my: number; scale: number; cx: number; cy: number } | null>(null);

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

  // tilting exposes the corners of the plate's box, so lean in a little as it
  // turns — the board keeps filling the frame instead of floating in it
  useEffect(() => {
    if (!svg) return;
    const lift = 1 + (Math.abs(view.yaw) + Math.abs(view.pitch)) * 0.0026;
    svg.style.transform =
      view.yaw || view.pitch
        ? `perspective(1700px) rotateX(${view.pitch}deg) rotateY(${view.yaw}deg) scale(${lift.toFixed(3)})`
        : '';
  }, [svg, view.yaw, view.pitch]);

  // wheel zoom, anchored on the cursor while the board is square-on — once it is
  // tilted the cursor no longer maps to a plate point, so zoom on the centre
  useEffect(() => {
    const el = svg;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const next = clamp(v.scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), MIN_SCALE, MAX_SCALE);
      const k = next / v.scale;
      if (v.yaw || v.pitch) {
        setView(s => ({ ...s, scale: next, cx: width / 2 + (s.cx - width / 2) * k, cy: height / 2 + (s.cy - height / 2) * k }));
        return;
      }
      const r = el.getBoundingClientRect();
      const vw = width / v.scale;
      const vh = height / v.scale;
      const px = v.cx - vw / 2 + ((e.clientX - r.left) / r.width) * vw;
      const py = v.cy - vh / 2 + ((e.clientY - r.top) / r.height) * vh;
      setView(s => ({ ...s, scale: next, cx: px + (s.cx - px) * k, cy: py + (s.cy - py) * k }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [svg, width, height]);

  // a drag that ends over a jack must not also select it
  useEffect(() => {
    if (!host) return;
    const onClick = (e: MouseEvent) => {
      if (!moved.current) return;
      e.stopPropagation();
      e.preventDefault();
    };
    host.addEventListener('click', onClick, true);
    return () => host.removeEventListener('click', onClick, true);
  }, [host]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = null;
      pinch.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        scale: view.scale,
        cx: view.cx,
        cy: view.cy,
      };
      return;
    }
    drag.current = {
      mode: e.shiftKey || e.button === 1 ? 'pan' : 'orbit',
      x: e.clientX,
      y: e.clientY,
      cx: view.cx,
      cy: view.cy,
      pitch: view.pitch,
      yaw: view.yaw,
    };
  }, [view]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const two = pinch.current;
    if (two && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const box = (host ?? svg)?.getBoundingClientRect();
      if (!box) return;
      if (Math.hypot(mx - two.mx, my - two.my) > 4 || Math.abs(dist - two.d) > 4) moved.current = true;
      const next = clamp(two.scale * (dist / two.d), MIN_SCALE, MAX_SCALE);
      setView(v => ({
        ...v,
        scale: next,
        cx: two.cx - ((mx - two.mx) / box.width) * (width / next),
        cy: two.cy - ((my - two.my) / box.height) * (height / next),
      }));
      return;
    }

    const d = drag.current;
    if (!d) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      drag.current = null;
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) moved.current = true;

    if (d.mode === 'orbit') {
      setView(v => ({
        ...v,
        yaw: clamp(d.yaw + dx * ORBIT_PER_PX, -MAX_YAW, MAX_YAW),
        pitch: clamp(d.pitch - dy * ORBIT_PER_PX, -MAX_PITCH, MAX_PITCH),
      }));
      return;
    }
    const box = (host ?? svg)?.getBoundingClientRect();
    if (!box) return;
    setView(v => ({ ...v, cx: d.cx - (dx / box.width) * (width / v.scale), cy: d.cy - (dy / box.height) * (height / v.scale) }));
  }, [host, svg, width, height]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setView(v => {
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = scale / v.scale;
      return { ...v, scale, cx: width / 2 + (v.cx - width / 2) * k, cy: height / 2 + (v.cy - height / 2) * k };
    });
  }, [width, height]);

  // "fit" means straight-on and whole — the view you would call home
  const reset = useCallback(() => setView({ scale: 1, cx: width / 2, cy: height / 2, pitch: 0, yaw: 0 }), [width, height]);

  // put a viewBox point at the centre, at a given zoom (keeps the current tilt)
  const centerOn = useCallback((x: number, y: number, scale?: number) => {
    setView(v => ({ ...v, scale: scale ?? Math.max(v.scale, 2), cx: x, cy: y }));
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
