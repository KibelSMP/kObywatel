// Post-build step: generate the PWA offline precache manifest.
//
// Next.js static export splits each route's JS into hashed chunks under
// /_next/static/**, so the service worker can't hardcode their names. This script
// reads the exported HTML for the routes that must work offline in the installed
// PWA, harvests every same-origin asset they reference (JS chunks, CSS, fonts),
// and writes the union — plus the route documents themselves — to
// out/pwa-precache-manifest.json, which public/sw.js fetches at precache time.
//
// Runs from `npm run build` (after `next build`). If out/ is missing (e.g. someone
// runs it standalone), it exits quietly and the SW falls back to its core list.

import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('out');

// Routes precached for offline use in the installed PWA. Keep in sync with
// sw.js NAV_FALLBACKS and offline-guard.js PWA_OFFLINE_PAGES.
// '' = home ('/'), the PWA's start_url — it must work offline too.
const OFFLINE_ROUTES = ['', 'settings', 'ksef', 'kdokumenty', 'ksejm/deputy'];

// The map route isn't part of the standard PWA precache (it's opt-in, downloaded
// separately into MAP_CACHE — see public/settings.js LOCAL_ASSETS). But it's still
// a Next.js page: it needs its own hashed JS/CSS chunks to hydrate (React runtime +
// IslandLoader, which is what appends map.js/route-search.js to the DOM), and those
// hashes change every build just like the routes above. Harvested separately so
// settings.js can merge them into its own download manifest.
const MAP_ROUTE = 'map';

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

// Harvests same-origin /_next/** asset references (src="..."/href="...") out of a
// route's exported HTML document.
async function harvestRouteAssets(route) {
  const docPath = path.join(OUT_DIR, route, 'index.html');
  if (!(await exists(docPath))) {
    console.warn(`[write-pwa-assets] missing ${route}/index.html — skipped.`);
    return null;
  }
  const html = await readFile(docPath, 'utf8');
  const assets = new Set();
  const refs = html.matchAll(/(?:src|href)="(\/_next\/[^"]+)"/g);
  for (const m of refs) assets.add(decodeAmp(m[1]));
  return assets;
}

async function main() {
  if (!(await exists(OUT_DIR))) {
    console.warn('[write-pwa-assets] out/ not found — skipping precache manifest.');
    return;
  }

  const assets = new Set();
  for (const route of OFFLINE_ROUTES) {
    const routeAssets = await harvestRouteAssets(route);
    if (!routeAssets) continue;
    // Cache the navigation document under its trailing-slash key (home: '/').
    assets.add(route ? `/${route}/` : '/');
    for (const a of routeAssets) assets.add(a);
  }

  const sorted = [...assets].sort();
  const target = path.join(OUT_DIR, 'pwa-precache-manifest.json');
  await writeFile(target, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`[write-pwa-assets] wrote ${sorted.length} entries to out/pwa-precache-manifest.json`);

  const mapAssets = await harvestRouteAssets(MAP_ROUTE);
  if (mapAssets) {
    const mapSorted = [...mapAssets].sort();
    const mapTarget = path.join(OUT_DIR, 'map-precache-manifest.json');
    await writeFile(mapTarget, JSON.stringify(mapSorted, null, 2) + '\n', 'utf8');
    console.log(`[write-pwa-assets] wrote ${mapSorted.length} entries to out/map-precache-manifest.json`);
  }
}

function decodeAmp(s) {
  return s.replace(/&amp;/g, '&');
}

main().catch((err) => {
  console.error('[write-pwa-assets] failed:', err);
  process.exit(1);
});
