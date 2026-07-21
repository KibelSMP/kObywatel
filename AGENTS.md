# AGENTS.md

Working-principles and repo-map conventions for AI agents. See `CLAUDE.md` for architecture, the page↔route map, and PWA/offline behavior.

## Working principles

- **Smallest change that solves the request.** Don't refactor or restyle beyond what was asked; mention unrelated issues instead of fixing them inline.
- **Match the existing file's style.** Conventions are per-file; there is no shared linter/formatter.
- **Prefer shared helpers** (`lib/*`, `components/*`) over duplicating logic across pages.
- **Islands are ported, not rewritten.** When editing an island (`public/*.js`), preserve its logic — for the map/kHandel/PDF/offline code, change class strings and paths, not behavior. Never introduce `next/link`; use plain `<a href>` (see CLAUDE.md "island pattern").
- **There IS a build step now** (Next.js). `npm run build` must stay green; it also regenerates the PWA precache manifest.

## Repo map

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router pages. `app/(shell)/` = pages with the shared header; `app/map/`, `app/page.js` = own chrome. |
| `components/` | React components: `SiteHeader`, `Icon`, `IslandLoader`, `ServiceWorker`, `PwaInstall`, `TallyEmbed`. |
| `lib/` | Importable modules: `db`, `utils`, `homeLayout`, `kwiedzaData`, `appleAssets`. |
| `public/` | Everything served at the site root: island scripts + CSS, `sw.js`/`offline-guard.js`, `db-adapter.js`/`db.config.json`, static assets (`assets/`, `icns_ui/`, `icns_transit/`, `mc-items/`, `map/base|tiles2x|tiles4x/`), raw fallback pages (`offline.html`, `403.html`, `500.html`), bundled kSejm data/docs. |
| `scripts/write-pwa-assets.mjs` | Post-build PWA precache-manifest generator. |
| `app/globals.css` | Tailwind v4 `@theme` tokens + base/prose/icon styles. |
| `_legacy/` | (gitignored) v1 originals kept as migration reference; not deployed. Delete once migration is settled. |
