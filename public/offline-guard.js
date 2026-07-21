// Strażnik offline: gdy urządzenie traci połączenie, przenosi na stronę /offline/.
// Wyjątek stanowią strony działające bez internetu (mapa pobrana offline).
// Skryptu NIE dołączamy do offline.html (byłaby pętla).
(function(){
  const MAP_CACHE = 'kobywatel-map-offline-v1';
  // Vercel strips the .html extension and adds a trailing slash for raw
  // public/*.html files — "/offline.html" itself 404s in production.
  const OFFLINE_PAGE = '/offline/';

  function normalizedPath(){
    return (location.pathname.replace(/\/+$/, '') || '/');
  }

  // Offline access is a PWA-only feature by design (see sw.js / settings.js, which
  // both gate precaching and the map download behind this same check). Cache Storage
  // is shared per-origin regardless of how a tab was opened, so without this check a
  // regular browser tab would also get offline access once the cache happens to be
  // populated (e.g. the device installed the PWA at some point) — checking cache
  // presence alone isn't enough to keep offline functionality PWA-exclusive.
  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  async function mapAvailableOffline(){
    try {
      if(!('caches' in window)) return false;
      const cache = await caches.open(MAP_CACHE);
      return !!(await cache.match('/map/index.html'));
    } catch(_){ return false; }
  }

  // Strony działające offline po pełnym precache (tylko w zainstalowanej PWA).
  // Ścieżka → plik strony w pamięci podręcznej service workera.
  // v2 (Next.js static export, trailingSlash): routes are emitted as /<route>/index.html,
  // so the cached navigation key is '/<route>/'. normalizedPath() strips the trailing
  // slash for the lookup key, but the VALUE must be the real cached key.
  const PWA_OFFLINE_PAGES = {
    '/': '/',
    '/settings': '/settings/',
    '/ksef': '/ksef/',
    '/kdokumenty': '/kdokumenty/',
    '/ksejm/deputy': '/ksejm/deputy/'
  };

  async function pageAvailableOffline(key){
    try {
      if(!('caches' in window)) return false;
      return !!(await caches.match(key));
    } catch(_){ return false; }
  }

  // Czy bieżąca strona działa offline (i nie należy przekierowywać)?
  async function isExempt(){
    const path = normalizedPath();
    if(path === '/offline') return true;
    // Cała reszta trybu offline działa wyłącznie w zainstalowanej PWA — nawet jeśli
    // pamięć podręczna jest już wypełniona (np. z wcześniejszej instalacji na tym
    // urządzeniu), zwykła karta przeglądarki nie ma z niej korzystać.
    if(!isStandalone()) return false;
    // Strony precache'owane działają offline tylko w zainstalowanej PWA.
    if(PWA_OFFLINE_PAGES[path]){
      return await pageAvailableOffline(PWA_OFFLINE_PAGES[path]);
    }
    // Podgląd mapy działa offline tylko po jej pobraniu.
    if(path === '/map' || path === '/map/index.html'){
      return await mapAvailableOffline();
    }
    return false;
  }

  let redirecting = false;
  async function guard(){
    if(redirecting) return;
    if(navigator.onLine) return;
    if(await isExempt()) return;
    redirecting = true;
    const from = location.pathname + location.search;
    location.href = OFFLINE_PAGE + '?from=' + encodeURIComponent(from);
  }

  window.addEventListener('offline', guard);
  // Strona mogła zostać otwarta już w trybie offline (np. z pamięci / BFCache).
  window.addEventListener('pageshow', guard);
  if(!navigator.onLine){ guard(); }
})();
