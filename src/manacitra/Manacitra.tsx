import { useEffect, useMemo, useRef, useState } from 'react';
import ContrastToggle from './ui/ContrastToggle';
import SearchBar from './ui/SearchBar';
import { useReducedMotion } from './a11y/useReducedMotion';
import { useManacitraStore } from './store';
import type { ManacitraData } from './types';

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
      <h1 style={{
        fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-0.02em',
        color: '#a3a3a3', marginBottom: '.5rem',
      }}>Manacitra</h1>
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
    <div style={{ position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
      <nav style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem',
        padding: '.5rem 1.25rem .5rem 1.5rem',
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

function TopBar() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'fixed', top: '1.1rem', right: '1.25rem', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close tools' : 'Open tools'}
        style={{
          width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontFamily: 'inherit',
          background: open ? 'rgba(163,163,163,0.12)' : 'transparent',
          border: `1px solid ${open ? 'rgba(163,163,163,0.25)' : 'rgba(163,163,163,0.18)'}`,
          color: 'rgba(163,163,163,0.7)', fontSize: '.8rem', lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >{open ? '×' : '···'}</button>
      {open && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px',
          background: 'rgba(19,19,19,0.92)', backdropFilter: 'blur(18px)',
          border: '1px solid rgba(163,163,163,0.14)', borderRadius: 12,
        }}>
          <SearchBar />
          <div style={{ display: 'flex', gap: 8 }}><ContrastToggle /></div>
        </div>
      )}
    </div>
  );
}

export default function Manacitra() {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(5);
  const [status, setStatus] = useState('Loading data...');
  const [error, setError] = useState<string | null>(null);
  const [plate, setPlate] = useState<{ html: string; world: any } | null>(null);
  const data = useManacitraStore(s => s.data);
  const setData = useManacitraStore(s => s.setData);
  const highContrast = useManacitraStore(s => s.highContrast);
  const searchQuery = useManacitraStore(s => s.searchQuery);
  useReducedMotion();
  const plateRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<{ select: (n: string) => void; clear: () => void; applyHealth: (d: any) => void; setQuery: (q: string) => void; destroy: () => void } | null>(null);

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
    if (!plate || !plateRef.current) return;
    const host = plateRef.current;
    host.innerHTML = plate.html;
    let live: any = null;
    (async () => {
      const { mountLive } = await import('./figure/live.mjs');
      live = mountLive(host, plate.world, data, {
        defaultReadout: `${online} of ${total} lamps lit`,
      });
      liveRef.current = live;
    })();
    return () => { live?.destroy?.(); liveRef.current = null; };
  }, [plate, data, online, total]);

  // search acts as "find a jack"
  useEffect(() => {
    if (searchQuery) liveRef.current?.setQuery(searchQuery);
  }, [searchQuery]);

  return (
    <div className="iso" data-theme={highContrast ? 'light' : 'dark'} style={{ width: '100vw', height: '100dvh', background: 'var(--anatomy-page)', position: 'relative', overflow: 'auto' }}>
      {error ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--anatomy-text)' }}>
          <span>⚠ {error}</span>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 18px', borderRadius: 999, cursor: 'pointer', background: 'var(--anatomy-strong)', color: 'var(--anatomy-page)', border: 'none' }}>Retry</button>
        </div>
      ) : !loaded && <Loader progress={progress} status={status} />}
      {loaded && !error && <Header online={online} total={total} />}
      {loaded && !error && <TopBar />}
      {plate && (
        <div ref={plateRef} style={{ width: 'min(860px, 100% - 32px)', margin: '72px auto 96px' }} />
      )}
    </div>
  );
}
