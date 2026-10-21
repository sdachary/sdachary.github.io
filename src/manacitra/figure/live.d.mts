export interface LiveApi {
  select(node: string): void;
  clear(): void;
  applyHealth(data: any): void;
  setQuery(query: string): void;
  destroy(): void;
}
export function mountLive(root: HTMLElement, world: any, data: any, opts?: { pollMs?: number; dataUrl?: string; defaultReadout?: string }): LiveApi;
