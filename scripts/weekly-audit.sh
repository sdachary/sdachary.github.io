#!/usr/bin/env bash
# Weekly health audit across all deployed repos
# Runs from oradev via systemd timer (Sun 4AM).
# Reports results to stdout — alert-router picks up failures via Telegram.
# Usage: ./scripts/weekly-audit.sh
#
# This runs ON oradev, so oradb-hosted services are probed through their
# public URLs: oradb's localhost ports (better-auth:4000, mail-relay:4001)
# are not reachable from here, which is why the old localhost:4000 check
# failed every single week.
#
# 2026-10-11 refresh — the previous list probed retired things and reported
# 11 false failures, which trains the operator to ignore it:
#   kubera backend      -> sampada (sampada replaced kubera)
#   uptime-kuma         -> gatus
#   pgbouncer :5433     -> dropped, never deployed
#   paca gateway :80    -> dropped, paca retired 2026-09-03
#   CF Pages unnati-70z -> sadhan; kubera-d4k/saraswati-7v3/narad-7hc -> dropped
#   better-auth localhost:4000 -> api.vayalabs.in (wrong host, unreachable)

set -u
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
P=0 F=0

pass() { echo "  PASS  $1"; P=$((P+1)); }
fail() { echo "  FAIL  $1"; F=$((F+1)); }

# probe <label> <url> — 2xx/3xx is up; 4xx/5xx/timeouts are failures.
probe() {
  local label=$1 url=$2 code
  code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 6 --max-time 15 "$url" 2>/dev/null)
  case "$code" in
    2??|3??) pass "$label" ;;
    *)       fail "$label (got ${code:-000})" ;;
  esac
}

echo "=== Weekly Health Audit — $DATE ==="
echo ""

# --- CF Pages frontends ---
for site in bepara chitragupta darpan sadhan udhyam vishwakarma sampada; do
  probe "$site" "https://$site.vayalabs.in/"
done

# --- API surface behind Caddy on oradb ---
probe "better-auth (api)"   "https://api.vayalabs.in/api/auth/get-session"
probe "mail-relay (api)"    "https://api.vayalabs.in/mail/health"
probe "sadhan API"          "https://api-sadhan.vayalabs.in/api/health"
probe "sampada API"         "https://sampada.vayalabs.in/api/healthz"
probe "bepara API (Worker)" "https://bepara.vayalabs.in/api/health"

# --- Monitoring (uptime-kuma retired, Gatus replaced it) ---
probe "gatus"        "https://gatus.vayalabs.in/"
probe "github pages" "https://sdachary.github.io/"

# --- oradev local services ---
mcp=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://localhost:3000/api/health 2>/dev/null)
[ "$mcp" = "200" ] && pass "mcp-hub" || fail "mcp-hub (got ${mcp:-000})"
# ttyd sits behind Basic auth, so an unauthenticated probe gets 401 — which
# still proves the process is up and answering. Only a connection failure or
# a 5xx counts as down.
ttyd=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://localhost:7681/ 2>/dev/null)
case "$ttyd" in
  200|401) pass "ttyd" ;;
  *)       fail "ttyd (got ${ttyd:-000})" ;;
esac

echo ""
echo "=== Results: $P passed, $F failed ==="
if [ "$F" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
fi
# Non-zero so the systemd unit records a real failure. The old script always
# exited 0, hiding every failure from the timer's status.
echo "ATTENTION: $F check(s) failed"
exit 1
