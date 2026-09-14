import { useEffect, useState, useMemo } from 'react';
import FlatMap from './FlatMap';
import InfoPanel from './InfoPanel';
import SearchBar from './ui/SearchBar';
import FilterPanel from './ui/FilterPanel';
import LayerToggles from './ui/LayerToggles';
import SceneDescription from './a11y/SceneDescription';
import { useReducedMotion } from './a11y/useReducedMotion';
import ContrastToggle from './ui/ContrastToggle';
import AudioToggle from './ui/AudioToggle';
import TouchControls from './controls/TouchControls';
import useAmbientAudio from './audio/useAmbientAudio';
import { HOSTING_TIERS } from './hosting';
import { TOKENS } from './tokens';
import { useManacitraStore } from './store';
import type { ManacitraData, Stats } from './types';

function Loader({ progress, status }: { progress: number; status: string }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#f4f5f7',
      zIndex: 100, transition: 'opacity 1s ease',
    }}>
      <div style={{
        width: 48, height: 48, border: '1.5px solid rgba(28,28,26,0.08)',
        borderTopColor: '#b5472e', borderRadius: '50%',
        animation: 'spin 1.2s cubic-bezier(0.4,0,0.2,1) infinite',
        marginBottom: '2rem',
      }} />
      <h1 style={{
        fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-0.02em',
        color: '#1c1c1a', marginBottom: '.5rem',
      }}>Manacitra</h1>
      <p style={{ color: 'rgba(28,28,26,0.35)', fontSize: '.8rem', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.75rem' }}>
        Infrastructure Map
      </p>
      <div style={{ width: 160, height: 1.5, background: 'rgba(28,28,26,0.06)', borderRadius: 2, marginTop: '.75rem', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${progress}%`, background: '#b5472e', borderRadius: 2, transition: 'width .5s ease' }} />
      </div>
      <p style={{ color: 'rgba(28,28,26,0.25)', fontSize: '.75rem', fontVariantNumeric: 'tabular-nums', marginTop: '.75rem' }}>
        {status}
      </p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '.8rem',
      padding: '.4rem .9rem', background: 'rgba(247,245,240,0.86)', backdropFilter: 'blur(24px)',
      border: '1px solid rgba(28,28,26,0.08)', borderRadius: 100, fontSize: '.7rem',
    }}>
      {children}
    </div>
  );
}

function LegendLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: 'rgba(28,28,26,0.28)', textTransform: 'uppercase', letterSpacing: '.1em', fontSize: '.6rem' }}>
      {children}
    </span>
  );
}

function Legend() {
  const dot = (color: string, label: string, breathe?: boolean) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem', color: 'rgba(28,28,26,0.55)' }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block',
        animation: breathe ? 'mc-breathe 3.2s ease-in-out infinite' : undefined,
      }} />
      {label}
    </span>
  );
  const chip = (short: string, label: string) => (
    <span title={label} style={{
      display: 'flex', alignItems: 'center', gap: '.35rem',
      color: 'rgba(28,28,26,0.55)', textTransform: 'uppercase', letterSpacing: '.08em', fontSize: '.62rem',
      fontFamily: 'ui-monospace, SFMono-Regular, monospace', cursor: 'default',
    }}>
      <span style={{ width: 6, height: 2, borderRadius: 1, background: 'rgba(28,28,26,0.4)' }} />
      {short}
    </span>
  );
  return (
    <div style={{ position: 'fixed', bottom: '1.25rem', left: '1.25rem', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '.4rem' }}>
      <Pill>
        <LegendLabel>status</LegendLabel>
        {dot(TOKENS.online, 'live', true)}
        {dot(TOKENS.offline, 'needs attention')}
        {dot(TOKENS.unknown, 'unchecked')}
      </Pill>
      <Pill>
        <LegendLabel>hosted</LegendLabel>
        {HOSTING_TIERS.map(t => chip(t.short, t.label))}
      </Pill>
      <Pill>
        <span style={{ color: 'rgba(28,28,26,0.4)' }}>click a service to open · hover to trace · tab + arrows to navigate · pinch / scroll to zoom</span>
      </Pill>
    </div>
  );
}

function Caption({ stats, generated_at, mobile }: { stats: Stats; generated_at: string; mobile: boolean }) {
  const when = generated_at ? generated_at.slice(0, 16).replace('T', ' ') + ' UTC' : 'unknown';
  return (
    <div style={{
      position: 'fixed', right: '1.25rem', bottom: mobile ? '7.25rem' : '1.25rem',
      zIndex: 8, maxWidth: mobile ? 'min(300px, calc(100vw - 2.5rem))' : 220, textAlign: mobile ? 'right' : 'left',
      fontSize: '.68rem', lineHeight: 1.55, color: 'rgba(28,28,26,0.42)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 500, color: 'rgba(28,28,26,0.6)', letterSpacing: '.02em' }}>
        AcharyLab — every live service, one map. {stats.zones} zones · {stats.total_services} services · {stats.connections} links
      </div>
      <div>green = live · red = needs attention · edges = traffic · data as of {when}</div>
    </div>
  );
}

function Header({ online, offline, unchecked, total }: { online: number; offline: number; unchecked: number; total: number }) {  return (
    <div style={{
      position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10,
    }}>
      <nav style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem',
        padding: '.5rem 1.25rem .5rem 1.5rem',
        background: 'rgba(247,245,240,0.86)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(28,28,26,0.08)', borderRadius: 100, fontSize: '.8rem',
      }}>
        <span style={{
          fontWeight: 500, color: '#1c1c1a',
        }}>Manacitra</span>
        <span style={{ color: 'rgba(28,28,26,0.10)' }}>·</span>
        <span style={{ color: 'rgba(28,28,26,0.55)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: '#2f6d4f' }} />
          {online} live
        </span>
        <span style={{ color: offline ? 'rgba(28,28,26,0.55)' : 'rgba(28,28,26,0.2)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: '#b5472e' }} />
          {offline} needs attention
        </span>
        {unchecked > 0 && (
          <span style={{ color: 'rgba(28,28,26,0.35)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: '#8a8577' }} />
            {unchecked} unchecked
          </span>
        )}
        <span style={{ color: 'rgba(28,28,26,0.25)', fontSize: '.7rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          {total} services
        </span>
      </nav>
    </div>
  );
}

export default function Manacitra() {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(5);
  const [status, setStatus] = useState('Loading data...');
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const [toolsOpen, setToolsOpen] = useState(false);
  const data = useManacitraStore(s => s.data);
  const setData = useManacitraStore(s => s.setData);
  const highContrast = useManacitraStore(s => s.highContrast);
  useReducedMotion();
  useAmbientAudio();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  const unchecked = Math.max(0, total - online - offline);

  useEffect(() => {
    fetch('/manacitra/data.json')
      .then(r => r.json())
      .then((d: ManacitraData) => {
        setProgress(50);
        setStatus('Building scene...');
        setData(d);
        setProgress(85);
        setStatus('Finalizing...');
        setTimeout(() => {
          setProgress(100);
          setStatus('Ready');
          setLoaded(true);
        }, 200);
      })
      .catch(() => {
        setError('Could not load map data. Please try again.');
        setStatus('Error');
        setLoaded(true);
      });
  }, [setData]);

  return (
    <div data-contrast={highContrast ? 'high' : 'normal'} style={{ width: '100vw', height: '100vh', background: '#f4f5f7', position: 'relative', overflow: 'hidden' }}>
      {error ? (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(28,28,26,0.6)',
          font: '0.85rem var(--font-mono, monospace)', textAlign: 'center', padding: '1rem',
        }}>
          <span>⚠ {error}</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 18px', borderRadius: 999, cursor: 'pointer', font: 'inherit',
              background: 'rgba(28,28,26,0.92)', color: '#f4f5f7', border: 'none',
            }}
          >
            Retry
          </button>
        </div>
      ) : !loaded && <Loader progress={progress} status={status} />}
      <Header online={online} offline={offline} unchecked={unchecked} total={total} />
      {!error && loaded && <Legend />}
      {data && <Caption stats={data.stats} generated_at={data.generated_at} mobile={isMobile} />}
      <div style={{
        position: 'fixed',
        top: isMobile ? '5.25rem' : '1.1rem',
        right: '1.25rem', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
      }}>
        <button
          onClick={() => setToolsOpen(o => !o)}
          aria-label={toolsOpen ? 'Close tools' : 'Open tools'}
          style={{
            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontFamily: 'inherit',
            background: toolsOpen ? 'rgba(28,28,26,0.08)' : 'transparent',
            border: `1px solid ${toolsOpen ? 'rgba(28,28,26,0.15)' : 'rgba(28,28,26,0.12)'}`,
            color: 'rgba(28,28,26,0.4)', fontSize: '.8rem', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity .2s', opacity: toolsOpen ? 1 : 0.5,
          }}
        >{toolsOpen ? '✕' : '···'}</button>
        {toolsOpen && (
          <div style={isMobile ? {
            display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center',
            maxWidth: 'calc(100vw - 3.5rem)', overflowX: 'auto', padding: '8px 12px',
            background: 'rgba(247,245,240,0.92)', backdropFilter: 'blur(24px)',
            border: '1px solid rgba(28,28,26,0.08)', borderRadius: 16, WebkitOverflowScrolling: 'touch',
          } : {
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px', width: 'fit-content', minWidth: 208, maxWidth: 224,
            maxHeight: 'calc(100vh - 8rem)', overflowY: 'auto',
            background: 'rgba(247,245,240,0.92)', backdropFilter: 'blur(24px)',
            border: '1px solid rgba(28,28,26,0.08)', borderRadius: 16,
          }}>
            <SearchBar />
            <FilterPanel />
            <LayerToggles />
            <div style={{ display: 'flex', gap: 8 }}>
              <ContrastToggle />
              <AudioToggle />
            </div>
          </div>
        )}
      </div>
      <SceneDescription />
      <TouchControls />
      <InfoPanel />
      {/* Desktop: the map is inset so the header/tools/legend/caption live in
          reserved gutters around it — nothing floats over the canvas. Mobile
          (narrow) keeps a full-bleed map with compact overlays. */}
      {data && (
        <div style={{
          position: 'absolute',
          top: isMobile ? 0 : '5.5rem',
          right: isMobile ? 0 : 252,
          bottom: isMobile ? 0 : '10.5rem',
          left: 0,
        }}>
          <FlatMap data={data} />
        </div>
      )}
    </div>
  );
}
