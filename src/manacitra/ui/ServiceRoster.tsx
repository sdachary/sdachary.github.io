import { useEffect, useRef } from 'react';
import type { ManacitraData } from '../types';

export interface Health {
  [id: string]: { online: boolean; checked_at?: string };
}

// The plate shows the *shape* of the stack; this rail shows the *facts* — every
// service by name, its lamp state, and what it is wired to. A name engraved at
// 3 units on a panel is a diagram, not a label, so the readable list lives here
// and the two stay in step: hovering a row lights the jack, clicking a jack
// highlights the row.

function Lamp({ online }: { online: boolean | null }) {
  return <span className="mc-lamp" data-state={online === null ? 'unknown' : online ? 'on' : 'off'} aria-hidden="true" />;
}

function ServiceRow({
  svc, online, selected, hovered, onPick, onHover,
}: {
  svc: any; online: boolean | null;
  selected: boolean; hovered: boolean;
  onPick: (id: string) => void; onHover: (id: string | null) => void;
}) {
  return (
    <button
      className="mc-row"
      data-selected={selected ? '' : undefined}
      data-hovered={hovered ? '' : undefined}
      onClick={() => onPick(svc.id)}
      onMouseEnter={() => onHover(svc.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(svc.id)}
      onBlur={() => onHover(null)}
    >
      <Lamp online={online} />
      <span className="mc-row-name">{svc.name}</span>
      <span className="mc-row-type">{svc.type}</span>
    </button>
  );
}

export default function ServiceRoster({
  data, health, selected, hovered, onPick, onHover, query,
}: {
  data: ManacitraData | null;
  health: Health;
  selected: string | null;
  hovered: string | null;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
  query: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();

  // keep the selected row in view when the selection comes from the plate
  useEffect(() => {
    if (!selected) return;
    const row = listRef.current?.querySelector(`[data-svc="${selected}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!data) return null;
  const zones = data.zones;

  return (
    <div className="mc-rail">
      <div className="mc-rail-head">
        <div className="mc-rail-title">Jacks</div>
        <div className="mc-rail-sub">{zones.reduce((n, z) => n + z.services.length, 0)} services · {zones.length} tiers</div>
      </div>
      <div className="mc-rail-list" ref={listRef}>
        {zones.map((zone) => {
          const services = zone.services.filter((s) =>
            !needle || s.name.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle));
          if (!services.length) return null;
          return (
            <section key={zone.id} className="mc-group">
              <h3 className="mc-group-head">
                <span>{zone.label || zone.name}</span>
                <span className="mc-group-count">{services.length}</span>
              </h3>
              {services.map((svc) => (
                <div key={svc.id} data-svc={svc.id}>
                  <ServiceRow
                    svc={svc}
                    online={health[svc.id] ? health[svc.id].online : null}
                    selected={selected === svc.id}
                    hovered={hovered === svc.id}
                    onPick={onPick}
                    onHover={onHover}
                  />
                </div>
              ))}
            </section>
          );
        })}
        {needle && !zones.some((z) => z.services.some((s) => s.name.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle))) && (
          <p className="mc-empty">No jack matches “{query}”.</p>
        )}
      </div>
    </div>
  );
}
