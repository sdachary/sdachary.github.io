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
- **Mānacitra** — ops map at `/manacitra.html`. React + zustand, flat 2D SVG diagram (no three.js). Fixed 2×2 zone grid (cloudflare top-left, oradb top-right, oradev bottom-left, external bottom-right); zone containers with provider header bands, tile type subtitles, 72×72 rounded-square service tiles with simple-icons brand logos and health status dots. Connections are orthogonal with polygon arrowheads landing on block edges: intra-zone routes exit the source tile's left gutter and dive into the target's top edge; inter-zone targets enter via the card's left padding gutter, then the same top-edge approach; card targets end on the card's left/bottom edge. Routing is allocator-based so lines never overlap: horizontal-run lane allocator owns every run, leftward exits use per-row counters, gutters fan out per arrow/destination tile, family corridors push past intruding cards (verified headlessly in `layout.test.ts`: 0 collinear overlaps, 0 tile-crossings). Connection labels with halo (API/DB/SSH Tunnel/CI deploy/Errors), health badges, animated flow dots; `<text>` for crisp labels. Search/filters/layers/high-contrast wired to store; hover dim/active transitions. React Flow canvas editor at `/floweditor.html` (internal admin only, no public link) — node positions persist to localStorage, an "Export data.json" button downloads the full data with per-service `pos {x,y}` as a hand-review PR payload (FlatMap honors `svc.pos` when present, falls back to its fixed grid).

## Integration Points
- GitHub Pages — hosting; deploy from `.github/workflows/deploy.yml` (build + upload-pages-artifact + deploy-pages); CI from `ci.yml`.
- Cloudflare — the `portfolio-contact` Worker (contact form → Notion). Site hosting is GitHub Pages only.
- Plausible — cookieless analytics (`script.outbound-links.js` in `index.html`).
- oradev (systemd timers) — `portfolio-sync.timer` runs `scripts/sync-activity.sh` daily (sources Recent Activity from the Paca API "Done" column, not public GitHub events); `manacitra-sync.timer` runs `scripts/sync-manacitra.sh` weekly (pulls repo, regenerates `public/manacitra/data.json` from live zone/service probing).