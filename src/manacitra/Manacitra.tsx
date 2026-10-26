import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModelApi } from './scene/Model3D';
import './manacitra.css';

// three.js only arrives with the model view; the plate stays light to load
const Model3D = lazy(() => import('./scene/Model3D'));
import ServiceRoster, { type Health } from './ui/ServiceRoster';
import TierMap from './ui/TierMap';
import ServiceDetail from './ui/ServiceDetail';
import { useViewport } from './controls/useViewport';
import { useReducedMotion } from './a11y/useReducedMotion';
import { useManacitraStore } from './store';
import type { ManacitraData } from './types';

type ViewMode = 'plate' | 'model' | 'map';

const PLATE_W = 780;
const PLATE_H = 560;

function Loader({ progress, status }: { progress: number; status: string }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#0b0b0b',
      zIndex: 100, transition: 'opacity 1s ease',
    }}>
      <div style={{
        width: 48, height: 48, border: '1.5px solid rgba(163,163,163,0.12)',
        borderTopColor: '#a3a3a3', borderRadius: '50%',
        animation: 'spin 1.2s cubic-bezier(0.4,0,0.2,1) infinite',
        marginBottom: '2rem',
      }} />
      <h1 style={{ fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-0.02em', color: '#a3a3a3', marginBottom: '.5rem' }}>
        Manacitra
      </h1>
      <p style={{ color: 'rgba(163,163,163,0.35)', fontSize: '.8rem', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.75rem' }}>
        Cord switchboard
      </p>
      <div style={{ width: 160, height: 1.5, background: 'rgba(163,163,163,0.06)', borderRadius: 2, marginTop: '.75rem', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${progress}%`, background: '#a3a3a3', borderRadius: 2, transition: 'width .5s ease' }} />
      </div>
      <p style={{ color: 'rgba(163,163,163,0.25)', fontSize: '.75rem', fontVariantNumeric: 'tabular-nums', marginTop: '.75rem' }}>
        {status}
      </p>
    </div>
  );
}

function Header({ online, total }: { online: number; total: number }) {
  return (
    <div style={{ position: 'fixed', top: '1.25rem', left: '1.25rem', zIndex: 10 }}>
      <nav style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '.5rem 1.1rem',
        background: 'rgba(19,19,19,0.86)', backdropFilter: 'blur(18px)',
        border: '1px solid rgba(163,163,163,0.12)', borderRadius: 100, fontSize: '.8rem',
      }}>
        <span style={{ fontWeight: 500, color: '#e6e6e6' }}>Manacitra</span>
        <span style={{ color: 'rgba(163,163,163,0.25)' }}>·</span>
        <span style={{ color: 'rgba(163,163,163,0.7)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: '#ffb454' }} />
          {online} lit
        </span>
        <span style={{ color: 'rgba(163,163,163,0.4)', fontSize: '.7rem' }}>{total} services</span>
      </nav>
    </div>
  );
}

function Tools({ query, onQuery, theme, onTheme, view, onView }: {
  query: string; onQuery: (q: string) => void; theme: string; onTheme: () => void;
  view: string; onView: (v: ViewMode) => void;
}) {
  return (
    <div className="mc-tools">
      <div className="mc-view-switch" role="group" aria-label="Choose a view of the board">
        <button data-on={view === 'plate'} aria-pressed={view === 'plate'} onClick={() => onView('plate')}>Board</button>
        <button data-on={view === 'model'} aria-pressed={view === 'model'} onClick={() => onView('model')}>Model</button>
        <button data-on={view === 'map'} aria-pressed={view === 'map'} onClick={() => onView('map')}>Map</button>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Find a jack…"
        aria-label="Find a jack"
        className="mc-search"
      />
      <button onClick={onTheme} aria-label="Toggle light and dark plate" className="mc-icon-btn" title="Light / dark plate">
        {theme === 'light' ? '◐' : '◑'}
      </button>
    </div>
  );
}

export default function Manacitra() {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(5);
  const [status, setStatus] = useState('Loading data...');
  const [error, setError] = useState<string | null>(null);
  const [plate, setPlate] = useState<{ html: string; world: any } | null>(null);
  const [health, setHealth] = useState<Health>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const data = useManacitraStore(s => s.data);
  const setData = useManacitraStore(s => s.setData);
  const highContrast = useManacitraStore(s => s.highContrast);
  const setHighContrast = useManacitraStore(s => s.setHighContrast);
  useReducedMotion();

  const [view, setView] = useState<ViewMode>(() => {
    const v = localStorage.getItem('manacitra_view');
    return v === 'model' || v === 'map' ? v : 'plate';
  });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const liveRef = useRef<any>(null);
  const modelRef = useRef<ModelApi | null>(null);
  const dataRef = useRef<ManacitraData | null>(null);
  // the roster is usable before the plate finishes building, so a click that
  // lands in that window is remembered and applied once the board is live
  const pendingPick = useRef<string | null>(null);
  const viewport = useViewport(host, PLATE_W, PLATE_H);

  const { online, total } = useMemo(() => {
    if (!data) return { online: 0, total: 0 };
    let on = 0, t = 0;
    const ids = new Set<string>();
    data.zones.forEach(z => z.services.forEach(s => ids.add(s.id)));
    ids.forEach(id => {
      t++;
      if (data.health[id]?.online) on++;
    });
    return { online: on, total: t };
  }, [data]);

  useEffect(() => {
    fetch('/manacitra/data.json')
      .then(r => r.json())
      .then(async (d: ManacitraData) => {
        setProgress(40); setStatus('Building switchboard...');
        setData(d);
        dataRef.current = d;
        setHealth(d.health || {});
        const [{ buildPlate }, keys] = await Promise.all([
          import('./figure/plate.mjs'),
          fetch('/manacitra/keys.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
        ]);
        setProgress(80); setStatus('Wiring lamps...');
        setPlate(buildPlate(d, keys));
        setProgress(100); setStatus('Ready');
        setLoaded(true);
      })
      .catch(() => { setError('Could not load map data.'); setStatus('Error'); setLoaded(true); });
  }, [setData]);

  // The plate is written into the container imperatively, never as React
  // children: a re-render would otherwise replace the SVG and wipe the live
  // layer's lamp and cord state.
  useEffect(() => {
    if (!plate || !host) return;
    host.innerHTML = plate.html;
    let live: any = null;
    (async () => {
      const { mountLive } = await import('./figure/live.mjs');
      live = mountLive(host, plate.world, dataRef.current, {
        defaultReadout: `${online} of ${total} lamps lit`,
        // the plate stays mounted (and its idle tour keeps ticking) while the
        // model is shown — it must not steer the page at all from there
        onSelect: (id: string | null) => { if (viewRef.current === 'plate') setSelected(id); },
        onHover: (id: string | null) => { if (viewRef.current === 'plate') setHovered(id); },
        onHealth: (h: Health) => setHealth(h),
      });
      liveRef.current = live;
      if (pendingPick.current) {
        const id = pendingPick.current;
        pendingPick.current = null;
        live.select(`svc:${id}`);
        const p = live.pointOf(id);
        if (p) viewport.centerOn(p[0], p[1], Math.max(viewport.view.scale, 2.2));
        setSelected(id);
      }
    })();
    return () => { live?.destroy?.(); liveRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plate, host]);

  const pick = useCallback((id: string) => {
    if (view === 'map') {
      setSelected(id);
      return;
    }
    if (view === 'model') {
      modelRef.current?.focus(id);
      setSelected(id);
      return;
    }
    const live = liveRef.current;
    if (!live) {
      pendingPick.current = id;
      setSelected(id);
      return;
    }
    live.select(`svc:${id}`);
    const p = live.pointOf(id);
    if (p) viewport.centerOn(p[0], p[1], Math.max(viewport.view.scale, 2.2));
    setSelected(id);
  }, [view]);

  const stateOf = (id: string) => (health[id] ? (health[id].online ? 'online' : 'offline') : 'unchecked');

  const onQuery = useCallback((q: string) => {
    setQuery(q);
    const needle = q.trim().toLowerCase();
    if (!needle) return;
    if (view === 'map') {
      const hit = (data?.zones.flatMap((z) => z.services) ?? [])
        .find((sv) => sv.name.toLowerCase().includes(needle) || sv.id.includes(needle));
      if (hit) setSelected(hit.id);
      return;
    }
    if (view === 'model') {
      const hit = (data?.zones.flatMap((z) => z.services) ?? [])
        .find((sv) => sv.name.toLowerCase().includes(needle) || sv.id.includes(needle));
      if (hit) { modelRef.current?.focus(hit.id); setSelected(hit.id); }
      return;
    }
    const live = liveRef.current;
    if (!live) return;
    const id = live.setQuery(q);
    if (id) {
      const p = live.pointOf(id);
      if (p) viewport.centerOn(p[0], p[1], Math.max(viewport.view.scale, 2.2));
    }
  }, [data, view]);

  return (
    <div
      className="iso"
      data-theme={highContrast ? 'light' : 'dark'}
      style={{
        '--mc-rail': '320px',
        background: 'var(--anatomy-page)',
        color: 'var(--anatomy-text)',
        height: '100dvh',
        overflow: 'hidden',
        position: 'relative',
      } as React.CSSProperties}
    >
      {error ? (
        <div className="mc-error">
          <span>⚠ {error}</span>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : !loaded ? <Loader progress={progress} status={status} /> : null}
      {loaded && !error && <Header online={online} total={total} />}
      {loaded && !error && (
        <Tools
          query={query}
          onQuery={onQuery}
          theme={highContrast ? 'light' : 'dark'}
          onTheme={() => setHighContrast(!highContrast)}
          view={view}
          onView={(v) => { setView(v); localStorage.setItem('manacitra_view', v); }}
        />
      )}

      <div className="mc-body">
        <div className="mc-stage-wrap" data-view={view}>
          {/* The plate stays mounted underneath the model: re-building 1.18 MB of SVG
              on every switch would make the toggle feel expensive. */}
          <div className="mc-viewport" style={{ display: view === 'plate' ? undefined : 'none' }} {...viewport.pointerHandlers}>
            {plate && <div ref={setHost} className="mc-plate-host" />}
          </div>
          {view === 'map' && (
            <TierMap
              data={data}
              health={health}
              selected={selected}
              hovered={hovered}
              onSelect={(id) => setSelected(id)}
              onHover={(id) => setHovered(id)}
            />
          )}
          {view === 'model' && (
            <Suspense fallback={<div className="mc-3d-loading">Building the model…</div>}>
              <Model3D
                data={data}
                health={health}
                selected={selected}
                hovered={hovered}
                theme={highContrast ? 'light' : 'dark'}
                onSelect={(id) => { if (id) pick(id); else { setSelected(null); } }}
                onHover={(id, x, y) => { setHovered(id); if (x !== undefined && y !== undefined) setTip({ x, y }); }}
                onReady={(api) => { modelRef.current = api; }}
              />
            </Suspense>
          )}
          {view === 'model' && hovered && tip && (
            <div className="mc-tip" data-on={stateOf(hovered)} style={{ position: 'fixed', left: tip.x, top: tip.y }}>
              {data?.zones.flatMap((z) => z.services).find((sv) => sv.id === hovered)?.name || hovered}
              {' · '}{stateOf(hovered)}
            </div>
          )}
          <div className="mc-zoom" style={{ display: view === 'plate' ? undefined : 'none' }}>
            <button onClick={() => viewport.zoomBy(1 / 1.4)} aria-label="Zoom out">−</button>
            <button onClick={() => viewport.reset()} aria-label="Fit the whole board, straight on">{Math.round(viewport.view.scale * 100)}%</button>
            <button onClick={() => viewport.zoomBy(1.4)} aria-label="Zoom in">+</button>
            <span className="mc-zoom-hint">drag to turn · shift-drag to pan · scroll to zoom</span>
          </div>
          {view === 'model' && (
            <span className="mc-zoom mc-model-hint">
              <span className="mc-zoom-hint">drag to turn · scroll to zoom · click a jack to trace</span>
            </span>
          )}
          {view === 'map' && (
            <span className="mc-zoom mc-model-hint">
              <span className="mc-zoom-hint">hover a service to warm its wires · click to trace</span>
            </span>
          )}
          <p className="mc-legend">
            <span><i className="mc-lamp" data-state="on" /> lit — service is up</span>
            <span><i className="mc-lamp" data-state="off" /> dark — needs attention</span>
            <span><i className="mc-legend-cord" /> a cord is a connection</span>
          </p>
        </div>

        <ServiceRoster
          data={data}
          health={health}
          selected={selected}
          hovered={hovered}
          onPick={pick}
          onHover={(id) => { setHovered(id); liveRef.current?.mark(id); }}
          query={query}
        />
      </div>

      {selected && data && (
        <ServiceDetail data={data} health={health} id={selected} onClose={() => { liveRef.current?.clear(); setSelected(null); }} />
      )}
    </div>
  );
}
