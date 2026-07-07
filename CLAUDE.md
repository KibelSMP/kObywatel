# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

kObywatel is a static, vanilla-JS PWA that serves as an e-governance portal for the KibelSMP Minecraft server community. It's deployed as-is to GitHub Pages (see `CNAME`) — there is no build step, bundler, package manager, or test suite. Every `.html` page loads its own `<script>`s directly.

## Working in this repo

- No `npm install`, no build, no test command exist. "Running" the app means opening the HTML files via a static file server (e.g. `python3 -m http.server`) since some pages use root-relative paths (`/db.config.json`, `/assets/...`) that don't resolve under `file://`.
- Validate changes by opening the affected page in a browser and exercising the feature — there is no automated test/lint/typecheck to fall back on.
- See `AGENTS.md` for the repo's working-principles/repo-map conventions; the guidance there still applies (smallest change that solves the request, don't broaden scope, match existing file's style).

## Data architecture: two different remote-data patterns

Content (map points/lines, kHandel products, kFirma companies, train metadata) lives in an **external GitHub repo**, not in this one: `KibelSMP/kobywatel-db` (also referenced as `KibelSMP/kObywatel-db` — GitHub repo names are case-insensitive, both resolve to the same repo).

Two ways code reaches that data — know which one a given file uses before editing it:

1. **`window.__db` (db-adapter.js)** — reads the base URL from `/db.config.json` (`DB_BASE`), then `window.__db.fetchJson('data/...')` builds the full raw.githubusercontent URL. Used by `app.js`, `route-search.js`, `map.js`, `settings.js`. Prefer this pattern for new code that fetches from the external db — it keeps the base URL configurable in one place.
2. **Hardcoded `raw.githubusercontent.com/KibelSMP/kObywatel-db/...` URLs** — used directly in `kfirma/index.js` and `kfirma/register.js` (`API_COMPANIES`, `API_SYMBOLS`). This is legacy/inconsistent with (1); don't propagate it further without reason.

Some modules pull from neither: `kwiedza.js` reads `/assets/docs/index.json` (bundled in this repo), `ksejm/index.js` / `ksejm/editor.js` read `/ksejm/data/index.json` and `/ksejm/docs/*` (also bundled in this repo, alongside real markdown/PDF acts).

## Page ↔ script map

Each top-level feature is an HTML page paired with a same-named JS file; there's no router or SPA framework — navigation is plain links between static pages.

| Page | Script | Purpose |
|---|---|---|
| `index.html` | `app.js` (+ `home-layout.js`) | Home page: search across map points/lines, personalized tile layout |
| `khandel.html` | `khandel.js` | kHandel — in-game shop/product catalog |
| `kwiedza.html` | `kwiedza.js` | kWiedza — markdown docs/guides (category → list → doc) |
| `kdokumenty.html` | `kdokumenty.js` | kDokumenty — generates PDFs client-side via jsPDF |
| `ksef.html` | `ksef.js` | kSeF — generates invoice PDFs (jsPDF + barcode font) |
| `ksejm/index.html` | `ksejm/index.js` (+ `sort-utils.js`) | kSejm — browse resolutions/statutes (acts), markdown rendering via markdown-it |
| `ksejm/editor.html` | `ksejm/editor.js` | kSejm editor/authoring view for acts |
| `ksejm/deputy/` | — | Deputy-facing regulation viewer/templates (downloadable doc templates, also precached for offline use) |
| `kfirma/index.html` | `kfirma/index.js` | kFirma — company registry browser |
| `kfirma/register.html` | `kfirma/register.js` | kFirma — company registration form |
| `map/index.html` | `map.js` (huge, ~3.9k lines) + `map.css` | Interactive game-world map: pan/zoom, hi-res tile layers (2x/4x, light/dark), point/line markers, live train overlay, kHandel/kFirma marker layers |
| `map/add.html` | — | Embedded Tally form to propose a new map point |
| `settings.html` | `settings.js` | Home tile personalization (shared `HomeLayout` model) + offline map download management |
| `report.html`, `creators.html` | — | Static helper pages |
| `403.html`, `404.html`, `500.html`, `offline.html` | — | Error / offline fallback pages, precached by the service worker |

## PWA / offline behavior

- `sw.js` is a Workbox-based service worker: precaches a small `offlineAssets` set (manifest, offline page, error CSS, ksejm/deputy templates) and serves `offline.html` as a navigation fallback. It also manages a separate `kobywatel-map-offline-v1` cache for user-triggered offline map downloads (initiated from `settings.html`).
- `offline-guard.js` runs on every page except `offline.html` (would create a redirect loop) and force-redirects to `/offline.html` when `navigator.onLine` is false, *unless* the current path is in its own `ALWAYS_OFFLINE` allowlist or is `/map` with the map already cached offline. If you add a new page that should work offline, it needs registering in **both** `sw.js`'s precache list and `offline-guard.js`'s `ALWAYS_OFFLINE` set.
- `pwa-install.js` / `pwa-links.js` handle install prompts and badge external/standalone-mode links respectively.

## Shared conventions across feature modules

- No framework: plain `document.getElementById`/`querySelector`, manual `innerHTML` templating, hand-rolled `escapeHtml()` re-implemented per file (not shared) — keep matching the local file's escaping helper rather than importing across files.
- Most feature pages keep a single top-level mutable `state` object and re-render on state change; there's no virtual DOM or diffing.
- PL/EN toggling where present (e.g. kHandel) is done via a `currentLang` variable persisted to `localStorage` and manual field fallback (`nameEn || namePl`), not i18n library.
- `home-layout.js` is the single source of truth for the home screen's tile order/visibility, shared by `app.js` (applies it) and `settings.js` (edits it) via `localStorage` key `kob.home.layout.v1`.
