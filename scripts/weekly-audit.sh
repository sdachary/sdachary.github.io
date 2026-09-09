#!/usr/bin/env bash
# Weekly health audit across all deployed repos
# Runs from oradev via systemd timer (Sun 4AM).
# Reports results to stdout — alert-router picks up failures via Telegram.
# Usage: ./scripts/weekly-audit.sh

set -euo pipefail
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
P=0 F=0

pass() { echo "  PASS  $1"; ((P++)) || true; }
fail() { echo "  FAIL  $1"; ((F++)) || true; }

echo "=== Weekly Health Audit — $DATE ==="
echo ""

# --- Backend services on oradb ---
curl -sf http://kubera.140.245.227.176.nip.io/up > /dev/null && pass "kubera backend" || fail "kubera backend"
curl -sf --connect-timeout 5 http://140.245.227.176:5433/health > /dev/null 2>&1 && pass "pgbouncer" || fail "pgbouncer"
curl -sf http://kubera.140.245.227.176.nip.io/status/ > /dev/null && pass "uptime-kuma" || fail "uptime-kuma"

# --- CF Pages frontends ---
for site in bepara chitragupta darpan unnati-70z udhyam vishwakarma kubera-d4k saraswati-7v3 narad-7hc; do
  curl -sfL "https://$site.pages.dev" > /dev/null && pass "$site" || fail "$site"
done

# --- MCP Hub (direct, not tunnel) ---
curl -sf http://localhost:3000/api/health > /dev/null 2>&1 && pass "mcp-hub" || fail "mcp-hub"

# --- oradev services ---
curl -sf http://localhost:80/api/health > /dev/null 2>&1 && pass "paca gateway" || fail "paca gateway"
curl -sf http://localhost:4000/api/health > /dev/null 2>&1 && pass "better-auth" || fail "better-auth"
curl -sf http://localhost:7681 > /dev/null 2>&1 && pass "ttyd" || fail "ttyd"

# --- GitHub Pages ---
curl -sfL https://sdachary.github.io/portfolio/ > /dev/null && pass "portfolio (gh-pages)" || fail "portfolio (gh-pages)"

echo ""
echo "=== Results: $P passed, $F failed ==="
