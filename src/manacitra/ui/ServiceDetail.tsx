import type { ManacitraData } from '../types';
import type { Health } from './ServiceRoster';
import ServiceIcon from './ServiceIcon';

// What a service *is* and what it is wired to. The plate shows the call; this
// card answers the questions a reader actually has about a jack — is it up,
// what is it, does it hold personal data, and who talks to it.

export default function ServiceDetail({
  data, health, id, onClose,
}: {
  data: ManacitraData | null;
  health: Health;
  id: string | null;
  onClose: () => void;
}) {
  if (!data || !id) return null;
  const svc = data.zones.flatMap((z) => z.services).find((s) => s.id === id);
  if (!svc) return null;
  const zone = data.zones.find((z) => z.services.some((s) => s.id === id));
  const h = health[id];
  const state = h ? (h.online ? 'online' : 'offline') : 'unchecked';

  const nameOf = (sid: string) => {
    const s = data.zones.flatMap((z) => z.services).find((x) => x.id === sid);
    if (s) return s.name;
    const z = data.zones.find((x) => x.id === sid);
    return z ? `${z.label || z.name} tier` : sid;
  };
  const links = (data.connections || [])
    .filter((c) => c.from === id || c.to === id)
    .map((c) => ({ other: c.from === id ? c.to : c.from, label: c.label }));

  return (
    <div className="mc-detail" role="dialog" aria-label={`${svc.name} details`}>
      <div className="mc-detail-head">
        <div className="mc-detail-id">
          <span className="mc-detail-icon"><ServiceIcon svc={svc} size={22} /></span>
          <div>
            <div className="mc-detail-name">{svc.name}</div>
            <div className="mc-detail-sub">
              {svc.type} · {zone?.label || zone?.name}
            </div>
          </div>
        </div>
        <button className="mc-detail-close" onClick={onClose} aria-label="Close details">✕</button>
      </div>

      <div className="mc-detail-state" data-state={state}>
        <span className="mc-lamp" data-state={state === 'unchecked' ? 'unknown' : state === 'online' ? 'on' : 'off'} aria-hidden="true" />
        {state === 'online' ? 'Live' : state === 'offline' ? 'Needs attention' : 'Unchecked'}
        {h?.checked_at ? <span className="mc-detail-time">· checked {h.checked_at.slice(0, 16).replace('T', ' ')} UTC</span> : null}
      </div>

      {svc.desc ? <p className="mc-detail-desc">{svc.desc}</p> : null}

      {svc.meta ? (
        <dl className="mc-detail-meta">
          {Object.entries(svc.meta).map(([k, v]) => (
            <div key={k} className="mc-meta-row">
              <dt>{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {links.length ? (
        <div className="mc-detail-links">
          <div className="mc-detail-links-head">Wired to</div>
          <ul>
            {links.map((l, i) => (
              <li key={`${l.other}-${i}`}>
                <span className="mc-link-name">{nameOf(l.other)}</span>
                {l.label ? <span className="mc-link-label">{l.label}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
