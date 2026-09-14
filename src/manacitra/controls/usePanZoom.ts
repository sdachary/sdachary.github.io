import { useCallback, useEffect, useRef, useState } from 'react';

export interface PanZoomView {
  scale: number;
  x: number;
  y: number;
}

const MAX_SCALE = 4;

// Touch/mouse pan-zoom applied to the fitted SVG map (scale 1 = content exactly
// fits the viewport). Zoom is anchored to the cursor / pinch midpoint; pan is
// softly clamped so the map always stays reachable — at fit zoom there is a
// 40%-of-viewport slack so the canvas can be dragged by mouse. Mouse drag
// always pans (armed lazily after ~4px of movement so a click still selects);
// touch drag pan only engages once zoomed in (>1.02), so a plain tap selects.
export function usePanZoom() {
  const [view, setView] = useState<PanZoomView>({ scale: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; cx: number; cy: number; s0: number } | null>(null);
  const drag = useRef<{ x0: number; y0: number; tx0: number; ty0: number } | null>(null);
  const mouseDown = useRef<{ id: number; x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  const rect = useCallback(
    () => svgRef.current?.getBoundingClientRect() ?? { width: 0, height: 0, left: 0, top: 0 },
    [],
  );

  // Elastic pan limit: full travel at zoomed-in scales, plus a fixed slack of
  // 40% of the viewport so the map can be dragged around by mouse even at fit
  // zoom (scale 1, where the fit bounds alone would clamp movement to zero).
  const PAN_SLACK = 0.4;
  const clampBounds = useCallback((s: number, x: number, y: number) => {
    const { width, height } = rect();
    if (width === 0) return { scale: s, x, y };
    const xm = Math.max(0, (width * (s - 1)) / 2 + width * PAN_SLACK);
    const ym = Math.max(0, (height * (s - 1)) / 2 + height * PAN_SLACK);
    return { scale: Math.max(1, Math.min(MAX_SCALE, s)), x: Math.max(-xm, Math.min(xm, x)), y: Math.max(-ym, Math.min(ym, y)) };
  }, [rect]);

  const set = useCallback((s: number, x: number, y: number) => {
    setView(() => clampBounds(s, x, y));
  }, [clampBounds]);

  const reset = useCallback(() => set(1, 0, 0), [set]);

  // wheel zoom (native listener so preventDefault is allowed)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { left, top, width, height } = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      setView(v => {
        const ns = Math.max(1, Math.min(MAX_SCALE, v.scale * factor));
        const cx = e.clientX - left - width / 2;
        const cy = e.clientY - top - height / 2;
        const k = ns / v.scale;
        return clampBounds(ns, v.x * k + cx * (1 - k), v.y * k + cy * (1 - k));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampBounds]);

  // pinch (2 pointers) + drag pan (1 pointer): mouse may pan at any zoom,
  // touch only once zoomed in (>1.02) so a plain tap still selects a service.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      // Mouse drag is armed lazily in onPointerMove once the cursor moves past
      // a small threshold. We hold off on setPointerCapture until then so that
      // a plain press+release still clicks a tile underneath.
      mouseDown.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    svgRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const { left, top, width, height } = rect();
      pinch.current = {
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2 - left - width / 2,
        cy: (a.y + b.y) / 2 - top - height / 2,
        s0: view.scale,
      };
      drag.current = null;
    } else if (pointers.current.size === 1 && view.scale > 1.02) {
      drag.current = { x0: e.clientX, y0: e.clientY, tx0: view.x, ty0: view.y };
    }
  }, [view, rect]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    if (e.pointerType === 'mouse' && !drag.current && mouseDown.current?.id === e.pointerId) {
      const dx = e.clientX - mouseDown.current.x;
      const dy = e.clientY - mouseDown.current.y;
      if (Math.hypot(dx, dy) > 4) {
        svgRef.current?.setPointerCapture(e.pointerId);
        drag.current = { x0: mouseDown.current.x, y0: mouseDown.current.y, tx0: view.x, ty0: view.y };
      }
    }
    if (pinch.current && pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([k]) => k !== e.pointerId);
      if (!other) return;
      const d = Math.hypot(e.clientX - other[1].x, e.clientY - other[1].y);
      const ns = Math.max(1, Math.min(MAX_SCALE, pinch.current.s0 * (d / pinch.current.d0)));
      const k = ns / pinch.current.s0;
      setView(() => clampBounds(ns, pinch.current!.cx * (1 - k), pinch.current!.cy * (1 - k)));
      movedRef.current = true;
    } else if (drag.current) {
      movedRef.current = true;
      const dx = e.clientX - drag.current.x0;
      const dy = e.clientY - drag.current.y0;
      setView(v => clampBounds(v.scale, drag.current!.tx0 + dx, drag.current!.ty0 + dy));
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }, [view, clampBounds]);

  const onPointerEnd = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (mouseDown.current?.id === e.pointerId) mouseDown.current = null;
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      drag.current = { x0: p.x, y0: p.y, tx0: view.x, ty0: view.y };
    } else if (pointers.current.size === 0) {
      drag.current = null;
    }
    if (movedRef.current) setTimeout(() => { movedRef.current = false; }, 60);
  }, [view]);

  return {
    ref: svgRef,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
    style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '50% 50%' },
    view,
    reset,
    isMoved: () => movedRef.current,
  };
}