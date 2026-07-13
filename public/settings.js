// Settings island: home-screen + nav-bar personalization, plus offline map management.
// Ported from the legacy settings.js. The offline-map logic (Cache Storage writes
// to kobywatel-map-offline-v1, TILE_LEVELS grid, concurrency downloader) is VERBATIM
// — do not change the cache name or tile math. The personalization editor markup was
// reskinned to Tailwind. Globals: window.HomeLayout, window.NavLayout.

/* ---------- Home-screen personalization (search-field visibility only — tile
   order/visibility is edited by dragging tiles directly on the home page) ---------- */
(function initPersonalization() {
  if (!window.HomeLayout) return;
  const searchToggle = document.getElementById('layout-search-toggle');
  if (!searchToggle) return;
  const state = window.HomeLayout.load();
  searchToggle.checked = !state.searchHidden;
  searchToggle.addEventListener('change', () => {
    state.searchHidden = !searchToggle.checked;
    window.HomeLayout.save(state);
  });
})();

/* ---------- Nav bar personalization (shared NavLayout model) ---------- */
(function initNavPersonalization() {
  if (!window.NavLayout) return;
  const listEl = document.getElementById('nav-tiles-list');
  const resetBtn = document.getElementById('nav-reset-btn');
  if (!listEl) return;
  let state = window.NavLayout.load();

  function esc(str) {
    return String(str).replace(/[&<>"']+/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function persist() { window.NavLayout.save(state); }

  const upIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"></polyline></svg>';
  const downIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  const miniBtn = 'grid h-8 w-8 place-items-center rounded-lg border border-koborder text-kodim transition hover:border-koaccent hover:text-kotext disabled:opacity-40 disabled:hover:border-koborder';

  function render() {
    listEl.innerHTML = state.items
      .map((item, idx) => {
        const upDisabled = idx === 0 ? 'disabled' : '';
        const downDisabled = idx === state.items.length - 1 ? 'disabled' : '';
        const safeLabel = esc(item.label || item.id);
        const safeId = esc(item.id);
        const visIcon = item.hidden ? '/icns_ui/visibility_off.svg' : '/icns_ui/visibility.svg';
        return (
          `<div class="flex items-center justify-between gap-3 rounded-xl border border-koborder bg-koelev2 px-3 py-2" role="listitem" data-nav="${safeId}" data-hidden="${item.hidden ? '1' : '0'}">` +
          `<div class="font-medium text-kotext ${item.hidden ? 'opacity-50' : ''}">${safeLabel}</div>` +
          `<div class="flex items-center gap-1.5">` +
          `<button type="button" class="${miniBtn}" data-nav-vis="${safeId}" aria-label="${(item.hidden ? 'Pokaż' : 'Ukryj') + ' ' + safeLabel}"><img src="${visIcon}" alt="" aria-hidden="true" class="h-4 w-4 dark:invert-0" style="filter:none" /></button>` +
          `<button type="button" class="${miniBtn}" data-nav-move="up" data-nav="${safeId}" ${upDisabled} aria-label="Przesuń ${safeLabel} w górę">${upIcon}</button>` +
          `<button type="button" class="${miniBtn}" data-nav-move="down" data-nav="${safeId}" ${downDisabled} aria-label="Przesuń ${safeLabel} w dół">${downIcon}</button>` +
          `</div></div>`
        );
      })
      .join('');
  }

  listEl.addEventListener('click', (e) => {
    const moveBtn = e.target.closest('[data-nav-move]');
    if (moveBtn) {
      const id = moveBtn.getAttribute('data-nav');
      const dir = moveBtn.getAttribute('data-nav-move');
      const idx = state.items.findIndex((t) => t.id === id);
      if (idx >= 0) {
        if (dir === 'up' && idx > 0) {
          [state.items[idx - 1], state.items[idx]] = [state.items[idx], state.items[idx - 1]];
          persist();
          render();
        } else if (dir === 'down' && idx < state.items.length - 1) {
          [state.items[idx + 1], state.items[idx]] = [state.items[idx], state.items[idx + 1]];
          persist();
          render();
        }
      }
      return;
    }
    const visBtn = e.target.closest('[data-nav-vis]');
    if (visBtn) {
      const id = visBtn.getAttribute('data-nav-vis');
      const entry = state.items.find((t) => t.id === id);
      if (entry) {
        entry.hidden = !entry.hidden;
        persist();
        render();
      }
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state = window.NavLayout.defaults();
      persist();
      render();
    });
  }
  render();
})();

/* ---------- Offline map (Cache Storage API) — VERBATIM logic ---------- */
(function initOfflineMap() {
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
  if (!downloadBtn) return;

  const supported = 'caches' in window && 'serviceWorker' in navigator;
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  const LOCAL_ASSETS = [
    '/map/index.html', '/map.css', '/map.js', '/route-search.js',
    '/db-adapter.js', '/db.config.json', '/map/political.svg',
    '/manifest.json', '/favicon.png', '/logo.png',
    '/icns_ui/company.svg', '/icns_ui/light_dark_mode.svg', '/icns_ui/link.svg',
    '/icns_ui/my_location.svg', '/icns_ui/person.svg', '/icns_ui/pin.svg',
    '/icns_ui/reset.svg', '/icns_ui/storefront.svg', '/icns_ui/unpin.svg',
    '/icns_ui/map_search.svg',
    '/map/base/map_light.webp', '/map/base/map_dark.webp',
  ];
  const DB_FILES = [
    'data/map-points/meta.json', 'data/map-points/localities-large.json',
    'data/map-points/localities-small.json', 'data/map-points/stations.json',
    'data/map-points/infra.json', 'data/map-points/airports.json',
    'data/map-points/players.json', 'data/map-lines.json',
    'data/khandel-products.json', 'data/companies.json',
  ];
  // Hi-res tile grids (must match TILE_CONFIG in map.js): 2x -> 3x3, 4x -> 5x5.
  const TILE_LEVELS = [{ factor: 2, grid: 3 }, { factor: 4, grid: 5 }];

  function tileUrls() {
    const out = [];
    for (const { factor, grid } of TILE_LEVELS) {
      for (const theme of ['light', 'dark']) {
        for (let r = 0; r < grid; r++) {
          for (let c = 0; c < grid; c++) {
            out.push(`/map/tiles${factor}x/${theme}/map_${theme}@${factor}x_r${r}_c${c}.webp`);
          }
        }
      }
    }
    return out;
  }

  async function buildManifest() {
    const urls = [...LOCAL_ASSETS, ...tileUrls()];
    try {
      const dbUrls = await Promise.all(DB_FILES.map((p) => window.__db.url(p)));
      urls.push(...dbUrls);
    } catch (_) { /* no DB_BASE — skip data, tiles still cache */ }
    // The /map/ route is a Next.js page: it needs its own hashed JS/CSS chunks
    // (React runtime + IslandLoader, which is what appends map.js/route-search.js
    // to the DOM) to hydrate at all — without them the page loads a static,
    // non-interactive shell offline. Hashes change every build, so they're
    // harvested at build time (write-pwa-assets.mjs) rather than hardcoded here.
    try {
      const resp = await fetch('/map-precache-manifest.json', { cache: 'no-store' });
      if (resp && resp.ok) urls.push(...(await resp.json()));
    } catch (_) { /* manifest missing (e.g. dev server) — map stays non-interactive offline */ }
    return urls;
  }

  const DOT_COLORS = { ready: 'bg-status-ready', busy: 'bg-status-busy', error: 'bg-status-fail', idle: 'bg-kodim' };
  function setDot(state) {
    if (!statusDot) return;
    statusDot.className = 'offline-map__dot inline-block h-2.5 w-2.5 rounded-full ' + (DOT_COLORS[state] || 'bg-kodim');
  }

  function setBusy(busy) {
    downloadBtn.disabled = busy;
    if (removeBtn) removeBtn.disabled = busy;
    progressWrap.hidden = !busy;
  }
  function setProgress(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (barFill) barFill.style.width = pct + '%';
    if (progressLabel) progressLabel.textContent = pct + '% (' + done + '/' + total + ')';
  }

  async function isDownloaded() {
    if (!supported) return false;
    try {
      if (!(await caches.has(MAP_CACHE))) return false;
      const cache = await caches.open(MAP_CACHE);
      const keys = await cache.keys();
      return keys.length > 0;
    } catch (_) { return false; }
  }
  function readFlag() {
    try { return JSON.parse(localStorage.getItem(FLAG_KEY) || 'null'); } catch (_) { return null; }
  }

  async function refreshUI() {
    if (!supported) {
      setDot('error');
      statusText.textContent = 'Twoja przeglądarka nie obsługuje trybu offline.';
      downloadBtn.hidden = true;
      if (removeBtn) removeBtn.hidden = true;
      if (openBtn) openBtn.hidden = true;
      if (progressWrap) progressWrap.hidden = true;
      return;
    }
    const has = await isDownloaded();
    if (removeBtn) removeBtn.hidden = !has;
    if (openBtn) openBtn.hidden = !has;

    if (has) {
      const flag = readFlag();
      const when = flag?.ts ? new Date(flag.ts).toLocaleDateString('pl-PL') : null;
      setDot('ready');
      statusText.textContent = 'Mapa jest dostępna offline' + (when ? ' (pobrano ' + when + ')' : '') + '.';
    } else {
      setDot('idle');
      statusText.textContent = 'Mapa nie została jeszcze pobrana.';
    }

    if (!isStandalone()) {
      downloadBtn.hidden = true;
      if (!has) {
        setDot('idle');
        statusText.textContent = 'Dostępne po zainstalowaniu aplikacji.';
      }
      if (hint) hint.textContent = 'Pobieranie mapy offline działa po zainstalowaniu kObywatela na urządzeniu (PWA). Dodaj aplikację do ekranu głównego, aby skorzystać z tej opcji.';
    } else {
      downloadBtn.hidden = false;
      downloadBtn.querySelector('span').textContent = has ? 'Pobierz ponownie' : 'Pobierz mapę';
      if (hint && !has) hint.textContent = 'Pełna mapa zajmuje ok. 65 MB. Pobieraj przez Wi‑Fi.';
    }
  }

  async function download() {
    if (!isStandalone()) return;
    setBusy(true);
    setDot('busy');
    statusText.textContent = 'Pobieranie mapy…';
    if (hint) hint.textContent = 'Nie zamykaj tej strony do zakończenia pobierania.';
    const urls = await buildManifest();
    const cache = await caches.open(MAP_CACHE);
    let done = 0;
    const total = urls.length;
    const failed = [];
    setProgress(0, total);
    let cursor = 0;
    const CONCURRENCY = 6;
    async function worker() {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        try {
          const resp = await fetch(url, { cache: 'reload' });
          if (!resp || !resp.ok) throw new Error('HTTP ' + (resp && resp.status));
          await cache.put(url, resp);
        } catch (e) {
          failed.push(url);
        }
        done++;
        setProgress(done, total);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    const ok = failed.length < total;
    if (ok) {
      try { localStorage.setItem(FLAG_KEY, JSON.stringify({ ts: Date.now(), count: total - failed.length })); } catch (_) {}
    }
    setBusy(false);
    await refreshUI();
    if (failed.length) {
      if (hint) hint.textContent = 'Pobrano z pominięciem ' + failed.length + ' plików (brak połączenia z częścią danych). Możesz spróbować ponownie.';
    } else {
      if (hint) hint.textContent = 'Gotowe. Mapa zadziała bez internetu w zainstalowanej aplikacji.';
    }
  }

  async function remove() {
    if (!confirm('Usunąć pobraną mapę offline? Zwolni to miejsce w pamięci urządzenia, ale uniemożliwi korzystanie z mapy bez dostępu do internetu.')) return;
    setDot('busy');
    statusText.textContent = 'Usuwanie…';
    try { await caches.delete(MAP_CACHE); } catch (_) {}
    try { localStorage.removeItem(FLAG_KEY); } catch (_) {}
    if (hint) hint.textContent = 'Pełna mapa zajmuje ok. 70 MB. Zalecane pobieranie przez Wi‑Fi.';
    await refreshUI();
  }

  downloadBtn.addEventListener('click', () => {
    download().catch(() => {
      setBusy(false);
      setDot('error');
      statusText.textContent = 'Wystąpił błąd podczas pobierania.';
    });
  });
  if (removeBtn) removeBtn.addEventListener('click', () => remove());

  try {
    const mq = window.matchMedia('(display-mode: standalone)');
    if (mq.addEventListener) mq.addEventListener('change', () => refreshUI());
    else if (mq.addListener) mq.addListener(() => refreshUI());
  } catch (_) {}

  refreshUI();
})();

document.getElementById('settings-back')?.addEventListener('click', () => { window.location.href = '/'; });
