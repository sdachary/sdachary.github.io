import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  NodeTypes,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  type XYPosition,
  type Viewport,
} from '@xyflow/react';
import { useManacitraStore } from './store';
import type { ManacitraData, Zone, Service } from './types';
import { logoFor } from './logos';
import { TOKENS, TOKENS_HC } from './tokens';

interface ServiceNodeData {
  service: Service;
  zoneId: string;
  zoneName: string;
  [key: string]: unknown;
}

interface ZoneNodeData {
  zone: Zone;
  [key: string]: unknown;
}

type ManacitraNode = Node<ServiceNodeData | ZoneNodeData, 'service' | 'zone'>;

const LAYOUT_KEY = 'manacitra_flow_layout';

interface SavedLayout {
  zones: Record<string, { x: number; z: number }>;
  services: Record<string, { x: number; z: number }>;
}

function loadLayout(): SavedLayout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) as SavedLayout : null;
  } catch {
    return null;
  }
}

const TILE_W = 180;
const TILE_H = 100;
const ZONE_PADDING = 32;
const ZONE_HEADER_H = 56;

function ServiceNode({ data }: { data: ServiceNodeData }) {
  const { service } = data;
  const def = logoFor(service.logo);
  const hasLogo = !!def;
  const interactive = !!service.url;
  const openUrl = () => window.open(service.url!, '_blank', 'noopener');
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUrl(); }
  };
  const tileProps = interactive
    ? { role: 'link' as const, tabIndex: 0, onClick: openUrl, onKeyDown }
    : {};

  return (
    <div {...tileProps} style={{
        width: TILE_W,
        height: TILE_H,
        borderRadius: 12,
        background: '#fff',
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: service.url ? 'pointer' : 'grab',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ width: 8, height: 8, background: '#6b7280', border: '2px solid #fff', top: -4 }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8, background: '#6b7280', border: '2px solid #fff', bottom: -4 }} />
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8, background: '#6b7280', border: '2px solid #fff', right: -4 }} />
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8, background: '#6b7280', border: '2px solid #fff', left: -4 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48 }}>
        {hasLogo ? (
          <svg viewBox={def.vb} width={32} height={32} aria-hidden="true">
            <path d={def.d} fill={def.color} />
          </svg>
        ) : (
          <span style={{ fontSize: 20 }}>
            {(() => {
              switch (service.logo) {
                case 'api': return '⚙';
                case 'auth': return '🔐';
                case 'mail': return '📧';
                case 'monitor': return '📊';
                default: return '📦';
              }
            })()}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: '#1f2937',
        textAlign: 'center',
        padding: '0 8px',
        lineHeight: 1.3,
        wordBreak: 'break-word',
      }}>
        {service.name}
      </div>
      {service.url && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: 8,
          fontSize: 10,
          color: '#9ca3af',
        }}>
          ↗
        </div>
      )}
    </div>
  );
}

function ZoneNode({ data }: { data: ZoneNodeData }) {
  const { zone } = data;
  const serviceCount = zone.services.length;

  return (
    <div
      style={{
        minWidth: 320,
        minHeight: ZONE_HEADER_H + serviceCount * (TILE_H + 16) + ZONE_PADDING * 2,
        borderRadius: 16,
        background: 'rgba(247,245,240,0.95)',
        border: `3px solid ${zone.color}`,
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <div style={{
        height: ZONE_HEADER_H,
        borderBottom: `1px solid ${zone.color}`,
        borderRadius: '13px 13px 0 0',
        background: zone.color,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        color: '#fff',
        fontWeight: 600,
        fontSize: 14,
        letterSpacing: '0.05em',
      }}>
        {zone.name}
        <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8, fontWeight: 400 }}>
          {zone.label}{zone.subtitle ? ` · ${zone.subtitle}` : ''}
        </span>
      </div>
      <div style={{
        flex: 1,
        padding: ZONE_PADDING,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignContent: 'flex-start',
      }}>
        {zone.services.map(svc => (
          <div key={svc.id} style={{ width: TILE_W, height: TILE_H }} />
        ))}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  service: ServiceNode,
  zone: ZoneNode,
};

function buildInitialNodes(data: ManacitraData): ManacitraNode[] {
  const nodes: ManacitraNode[] = [];
  const saved = loadLayout();

  const zonePositions: Record<string, XYPosition> = {
    oradb: { x: 600, y: 100 },
    oradev: { x: 100, y: 500 },
    cloudflare: { x: 100, y: 100 },
    external: { x: 600, y: 500 },
  };

  for (const zone of data.zones) {
    const savedZ = saved?.zones[zone.id];
    const pos: XYPosition = savedZ ? { x: savedZ.x, y: savedZ.z } : (zonePositions[zone.id] ?? { x: 100, y: 100 });

    nodes.push({
      id: `zone-${zone.id}`,
      type: 'zone',
      position: pos,
      data: { zone },
      draggable: true,
      selectable: true,
    });

    const { cols } = gridFor(zone.services.length);
    zone.services.forEach((svc, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const base = saved?.services[svc.id];
      nodes.push({
        id: svc.id,
        type: 'service',
        position: base ? { x: base.x, y: base.z } : {
          x: pos.x + ZONE_PADDING + col * (TILE_W + 16),
          y: pos.y + ZONE_HEADER_H + ZONE_PADDING + row * (TILE_H + 16),
        },
        data: { service: svc, zoneId: zone.id, zoneName: zone.name },
        draggable: true,
        selectable: true,
        parentId: `zone-${zone.id}`,
        extent: 'parent',
      });
    });
  }

  return nodes;
}

function gridFor(n: number) {
  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
  return { cols, rows: Math.ceil(n / cols) };
}

function buildInitialEdges(data: ManacitraData): Edge[] {
  return data.connections.map((conn, i) => ({
    id: `edge-${conn.from}-${conn.to}-${i}`,
    source: conn.from,
    target: conn.to,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#6b7280', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280', width: 16, height: 16 },
    label: conn.label,
    labelStyle: { fontSize: 10, fill: '#6b7280', fontWeight: 500 },
    labelBgStyle: { fill: 'rgba(247,245,240,0.95)', fillOpacity: 0.9, padding: 2, borderRadius: 3 },
    labelBgBorderRadius: 3,
    data: { label: conn.label },
  }));
}

function nodesToLayout(nodes: ManacitraNode[]): SavedLayout {
  const layout: SavedLayout = { zones: {}, services: {} };
  nodes.forEach(n => {
    const p = { x: n.position.x, z: n.position.y };
    if (n.type === 'zone') layout.zones[n.id.replace(/^zone-/, '')] = p;
    else layout.services[n.id] = p;
  });
  return layout;
}

export default function FlowEditor({ data, onSaveLayout }: { data: ManacitraData; onSaveLayout?: (layout: SavedLayout) => void }) {
  const [nodes, , onNodesChange] = useNodesState(buildInitialNodes(data));
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildInitialEdges(data));
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const highContrast = useManacitraStore(s => s.highContrast);
  const T = highContrast ? TOKENS_HC : TOKENS;
  const saveCallback = useRef(onSaveLayout);
  useEffect(() => { saveCallback.current = onSaveLayout; }, [onSaveLayout]);

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, [setEdges]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const layout = nodesToLayout(nodes);
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* storable only */ }
      saveCallback.current?.(layout);
    }, 500);
    return () => clearTimeout(timer);
  }, [nodes, data]);

  return (
    <div style={{ width: '100%', height: '100%', background: T.bgCanvas }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onViewportChange={setViewport}
        viewport={viewport}
        nodeTypes={nodeTypes}
        fitView={false}
        attributionPosition="bottom-right"
      >
        <Background color={T.inkMuted} gap={24} />
        <Controls />
        <MiniMap
          nodeColor={(node) => node.type === 'zone' ? (node.data as ZoneNodeData).zone.color : '#6b7280'}
          nodeStrokeColor="#fff"
          nodeBorderRadius={4}
        />
      </ReactFlow>
    </div>
  );
}