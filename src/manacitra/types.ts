interface HealthEntry {
  online: boolean;
  checked_at: string;
}

interface ServiceMeta {
  protocol?: string;
  upstream?: string;
  dataStored?: string;
  pii?: string;
  topology?: string;
}

export interface Service {
  id: string;
  name: string;
  type: string;
  logo: string;
  color: string;
  h: number;
  desc: string;
  url?: string;
  meta?: ServiceMeta;
}

export interface Zone {
  id: string;
  name: string;
  label: string;
  subtitle: string;
  x: number;
  z: number;
  color: string;
  size: number;
  services: Service[];
}

interface Connection {
  from: string;
  to: string;
  label: string;
}

export interface Stats {
  total_services: number;
  online: number;
  zones: number;
  connections: number;
  total: number;
}

export interface ManacitraData {
  zones: Zone[];
  connections: Connection[];
  health: Record<string, HealthEntry>;
  stats: Stats;
  generated_at: string;
}
