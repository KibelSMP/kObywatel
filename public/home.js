// Home search + tile personalization (island). Ported from the legacy app.js.
// Search/data logic is unchanged; result markup and tile-layout application were
// reskinned to Tailwind. Functional hook classes JS queries (goto-map, goto-line,
// pf-btn, point-filters, #points-container, .tile, …) are preserved. Globals:
// window.__db, window.KWiedzaData, window.HomeLayout, window.escapeHtml,
// window.productFallbackName.

let __mapPointsCache = null;
let __pointCategoryFilter = new Set();
let __allPointMatches = [];
let __pointsPageSize = 15;
let __pointsShown = 0;
let __mapLinesCache = null;
let __lineMatches = [];
const __MAX_LINE_RESULTS = 50;

async function fetchMapPoints() {
  if (__mapPointsCache) return __mapPointsCache;
  try {
    const metaObj = await window.__db.fetchJson('data/map-points/meta.json');
    const meta = metaObj?.meta || {};
    const categories = metaObj?.categories || {};
    const basePoints = Array.isArray(metaObj?.points) ? metaObj.points : [];
    const files = ['localities-large.json', 'localities-small.json', 'stations.json', 'infra.json', 'airports.json'];
    const parts = await Promise.all(files.map((fn) => window.__db.fetchJson('data/map-points/' + fn).catch(() => ({ points: [] }))));
    const extra = parts.flatMap((p) => (Array.isArray(p?.points) ? p.points : []));
    const points = [...basePoints, ...extra];
    __mapPointsCache = { points, categories, meta };
    return __mapPointsCache;
  } catch (e) {
    console.warn('[search] Nie udało się pobrać map-points.json', e);
    __mapPointsCache = { points: [], categories: {}, meta: {} };
    return __mapPointsCache;
  }
}
function searchMapPoints(q) {
  if (!__mapPointsCache) return [];
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const cats = __mapPointsCache.categories || {};
  const MAX = 60;
  const matches = __mapPointsCache.points
    .filter((pt) => {
      if (pt.hidden) return false;
      if ((pt.category || '').toLowerCase() === 'players') return false;
      const displayName = (pt.name || pt.label || pt.id || '').trim();
      if (!displayName) return false;
      return displayName.toLowerCase().includes(term);
    })
    .map((pt) => {
      const displayName = (pt.name || pt.label || pt.id || '').trim();
      const catKey = pt.category || '';
      const catLabel = cats[catKey]?.label || catKey;
      return { type: 'point', id: pt.id, name: displayName, category: catKey, categoryLabel: catLabel, x: pt.x, z: (pt.z !== undefined ? pt.z : pt.y) || 0 };
    });
  matches.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(term) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(term) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name, 'pl');
  });
  return matches.slice(0, MAX);
}

async function fetchMapLines() {
  if (__mapLinesCache) return __mapLinesCache;
  try {
    const j = await window.__db.fetchJson('data/map-lines.json');
    if (!j || !Array.isArray(j.lines)) throw new Error('Zły format map-lines.json');
    __mapLinesCache = j;
    return j;
  } catch (e) {
    console.warn('[search] Nie udało się pobrać map-lines.json', e);
    __mapLinesCache = { lines: [], categories: {}, meta: {} };
    return __mapLinesCache;
  }
}
function searchMapLines(q) {
  if (!__mapLinesCache) return [];
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const cats = __mapLinesCache.categories || {};
  const list = Array.isArray(__mapLinesCache.lines) ? __mapLinesCache.lines : [];
  const out = [];
  for (const ln of list) {
    if (!ln) continue;
    const name = (ln.name || ln.id || '').trim();
    if (!name) continue;
    const hay = (name + ' ' + (ln.id || '') + ' ' + (ln.category || '')).toLowerCase();
    if (hay.includes(term)) {
      const catLabel = cats[ln.category]?.label || ln.category || '';
      out.push({ type: 'line', id: ln.id, name, category: ln.category || '', categoryLabel: catLabel });
      if (out.length >= __MAX_LINE_RESULTS) break;
    }
  }
  out.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(term) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(term) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name, 'pl');
  });
  return out;
}

const __MAX_EXT_RESULTS = 30;
let __khandelCache = null;
async function fetchKhandelProducts() {
  if (__khandelCache) return __khandelCache;
  try {
    const list = await window.__db.fetchJson('data/khandel-products.json');
    __khandelCache = Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('[search] khandel-products.json', e);
    __khandelCache = [];
  }
  return __khandelCache;
}
function searchKhandelProducts(q) {
  if (!__khandelCache) return [];
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const out = [];
  for (const p of __khandelCache) {
    if (!p) continue;
    const name = productFallbackName(p);
    if (!name) continue;
    const hay = (name + ' ' + (p.storeName || '')).toLowerCase();
    if (hay.includes(term)) {
      out.push({ type: 'product', name, storeName: p.storeName || '', storeLocation: p.storeLocation || '' });
      if (out.length >= __MAX_EXT_RESULTS) break;
    }
  }
  return out;
}

let __kfirmaCache = null;
async function fetchKfirmaCompanies() {
  if (__kfirmaCache) return __kfirmaCache;
  try {
    const list = await window.__db.fetchJson('data/companies.json');
    __kfirmaCache = Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('[search] companies.json', e);
    __kfirmaCache = [];
  }
  return __kfirmaCache;
}
function searchKfirmaCompanies(q) {
  if (!__kfirmaCache) return [];
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const out = [];
  for (const c of __kfirmaCache) {
    if (!c) continue;
    const name = String(c.name || '').trim();
    if (!name) continue;
    const addr = c.location?.address || {};
    const city = addr.city || '';
    const voiv = addr.voivodeship || '';
    const knip = c.knip != null ? String(c.knip) : '';
    const hay = [name, city, voiv, knip].join(' ').toLowerCase();
    if (hay.includes(term)) {
      out.push({ type: 'company', name, city, voiv, knip });
      if (out.length >= __MAX_EXT_RESULTS) break;
    }
  }
  return out;
}

let __kwiedzaCache = null;
async function fetchKwiedzaDocs() {
  if (!__kwiedzaCache) __kwiedzaCache = await window.KWiedzaData.fetchDocs();
  return __kwiedzaCache;
}
function searchKwiedzaDocs(q) {
  if (!__kwiedzaCache) return [];
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const out = [];
  for (const d of __kwiedzaCache) {
    const hay = (d.title + ' ' + (d.excerpt || '')).toLowerCase();
    if (hay.includes(term)) {
      out.push({ type: 'doc', slug: d.slug, title: d.title, category: d.meta?.category || '' });
      if (out.length >= __MAX_EXT_RESULTS) break;
    }
  }
  return out;
}

let __ksejmCache = null;
async function fetchKsejmActs() {
  if (__ksejmCache) return __ksejmCache;
  try {
    const r = await fetch('/ksejm/data/index.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    __ksejmCache = Array.isArray(data?.entries) ? data.entries : [];
  } catch (e) {
    console.warn('[search] ksejm index.json', e);
    __ksejmCache = [];
  }
  return __ksejmCache;
}
function searchKsejmActs(q) {
  if (!__ksejmCache) return [];
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const out = [];
  for (const e of __ksejmCache) {
    if (!e) continue;
    const hay = [e.title, e.category, e.dotyczy].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(term)) {
      out.push({ type: 'act', id: e.id, title: e.title || e.id, category: e.category || '' });
      if (out.length >= __MAX_EXT_RESULTS) break;
    }
  }
  return out;
}

const queryInput = document.getElementById('query');
const form = document.getElementById('search-form');
const resultsDiv = document.getElementById('results');
const skeleton = document.getElementById('skeleton');
const homeTilesRoot = document.getElementById('home-tiles-root');
const homeTilesGrid = document.querySelector('.home-tiles-grid');

function hideHomeTiles() { if (homeTilesRoot) homeTilesRoot.hidden = true; }
function showHomeTiles() { if (homeTilesRoot) homeTilesRoot.hidden = false; }

function applyHomeLayout() {
  if (!window.HomeLayout) return;
  const state = window.HomeLayout.load();
  const LOCKED = window.HomeLayout.LOCKED;
  if (homeTilesGrid) {
    const map = new Map([...homeTilesGrid.querySelectorAll('[data-tile-wrapper]')].map((el) => [el.id, el]));
    const frag = document.createDocumentFragment();
    state.tiles.forEach((tile) => {
      const el = map.get(tile.id);
      if (!el) return;
      const locked = LOCKED.has(tile.id) || tile.locked;
      const isHidden = locked ? false : !!tile.hidden;
      el.style.display = isHidden ? 'none' : '';
      frag.appendChild(el);
      map.delete(tile.id);
    });
    map.forEach((el) => { el.style.display = ''; frag.appendChild(el); });
    homeTilesGrid.appendChild(frag);
  }
  const searchWrap = document.getElementById('search-form');
  if (searchWrap) searchWrap.style.display = state.searchHidden ? 'none' : '';
}

// Drag-to-reorder (pointer events cover mouse + touch/pen uniformly). The handle
// is a sibling of the tile's <a>, never nested inside it, so dragging never
// triggers navigation. The dragged card is lifted out of the grid (position:
// fixed, follows the pointer exactly) while a dashed placeholder holds its slot
// open in the grid — this is what makes the reorder feel like a real drag
// instead of a "hover swaps two cells" trick, and it avoids the previous
// implementation's feedback-loop jitter (moving the real grid item on every
// pointermove reshuffled the very rects the next move was measured against).
function initTileDragReorder() {
  if (!homeTilesGrid || !window.HomeLayout) return;
  let dragEl = null;
  let placeholder = null;
  let pointerId = null;
  let grabDX = 0;
  let grabDY = 0;

  function otherSlots() {
    return [...homeTilesGrid.querySelectorAll('[data-tile-wrapper]')];
  }

  function findTarget(clientX, clientY) {
    for (const el of otherSlots()) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return { el, r };
      }
    }
    return null;
  }

  function onPointerMove(e) {
    if (!dragEl) return;
    e.preventDefault();
    dragEl.style.left = (e.clientX - grabDX) + 'px';
    dragEl.style.top = (e.clientY - grabDY) + 'px';
    const target = findTarget(e.clientX, e.clientY);
    if (!target) return;
    const after = e.clientX > target.r.left + target.r.width / 2;
    const ref = after ? target.el.nextSibling : target.el;
    if (ref === placeholder || placeholder.nextSibling === ref) return;
    target.el.parentElement.insertBefore(placeholder, ref);
  }

  function commitOrder() {
    const state = window.HomeLayout.load();
    const byId = new Map(state.tiles.map((t) => [t.id, t]));
    const reordered = [];
    otherSlots().forEach((el) => {
      const t = byId.get(el.id);
      if (t) { reordered.push(t); byId.delete(el.id); }
    });
    byId.forEach((t) => reordered.push(t));
    state.tiles = reordered;
    window.HomeLayout.save(state);
  }

  function endDrag() {
    if (!dragEl) return;
    try { dragEl.releasePointerCapture(pointerId); } catch (_) {}
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);

    placeholder.parentElement.insertBefore(dragEl, placeholder);
    placeholder.remove();
    placeholder = null;

    dragEl.classList.remove('dragging');
    dragEl.style.position = '';
    dragEl.style.left = '';
    dragEl.style.top = '';
    dragEl.style.width = '';
    dragEl.style.height = '';
    dragEl = null;
    pointerId = null;

    commitOrder();
    applyHomeLayout();
  }

  homeTilesGrid.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    const wrapper = handle.closest('[data-tile-wrapper]');
    if (!wrapper) return;
    e.preventDefault();

    const r = wrapper.getBoundingClientRect();
    grabDX = e.clientX - r.left;
    grabDY = e.clientY - r.top;

    placeholder = document.createElement('div');
    placeholder.className = 'tile-drop-placeholder rounded-2xl border-2 border-dashed border-koaccent/40';
    placeholder.style.width = r.width + 'px';
    placeholder.style.height = r.height + 'px';
    wrapper.parentElement.insertBefore(placeholder, wrapper);

    dragEl = wrapper;
    pointerId = e.pointerId;
    dragEl.style.position = 'fixed';
    dragEl.style.left = r.left + 'px';
    dragEl.style.top = r.top + 'px';
    dragEl.style.width = r.width + 'px';
    dragEl.style.height = r.height + 'px';
    dragEl.classList.add('dragging');
    document.body.appendChild(dragEl);

    try { dragEl.setPointerCapture(pointerId); } catch (_) {}
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  });

  // Keyboard equivalent (Arrow keys) — the handle is a real, focusable <button>,
  // so it needs a non-pointer way to reorder too.
  homeTilesGrid.addEventListener('keydown', (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    const wrapper = handle.closest('[data-tile-wrapper]');
    if (!wrapper) return;
    let dir = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') dir = -1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') dir = 1;
    else return;
    e.preventDefault();
    const state = window.HomeLayout.load();
    const idx = state.tiles.findIndex((t) => t.id === wrapper.id);
    const swapWith = idx + dir;
    if (idx === -1 || swapWith < 0 || swapWith >= state.tiles.length) return;
    [state.tiles[idx], state.tiles[swapWith]] = [state.tiles[swapWith], state.tiles[idx]];
    window.HomeLayout.save(state);
    applyHomeLayout();
    document.getElementById(wrapper.id)?.querySelector('[data-drag-handle]')?.focus();
  });
}

function hideSkeleton() { if (skeleton) { skeleton.classList.add('hidden'); skeleton.setAttribute('aria-hidden', 'true'); } }
function showSkeleton() { if (skeleton) { skeleton.classList.remove('hidden'); skeleton.setAttribute('aria-hidden', 'false'); } }

function attachMapButtons() {
  resultsDiv.querySelectorAll('.goto-map').forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const hasLine = btn.hasAttribute('data-lineid');
      if (hasLine) {
        const lineId = btn.getAttribute('data-lineid');
        if (!lineId) return;
        try {
          sessionStorage.setItem('map.focus.line', JSON.stringify({ lineId, ts: Date.now() }));
        } catch (_) {}
        window.location.href = `/map/?line=${encodeURIComponent(lineId)}`;
        return;
      }
      const x = Number(btn.getAttribute('data-x'));
      const z = Number(btn.getAttribute('data-z'));
      const label = btn.getAttribute('data-nick') || 'Gracz';
      if (!isFinite(x) || !isFinite(z)) return;
      try {
        sessionStorage.setItem('map.focus.player', JSON.stringify({ x, z, label, ts: Date.now() }));
      } catch (_) {}
      window.location.href = `/map/?fx=${encodeURIComponent(x)}&fz=${encodeURIComponent(z)}&fl=${encodeURIComponent(label)}`;
    });
  });
  resultsDiv.querySelectorAll('.goto-line').forEach((b) => { if (!b.classList.contains('goto-map')) b.classList.add('goto-map'); });
}

function getFilteredPointMatches() {
  if (__pointCategoryFilter.size === 0) return __allPointMatches;
  return __allPointMatches.filter((p) => __pointCategoryFilter.has(p.category));
}

const PF_BTN = 'pf-btn inline-flex items-center gap-1.5 rounded-full border border-koborder bg-koelev2 px-3 py-1 text-xs font-semibold text-kotext transition hover:border-koaccent aria-pressed:border-koaccent aria-pressed:bg-koaccent/15';
const MINI_BTN = 'inline-flex items-center gap-1.5 rounded-lg border border-koborder bg-koelev2 px-2.5 py-1.5 text-xs font-semibold text-kotext transition hover:border-koaccent';

function initPointFilters() {
  const bar = resultsDiv.querySelector('.point-filters');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button.pf-btn');
    if (!btn) return;
    const cat = btn.getAttribute('data-cat');
    if (cat === '__all') __pointCategoryFilter.clear();
    else if (__pointCategoryFilter.has(cat)) __pointCategoryFilter.delete(cat);
    else __pointCategoryFilter.add(cat);
    bar.querySelectorAll('button.pf-btn').forEach((b) => {
      const c = b.getAttribute('data-cat');
      b.setAttribute('aria-pressed', c === '__all' ? String(__pointCategoryFilter.size === 0) : String(__pointCategoryFilter.has(c)));
    });
    __pointsShown = Math.min(__pointsPageSize, getFilteredPointMatches().length);
    renderPointsList();
  });
}

function renderPointsList() {
  const box = resultsDiv.querySelector('#points-container');
  if (!box) return;
  const all = getFilteredPointMatches();
  if (!all.length) { box.innerHTML = '<div class="text-sm text-kodim">Brak wyników po filtrach</div>'; return; }
  const subset = all.slice(0, __pointsShown);
  const cats = __mapPointsCache?.categories || {};
  box.innerHTML =
    '<div class="grid gap-2 sm:grid-cols-2">' +
    subset
      .map((p) => {
        const col = cats[p.category]?.color || '#AC1943';
        const catTag = p.category ? `<span class="rounded-full border border-koborder bg-koelev2 px-2 py-0.5 text-[11px] text-kodim" title="${escapeHtml(p.categoryLabel || p.category)}">${escapeHtml(p.categoryLabel || p.category)}</span>` : '';
        return (
          `<div class="rounded-xl border border-koborder bg-koelev p-3" data-id="${p.id || ''}" data-cat="${escapeHtml(p.category)}">` +
          `<div class="flex items-center gap-2"><span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${col}"></span><span class="goto-map flex-1 cursor-pointer font-semibold text-kotext hover:text-koaccent2" role="button" tabindex="0" data-x="${p.x}" data-z="${p.z}" data-nick="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>${catTag}</div>` +
          `<div class="mt-1 text-xs text-kodim">X:${p.x} Z:${p.z}</div>` +
          `<div class="mt-2"><button type="button" class="${MINI_BTN} goto-map" data-x="${p.x}" data-z="${p.z}" data-nick="${escapeHtml(p.name)}">Pokaż na mapie</button></div>` +
          `</div>`
        );
      })
      .join('') +
    '</div>' +
    (all.length > subset.length ? `<div class="mt-3"><button type="button" id="points-more-btn" class="${MINI_BTN}">Pokaż więcej (${all.length - subset.length})</button></div>` : '');
  attachMapButtons();
  const moreBtn = resultsDiv.querySelector('#points-more-btn');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      __pointsShown = Math.min(__pointsShown + __pointsPageSize, getFilteredPointMatches().length);
      renderPointsList();
    });
  }
}

function renderExtSection(items, { ariaLabel, label, hrefFn, nameFn, metaFn }) {
  if (!items.length) return '';
  const rows = items
    .map((item) => {
      const meta = metaFn(item);
      return `<a class="flex items-center justify-between gap-3 rounded-xl border border-koborder bg-koelev p-3 transition hover:border-koaccent/70" href="${hrefFn(item)}"><span class="font-medium text-kotext">${escapeHtml(nameFn(item))}</span>${meta ? `<span class="shrink-0 text-xs text-kodim">${escapeHtml(meta)}</span>` : ''}</a>`;
    })
    .join('');
  return `<section class="space-y-2" aria-label="${ariaLabel}"><h3 class="text-sm font-bold uppercase tracking-wide text-kodim">${label} (${items.length})</h3><div class="grid gap-2 sm:grid-cols-2">${rows}</div></section>`;
}

function render(results) {
  const { query, pointMatches, lineMatches, productMatches, companyMatches, docMatches, actMatches } = results;
  __allPointMatches = pointMatches || [];
  __pointsShown = Math.min(__pointsPageSize, __allPointMatches.length);
  __lineMatches = lineMatches || [];
  const products = productMatches || [];
  const companies = companyMatches || [];
  const docs = docMatches || [];
  const acts = actMatches || [];
  if (!query && !pointMatches.length) { resultsDiv.innerHTML = ''; hideSkeleton(); return; }
  if (!pointMatches.length && !__lineMatches.length && !products.length && !companies.length && !docs.length && !acts.length) {
    resultsDiv.innerHTML = `<div class="rounded-xl border border-koborder bg-koelev p-6 text-center text-kodim">Brak wyników dla: <strong class="text-kotext">${query}</strong></div>`;
    hideSkeleton();
    return;
  }
  let html = '';
  if (pointMatches.length) {
    const cats = Object.entries(__mapPointsCache?.categories || {}).filter(([k]) => k.toLowerCase() !== 'players');
    const filterBar = cats.length
      ? `<div class="point-filters flex flex-wrap gap-1.5" role="group" aria-label="Filtry kategorii"><button type="button" class="${PF_BTN}" data-cat="__all" aria-pressed="${__pointCategoryFilter.size === 0}">Wszystkie</button>` +
        cats
          .map(([k, v]) => {
            const active = __pointCategoryFilter.has(k);
            const color = v.color || '#888';
            return `<button type="button" class="${PF_BTN}" data-cat="${escapeHtml(k)}" aria-pressed="${active}"><span class="h-2 w-2 rounded-full" style="background:${color}"></span>${escapeHtml(v.label || k)}</button>`;
          })
          .join('') +
        `</div>`
      : '';
    html += `<section class="space-y-3" aria-label="Miejsca"><h3 class="text-sm font-bold uppercase tracking-wide text-kodim">Miejsca (${pointMatches.length})</h3>${filterBar}<div id="points-container"></div></section>`;
  }
  if (__lineMatches.length) {
    const cats = __mapLinesCache?.categories || {};
    const items = __lineMatches
      .map((ln) => {
        const color = cats[ln.category]?.color || '#666';
        const catLabel = ln.categoryLabel || ln.category || '';
        return `<div class="flex items-center gap-2 rounded-xl border border-koborder bg-koelev p-3" data-lineid="${ln.id}"><span class="h-2.5 w-2.5 rounded-full" style="background:${color}"></span><span class="flex-1 font-semibold text-kotext">${escapeHtml(ln.name)}</span>${catLabel ? `<span class="text-xs text-kodim">${escapeHtml(catLabel)}</span>` : ''}<button type="button" class="${MINI_BTN} goto-line" data-lineid="${ln.id}" aria-label="Pokaż linię ${escapeHtml(ln.name)}">Pokaż</button></div>`;
      })
      .join('');
    html += `<section class="space-y-2" aria-label="Linie"><h3 class="text-sm font-bold uppercase tracking-wide text-kodim">Linie (${__lineMatches.length})</h3><div class="grid gap-2 sm:grid-cols-2">${items}</div></section>`;
  }
  html += renderExtSection(products, { ariaLabel: 'Produkty', label: 'Produkty – kHandel', hrefFn: (p) => `/khandel/?q=${encodeURIComponent(p.name)}`, nameFn: (p) => p.name, metaFn: (p) => [p.storeName, p.storeLocation].filter(Boolean).join(' • ') });
  html += renderExtSection(companies, { ariaLabel: 'Firmy', label: 'Firmy – kFirma', hrefFn: (c) => `/kfirma/?q=${encodeURIComponent(c.name)}`, nameFn: (c) => c.name, metaFn: (c) => [c.city, c.voiv].filter(Boolean).join(', ') });
  html += renderExtSection(docs, { ariaLabel: 'Dokumenty', label: 'Dokumenty – kWiedza', hrefFn: (d) => `/kwiedza/?doc=${encodeURIComponent(d.slug)}&cat=${encodeURIComponent(d.category || '')}`, nameFn: (d) => d.title, metaFn: (d) => d.category || '' });
  html += renderExtSection(acts, { ariaLabel: 'Akty', label: 'Akty – kSejm', hrefFn: (a) => `/ksejm/?doc=${encodeURIComponent(a.id)}`, nameFn: (a) => a.title, metaFn: (a) => a.category || '' });
  resultsDiv.innerHTML = `<div class="space-y-6">${html}</div>`;
  hideSkeleton();
  attachMapButtons();
  if (pointMatches.length) { initPointFilters(); renderPointsList(); }
}

function startSearch(q) {
  if (!resultsDiv || !queryInput) return;
  const term = (q || '').trim();
  if (!term) { resultsDiv.innerHTML = ''; hideSkeleton(); showHomeTiles(); return; }
  hideHomeTiles();
  showSkeleton();
  Promise.all([fetchMapPoints(), fetchMapLines(), fetchKhandelProducts(), fetchKfirmaCompanies(), fetchKwiedzaDocs(), fetchKsejmActs()])
    .then(() => {
      render({
        query: escapeHtml(term),
        pointMatches: searchMapPoints(term),
        lineMatches: searchMapLines(term),
        productMatches: searchKhandelProducts(term),
        companyMatches: searchKfirmaCompanies(term),
        docMatches: searchKwiedzaDocs(term),
        actMatches: searchKsejmActs(term),
      });
    })
    .catch(() => {
      hideSkeleton();
      resultsDiv.innerHTML = '<div class="rounded-xl border border-koborder bg-koelev p-6 text-center text-kodim">Błąd wyszukiwania</div>';
    });
}

function bindSearch() {
  if (!form || !queryInput) return;
  if (form.__bound) return;
  form.__bound = true;
  form.addEventListener('submit', (e) => { e.preventDefault(); startSearch(queryInput.value); });
  let t = null;
  const DEBOUNCE = 250;
  queryInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => startSearch(queryInput.value), DEBOUNCE); });
}

window.__db.loadConfig().then(() => {
  applyHomeLayout();
  initTileDragReorder();
  bindSearch();
});
