import { describe, it, expect } from 'vitest';
import { hostingFor } from '../manacitra/hosting';
import type { Zone } from '../manacitra/types';

const makeZone = (id: string): Zone => ({
  id,
  name: 'Test',
  label: 'Test',
  subtitle: '',
  x: 0,
  z: 0,
  color: '#fff',
  size: 1,
  services: [],
});

describe('hostingFor', () => {
  it('returns ON-PREM for oradb zone', () => {
    const result = hostingFor(makeZone('oradb'));
    expect(result).not.toBeNull();
    expect(result!.short).toBe('ON-PREM');
    expect(result!.label).toBe('on-prem · self-hosted');
  });

  it('returns ON-PREM for oradev zone', () => {
    const result = hostingFor(makeZone('oradev'));
    expect(result).not.toBeNull();
    expect(result!.short).toBe('ON-PREM');
  });

  it('returns ON-PREM for personal zone', () => {
    const result = hostingFor(makeZone('personal'));
    expect(result).not.toBeNull();
    expect(result!.short).toBe('ON-PREM');
    expect(result!.who).toBe('home workstation');
  });

  it('returns EDGE-MANAGED for cloudflare zone', () => {
    const result = hostingFor(makeZone('cloudflare'));
    expect(result).not.toBeNull();
    expect(result!.short).toBe('EDGE-MANAGED');
    expect(result!.label).toBe('edge-managed · Cloudflare');
  });

  it('returns THIRD-PARTY for external zone', () => {
    const result = hostingFor(makeZone('external'));
    expect(result).not.toBeNull();
    expect(result!.short).toBe('THIRD-PARTY');
    expect(result!.label).toBe('third-party');
  });

  it('returns null for unknown zone id', () => {
    const result = hostingFor(makeZone('unknown-zone'));
    expect(result).toBeNull();
  });
});