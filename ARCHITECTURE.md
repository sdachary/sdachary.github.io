# Architecture — Portfolio

## Key Decisions
- Vite + React + TypeScript for fast dev experience; single build produces three pages (`index`, `manacitra`, `floweditor`) via Vite multi-page input.
- Static site hosted on GitHub Pages (`sdachary.github.io`) via Actions build (`deploy.yml`). A Cloudflare Pages path also exists (`npm run deploy` — vite build + `wrangler deploy`) but GitHub Pages is the canonical host.
- Mānacitra is a standalone page embedded on the homepage as an iframe; the flow editor is admin-only and never publicly linked.
- Contact form POSTs to an n8n webhook (URL injected at build from `VITE_N8N_WEBHOOK_URL` / Actions secret `N8N_WEBHOOK_URL`). Submissions land in a Notion DB. The legacy `worker/` CF Worker (Notion writer) is still in-repo but not wired into the site.

## Data Flow
```
push → ci.yml (gitleaks, lint, typecheck, test, build)
     → deploy.yml (dist/ → GitHub Pages)
browser → sdachary.github.io (static assets + Plausible cookieless analytics)
contact form → n8n webhook (Render) → Notion "Contact submissions" DB
```

## Services
- **portfolio** — the site itself (Vite + React + TS). Homepage sections: Hero, About, Experience, Projects, Mānacitra embed, Contact. L1 legal pages `/privacy.html` + `/terms.html` (DPDP); cookie banner in `public/cookie-banner.js` (informational, essential-only, persisted in localStorage, auto-dismissed on scroll).
- **portfolio-contact (n8n)** — webhook at `VITE_N8N_WEBHOOK_URL`, receives contact form JSON, forwards to the Notion submissions DB. Replaces the earlier CF Worker path (`worker/`), which is kept in-repo as reference only.
- **Mānacitra** — ops map at `/manacitra.html`. React + zustand, flat 2D SVG diagram (no three.js). Fixed 2×2 zone grid (cloudflare top-left, oradb top-right, oradev bottom-left, external bottom-right); zone containers with provider header bands, tile type subtitles, 72×72 rounded-square service tiles with simple-icons brand logos and health status dots. Connections are orthogonal with polygon arrowheads landing on block edges: intra-zone routes exit the source tile's left gutter and dive into the target's top edge; inter-zone targets enter via the card's left padding gutter, then the same top-edge approach; card targets end on the card's left/bottom edge. Routing is allocator-based so lines never overlap: horizontal-run lane allocator owns every run, leftward exits use per-row counters, gutters fan out per arrow/destination tile, family corridors push past intruding cards (verified headlessly in `layout.test.ts`: 0 collinear overlaps, 0 tile-crossings). Connection labels with halo (API/DB/SSH Tunnel/CI deploy/Errors), health badges, animated flow dots; `<text>` for crisp labels. Search/filters/layers/high-contrast wired to store; hover dim/active transitions. React Flow canvas editor at `/floweditor.html` (internal admin only, no public link) — node positions persist to localStorage, an "Export data.json" button downloads the full data with per-service `pos {x,y}` as a hand-review PR payload (FlatMap honors `svc.pos` when present, falls back to its fixed grid).

## Integration Points
- GitHub Pages — hosting; deploy from `.github/workflows/deploy.yml` (build + upload-pages-artifact + deploy-pages); CI from `ci.yml`.
- Cloudflare — optional Pages deploy via `npm run deploy` (`wrangler.jsonc` assets); legacy `worker/` (portfolio-contact, Notion writer) retained for reference.
- n8n (Render) — contact webhook → Notion submissions DB.
- Plausible — cookieless analytics (`script.outbound-links.js` in `index.html`).
- oradev (systemd timers) — `portfolio-sync.timer` runs `scripts/sync-activity.sh` daily (sources Recent Activity from the Paca API "Done" column, not public GitHub events); `manacitra-sync.timer` runs `scripts/sync-manacitra.sh` weekly (pulls repo, regenerates `public/manacitra/data.json` from live zone/service probing).