// Strona ustawień: personalizacja ekranu głównego + zarządzanie mapą offline.

/* ============================================================
 *  Personalizacja ekranu głównego (współdzielony model HomeLayout)
 * ============================================================ */
(function initPersonalization(){
  if(!window.HomeLayout) return;
  const listEl = document.getElementById('layout-tiles-list');
  const searchToggle = document.getElementById('layout-search-toggle');
  const resetBtn = document.getElementById('layout-reset-btn');
  if(!listEl) return;
  let state = window.HomeLayout.load();
  const LOCKED = window.HomeLayout.LOCKED;

  function esc(str){
    return String(str).replace(/[&<>"']+/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));
  }

  function persist(){ window.HomeLayout.save(state); }

  function render(){
    if(searchToggle) searchToggle.checked = !state.searchHidden;
    const upIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"></polyline></svg>';
    const downIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    listEl.innerHTML = state.tiles.map((tile, idx) => {
      const upDisabled = idx === 0 ? 'disabled' : '';
      const downDisabled = idx === state.tiles.length - 1 ? 'disabled' : '';
      const safeLabel = esc(tile.label || tile.id);
      const safeId = esc(tile.id);
      const locked = LOCKED.has(tile.id) || tile.locked;
      const visIcon = locked ? '/icns_ui/visibility_lock.svg' : (tile.hidden ? '/icns_ui/visibility_off.svg' : '/icns_ui/visibility.svg');
      return `<div class="layout-item" role="listitem" data-tile="${safeId}" data-hidden="${tile.hidden ? '1' : '0'}" data-locked="${locked ? '1' : '0'}">`
        + `<div class="layout-labels"><div class="layout-title">${safeLabel}</div></div>`
        + `<div class="layout-actions">`
        + `<button type="button" class="mini-btn ghost layout-vis-btn" data-tile-vis="${safeId}" data-hidden="${tile.hidden ? '1' : '0'}" data-locked="${locked ? '1' : '0'}" ${locked?'disabled':''} aria-label="${locked ? 'Ten kafelek jest zawsze widoczny' : (tile.hidden ? 'Pokaż' : 'Ukryj') + ' ' + safeLabel}"><img src="${visIcon}" alt="" aria-hidden="true" class="layout-vis-icon" /></button>`
        + `<div class="layout-move">`
        + `<button type="button" class="mini-btn ghost" data-move="up" data-tile="${safeId}" ${upDisabled} aria-label="Przesuń ${safeLabel} w górę">${upIcon}</button>`
        + `<button type="button" class="mini-btn ghost" data-move="down" data-tile="${safeId}" ${downDisabled} aria-label="Przesuń ${safeLabel} w dół">${downIcon}</button>`
        + `</div></div></div>`;
    }).join('');
  }

  listEl.addEventListener('click', e => {
    const moveBtn = e.target.closest('[data-move]');
    if(moveBtn){
      const id = moveBtn.getAttribute('data-tile');
      const dir = moveBtn.getAttribute('data-move');
      const idx = state.tiles.findIndex(t=> t.id === id);
      if(idx >= 0){
        if(dir === 'up' && idx > 0){
          [state.tiles[idx-1], state.tiles[idx]] = [state.tiles[idx], state.tiles[idx-1]];
          persist(); render();
        } else if(dir === 'down' && idx < state.tiles.length - 1){
          [state.tiles[idx+1], state.tiles[idx]] = [state.tiles[idx], state.tiles[idx+1]];
          persist(); render();
        }
      }
      return;
    }
    const visBtn = e.target.closest('[data-tile-vis]');
    if(visBtn){
      if(visBtn.disabled || visBtn.getAttribute('data-locked') === '1') return;
      const id = visBtn.getAttribute('data-tile-vis');
      const entry = state.tiles.find(t=> t.id === id);
      if(entry){ entry.hidden = !entry.hidden; persist(); render(); }
    }
  });

  if(searchToggle){
    searchToggle.addEventListener('change', ()=>{
      state.searchHidden = !searchToggle.checked;
      persist();
    });
  }

  if(resetBtn){
    resetBtn.addEventListener('click', ()=>{
      state = window.HomeLayout.defaults();
      persist(); render();
    });
  }

  render();
})();

/* ============================================================
 *  Mapa offline (Cache Storage API)
 * ============================================================ */
(function initOfflineMap(){
  const MAP_CACHE = 'kobywatel-map-offline-v1';
  const FLAG_KEY = 'kob.map.offline.v1';

  const statusDot = document.querySelector('#offline-status .offline-map__dot');
  const statusText = document.getElementById('offline-status-text');
  const progressWrap = document.getElementById('offline-progress');
  const barFill = document.getElementById('offline-bar-fill');
  const progressLabel = document.getElementById('offline-progress-label');
  const hint = document.getElementById('offline-hint');
  const downloadBtn = document.getElementById('offline-download-btn');
  const removeBtn = document.getElementById('offline-remove-btn');
  const openBtn = document.getElementById('offline-open-btn');
  if(!downloadBtn) return;

  const supported = ('caches' in window) && ('serviceWorker' in navigator);
  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  // --- Manifest zasobów mapy do pobrania offline ---
  const LOCAL_ASSETS = [
    '/map/index.html', '/map.css', '/map.js', '/route-search.js',
    '/db-adapter.js', '/db.config.json', '/map/political.svg',
    '/manifest.json', '/favicon.png', '/logo.png',
    '/icns_ui/company.svg', '/icns_ui/light_dark_mode.svg', '/icns_ui/link.svg',
    '/icns_ui/my_location.svg', '/icns_ui/person.svg', '/icns_ui/pin.svg',
    '/icns_ui/reset.svg', '/icns_ui/storefront.svg', '/icns_ui/unpin.svg',
    '/icns_ui/map_search.svg',
    '/map/base/map_light.webp', '/map/base/map_dark.webp'
  ];
  const DB_FILES = [
    'data/map-points/meta.json', 'data/map-points/localities-large.json',
    'data/map-points/localities-small.json', 'data/map-points/stations.json',
    'data/map-points/infra.json', 'data/map-points/airports.json',
    'data/map-points/players.json', 'data/map-lines.json',
    'data/khandel-products.json', 'data/companies.json'
  ];
  // Siatki kafelków hi-res (zgodne z TILE_CONFIG w map.js): 2x -> 3x3, 4x -> 5x5
  const TILE_LEVELS = [ { factor:2, grid:3 }, { factor:4, grid:5 } ];

  function tileUrls(){
    const out = [];
    for(const { factor, grid } of TILE_LEVELS){
      for(const theme of ['light','dark']){
        for(let r=0; r<grid; r++){
          for(let c=0; c<grid; c++){
            out.push(`/map/tiles${factor}x/${theme}/map_${theme}@${factor}x_r${r}_c${c}.webp`);
          }
        }
      }
    }
    return out;
  }

  async function buildManifest(){
    const urls = [...LOCAL_ASSETS, ...tileUrls()];
    // Dane z zewnętrznej bazy (DB_BASE) – rozwiązujemy na pełne URL-e.
    try {
      const dbUrls = await Promise.all(DB_FILES.map(p=> window.__db.url(p)));
      urls.push(...dbUrls);
    } catch(_){ /* brak DB_BASE – pomiń dane, kafelki i tak się zapiszą */ }
    return urls;
  }

  function setDot(state){ if(statusDot) statusDot.setAttribute('data-state', state); }

  function setBusy(busy){
    downloadBtn.disabled = busy;
    if(removeBtn) removeBtn.disabled = busy;
    progressWrap.hidden = !busy;
  }

  function setProgress(done, total){
    const pct = total ? Math.round((done/total)*100) : 0;
    if(barFill) barFill.style.width = pct + '%';
    if(progressLabel) progressLabel.textContent = pct + '% (' + done + '/' + total + ')';
  }

  async function isDownloaded(){
    if(!supported) return false;
    try {
      if(!(await caches.has(MAP_CACHE))) return false;
      const cache = await caches.open(MAP_CACHE);
      const keys = await cache.keys();
      return keys.length > 0;
    } catch(_){ return false; }
  }

  function readFlag(){
    try { return JSON.parse(localStorage.getItem(FLAG_KEY) || 'null'); } catch(_){ return null; }
  }

  async function refreshUI(){
    if(!supported){
      setDot('error');
      statusText.textContent = 'Twoja przeglądarka nie obsługuje trybu offline.';
      downloadBtn.disabled = true;
      return;
    }
    const has = await isDownloaded();
    // Otwarcie i usunięcie zależą tylko od tego, czy mapa jest w pamięci.
    if(removeBtn) removeBtn.hidden = !has;
    if(openBtn) openBtn.hidden = !has;

    if(has){
      const flag = readFlag();
      const when = flag?.ts ? new Date(flag.ts).toLocaleDateString('pl-PL') : null;
      setDot('ready');
      statusText.textContent = 'Mapa jest dostępna offline' + (when ? ' (pobrano ' + when + ')' : '') + '.';
    } else {
      setDot('idle');
      statusText.textContent = 'Mapa nie została jeszcze pobrana.';
    }

    // Pobieranie mapy offline jest dostępne wyłącznie w zainstalowanej aplikacji (PWA).
    if(!isStandalone()){
      downloadBtn.hidden = true;
      if(!has){
        setDot('idle');
        statusText.textContent = 'Dostępne po zainstalowaniu aplikacji.';
      }
      if(hint) hint.textContent = 'Pobieranie mapy offline działa po zainstalowaniu kObywatela na urządzeniu (PWA). Dodaj aplikację do ekranu głównego, aby skorzystać z tej opcji.';
    } else {
      downloadBtn.hidden = false;
      downloadBtn.querySelector('span').textContent = has ? 'Pobierz ponownie' : 'Pobierz mapę';
      if(hint && !has) hint.textContent = 'Pełna mapa zajmuje ok. 65 MB. Pobieraj przez Wi‑Fi.';
    }
  }

  async function download(){
    if(!isStandalone()) return; // pobieranie tylko w PWA
    setBusy(true);
    setDot('busy');
    statusText.textContent = 'Pobieranie mapy…';
    if(hint) hint.textContent = 'Nie zamykaj tej strony do zakończenia pobierania.';
    const urls = await buildManifest();
    const cache = await caches.open(MAP_CACHE);
    let done = 0; const total = urls.length; const failed = [];
    setProgress(0, total);
    let cursor = 0;
    const CONCURRENCY = 6;
    async function worker(){
      while(cursor < urls.length){
        const url = urls[cursor++];
        try {
          const resp = await fetch(url, { cache:'reload' });
          if(!resp || !resp.ok) throw new Error('HTTP ' + (resp && resp.status));
          await cache.put(url, resp);
        } catch(e){
          failed.push(url);
        }
        done++; setProgress(done, total);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, ()=> worker()));

    // Uznajemy pobranie za udane, jeśli zapisały się kluczowe zasoby (kafelki + strona).
    const ok = failed.length < total;
    if(ok){
      try { localStorage.setItem(FLAG_KEY, JSON.stringify({ ts: Date.now(), count: total - failed.length })); } catch(_){}
    }
    setBusy(false);
    await refreshUI();
    if(failed.length){
      if(hint) hint.textContent = 'Pobrano z pominięciem ' + failed.length + ' plików (brak połączenia z częścią danych). Możesz spróbować ponownie.';
    } else {
      if(hint) hint.textContent = 'Gotowe. Mapa zadziała bez internetu w zainstalowanej aplikacji.';
    }
  }

  async function remove(){
    if(!confirm('Usunąć pobraną mapę offline? Zwolni to miejsce w pamięci urządzenia, ale uniemożliwi korzystanie z mapy bez dostępu do internetu.')) return;
    setDot('busy');
    statusText.textContent = 'Usuwanie…';
    try { await caches.delete(MAP_CACHE); } catch(_){}
    try { localStorage.removeItem(FLAG_KEY); } catch(_){}
    if(hint) hint.textContent = 'Pełna mapa zajmuje ok. 70 MB. Zalecane pobieranie przez Wi‑Fi.';
    await refreshUI();
  }

  downloadBtn.addEventListener('click', ()=>{ download().catch(()=>{ setBusy(false); setDot('error'); statusText.textContent = 'Wystąpił błąd podczas pobierania.'; }); });
  if(removeBtn) removeBtn.addEventListener('click', ()=> remove());

  // Zareaguj, gdy aplikacja zostanie zainstalowana/uruchomiona jako PWA przy otwartej stronie.
  try {
    const mq = window.matchMedia('(display-mode: standalone)');
    if(mq.addEventListener){ mq.addEventListener('change', ()=> refreshUI()); }
    else if(mq.addListener){ mq.addListener(()=> refreshUI()); }
  } catch(_){}

  refreshUI();
})();

document.getElementById('back-btn')?.addEventListener('click', () => { window.location.href = '/'; });
