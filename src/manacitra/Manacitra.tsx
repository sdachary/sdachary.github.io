import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './manacitra.css';
import ServiceRoster, { type Health } from './ui/ServiceRoster';
import ServiceDetail from './ui/ServiceDetail';
import { useViewport } from './controls/useViewport';
import { useReducedMotion } from './a11y/useReducedMotion';
import { useManacitraStore } from './store';
import type { ManacitraData } from './types';

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

function Tools({ query, onQuery, theme, onTheme }: {
  query: string; onQuery: (q: string) => void; theme: string; onTheme: () => void;
}) {
  return (
    <div className="mc-tools">
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
  const [query, setQuery] = useState('');
  const data = useManacitraStore(s => s.data);
  const setData = useManacitraStore(s => s.setData);
  const highContrast = useManacitraStore(s => s.highContrast);
  const setHighContrast = useManacitraStore(s => s.setHighContrast);
  useReducedMotion();

  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const liveRef = useRef<any>(null);
  const dataRef = useRef<ManacitraData | null>(null);
  // the roster is usable before the plate finishes building, so a click that
  // lands in that window is remembered and applied once the board is live
  const pendingPick = useRef<string | null>(null);
  const view = useViewport(host, PLATE_W, PLATE_H);

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
        onSelect: (id: string | null) => setSelected(id),
        onHover: (id: string | null) => setHovered(id),
        onHealth: (h: Health) => setHealth(h),
      });
      liveRef.current = live;
      if (pendingPick.current) {
        const id = pendingPick.current;
        pendingPick.current = null;
        live.select(`svc:${id}`);
        const p = live.pointOf(id);
        if (p) view.centerOn(p[0], p[1], Math.max(view.view.scale, 2.2));
        setSelected(id);
      }
    })();
    return () => { live?.destroy?.(); liveRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plate, host]);

  const pick = useCallback((id: string) => {
    const live = liveRef.current;
    if (!live) {
      pendingPick.current = id;
      setSelected(id);
      return;
    }
    live.select(`svc:${id}`);
    const p = live.pointOf(id);
    if (p) view.centerOn(p[0], p[1], Math.max(view.view.scale, 2.2));
    setSelected(id);
  }, [view]);

  const onQuery = useCallback((q: string) => {
    setQuery(q);
    const live = liveRef.current;
    if (!live || !q.trim()) return;
    const id = live.setQuery(q);
    if (id) {
      const p = live.pointOf(id);
      if (p) view.centerOn(p[0], p[1], Math.max(view.view.scale, 2.2));
    }
  }, [view]);

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
        />
      )}

      <div className="mc-body">
        <div className="mc-stage-wrap">
          <div className="mc-viewport" {...view.pointerHandlers}>
            {plate && <div ref={setHost} className="mc-plate-host" />}
          </div>
          <div className="mc-zoom">
            <button onClick={() => view.zoomBy(1 / 1.4)} aria-label="Zoom out">−</button>
            <button onClick={() => view.reset()} aria-label="Fit the whole board, straight on">{Math.round(view.view.scale * 100)}%</button>
            <button onClick={() => view.zoomBy(1.4)} aria-label="Zoom in">+</button>
            <span className="mc-zoom-hint">drag to turn · shift-drag to pan · scroll to zoom</span>
          </div>
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
