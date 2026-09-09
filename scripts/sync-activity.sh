#!/usr/bin/env bash
set -euo pipefail

# Portfolio Recent Activity sync — sources completed work from the Paca API
# (acharylab board, Done column) instead of public GitHub events, which miss
# private-repo work. Runs daily on oradev via portfolio-sync.timer.
#
# Requires: ~/.paca_api_key              (X-API-Key for the Paca API)
#           Paca reachable at $PACA_URL (default http://localhost:80 on oradev)
#
# DRY_RUN=1 [env overrides] scripts/sync-activity.sh
#   -> regenerate + report only; never touches git in the target repo.

REPO_DIR="${REPO_DIR:-$HOME/portfolio}"
REPO_URL="git@github.com:sdachary/sdachary.github.io.git"

PACA_URL="${PACA_URL:-http://localhost:80}"
PROJECT_ID="4cf13185-b9fb-4b19-97d1-2ee2c7597a5b"
STATUS_DONE="572c562b-b2b9-4cdb-88e6-2cc301b2145f"
KEY_FILE="${KEY_FILE:-$HOME/.paca_api_key}"
DRY_RUN="${DRY_RUN:-0}"
MAX_AGE_DAYS=120

if [ "$DRY_RUN" != "1" ]; then
  # NEVER point a non-dry run at a dev checkout: this branch hard-resets.
  if [ ! -d "$REPO_DIR" ]; then
    git clone "$REPO_URL" "$REPO_DIR"
  fi
  cd "$REPO_DIR"
  git fetch origin main
  git reset --hard origin/main
fi

if [ ! -f "$KEY_FILE" ]; then
  echo "Missing $KEY_FILE — cannot query Paca" >&2
  exit 1
fi

export PACA_URL PROJECT_ID STATUS_DONE MAX_AGE_DAYS KEY_FILE_OVERRIDE="$KEY_FILE"
node -e '
const fs = require("fs");
const http = require("http");
const KEY = fs.readFileSync(process.env.KEY_FILE_OVERRIDE, "utf8").trim();
const BASE = process.env.PACA_URL + "/api/v1/projects/" + process.env.PROJECT_ID + "/tasks";
const DONE = process.env.STATUS_DONE;
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS, 10);

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { "X-API-Key": KEY } }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error("bad JSON from " + url)); }
      });
    }).on("error", reject);
  });
}

// project label inferred from the task title; infra/board-level work -> INFRA/ACHARYLAB
const KNOWN = ["SAMPADA","SADHAN","BEPARA","DARPAN","CHITRAGUPTA","UDHYAM","VISHWAKARMA",
               "PRAYOG","SARASWATI","NIDHIFLOW","MCP-HUB","PORTFOLIO","MANACITRA","AHAM",
               "KARMA","INDRA"];
function projectFor(title) {
  const t = title.toUpperCase();
  for (const k of KNOWN) {
    if (t.includes(k) || t.includes(k.replace("-", " "))) return k;
  }
  if (/PACA|ORADB|ORADEV|MCP|INFRA|TUNNEL|CLOUDFLARE/.test(t)) return "INFRA";
  return "ACHARYLAB";
}

// kind inferred from title verbs (Paca task-type ids are per-project, not stable)
function kindFor(title) {
  const t = title.toLowerCase();
  if (/\b(fix|bug|hotfix|regression)\b/.test(t)) return "bugfix";
  if (/\b(docs|readme|guide|document)/.test(t)) return "docs";
  if (/\b(refactor|cleanup|migrate|reorganiz)/.test(t)) return "refactor";
  if (/\b(perf|optimi[sz]|speed up)/.test(t)) return "perf";
  if (/\b(test|uat)\b/.test(t)) return "test";
  if (/\b(deploy|build|ci|pipeline|provision)/.test(t)) return "build";
  return "feature";
}

// current phase per project — keep in sync with wiki/ROADMAP.md when phases roll.
// Existing entries keep their stored phase; this applies to NEW entries only.
const PHASE_MAP = {
  PORTFOLIO: "Phase 65", MANACITRA: "Phase 65", AHAM: "Phase 65", NIDHIFLOW: "Phase 58",
  SAMPADA: "Phase 57", SADHAN: "Phase 60", "MCP-HUB": "Phase 52", BEPARA: "Phase 61",
  CHITRAGUPTA: "Phase 61", DARPAN: "Phase 61", KARMA: "Phase 61", PRAYOG: "Phase 61",
  UDHYAM: "Phase 64", VISHWAKARMA: "Phase 61", INDRA: "Phase 61", SARASWATI: "Phase 61",
  INFRA: "Phase 63", ACHARYLAB: "",
};

(async () => {
  // walk cursor pagination (server returns fixed 20/page)
  let cursor = "", done = [];
  for (let page = 0; page < 40; page++) {
    const d = (await get(BASE + "?limit=100" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""))).data;
    done = done.concat(d.items.filter(t => t.status_id === DONE && !t.deleted_at));
    if (!d.next_cursor) break;
    cursor = d.next_cursor;
  }

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 864e5).toISOString().slice(0, 10);
  const entries = done
    .map(t => ({ date: (t.updated_at || "").slice(0, 10), t }))
    .filter(e => e.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ date, t }) => ({
      kind: kindFor(t.title),
      phase: PHASE_MAP[projectFor(t.title)] ?? "",
      project: projectFor(t.title),
      description: t.title.trim(),
      date,
      status: "completed",
    }));

  const existing = JSON.parse(fs.readFileSync("public/activity.json", "utf8"));
  const seen = new Set(existing.map(e => e.date + "|" + e.project + "|" + e.description));
  const fresh = entries.filter(e => !seen.has(e.date + "|" + e.project + "|" + e.description));

  if (fresh.length === 0) { console.log("No new completed tasks"); process.exit(2); }

  const merged = [...fresh, ...existing]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  fs.writeFileSync("public/activity.json", JSON.stringify(merged, null, 2) + "\n");
  console.log("Added " + fresh.length + " entr" + (fresh.length === 1 ? "y" : "ies") + " from Paca:");
  for (const e of fresh.slice(0, 8)) console.log("  " + e.date + " [" + e.project + "] " + e.description);
})();
'

rc=$?
if [ "$rc" -eq 2 ]; then echo "Nothing to sync"; exit 0; fi
if [ "$rc" -ne 0 ]; then exit "$rc"; fi

if [ "$DRY_RUN" = "1" ]; then
  git diff --stat public/activity.json
  git checkout -- public/activity.json
  echo "DRY_RUN — reverted local change"
  exit 0
fi

git config user.name "portfolio-sync"
git config user.email "portfolio-sync@oradev"

git add public/activity.json
if git diff --staged --quiet; then
  echo "No new activity to sync"
else
  git commit -m "chore: sync activity [skip ci]"
  git push origin main
  echo "Activity synced"
fi