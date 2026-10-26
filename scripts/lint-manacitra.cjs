#!/usr/bin/env node
'use strict';

// Deterministic guard for manacitra data invariants (architecture-visual skill):
//  - unique zone/service ids, no orphan connections or health keys
//  - stats recomputed == declared stats (never hand-edited to drift from data)
//  - logos restricted to the known glyph set (no invented icons)
// FAIL => exit 1 (blocks sync/deploy). WARN => informational (text-only fallback is legal).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = process.argv[2] || path.join(ROOT, 'public/manacitra/data.json');

let fails = 0;
let warns = 0;
const fail = (m) => { fails++; console.error('FAIL ' + m); };
const warn = (m) => { warns++; console.warn('WARN ' + m); };

let data;
try {
  data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
} catch (e) {
  console.error('FAIL cannot parse ' + DATA + ': ' + e.message);
  process.exit(1);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// 1. structural presence
for (const k of ['zones', 'connections', 'health', 'stats']) {
  if (!(k in data)) fail(`missing top-level "${k}"`);
}
if (data.zones !== undefined && !Array.isArray(data.zones)) fail('zones must be an array');
if (data.connections !== undefined && !Array.isArray(data.connections)) fail('connections must be an array');
for (const k of ['health', 'stats']) {
  if (data[k] !== undefined && (data[k] === null || Array.isArray(data[k]) || typeof data[k] !== 'object')) fail(`${k} must be an object`);
}
if (typeof data.generated_at !== 'string' || Number.isNaN(Date.parse(data.generated_at))) {
  fail('generated_at missing or not ISO-parseable');
}

// 2. ids + service shape
if (Array.isArray(data.zones)) {
  const zoneIds = data.zones.map((z) => z.id);
  if (new Set(zoneIds).size !== zoneIds.length) fail('duplicate zone ids');
  const services = data.zones.flatMap((z) => (Array.isArray(z.services) ? z.services.map((s) => ({ ...s, zone: z.id })) : []));
  const svcIds = new Set(services.map((s) => s.id));
  if (services.length !== svcIds.size) fail('duplicate service ids (must be unique across zones)');

  for (const s of services) {
    if (!String(s.name || '').trim()) fail(`service "${s.id}" (${s.zone}) has no name`);
    if (s.color && !HEX.test(s.color)) warn(`service "${s.id}" color "${s.color}" is not #hex`);
    if (s.url !== undefined && s.url !== null && !/^https?:\/\//.test(s.url)) warn(`service "${s.id}" url "${s.url}" is not http(s)`);
  }
  for (const z of data.zones) {
    if (z.color && !HEX.test(z.color)) warn(`zone "${z.id}" color "${z.color}" is not #hex`);
  }

  // 3. connections reference known source/target
  for (const c of data.connections || []) {
    if (!(zoneIds.includes(c.from) || svcIds.has(c.from))) fail(`connection ${c.from}->${c.to} has unknown source`);
    if (!(zoneIds.includes(c.to) || svcIds.has(c.to))) fail(`connection ${c.from}->${c.to} has unknown target`);
    if (c.from === c.to) fail(`connection ${c.from} is a self-connection`);
  }

  // 4. health is 1:1 with services (no orphans, none missing)
  const healthKeys = Object.keys(data.health || {});
  for (const id of healthKeys) if (!svcIds.has(id)) fail(`orphan health key "${id}" (no such service)`);
  for (const s of services) if (!(s.id in (data.health || {}))) fail(`service "${s.id}" (${s.zone}) has no health entry`);
  for (const s of services) {
    const h = data.health && data.health[s.id];
    if (h && typeof h.checked_at === 'string' && Number.isNaN(Date.parse(h.checked_at))) warn(`health[${s.id}] checked_at "${h.checked_at}" not ISO`);
  }

  // 5. stats recompute — data wins; declared stats must never drift from the data
  const total_services = services.length;
  const online = Object.values(data.health || {}).filter((h) => h && h.online).length;
  const expected = { total_services, online, zones: data.zones.length, connections: (data.connections || []).length, total: total_services };
  for (const [k, v] of Object.entries(expected)) {
    if ((data.stats || {})[k] !== v) fail(`stats.${k} = ${data.stats[k]}, recomputed = ${v}`);
  }

  // 6. logos restricted to the known glyph set (no invented icons). The set is
  //    the brand logos in logos.ts PLUS the type-glyphs ServiceIcon draws from a
  //    service's `type` (and a few special `logo` hints) — both are drawn marks,
  //    not invented icons, so neither should warn.
  const logosFile = path.join(ROOT, 'src/manacitra/logos.ts');
  const known = new Set([
    // keep in sync with src/manacitra/ui/ServiceIcon.tsx
    'database', 'cache', 'api', 'app', 'service', 'saas', 'auth', 'security',
    'dns', 'network', 'monitoring', 'host', 'ai', 'mail', 'terminal', 'scm',
  ]);
  if (fs.existsSync(logosFile)) {
    const src = fs.readFileSync(logosFile, 'utf8');
    for (const m of src.matchAll(/^\s*([A-Za-z0-9_]+):\s*\{\s*color:/gm)) known.add(m[1]);
    if (known.size === 0) warn('could not parse logos.ts glyph keys — logo check skipped');
  } else {
    warn('logos.ts not found — logo check skipped');
  }
  if (known.size) {
    for (const s of services) {
      if (s.logo && !known.has(s.logo) && !known.has(s.type)) {
        warn(`service "${s.id}" logo "${s.logo}" (type "${s.type}") not in glyph set — will render text-only`);
      }
    }
  }

  if (fails) {
    console.error(`lint-manacitra: ${fails} failure(s), ${warns} warning(s) — map is NOT shippable`);
    process.exit(1);
  }
  console.log(
    `lint-manacitra: PASS — ${services.length} services, ${data.zones.length} zones, ` +
    `${(data.connections || []).length} connections, ${healthKeys.length} health, ` +
    `${online}/${total_services} online (${warns} warning${warns === 1 ? '' : 's'})`
  );
}