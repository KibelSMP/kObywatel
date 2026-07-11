importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// Podbicie wersji czyści stary cache, w którym pełny zestaw mieli też
// użytkownicy przeglądarki (przed rozdzieleniem precache'u na tryb PWA).
const CACHE = "pwabuilder-page-v2";
// Pamięć podręczna mapy offline (zapisywana z /settings).
const MAP_CACHE = "kobywatel-map-offline-v1";

// Minimalny zestaw zapisywany zawsze (także w przeglądarce): tylko strona
// „Jesteś offline” i jej zasoby. Reszta pobiera się wyłącznie w trybie PWA.
const offlineFallbackAssets = [
    "offline.html",
    "/logo.png"
];

// Zasoby dostępne offline w zainstalowanej aplikacji (PWA). Pobierane dopiero
// po wiadomości PRECACHE_PWA_ASSETS ze strony działającej w trybie standalone.
const pwaAssets = [
    "/manifest.json",
    "/errors.css",
    "/style.css",
    "/offline-guard.js",
    "/db-adapter.js",
    "/db.config.json",
    "/home-layout.js",
    "/favicon.png",
    // Ustawienia
    "/settings.html",
    "/settings.js",
    "/icns_ui/download.svg",
    "/icns_ui/delete.svg",
    "/icns_ui/visibility.svg",
    "/icns_ui/visibility_off.svg",
    "/icns_ui/visibility_lock.svg",
    // kSeF
    "/ksef.html",
    "/ksef.js",
    "/assets/ksef.png",
    // kDokumenty
    "/kdokumenty.html",
    "/kdokumenty.js",
    "/assets/kdokumenty.png",
    // kSejm – szablony poselskie
    "/ksejm/deputy/",
    "/ksejm/deputy/download/Szablon%20projektu%20ustawy.md",
    "/ksejm/deputy/download/Szablon%20projektu%20ustawy.odt",
    "/ksejm/deputy/download/Szablon%20projektu%20uchwa%C5%82y.md",
    "/ksejm/deputy/download/Szablon%20projektu%20uchwa%C5%82y.odt"
];

// Biblioteki zewnętrzne (CDN) potrzebne do kSeF/kDokumenty offline.
// Cache tolerancyjny – ewentualny błąd nie blokuje precache'u.
const cdnAssets = [
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
    "https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js"
];

// Mapowanie ścieżek nawigacji na zapisany plik strony (dla trybu offline).
const NAV_FALLBACKS = {
    "/settings": "/settings.html",
    "/settings/": "/settings.html",
    "/settings.html": "/settings.html",
    "/ksef": "/ksef.html",
    "/ksef/": "/ksef.html",
    "/ksef.html": "/ksef.html",
    "/kdokumenty": "/kdokumenty.html",
    "/kdokumenty/": "/kdokumenty.html",
    "/kdokumenty.html": "/kdokumenty.html",
    // Mapa działa offline tylko po pobraniu (plik jest wtedy w MAP_CACHE).
    "/map": "/map/index.html",
    "/map/": "/map/index.html",
    "/map/index.html": "/map/index.html"
};

const offlineFallbackPage = "offline.html";

// Pełny precache dla PWA – wywoływany na żądanie, nie przy instalacji.
async function precachePwaAssets() {
    const cache = await caches.open(CACHE);
    await cache.addAll(pwaAssets);
    // CDN – nie przerywaj precache'u, jeśli któryś zasób zawiedzie.
    await Promise.allSettled(cdnAssets.map(async (url) => {
        try {
            const resp = await fetch(url, { mode: 'cors' });
            if (resp && resp.ok) await cache.put(url, resp);
        } catch (_) { /* pomiń */ }
    }));
}

// Czy pełny precache PWA został już wykonany? (marker: pierwsza strona zestawu)
async function pwaAssetsCached() {
    const cache = await caches.open(CACHE);
    return !!(await cache.match(pwaAssets[0]));
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
