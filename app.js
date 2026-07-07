// Wyszukiwarka strony głównej (statyczna: ładujemy pełne pliki i filtrujemy klientem).

// --- Map points & lines search (miasta / infrastruktura / etykiety / linie) ---
let __mapPointsCache = null; // { points: [...], categories: {...}, meta: {...} }
let __pointCategoryFilter = new Set(); // wybrane kategorie (puste = wszystkie)
let __allPointMatches = []; // pełna lista wyników punktów dla bieżącego zapytania
let __pointsPageSize = 15;
let __pointsShown = 0;
let __mapLinesCache = null; // { lines: [...], categories: {...}, meta: {...} }
let __lineMatches = []; // wyniki linii dla bieżącego zapytania
const __MAX_LINE_RESULTS = 50;
async function fetchMapPoints(){
  if(__mapPointsCache) return __mapPointsCache;
  try {
    // Agreguj z plików w db/data/map-points
    const metaObj = await window.__db.fetchJson('data/map-points/meta.json');
    const meta = metaObj?.meta || {};
    const categories = metaObj?.categories || {};
    const basePoints = Array.isArray(metaObj?.points) ? metaObj.points : [];
    const files = ['localities-large.json','localities-small.json','stations.json','infra.json','airports.json'];
    const parts = await Promise.all(files.map(fn=> window.__db.fetchJson('data/map-points/'+fn).catch(()=>({points:[]}))));
    const extra = parts.flatMap(p => Array.isArray(p?.points) ? p.points : []);
    const points = [...basePoints, ...extra];
    __mapPointsCache = { points, categories, meta };
    return __mapPointsCache;
  } catch(e){
    console.warn('[search] Nie udało się pobrać map-points.json', e);
    __mapPointsCache = { points:[], categories:{}, meta:{} };
    return __mapPointsCache;
  }
}
function searchMapPoints(q){
  if(!__mapPointsCache) return [];
  const term = q.trim().toLowerCase();
  if(!term) return [];
  const cats = __mapPointsCache.categories || {};
  const MAX = 60;
  const matches = __mapPointsCache.points
    .filter(pt => {
      if(pt.hidden) return false;
      if((pt.category||'').toLowerCase()==='players') return false; // wyklucz graczy z sekcji Miejsca
      const displayName = (pt.name || pt.label || pt.id || '').trim();
      if(!displayName) return false;
      return displayName.toLowerCase().includes(term);
    })
    .map(pt => {
      const displayName = (pt.name || pt.label || pt.id || '').trim();
      const catKey = pt.category || '';
      const catLabel = cats[catKey]?.label || catKey;
      return {
        type:'point',
        id: pt.id,
        name: displayName,
        category: catKey,
        categoryLabel: catLabel,
        x: pt.x,
        z: (pt.z !== undefined ? pt.z : pt.y) || 0
      };
    });
  matches.sort((a,b)=>{
    const aPrefix = a.name.toLowerCase().startsWith(term) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(term) ? 0 : 1;
    if(aPrefix !== bPrefix) return aPrefix - bPrefix;
    if(a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name,'pl');
  });
  return matches.slice(0, MAX);
}

async function fetchMapLines(){
  if(__mapLinesCache) return __mapLinesCache;
  try {
    const j = await window.__db.fetchJson('data/map-lines.json');
    if(!j || !Array.isArray(j.lines)) throw new Error('Zły format map-lines.json');
    __mapLinesCache = j;
    return j;
  } catch(e){
    console.warn('[search] Nie udało się pobrać map-lines.json', e);
    __mapLinesCache = { lines:[], categories:{}, meta:{} };
    return __mapLinesCache;
  }
}
function searchMapLines(q){
  if(!__mapLinesCache) return [];
  const term = q.trim().toLowerCase();
  if(!term) return [];
  const cats = __mapLinesCache.categories || {};
  const list = Array.isArray(__mapLinesCache.lines) ? __mapLinesCache.lines : [];
  const out = [];
  for(const ln of list){
    if(!ln) continue;
    const name = (ln.name || ln.id || '').trim();
    if(!name) continue;
    const hay = (name + ' ' + (ln.id||'') + ' ' + (ln.category||'')).toLowerCase();
    if(hay.includes(term)){
      const catLabel = cats[ln.category]?.label || ln.category || '';
      out.push({
        type:'line',
        id: ln.id,
        name,
        category: ln.category || '',
        categoryLabel: catLabel
      });
      if(out.length >= __MAX_LINE_RESULTS) break;
    }
  }
  // Sortuj: prefix match > długość nazwy > alfa
  out.sort((a,b)=>{
    const aPrefix = a.name.toLowerCase().startsWith(term) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(term) ? 0 : 1;
    if(aPrefix !== bPrefix) return aPrefix - bPrefix;
    if(a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name,'pl');
  });
  return out;
}

const queryInput = document.getElementById('query');
const form = document.getElementById('search-form');
const resultsDiv = document.getElementById('results');
const skeleton = document.getElementById('skeleton');
const body = document.body;
const homeTilesRoot = document.getElementById('home-tiles-root');
const homeTilesPrimary = document.querySelector('.home-tiles-primary');
const homeTilesCompact = document.querySelector('.home-tiles-compact');

function escapeHtml(str){
  return String(str).replace(/[&<>"']+/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));
}

function hideHomeTiles(){
  if(homeTilesRoot){
    homeTilesRoot.setAttribute('data-hidden','true');
    document.body.setAttribute('data-home-tiles-hidden','true');
  }
}

function showHomeTiles(){
  if(homeTilesRoot){
    homeTilesRoot.removeAttribute('data-hidden');
  }
  document.body.removeAttribute('data-home-tiles-hidden');
}

// --- Zastosowanie zapisanej personalizacji strony głównej (edycja żyje w /settings) ---
function applyHomeLayout(){
  if(!window.HomeLayout) return;
  const state = window.HomeLayout.load();
  const LOCKED = window.HomeLayout.LOCKED;
  if(homeTilesRoot && homeTilesPrimary && homeTilesCompact){
    const map = new Map([...homeTilesRoot.querySelectorAll('.tile')].map(el=> [el.id, el]));
    const visible = [];
    const hidden = [];
    state.tiles.forEach(tile => {
      const el = map.get(tile.id);
      if(!el) return;
      const locked = LOCKED.has(tile.id) || tile.locked;
      const isHidden = locked ? false : !!tile.hidden;
      el.dataset.hidden = isHidden ? 'true' : 'false';
      el.style.display = isHidden ? 'none' : '';
      if(isHidden){ hidden.push(el); } else { visible.push(el); }
      map.delete(tile.id);
    });
    // Kafelki nieobecne w zapisanym stanie (np. nowo dodane) – pokaż na końcu.
    map.forEach(el=>{
      el.dataset.hidden = 'false';
      el.style.display = '';
      visible.push(el);
    });
    const fragPrimary = document.createDocumentFragment();
    const fragCompact = document.createDocumentFragment();
    visible.forEach((el, idx)=>{
      if(idx < 3){ fragPrimary.appendChild(el); } else { fragCompact.appendChild(el); }
    });
    hidden.forEach(el=> fragCompact.appendChild(el));
    homeTilesPrimary.innerHTML = '';
    homeTilesCompact.innerHTML = '';
    homeTilesPrimary.appendChild(fragPrimary);
    homeTilesCompact.appendChild(fragCompact);
  }
  if(state.searchHidden){
    body.setAttribute('data-search-hidden','true');
  } else {
    body.removeAttribute('data-search-hidden');
  }
}

function hideSkeleton(){
  if(skeleton){
    skeleton.classList.add('hidden');
    skeleton.setAttribute('aria-hidden','true');
  }
}
function showSkeleton(){
  if(skeleton){
    skeleton.classList.remove('hidden');
    skeleton.setAttribute('aria-hidden','false');
  }
}

// --- Helpery wyszukiwarki punktów / mapy ---
function attachMapButtons(){
  const btns = resultsDiv.querySelectorAll('.goto-map');
  btns.forEach(btn=>{
    if(btn.dataset.bound === '1') return;
    btn.dataset.bound='1';
    btn.addEventListener('click', ()=>{
      const hasLine = btn.hasAttribute('data-lineid');
      if(hasLine){
        const lineId = btn.getAttribute('data-lineid');
        if(!lineId) return;
        try {
          sessionStorage.setItem('map.focus.line', JSON.stringify({ lineId, ts: Date.now() }));
          window.location.href = `/map?line=${encodeURIComponent(lineId)}`;
        } catch(_){ window.location.href = `/map?line=${encodeURIComponent(lineId)}`; }
        return;
      }
      const x = Number(btn.getAttribute('data-x'));
      const z = Number(btn.getAttribute('data-z'));
      const label = btn.getAttribute('data-nick') || 'Gracz';
      if(!isFinite(x) || !isFinite(z)) return;
      try {
        sessionStorage.setItem('map.focus.player', JSON.stringify({ x, z, label, ts: Date.now() }));
        const url = `/map?fx=${encodeURIComponent(x)}&fz=${encodeURIComponent(z)}&fl=${encodeURIComponent(label)}`;
        window.location.href = url;
      } catch(_){
        window.location.href = `/map?fx=${encodeURIComponent(x)}&fz=${encodeURIComponent(z)}`;
      }
    });
  });
  // Linie (przycisk goto-line aliasuje do goto-map jeśli brak współrzędnych)
  const lineBtns = resultsDiv.querySelectorAll('.goto-line');
  lineBtns.forEach(b=>{ if(!b.classList.contains('goto-map')) b.classList.add('goto-map'); });
}

function getFilteredPointMatches(){
  if(__pointCategoryFilter.size===0) return __allPointMatches;
  return __allPointMatches.filter(p=> __pointCategoryFilter.has(p.category));
}

function initPointFilters(){
  const bar = resultsDiv.querySelector('.point-filters');
  if(!bar) return;
  bar.addEventListener('click', e => {
    const btn = e.target.closest('button.pf-btn');
    if(!btn) return;
    const cat = btn.getAttribute('data-cat');
    if(cat === '__all'){
      __pointCategoryFilter.clear();
    } else {
      if(__pointCategoryFilter.has(cat)) __pointCategoryFilter.delete(cat); else __pointCategoryFilter.add(cat);
    }
    bar.querySelectorAll('button.pf-btn').forEach(b=>{
      const c = b.getAttribute('data-cat');
      if(c==='__all'){
        b.setAttribute('aria-pressed', String(__pointCategoryFilter.size===0));
      } else {
        b.setAttribute('aria-pressed', String(__pointCategoryFilter.has(c)));
      }
    });
    __pointsShown = Math.min(__pointsPageSize, getFilteredPointMatches().length);
    renderPointsList();
  });
}

function renderPointsList(){
  const box = resultsDiv.querySelector('#points-container');
  if(!box) return;
  const all = getFilteredPointMatches();
  if(!all.length){ box.innerHTML = '<div class="empty" style="font-size:.65rem;opacity:.7;">Brak wyników po filtrach</div>'; return; }
  const subset = all.slice(0, __pointsShown);
  const cats = (__mapPointsCache?.categories)||{};
  box.innerHTML = '<div class="points-list">'+ subset.map(p=>{
    const col = cats[p.category]?.color || '#AC1943';
    const catTag = p.category ? `<span class=\"pt-cat\" title=\"${escapeHtml(p.categoryLabel||p.category)}\">${escapeHtml(p.categoryLabel||p.category)}</span>` : '';
    return `<div class=\"point-result\" data-id=\"${p.id||''}\" data-cat=\"${escapeHtml(p.category)}\">`
      + `<div class=\"pr-row\"><span class=\"pt-color-dot\" style=\"background:${col}\"></span><span class=\"pr-name goto-map\" role=\"button\" tabindex=\"0\" data-x=\"${p.x}\" data-z=\"${p.z}\" data-nick=\"${escapeHtml(p.name)}\">${escapeHtml(p.name)}</span>${catTag}</div>`
      + `<div class=\"pr-meta\">X:${p.x} Z:${p.z}</div>`
      + `<div class=\"pr-actions\"><button type=\"button\" class=\"mini-btn icon-btn goto-map\" data-x=\"${p.x}\" data-z=\"${p.z}\" data-nick=\"${escapeHtml(p.name)}\"><img src=\"/icns_ui/map_search.svg\" alt=\"\" class=\"icon\" aria-hidden=\"true\"/>Pokaż</button></div>`
      + `</div>`;
  }).join('') + '</div>' + (all.length>subset.length ? `<div class=\"points-more\"><button type=\"button\" id=\"points-more-btn\" class=\"mini-btn icon-btn\">Pokaż więcej (${all.length - subset.length})</button></div>` : '');
  attachMapButtons();
  const moreBtn = resultsDiv.querySelector('#points-more-btn');
  if(moreBtn){
    moreBtn.addEventListener('click', ()=>{
      __pointsShown = Math.min(__pointsShown + __pointsPageSize, getFilteredPointMatches().length);
      renderPointsList();
    });
  }
}

function render(results){
  const { query, pointMatches, lineMatches } = results;
  __allPointMatches = pointMatches || [];
  __pointsShown = Math.min(__pointsPageSize, __allPointMatches.length);
  __lineMatches = lineMatches || [];
  if(!query && !pointMatches.length){
    resultsDiv.innerHTML=''; hideSkeleton(); return;
  }
  if(!pointMatches.length && !__lineMatches.length){
    resultsDiv.innerHTML = `<div class="empty">Brak wyników dla: <strong>${query}</strong></div>`;
    hideSkeleton(); return;
  }
  let html = '';
  // --- Miejsca ---
  if(pointMatches.length){
    const cats = Object.entries(__mapPointsCache?.categories || {}).filter(([k])=> k.toLowerCase()!=='players');
    const filterBar = cats.length ? `<div class="point-filters" role="group" aria-label="Filtry kategorii">`
      + `<button type="button" class="pf-btn pf-all" data-cat="__all" aria-pressed="${__pointCategoryFilter.size===0}">Wszystkie</button>`
      + cats.map(([k,v])=>{
        const active = __pointCategoryFilter.has(k);
        const color = v.color || '#888';
        return `<button type="button" class="pf-btn" data-cat="${escapeHtml(k)}" aria-pressed="${active}"><span class="pf-dot" style="background:${color}"></span>${escapeHtml(v.label||k)}</button>`;
      }).join('')
      + `</div>` : '';
    html += `<section class="res-block res-points" aria-label="Miejsca"><h3 id="pts-head" class="res-head">Miejsca (${pointMatches.length})</h3>${filterBar}<div id="points-container"></div></section>`;
  }
  // --- Linie ---
  if(__lineMatches.length){
    const cats = __mapLinesCache?.categories || {};
    const items = __lineMatches.map(ln=>{
      const color = cats[ln.category]?.color || '#666';
      const catLabel = ln.categoryLabel || ln.category || '';
      return `<div class="line-result" data-lineid="${ln.id}">`
        + `<div class="lr-row"><span class="lr-color" style="background:${color}"></span>`
        + `<span class="lr-name">${escapeHtml(ln.name)}</span>`
        + (catLabel?`<span class="lr-cat">${escapeHtml(catLabel)}</span>`:'')
        + `<button type="button" class="mini-btn icon-btn goto-line" data-lineid="${ln.id}" aria-label="Pokaż linię ${escapeHtml(ln.name)}"><img src="/icns_ui/map_search.svg" class="icon" alt="" aria-hidden="true"/>Pokaż</button>`
        + `</div>`
        + `</div>`;
    }).join('');
    html += `<section class="res-block res-lines" aria-label="Linie"><h3 class="res-head">Linie (${__lineMatches.length})</h3><div class="lines-container">${items}</div></section>`;
  }
  resultsDiv.innerHTML = html;
  hideSkeleton();
  attachMapButtons();
  if(pointMatches.length){
    initPointFilters();
    renderPointsList();
  }
}

// --- Inicjalizacja wyszukiwarki na stronie głównej ---
function startSearch(q){
  if(!resultsDiv || !queryInput) return;
  const term = (q||'').trim();
  if(!term){
    resultsDiv.innerHTML='';
    hideSkeleton();
    showHomeTiles(); // pusty termin – przywróć kafelki
    body.removeAttribute('data-mode');
    return;
  }
  // Aktywne wyszukiwanie – ukryj kafelki
  hideHomeTiles();
  showSkeleton();
  Promise.all([fetchMapPoints(), fetchMapLines()]).then(()=>{
    const pointMatches = searchMapPoints(term);
    const lineMatches = searchMapLines(term);
    render({ query: escapeHtml(term), pointMatches, lineMatches });
    body.setAttribute('data-mode','condensed');
    // Nie pokazuj kafelków dopóki jest aktywny termin
  }).catch(()=>{
    hideSkeleton();
    resultsDiv.innerHTML = '<div class="empty">Błąd wyszukiwania</div>';
  });
}

function bindSearch(){
  if(!form || !queryInput) return;
  if(form.__bound) return; form.__bound = true;
  form.addEventListener('submit', e => {
    e.preventDefault();
    startSearch(queryInput.value);
  });
  // Debounce wyszukiwania podczas pisania
  let t = null; const DEBOUNCE = 250;
  queryInput.addEventListener('input', ()=>{
    clearTimeout(t);
    t = setTimeout(()=> startSearch(queryInput.value), DEBOUNCE);
  });
}

applyHomeLayout();
bindSearch();
// Aktywacja inputu po kliknięciu ikony lupy
function bindSearchIcon(){
  const icon = document.querySelector('.search-icon');
  if(!icon || icon.__bound) return; icon.__bound = true;
  function focusInput(){ if(queryInput){ queryInput.focus(); } }
  icon.addEventListener('click', focusInput);
  icon.addEventListener('keydown', e => { if(e.key==='Enter' || e.key===' '){ e.preventDefault(); focusInput(); } });
}
bindSearchIcon();
