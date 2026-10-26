import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModelApi } from './scene/Model3D';
import { ISO_CSS } from '../iso/iso-kit.mjs';
import './manacitra.css';

// three.js only arrives with the model view; the map stays light to load
const Model3D = lazy(() => import('./scene/Model3D'));
import ServiceRoster, { type Health } from './ui/ServiceRoster';
import TierMap from './ui/TierMap';
import ServiceDetail from './ui/ServiceDetail';
import { useReducedMotion } from './a11y/useReducedMotion';
import { useManacitraStore } from './store';
import type { ManacitraData } from './types';

type ViewMode = 'model' | 'map';

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
        <button data-on={view === 'model'} aria-pressed={view === 'model'} onClick={() => onView('model')}>Model</button>
        <button data-on={view === 'map'} aria-pressed={view === 'map'} onClick={() => onView('map')}>Map</button>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Find a service…"
        aria-label="Find a service"
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

  // map renders instantly; the model needs three.js to chunk in, so a fresh
  // visit lands on the map rather than a loading shell
  const [view, setView] = useState<ViewMode>(() => {
    const v = localStorage.getItem('manacitra_view');
    return v === 'model' || v === 'map' ? v : 'map';
  });
  const modelRef = useRef<ModelApi | null>(null);

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

  // the service the search box should jump to, shared by the map and the model
  const searchHit = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !data) return null;
    return data.zones.flatMap((z) => z.services)
      .find((sv) => sv.name.toLowerCase().includes(needle) || sv.id.includes(needle)) ?? null;
  }, [query, data]);

  useEffect(() => {
    fetch('/manacitra/data.json')
      .then(r => r.json())
      .then((d: ManacitraData) => {
        setProgress(70); setStatus('Lighting lamps…');
        setData(d);
        setHealth(d.health || {});
        setProgress(100); setStatus('Ready');
        setLoaded(true);
      })
      .catch(() => { setError('Could not load map data.'); setStatus('Error'); setLoaded(true); });
  }, [setData]);

  const pick = useCallback((id: string) => {
    if (view === 'model') modelRef.current?.focus(id);
    setSelected(id);
  }, [view]);

  const stateOf = (id: string) => (health[id] ? (health[id].online ? 'online' : 'offline') : 'unchecked');

  // the map tracks the search target on its own; the model needs a nudge to fly there
  useEffect(() => {
    if (view === 'model' && searchHit) {
      modelRef.current?.focus(searchHit.id);
      setSelected(searchHit.id);
    }
  }, [searchHit, view]);

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
      {/* the --anatomy-* board palette lives in the kit; without it every
          var() in manacitra.css resolves to nothing and both themes read as
          black-on-black. Scoped to .iso, so the rest of the portfolio is safe. */}
      <style>{ISO_CSS}</style>
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
          onQuery={setQuery}
          theme={highContrast ? 'light' : 'dark'}
          onTheme={() => setHighContrast(!highContrast)}
          view={view}
          onView={(v) => { setView(v); localStorage.setItem('manacitra_view', v); }}
        />
      )}

      <div className="mc-body">
        <div className="mc-stage-wrap" data-view={view}>
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
          onHover={(id) => setHovered(id)}
          query={query}
        />
      </div>

      {selected && data && (
        <ServiceDetail data={data} health={health} id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
