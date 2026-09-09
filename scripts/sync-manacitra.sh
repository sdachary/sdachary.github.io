#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${REPO_DIR:-/home/ubuntu/portfolio}"
DATA_FILE="public/manacitra/data.json"

cd "$REPO_DIR"
git pull --ff-only origin main
# re-exec once so bash picks up any changes to this script
[ -z "${MANACITRA_REEXEC:-}" ] && exec env MANACITRA_REEXEC=1 bash "$0" "$@"

[ -f "$DATA_FILE" ] || { echo "ERROR: $DATA_FILE not found"; exit 1; }

TMP=$(mktemp)

cat > /tmp/__sync_manacitra.mjs << 'JSEOF'
import fs from 'fs';
import { execSync } from 'child_process';

const data_file = process.env.MANACITRA_DATA_FILE;

async function check(url, timeout=8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal, method: 'GET', redirect: 'follow' });
    clearTimeout(t);
    return r.ok || [301, 302, 308, 401, 405].includes(r.status);
  } catch {
    clearTimeout(t);
    return false;
  }
}

async function run() {
  const data = JSON.parse(fs.readFileSync(data_file, 'utf8'));
  data.generated_at = new Date().toISOString();

  const checks = [
    { id: 'nginx',       cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'postgrest',   cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost:3000 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'better-auth', cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost:4000/api/auth/health 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'mail-relay',  cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost:4001/health 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'sampada-api', cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost:3002 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'bepara-api',  cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost:3001/api/health 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'sadhan-server',cmd:"ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost:4002/api/health 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'nidhiflow-api',cmd:"ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost:4003/api/identity 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'headroom',    cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} -H \"Host: headroom.140.245.227.176.nip.io\" http://localhost:8787 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'gatus',       cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'curl -s -o /dev/null -w %{http_code} http://localhost:8080 2>/dev/null' 2>/dev/null | grep -qE '^[234]'", ssh: true },
    { id: 'pg16',        cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'pg_isready -q' 2>/dev/null", ssh: true },
    { id: 'redis',       cmd: "ssh -o StrictHostKeyChecking=accept-new 140.245.227.176 'redis-cli ping' 2>/dev/null | grep -q PONG", ssh: true },
    { id: 'mcp-hub',     url: 'http://localhost:3000/api/healthz' },
    { id: 'paca',        url: 'http://localhost:80/' },
    { id: 'ttyd',        url: 'http://localhost:7681/' },
    { id: 'minio',       cmd: "sudo docker inspect --format '{{.State.Health.Status}}' paca-minio-1 2>/dev/null | grep -q healthy", ssh: true },
    { id: 'pihole',      cmd: "sudo docker inspect --format '{{.State.Health.Status}}' pihole 2>/dev/null | grep -q healthy", ssh: true },
    { id: 'unbound',     cmd: "systemctl is-active pihole-docker-user 2>/dev/null | grep -q active", ssh: true },
    { id: 'tailscale',   cmd: "systemctl is-active tailscaled 2>/dev/null | grep -q active", ssh: true },
    { id: 'fail2ban',    cmd: "systemctl is-active fail2ban 2>/dev/null | grep -q active", ssh: true },
    // tailnet pings pay a ~5.7s DERP/ICE handshake on any idle start, so each check
// re-warms first (8s budget) then probes (extra per-check execSync window).
    { id: 'workstation', cmd: "tailscale ping --timeout=8s workstation >/dev/null 2>&1; tailscale ping --timeout=4s workstation 2>/dev/null | grep -q pong", ssh: true, timeout: 20000 },
    { id: 'pixel-10a',   cmd: "tailscale ping --timeout=8s pixel-10a >/dev/null 2>&1; tailscale ping --timeout=4s pixel-10a 2>/dev/null | grep -q pong", ssh: true, timeout: 20000 },
    { id: 'github',      url: 'https://github.com' },
    { id: 'notion',      url: 'https://notion.so' },
    { id: 'chitragupta', url: 'https://chitragupta.pages.dev' },
    { id: 'bepara',      url: 'https://bepara.pages.dev' },
    { id: 'udhyam',      url: 'https://udhyam.pages.dev' },
    { id: 'sampada-web', url: 'https://sampada.pages.dev' },
    { id: 'sadhan',      url: 'https://sadhan.pages.dev' },
    { id: 'nidhiflow',   url: 'https://nidhiflow.pages.dev' },
    { id: 'vishwakarma', url: 'https://vishwakarma.pages.dev' },
    { id: 'darpan',      url: 'https://darpan.pages.dev' },
    { id: 'prayog',      url: 'https://prayog.pages.dev' },
    { id: 'portfolio',   url: 'https://sdachary.github.io' },
  ];

  const results = {};
  for (const c of checks) {
    let ok;
    if (c.ssh) {
      try {
        execSync(c.cmd, { timeout: c.timeout || 8000, stdio: 'pipe' });
        ok = true;
      } catch {
        ok = false;
      }
    } else {
      ok = await check(c.url);
    }
    results[c.id] = ok;
    process.stdout.write(ok ? '.' : 'x');
  }
  console.log();

  const health = {};
  for (const [id, ok] of Object.entries(results)) {
    health[id] = { online: ok, checked_at: data.generated_at };
  }
  data.health = health;

  const online = Object.values(health).filter(h => h.online).length;
  const total_services = data.zones.reduce((n, z) => n + z.services.length, 0);
  data.stats = data.stats || {};
  data.stats.online = online;
  data.stats.total = Object.keys(health).length;
  data.stats.total_services = total_services;
  data.stats.zones = data.zones.length;
  data.stats.connections = (data.connections || []).length;

  fs.writeFileSync(data_file, JSON.stringify(data, null, 2) + '\n');
  console.log('Health: %d/%d online (%d services, %d zones)', online, data.stats.total, total_services, data.stats.zones);
}

run().catch(e => { console.error(e); process.exit(1); });
JSEOF

export MANACITRA_DATA_FILE="$REPO_DIR/$DATA_FILE"
node /tmp/__sync_manacitra.mjs 2>&1 | tee "$TMP"
rm -f /tmp/__sync_manacitra.mjs

# deterministic invariants gate — a broken map must never sync
if [ -f "$REPO_DIR/scripts/lint-manacitra.cjs" ]; then
  node "$REPO_DIR/scripts/lint-manacitra.cjs" "$REPO_DIR/$DATA_FILE"
else
  echo "lint-manacitra.cjs not present (stale checkout) — skipping invariants gate"
fi

git add "$DATA_FILE"
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "sync: manacitra $(date +%F)"
  git push origin main
  echo "Pushed."
fi
