// Strażnik offline: gdy urządzenie traci połączenie, przenosi na stronę /offline.html.
// Wyjątek stanowią strony działające bez internetu (mapa pobrana offline).
// Skryptu NIE dołączamy do offline.html (byłaby pętla).
(function(){
  const MAP_CACHE = 'kobywatel-map-offline-v1';
  const OFFLINE_PAGE = '/offline.html';

  function normalizedPath(){
    return (location.pathname.replace(/\/+$/, '') || '/');
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
  const PWA_OFFLINE_PAGES = {
    '/settings': '/settings.html', '/settings.html': '/settings.html',
    '/ksef': '/ksef.html', '/ksef.html': '/ksef.html',
    '/kdokumenty': '/kdokumenty.html', '/kdokumenty.html': '/kdokumenty.html'
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
    if(path === OFFLINE_PAGE || path === '/offline') return true;
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
    location.href = OFFLINE_PAGE;
  }

  window.addEventListener('offline', guard);
  // Strona mogła zostać otwarta już w trybie offline (np. z pamięci / BFCache).
  window.addEventListener('pageshow', guard);
  if(!navigator.onLine){ guard(); }
})();
