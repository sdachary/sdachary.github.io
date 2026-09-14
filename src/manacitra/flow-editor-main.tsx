import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import FlowEditor from './FlowEditor';
import { useManacitraStore } from './store';
import type { ManacitraData } from './types';

function FlowEditorPage() {
  const data = useManacitraStore(s => s.data);
  const setData = useManacitraStore(s => s.setData);

  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(5);
  const [status, setStatus] = useState('Loading data...');

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
      .catch(e => {
        setStatus('Error: ' + e.message);
      });
  }, [setData]);

  if (!loaded || !data) {
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
        }}>Manacitra Editor</h1>
        <p style={{ color: 'rgba(28,28,26,0.35)', fontSize: '.8rem', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.75rem' }}>
          React Flow Canvas
        </p>
        <div style={{ width: 160, height: 1.5, background: 'rgba(28,28,26,0.06)', borderRadius: 2, marginTop: '.75rem', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${progress}%`, background: '#b5472e', borderRadius: 2, transition: 'width .5s ease' }} />
        </div>
        <p style={{ color: 'rgba(28,28,26,0.25)', fontSize: '.75rem', fontVariantNumeric: 'tabular-nums', marginTop: '.75rem' }}>
          {status}
        </p>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f4f5f7', position: 'relative', overflow: 'hidden' }}>
      <FlowEditor data={data} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<FlowEditorPage />);