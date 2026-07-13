# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

kObywatel is an e-governance portal PWA for the KibelSMP Minecraft server community. **v2.0** is a **Next.js (App Router) + Tailwind CSS v4** app, built as a **static export** (`output: 'export'`) and hosted on **Vercel**. There is no backend — every "database" read is a client-side fetch to an external GitHub repo.

## Working in this repo

- `npm run dev` — local dev server (hot reload). `npm run build` — production static export to `out/` **plus** the PWA precache-manifest generator (`scripts/write-pwa-assets.mjs`). `npm run serve:out` — serve the built `out/` for a production-like check.
- Validate by opening pages in a browser and exercising the feature — there is no automated test/lint/typecheck suite. The imperative "island" pages (map, kHandel, and the search/PDF/offline logic) only fully work in a real browser, not from a static HTML grep.
- Plain JavaScript (no TypeScript). Match the surrounding file's style.

## Architecture: the "island" pattern

Most pages are ordinary React/Tailwind (server) components. But several features carry large, battle-tested **imperative** logic (DOM/canvas manipulation, PDF generation, Cache Storage). Rather than rewrite these as React, they are ported near-verbatim as plain scripts in `public/` and mounted as **islands**:

- A page renders the exact DOM shell (same element `id`s/classes the script queries) as JSX.
- `components/IslandLoader.js` (client) exposes the globals the script expects (`window.__db`, `window.escapeHtml`, `window.markdownit`, `window.jspdf`, `window.HomeLayout`, `window.KWiedzaData`, …) from bundled modules, then appends the island script(s).
- **Navigation is plain `<a href>` everywhere — never `next/link`.** Islands grab DOM refs and register `window` listeners at module top level; a full document reload per navigation keeps their "runs once against a fresh DOM" assumption true (and matches v1, which had no SPA behavior).

Islands: `public/map.js` (+`route-search.js`, `map.css`), `public/khandel-core.js` (+`khandel.css`), `public/ksef.js`, `public/kdokumenty.js`, `public/kfirma-index.js`, `public/kfirma-register.js`, `public/kwiedza.js`, `public/settings.js`, `public/home.js`, `public/ksejm/index.js` (+`sort-utils.js`), `public/ksejm/deputy/index.js`.

## Data architecture

Content (map points/lines, kHandel products, kFirma companies) lives in the **external** `KibelSMP/kobywatel-db` repo. Two access paths:
1. **`window.__db`** (`public/db-adapter.js`) — reads `DB_BASE` from `/db.config.json` at runtime (`cache:'no-store'`, so the source is hot-swappable without a redeploy), then `fetchJson('data/…')`. Used by every island.
2. **`lib/db.js`** — the same `loadConfig/url/fetchJson` shape as an importable ES module, for new React components.

Bundled (in-repo, not external) data: kWiedza docs (`public/assets/docs/index.json` + markdown), kSejm acts (`public/ksejm/data|docs`), kSejm deputy templates (`public/ksejm/deputy/download`).

## Page ↔ route map

| Route | Page | Island / logic |
|---|---|---|
| `/` | `app/page.js` | `public/home.js` — search + `lib/homeLayout.js` tile personalization |
| `/khandel/` | `app/(shell)/khandel/page.js` | `public/khandel-core.js` + `khandel.css` |
| `/kwiedza/` | `app/(shell)/kwiedza/page.js` | `public/kwiedza.js` (markdown docs, history deep-linking) |
| `/kdokumenty/` | `app/(shell)/kdokumenty/page.js` | `public/kdokumenty.js` (jsPDF) |
| `/ksef/` | `app/(shell)/ksef/page.js` | `public/ksef.js` (jsPDF + barcode font) |
| `/ksejm/`, `/ksejm/deputy/` | `app/(shell)/ksejm/…` | `public/ksejm/…` (markdown-it) |
| `/kfirma/`, `/kfirma/register/` | `app/(shell)/kfirma/…` | `public/kfirma-index.js`, `public/kfirma-register.js` |
| `/map/` | `app/map/page.js` | `public/map.js` (+`route-search.js`, `map.css`) — full-bleed, no shared header |
| `/map/add/` | `app/map/add/page.js` | Tally embed |
| `/settings/` | `app/(shell)/settings/page.js` | `public/settings.js` (tile editor + offline-map download) |
| `/report/`, `/creators/` | `app/(shell)/…` | static / Tally |
| `not-found.js` | — | 404 (replaces the old `404.html`) |

`app/(shell)/layout.js` provides the shared header (`components/SiteHeader.js`) + footer. The map and home render their own chrome. Raw fallback pages that stay outside Next: `public/offline.html`, `public/403.html`, `public/500.html`.

## Theme (Tailwind v4)

`app/globals.css` holds the `@theme` tokens (`koaccent`, `koaccent2`, `koaccenttext`, `kobg`, `koelev`, `koelev2`, `koborder`, `kotext`, `kodim`, status/map-marker colors). Light/dark switches purely by `prefers-color-scheme` — there is **no** manual app-theme toggle. (The map's own light/dark button, in `map.css`/`map.js`, only swaps the map *tile imagery* and is separate.) Accent `#AC1943` and backgrounds are carried over unchanged from v1.

## PWA / offline

- `public/sw.js` — hand-written Workbox-loaded SW (not codegen). Two caches, **names unchanged from v1** (never rename): `pwabuilder-page-v2` (precache) and `kobywatel-map-offline-v1` (offline map, preserved across `activate`). `offlineFallbackAssets` (offline.html + logo) is precached on install; the full set (`corePwaAssets` + build-generated `/pwa-precache-manifest.json`) is fetched only on the `PRECACHE_PWA_ASSETS` message, sent by `components/ServiceWorker.js` **only in standalone (installed PWA)** mode. `components/ServiceWorker.js` also registers the SW on **every** route and drives the "new version" update banner (`SKIP_WAITING`).
- **`scripts/write-pwa-assets.mjs`** (runs in `npm run build`) reads `out/` for the offline routes' hashed JS/CSS chunks and writes `out/pwa-precache-manifest.json`. If you add a page that must work offline, add its route to `OFFLINE_ROUTES` there, to `sw.js` `NAV_FALLBACKS`, and to `offline-guard.js` `PWA_OFFLINE_PAGES`.
- `public/offline-guard.js` redirects to `/offline.html` when offline unless the path is exempt (offline page, a precached PWA page present in cache, or `/map` with the offline map downloaded). `settings.js` writes the map cache directly (no SW message); its `TILE_LEVELS` must stay in sync with `map.js`'s `TILE_CONFIG`.
- `components/PwaInstall.js` — install-prompt banner (iOS/Safari/Chromium branches, 180-day dismissal TTL).

## Hosting

Vercel, Next.js preset, static export. `vercel.json` sets security headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Custom domain `kobywatel-mc.stankiewiczm.eu` (was GitHub Pages; the `CNAME` file is retired on Vercel).
