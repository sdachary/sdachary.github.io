# Architecture — Portfolio

## Key Decisions
- Vite + React + TypeScript for fast dev experience; single build produces three pages (`index`, `manacitra`, `floweditor`) via Vite multi-page input.
- Static site hosted on GitHub Pages (`sdachary.github.io`) via Actions build (`deploy.yml`).
- Mānacitra is a standalone page embedded on the homepage as an iframe; the flow editor is admin-only and never publicly linked.
- Contact form POSTs to the `portfolio-contact` Cloudflare Worker (`https://portfolio-contact.sdachary-582.workers.dev`), which appends submissions to the Notion "Contact Submissions" DB (`3d758aef-cf9d-8164-9d2c-e3519633dbc8`). The earlier n8n webhook path (`VITE_N8N_WEBHOOK_URL`) was removed — no n8n instance runs.

## Data Flow
```
push → ci.yml (gitleaks, lint, typecheck, test, build)
     → deploy.yml (dist/ → GitHub Pages)
browser → sdachary.github.io (static assets + Plausible cookieless analytics)
contact form → portfolio-contact CF Worker → Notion "Contact submissions" DB
```

## Services
- **portfolio** — the site itself (Vite + React + TS). Homepage sections: Hero, About, Experience, Projects, Mānacitra embed, Contact. L1 legal pages `/privacy.html` + `/terms.html` (DPDP); cookie banner in `public/cookie-banner.js` (informational, essential-only, persisted in localStorage, auto-dismissed on scroll).
- **portfolio-contact** — CF Worker (`worker/src/index.ts`, `worker/wrangler.toml`). Receives `{name, email, message}` POST (CORS: sdachary.github.io + localhost), appends to Notion Contact Submissions DB. `NOTION_TOKEN` is a Wrangler secret (tagged via `wrangler secret put`, not in the repo).
- **Mānacitra** — ops map at `/manacitra.html`. A **1950s cord switchboard**, drawn as an isometric technical plate with the `anatomy` skill: each service is a jack socket with a lamp above it and an engraved nameplate below, each connection is a real sagging patch cord, and health is lamp state (lit = online, dark = offline — so `notion` and the whole home subscriber box read dark, with no legend needed to explain it).
  - **Geometry** — `src/manacitra/figure/world.mjs` (bays, jack slots, cord routes) and `figure.mjs` (drawing) are **pure ESM with no node dependencies**, so the browser builds the same SVG the Node build audits (verified byte-identical). `public/manacitra/keys.json` carries only the audited *painter order*; no SVG is checked in, so a topology change needs no rebuild of a static asset.
  - **Audit** — `node tools/manacitra/build.mjs --audit` runs the anatomy kit's geometry audit (clearance, terminals, folds, self-overlap, depth order, crowding) and exits non-zero on any problem. Current state: **audit passed, zero problems**, with a minimal documented crowd allowlist. `scripts/lines.mjs` reports 0 floating line ends. `tools/manacitra/switchboard*.html` are standalone previews of the same figure.
  - **Runtime** — `figure/live.mjs` (no imports) wires selection, BFS hop lighting with a staggered reveal, a 60 s health poll, the idle tour, and the keyboard path (arrows move the jack focus, Enter traces, Escape clears). Health only flips `data-state`; the geometry is never rebuilt.
  - **Mount** — `Manacitra.tsx` is a thin React shell: fetch `data.json` + `keys.json`, build the plate, mount the live layer. The plate is written into its container **imperatively** (`host.innerHTML = plate.html`), never as React children — `dangerouslySetInnerHTML` re-writes its subtree on re-render and would wipe the live layer's lamp and cord state.
  - Dropped with the flat map: FilterPanel, LayerToggles, ambient audio, TouchControls, SceneDescription, InfoPanel, FlatMap, `layout.ts` (+test). Kept: contrast toggle, reduced-motion, and search — retargeted to "find a jack" (type a name, it selects the jack and lights the route).
  - React Flow canvas editor at `/floweditor.html` (internal admin only, no public link) — node positions persist to localStorage, an "Export data.json" button downloads the full data with per-service `pos {x,y}` as a hand-review PR payload.

## Integration Points
- GitHub Pages — hosting; deploy from `.github/workflows/deploy.yml` (build + upload-pages-artifact + deploy-pages); CI from `ci.yml`.
- Cloudflare — the `portfolio-contact` Worker (contact form → Notion). Site hosting is GitHub Pages only.
- Plausible — cookieless analytics (`script.outbound-links.js` in `index.html`).
- oradev (systemd timers) — `portfolio-sync.timer` runs `scripts/sync-activity.sh` daily (sources Recent Activity from the Paca API "Done" column, not public GitHub events); `manacitra-sync.timer` runs `scripts/sync-manacitra.sh` weekly (pulls repo, regenerates `public/manacitra/data.json` from live zone/service probing).