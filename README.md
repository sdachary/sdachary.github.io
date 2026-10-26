# Portfolio

> Personal portfolio site — Vite + React, deployed to GitHub Pages (`sdachary.github.io`).

## Pages

| Path | Content |
|------|---------|
| `/` | Homepage SPA — Hero, About, Experience, Projects, Mānacitra embed (iframe), Contact, legal footer links |
| `/manacitra.html` | Mānacitra infrastructure map — an isometric cord switchboard (one jack + lamp per service, one patch cord per connection, lamp state = health); three views of one board: the **plate** (tilt, zoom, searchable roster), a **real 3D model** (three.js — drag to orbit, scroll to zoom, click a jack to trace its cords), and a **2D tier map** (five labelled tiers, one labelled curve per connection); on the light board the cords carry an animated flow; embedded on the homepage |
| `/floweditor.html` | Internal React Flow editor for the map (admin only, no public link) |
| `/privacy.html` | DPDP privacy notice |
| `/terms.html` | Terms of Service |

Cookie banner (`public/cookie-banner.js`): informational essential-only notice (DPDP — no consent needed for essential cookies); auto-dismissed on first scroll or Accept/Reject; choice persisted in `localStorage['acharylab-cookie-consent']`.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Vite + React + TypeScript |
| Database | Notion (contact submissions via `portfolio-contact` CF Worker) |
| Analytics | Plausible (cookieless) |
| Deploy | GitHub Pages (`.github/workflows/deploy.yml`, Actions build) |

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (Vite multi-page: `index` + `manacitra` + `floweditor`) |
| `npm run lint` | ESLint check |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint:manacitra` | Validate `public/manacitra/data.json` shape |
| `node tools/manacitra/build.mjs --audit` | Build the switchboard plate and run the anatomy geometry audit (exits non-zero on any problem) |
| `npm test` | Run tests (vitest) |
| `npm run verify` | lint + typecheck + lint:manacitra + test |

## Env Vars

None required for contact — the form posts to the hardcoded `portfolio-contact` Worker endpoint (CORS allows the GitHub Pages origin). Worker's `NOTION_TOKEN` is a Wrangler secret, not a repo value.

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.