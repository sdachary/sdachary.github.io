import { motion, AnimatePresence } from 'framer-motion';
import { useManacitraStore } from './store';
import { hostingFor } from './hosting';
import { EASE, DURATION } from './motion/constants';

function StatusDot({ online }: { online: boolean | null }) {
  const reduced = useManacitraStore(s => s.reducedMotion);
  const bg = online === null ? '#8a8577' : online ? '#2f6d4f' : '#b5472e';
  return (
    <motion.span
      animate={reduced ? {} : { scale: [1, 1.2, 1] }}
      transition={reduced ? {} : { repeat: Infinity, duration: 2, ease: 'easeInOut', repeatDelay: 3 }}
      style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: bg }}
    />
  );
}

export default function InfoPanel() {
  const data = useManacitraStore(s => s.data);
  const hoveredId = useManacitraStore(s => s.hoveredId);
  const selectedId = useManacitraStore(s => s.selectedId);
  const setSelected = useManacitraStore(s => s.setSelected);

  const activeId = hoveredId ?? selectedId;

  const info = (() => {
    if (!data || !activeId) return null;
    for (const zone of data.zones) {
      for (const svc of zone.services) {
        if (svc.id === activeId) {
          const h = data.health[activeId];
          const links = (data.connections || [])
            .filter(c => c.from === activeId || c.to === activeId)
            .map(c => {
              const other = c.from === activeId ? c.to : c.from;
              const owner = data.zones.find(z => z.id === other);
              if (owner) return owner.label;
              const sv = data.zones.flatMap(z => z.services).find(s => s.id === other);
              return sv ? sv.name : other;
            });
          return { name: svc.name, type: svc.type, desc: svc.desc, color: svc.color, online: h?.online ?? null, zone: zone.label, hosting: hostingFor(zone)?.short ?? null, onPrem: hostingFor(zone)?.short === 'ON-PREM', who: hostingFor(zone)?.who ?? null, id: svc.id, url: svc.url, meta: svc.meta, links, checkedAt: h?.checked_at ?? null };
        }
      }
    }
    return null;
  })();

  const isHover = hoveredId !== null && hoveredId === activeId;
  const close = () => setSelected(null);

  return (
    <AnimatePresence>
      {info && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: DURATION.panel / 1000, ease: EASE.standard }}
          style={{
            position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 20,
            background: 'rgba(247,245,240,0.94)', backdropFilter: 'blur(24px)',
            border: `1px solid ${info.color}44`, borderRadius: 12,
            padding: '1rem 1.5rem', minWidth: 280, maxWidth: 400,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.5rem' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1c1c1a', letterSpacing: '-0.01em' }}>{info.name}</div>
              <div style={{ fontSize: '.7rem', color: 'rgba(28,28,26,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', marginTop: 2 }}>{info.type} · {info.zone}{info.hosting ? ` · ${info.hosting}` : ''}</div>
            </div>
            {!isHover && (
              <button
                onClick={close}
                style={{ background: 'rgba(28,28,26,0.06)', border: 'none', color: 'rgba(28,28,26,0.4)', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            )}
          </div>
          <p style={{ fontSize: '.8rem', color: 'rgba(28,28,26,0.65)', lineHeight: 1.5, margin: '0 0 .75rem' }}>{info.desc}</p>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <StatusDot online={info.online} />
            <span style={{ fontSize: '.75rem', color: info.online === null ? '#8a8577' : info.online ? '#2f6d4f' : '#b5472e' }}>
              {info.online === null ? 'Unchecked' : info.online ? 'Live' : 'Needs attention'}
            </span>
            <span style={{ color: 'rgba(28,28,26,0.12)' }}>|</span>
            <span style={{ fontSize: '.7rem', color: 'rgba(28,28,26,0.25)' }}>{info.id}</span>
          </div>
          {info.online === false && info.onPrem && (
            <div style={{ fontSize: '.67rem', color: 'rgba(28,28,26,0.4)', marginTop: '.3rem' }}>
              self-hosted on-prem ({info.who}) — restore via ssh
            </div>
          )}
          {info.links.length > 0 && (
            <div style={{ marginTop: '.5rem', display: 'flex', gap: '.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(28,28,26,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', fontSize: '.6rem' }}>Links</span>
              <span style={{ fontSize: '.68rem', color: 'rgba(28,28,26,0.7)' }}>
                {info.links.map((n, i) => (
                  <span key={i} style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{n}{i < info.links.length - 1 ? ' · ' : ''}</span>
                ))}
              </span>
            </div>
          )}
          {info.checkedAt && (
            <div style={{ marginTop: '.4rem', fontSize: '.62rem', color: 'rgba(28,28,26,0.3)', fontVariantNumeric: 'tabular-nums' }}>
              health at {info.checkedAt.slice(0, 16).replace('T', ' ')} UTC
            </div>
          )}
          {info.url && (
            <div style={{ marginTop: '.6rem' }}>
              <a href={info.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '.72rem', color: '#1c1c1a', textDecoration: 'none', borderBottom: '1px dashed rgba(28,28,26,0.3)' }}>
                {info.url.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          {info.meta && (() => {
            const meta = info.meta;
            const rows: [string, string][] = [];
            (['protocol', 'upstream', 'dataStored', 'pii', 'topology'] as const).forEach(k => {
              if (meta[k]) rows.push([k, meta[k] as string]);
            });
            return rows.length === 0 ? null : (
              <div style={{ marginTop: '.75rem', borderTop: '1px solid rgba(28,28,26,0.08)', paddingTop: '.6rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                {rows.map(([k, v]) => (
                  <div key={k} style={{ fontSize: '.68rem', display: 'flex', gap: '.5rem', alignItems: 'baseline' }}>
                    <span style={{ color: 'rgba(28,28,26,0.35)', minWidth: 56, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: '.6rem' }}>{k}</span>
                    <span style={{ color: 'rgba(28,28,26,0.7)', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '.66rem' }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
