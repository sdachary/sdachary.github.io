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
      alignItems: 'center', justifyContent: 'center', background: 'var(--mc-bg, #0e100d)',
      zIndex: 100, transition: 'opacity 1s ease',
    }}>
      <div style={{
        width: 48, height: 48, border: '1.5px solid rgba(156,176,156,0.08)',
        borderTopColor: 'var(--mc-lamp-on, #9dbf9a)', borderRadius: '50%',
        animation: 'spin 1.2s cubic-bezier(0.4,0,0.2,1) infinite',
        marginBottom: '2rem',
      }} />
      <h1 style={{
        fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-0.02em',
        color: 'var(--mc-ink, #c9d3c9)', marginBottom: '.5rem',
      }}>Manacitra</h1>
      <p style={{ color: 'rgba(201,211,201,0.35)', fontSize: '.8rem', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.75rem' }}>
        Cord switchboard
      </p>
      <div style={{ width: 160, height: 1.5, background: 'rgba(156,176,156,0.06)', borderRadius: 2, marginTop: '.75rem', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${progress}%`, background: 'var(--mc-lamp-on, #9dbf9a)', borderRadius: 2, transition: 'width .5s ease' }} />
      </div>
      <p style={{ color: 'rgba(201,211,201,0.25)', fontSize: '.75rem', fontVariantNumeric: 'tabular-nums', marginTop: '.75rem' }}>
        {status}
      </p>
    </div>
  );
}

function Header({ online, offline, total }: { online: number; offline: number; total: number }) {
  return (
    <div style={{ position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
      <nav style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem',
        padding: '.5rem 1.25rem .5rem 1.5rem',
        background: 'var(--mc-panel, rgba(12,14,12,0.82))', backdropFilter: 'blur(18px)',
        border: '1px solid rgba(156,176,156,0.12)', borderRadius: 100, fontSize: '.8rem',
      }}>
        <span style={{ fontWeight: 500, color: 'var(--mc-ink, #c9d3c9)' }}>Manacitra</span>
        <span style={{ color: 'rgba(201,211,201,0.18)' }}>·</span>
        <span style={{ color: 'rgba(201,211,201,0.6)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: 'var(--mc-lamp-on, #9dbf9a)' }} />
          {online} lit
        </span>
        <span style={{ color: offline ? 'rgba(201,211,201,0.6)' : 'rgba(201,211,201,0.28)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: 'var(--mc-lamp-off, #566056)' }} />
          {offline} dark
        </span>
        <span style={{ color: 'rgba(201,211,201,0.25)', fontSize: '.7rem' }}>{total} services</span>
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
        aria-label={open ? 'Close' : 'Search / tools'}
        style={{
          width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontFamily: 'inherit',
          background: open ? 'rgba(156,176,156,0.12)' : 'transparent',
          border: `1px solid ${open ? 'rgba(156,176,156,0.25)' : 'rgba(156,176,156,0.18)'}`,
          color: 'rgba(201,211,201,0.55)', fontSize: '.8rem',
        }}
      >{open ? '×' : '⌕'}</button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'var(--mc-panel, rgba(12,14,12,0.86))', backdropFilter: 'blur(18px)', border: '1px solid rgba(156,176,156,0.14)', borderRadius: 12 }}>
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
  const data = useManacitraStore(s => s.data);
  const setData = useManacitraStore(s => s.setData);
  const highContrast = useManacitraStore(s => s.highContrast);
  useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  const { online, offline, total } = useMemo(() => {
    if (!data) return { online: 0, offline: 0, total: 0 };
    let on = 0, off = 0, t = 0;
    const allIds = new Set<string>();
    data.zones.forEach(z => z.services.forEach(s => allIds.add(s.id)));
    allIds.forEach(id => {
      t++;
      const h = data.health[id];
      if (!h) return;
      if (h.online) on++; else off++;
    });
    return { online: on, offline: off, total: t };
  }, [data]);

  useEffect(() => {
    fetch('/manacitra/data.json')
      .then(r => r.json())
      .then((d: ManacitraData) => {
        setProgress(50); setStatus('Building switchboard...');
        setData(d);
        setProgress(85); setStatus('Finalizing...');
        setTimeout(() => { setProgress(100); setStatus('Ready'); setLoaded(true); }, 200);
      })
      .catch(() => { setError('Could not load map data.'); setStatus('Error'); setLoaded(true); });
  }, [setData]);

  useEffect(() => {
    if (!loaded || !data || !rootRef.current) return;
    (async () => {
      const [{ mountLive }, worldMod, keysMod] = await Promise.all([
        import('./figure/live.mjs'),
        import('./figure/world.mjs'),
        fetch('/manacitra/keys.json').then(r => r.json()).catch(() => ({})),
      ]);
      const world = worldMod.buildWorld ? worldMod.buildWorld(data) : data;
      const live = mountLive(rootRef.current as HTMLElement, world, data, { keys: keysMod, defaultReadout: `${online} of ${total} lamps lit` });
      return live;
    })();
  }, [loaded, data]);

  return (
    <div data-contrast={highContrast ? 'high' : 'normal'} style={{ width: '100vw', height: '100dvh', background: 'var(--mc-bg, #0e100d)', position: 'relative', overflow: 'hidden', color: 'var(--mc-ink, #c9d3c9)' }}>
      {error ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span>⚠ {error}</span>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 18px', borderRadius: 999, cursor: 'pointer', background: 'rgba(156,176,156,0.16)', color: '#c9d3c9', border: '1px solid rgba(156,176,156,0.24)' }}>Retry</button>
        </div>
      ) : !loaded && <Loader progress={progress} status={status} />}
      <Header online={online} offline={offline} total={total} />
      <TopBar />
      {data && (
        <div ref={rootRef} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64 }}>
          <div className="mc-plate" style={{ transform: 'scale(0.98)' }}>
            <link rel="stylesheet" href="/manacitra/iso.css" />
            <style>{`
              :root{--mc-bg:#0e100d;--mc-ink:#c9d3c9;--mc-panel:rgba(12,14,12,0.86);--mc-lamp-on:#9dbf9a;--mc-lamp-off:#566056;--mc-cord:#6f7b6f;--mc-cord-hot:#b9d9b6}
              [data-contrast="high"]{--mc-bg:#050705;--mc-ink:#e6ede6;--mc-lamp-on:#c9f0c6;--mc-lamp-off:#3a423a}
            `}</style>
            <div className="iso-frame">
              <div className="iso-card">
                <div className="iso-meta">
                  <div className="iso-title">Manacitra</div>
                  <div className="iso-hint">Click a jack to trace a call</div>
                </div>
                <div className="iso-stage mc-stage" tabIndex={0} role="group" aria-label="Cord switchboard">
                  {/* Figure injected at build time or via keys; live harness works against .station/.cord/.lamp */}
                </div>
                <div className="iso-foot">
                  <div data-readout className="iso-readout">{online} of {total} lamps lit · {data.connections?.length || 0} cords</div>
                  <div className="iso-key">
                    <span className="mark lit">●</span> lamp lit · <span className="mark flat">●</span> lamp dark · <span className="mark line">—</span> cord
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
