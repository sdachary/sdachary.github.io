# Portfolio

> Personal portfolio site — Vite + React, deployed to GitHub Pages (`sdachary.github.io`).

## Pages

| Path | Content |
|------|---------|
| `/` | Homepage SPA — Hero, About, Experience, Projects, Mānacitra embed (iframe), Contact, legal footer links |
| `/manacitra.html` | Mānacitra infrastructure map (zones, services, connections); embedded on the homepage |
| `/floweditor.html` | Internal React Flow editor for the map (admin only, no public link) |
| `/privacy.html` | DPDP privacy notice |
| `/terms.html` | Terms of Service |

Cookie banner (`public/cookie-banner.js`): informational essential-only notice (DPDP — no consent needed for essential cookies); auto-dismissed on first scroll or Accept/Reject; choice persisted in `localStorage['acharylab-cookie-consent']`.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Vite + React + TypeScript |
| Database | Notion (contact submissions, via n8n webhook) |
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
| `npm test` | Run tests (vitest) |
| `npm run verify` | lint + typecheck + lint:manacitra + test |
| `npm run preview` | Build + `wrangler dev` preview |
| `npm run deploy` | Build + `wrangler deploy` (Cloudflare Pages path) |

## Env Vars

- `VITE_N8N_WEBHOOK_URL` — n8n webhook the contact form POSTs to. Injected at build time in GitHub Actions from the `N8N_WEBHOOK_URL` secret (never committed). See `.env.example` for details.

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.