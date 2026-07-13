importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// v2 (Next.js static export). Cache names are UNCHANGED from v1 on purpose:
// bumping CACHE clears the old precache; MAP_CACHE is preserved across activations
// so installed users never lose their downloaded offline map.
const CACHE = "pwabuilder-page-v2";
const MAP_CACHE = "kobywatel-map-offline-v1";

// Minimalny zestaw zapisywany zawsze (także w przeglądarce): tylko strona
// „Jesteś offline” i jej zasoby. Reszta pobiera się wyłącznie w trybie PWA.
const offlineFallbackAssets = [
    "offline.html",
    "/logo.png"
];

// Statyczny rdzeń zestawu offline (pliki spoza buildu Next, o stałych nazwach).
// Dynamiczne trasy Next (dokumenty HTML + hashowane chunki JS) dokładane są z
// wygenerowanego /pwa-precache-manifest.json (patrz precachePwaAssets()).
const corePwaAssets = [
    "/manifest.json",
    "/offline-guard.js",
    "/db-adapter.js",
    "/db.config.json",
    "/favicon.png",
    // Ikony UI (Ustawienia)
    "/icns_ui/download.svg",
    "/icns_ui/delete.svg",
    "/icns_ui/visibility.svg",
    "/icns_ui/visibility_off.svg",
    "/icns_ui/visibility_lock.svg",
    // Ikony współdzielonego nagłówka (SiteHeader) — renderowany na każdej z
    // powyższych stron offline, więc jego ikony (nawigacja + ustawienia + menu)
    // muszą być precache'owane razem z nimi, inaczej znikają offline.
    "/icns_ui/settings.svg",
    "/icns_ui/close.svg",
    "/icns_ui/menu.svg",
    "/icns_ui/map.svg",
    "/icns_ui/storefront.svg",
    "/icns_ui/book.svg",
    "/icns_ui/ksejm.svg",
    "/icns_ui/invoice.svg",
    "/icns_ui/company.svg",
    "/icns_ui/document.svg",
    // Logotypy modułów
    "/assets/ksef.png",
    "/assets/kdokumenty.png",
    // kSejm – szablony poselskie (pliki do pobrania)
    "/ksejm/deputy/download/Szablon%20projektu%20ustawy.md",
    "/ksejm/deputy/download/Szablon%20projektu%20ustawy.odt",
    "/ksejm/deputy/download/Szablon%20projektu%20uchwa%C5%82y.md",
    "/ksejm/deputy/download/Szablon%20projektu%20uchwa%C5%82y.odt"
];

// Mapowanie ścieżek nawigacji na zapisany dokument strony (dla trybu offline).
// v2: trasy Next są emitowane jako /<trasa>/ (trailingSlash).
const NAV_FALLBACKS = {
    "/settings": "/settings/",
    "/settings/": "/settings/",
    "/ksef": "/ksef/",
    "/ksef/": "/ksef/",
    "/kdokumenty": "/kdokumenty/",
    "/kdokumenty/": "/kdokumenty/",
    "/ksejm/deputy": "/ksejm/deputy/",
    "/ksejm/deputy/": "/ksejm/deputy/",
    // Mapa działa offline tylko po pobraniu (plik jest wtedy w MAP_CACHE).
    "/map": "/map/index.html",
    "/map/": "/map/index.html",
    "/map/index.html": "/map/index.html"
};

const offlineFallbackPage = "offline.html";

// Zwraca pełną listę zasobów PWA: rdzeń + wygenerowany manifest tras Next.
async function pwaAssetList() {
    let generated = [];
    try {
        const resp = await fetch("/pwa-precache-manifest.json", { cache: "no-store" });
        if (resp && resp.ok) generated = await resp.json();
    } catch (_) { /* brak manifestu = precache tylko rdzenia */ }
    // Deduplikacja
    return Array.from(new Set([...corePwaAssets, ...generated]));
}

// Pełny precache dla PWA – wywoływany na żądanie, nie przy instalacji.
async function precachePwaAssets() {
    const cache = await caches.open(CACHE);
    const assets = await pwaAssetList();
    // Tolerancyjnie: pojedynczy błąd nie przerywa całego precache'u.
    await Promise.allSettled(assets.map(async (url) => {
        try {
            const resp = await fetch(url, { cache: "no-store" });
            if (resp && resp.ok) await cache.put(url, resp);
        } catch (_) { /* pomiń */ }
    }));
}

// Czy pełny precache PWA został już wykonany? (marker: manifest strony głównej zestawu)
async function pwaAssetsCached() {
    const cache = await caches.open(CACHE);
    return !!(await cache.match("/manifest.json"));
}

self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
    if (event.data && event.data.type === "PRECACHE_PWA_ASSETS") {
        // Pobierz zestaw tylko raz; odświeżanie robi zdarzenie activate.
        event.waitUntil((async () => {
            if (!(await pwaAssetsCached())) await precachePwaAssets();
        })());
    }
});

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(offlineFallbackAssets);
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Usuń przestarzałe wersje cache (poza mapą offline i bieżącą wersją).
        const names = await caches.keys();
        await Promise.all(names
            .filter((name) => name !== CACHE && name !== MAP_CACHE)
            .map((name) => caches.delete(name)));
        // Nowa wersja service workera: odśwież pełny zestaw PWA, o ile był pobrany.
        if (await pwaAssetsCached()) await precachePwaAssets();
    })());
});

if (workbox.navigationPreload.isSupported()) {
    workbox.navigationPreload.enable();
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    // Nawigacje: sieć (z preloadem), a offline – zapisana strona / strona zastępcza.
    if (req.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const preloadResp = await event.preloadResponse;
                if (preloadResp) return preloadResp;
                return await fetch(req);
            } catch (error) {
                const url = new URL(req.url);
                const key = NAV_FALLBACKS[url.pathname];
                if (key) {
                    const page = await caches.match(key);
                    if (page) return page;
                }
                const cached = await caches.match(req, { ignoreSearch: true });
                if (cached) return cached;
                const cache = await caches.open(CACHE);
                const fallback = await cache.match(offlineFallbackPage);
                return fallback || Response.error();
            }
        })());
        return;
    }

    // Zasoby GET: sieć (świeże dane online), a przy braku sieci – pamięć podręczna.
    event.respondWith((async () => {
        try {
            return await fetch(req);
        } catch (error) {
            const cached = await caches.match(req);
            if (cached) return cached;
            return Response.error();
        }
    })());
});
