export interface Health {
  [id: string]: { online: boolean; checked_at?: string };
}
export interface LiveOptions {
  pollMs?: number;
  dataUrl?: string;
  defaultReadout?: string;
  onSelect?: (svcId: string | null) => void;
  onHover?: (svcId: string | null) => void;
  onHealth?: (health: Health) => void;
}
export interface LiveApi {
  select(node: string): void;
  clear(): void;
  hover(svcId: string | null, x?: number, y?: number): void;
  mark(svcId: string | null): void;
  applyHealth(data: any): void;
  setQuery(query: string): string | null;
  pointOf(svcId: string): [number, number] | null;
  destroy(): void;
}
export function mountLive(root: HTMLElement, world: any, data: any, opts?: LiveOptions): LiveApi;
