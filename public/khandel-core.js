let currentLang = (localStorage.getItem('khandelLang') || 'pl');
let allProducts = [];
let selectedStore = '';
let searchQuery = '';
let priceSearch = false;
let priceMin = '';
let priceMax = '';
let groupMode = 'none';
const PAGE_SIZE = 60;

// --- Trasa handlowa: katalog przedmiotów i graf wymian ---
let itemCatalog = new Map();
let tradeGraph = new Map();
let edgeListings = new Map();
let sellListings = new Map();
let lastRouteResult = null;

// Klucz sortowania ofert – identyfikator oferty (fallback na nazwę przedmiotu)
const getIdentifier = (p)=>{
  if(!p) return '';
  const offerId = p.offerId || p.offerID || p.id || p.uuid || p.identifier;
  const raw = offerId || p.product?.item || p.productName || p.productNameEn || '';
  return String(raw).toLowerCase();
};

const breadcrumbEl = null;
const productsEl = document.getElementById('khandel-products');
const emptyEl = document.getElementById('empty');
let langToggle = document.getElementById('lang-toggle');
let langToggleFloat = document.getElementById('lang-toggle-float');
const searchInput = document.getElementById('khandel-search');
let filterLocation = document.getElementById('khandel-filter-location');
let filterStore = document.getElementById('khandel-filter-store');
if(!filterLocation){ filterLocation = document.createElement('input'); filterLocation.type='hidden'; filterLocation.id='khandel-filter-location'; document.body.appendChild(filterLocation); }
if(!filterStore){ filterStore = document.createElement('input'); filterStore.type='hidden'; filterStore.id='khandel-filter-store'; document.body.appendChild(filterStore); }
const clearSearchBtn = document.getElementById('khandel-clear-search');
const priceSearchToggle = document.getElementById('khandel-price-toggle');
const priceToggleLabel = document.getElementById('khandel-price-toggle-label');
const doSearchBtn = document.getElementById('khandel-do-search');
const mobileSearchInput = document.getElementById('khandel-search-mobile');
const mobileClearBtn = document.getElementById('khandel-clear-search-mobile');
const priceToggleMobile = document.getElementById('khandel-price-toggle-mobile');
const groupNoneBottomBtn = document.getElementById('group-none-bottom');
const groupCityBottomBtn = document.getElementById('group-city-bottom');
const groupStoreBottomBtn = document.getElementById('group-store-bottom');
const groupNoneBtn = null;
const groupCityBtn = null;
const groupStoreBtn = null;
const segmented = null;
const routeResultsEl = document.getElementById('route-results');
const routeHaveInput = document.getElementById('route-have-input');
const routeWantInput = document.getElementById('route-want-input');
const routeHaveSuggest = document.getElementById('route-have-suggest');
const routeWantSuggest = document.getElementById('route-want-suggest');
const routeSwapBtn = document.getElementById('route-swap-btn');
const routeSearchBtn = document.getElementById('route-search-btn');

// --- Funkcje pomocnicze językowe ---
function pickName(obj, fallback){
  if(!obj) return fallback;
  const rawName = obj.name || obj.namePl || obj.namePL || obj.name_pl;
  const rawEn = obj.nameEn || obj.nameEN || obj.name_en;
  if(currentLang==='en'){
    if(rawEn){
      return rawEn;
    }
    return rawName || fallback;
  } else {
    return rawName || rawEn || fallback;
  }
}
function pickRootName(entry){
  const p = entry.product || {};
  const plName = entry.productName || p.name || p.namePl || p.namePL || p.name_pl;
  const enName = entry.productNameEn || p.nameEn || p.nameEN || p.name_en;
  if(currentLang==='en'){
    return enName || plName || p.item || '—';
  }
  return plName || enName || p.item || '—';
}

// --- Grupowanie ---
function setGroupPressed(){
  const none = groupMode==='none';
  const city = groupMode==='city';
  const store = groupMode==='store';
  if(groupNoneBtn){ groupNoneBtn.setAttribute('aria-pressed', none? 'true':'false'); groupNoneBtn.setAttribute('aria-selected', none? 'true':'false'); groupNoneBtn.tabIndex = none? 0 : -1; }
  if(groupCityBtn){ groupCityBtn.setAttribute('aria-pressed', city? 'true':'false'); groupCityBtn.setAttribute('aria-selected', city? 'true':'false'); groupCityBtn.tabIndex = city? 0 : -1; }
  if(groupStoreBtn){ groupStoreBtn.setAttribute('aria-pressed', store? 'true':'false'); groupStoreBtn.setAttribute('aria-selected', store? 'true':'false'); groupStoreBtn.tabIndex = store? 0 : -1; }
  if(groupNoneBottomBtn){ groupNoneBottomBtn.setAttribute('aria-pressed', none? 'true':'false'); groupNoneBottomBtn.setAttribute('aria-selected', none? 'true':'false'); groupNoneBottomBtn.tabIndex = none? 0 : -1; }
  if(groupCityBottomBtn){ groupCityBottomBtn.setAttribute('aria-pressed', city? 'true':'false'); groupCityBottomBtn.setAttribute('aria-selected', city? 'true':'false'); groupCityBottomBtn.tabIndex = city? 0 : -1; }
  if(groupStoreBottomBtn){ groupStoreBottomBtn.setAttribute('aria-pressed', store? 'true':'false'); groupStoreBottomBtn.setAttribute('aria-selected', store? 'true':'false'); groupStoreBottomBtn.tabIndex = store? 0 : -1; }
}

// UI helpers – placeholder i wizualny stan przełączników
function computeSearchPlaceholder(){
  const loc = filterLocation?.value || '';
  const sto = filterStore?.value || '';
  if(currentLang==='en'){
    if(groupMode==='city' && loc){ return priceSearch? `Search in ${loc}… or currency` : `Search in ${loc}…`; }
    if(groupMode==='store' && sto){ return priceSearch? `Search in store ${sto}… or currency` : `Search in store ${sto}…`; }
    return priceSearch? 'Search item… or currency' : 'Search item…';
  }
  if(groupMode==='city' && loc){ return priceSearch? `Szukaj w mieście ${loc}… lub waluty` : `Szukaj w mieście ${loc}…`; }
  if(groupMode==='store' && sto){ return priceSearch? `Szukaj w sklepie ${sto}… lub waluty` : `Szukaj w sklepie ${sto}…`; }
  return priceSearch? 'Szukaj przedmiotu… lub waluty' : 'Szukaj przedmiotu…';
}
function updatePriceToggleVisual(){
  if(priceToggleLabel){ priceToggleLabel.setAttribute('aria-pressed', priceSearch? 'true':'false'); }
  if(searchInput){ searchInput.placeholder = computeSearchPlaceholder(); }
  if(priceToggleMobile){ priceToggleMobile.setAttribute('aria-pressed', priceSearch? 'true':'false'); }
}
function setGroupMode(mode){ groupMode = mode; setGroupPressed(); updatePriceToggleVisual(); }

// Płynne przewinięcie do dowolnego wyniku z uwzględnieniem wysokości nagłówka
function scrollToEl(el){
  if(!el) return;
  const header = document.querySelector('.app-header');
  const headerH = header ? header.offsetHeight : 0;
  const y = el.getBoundingClientRect().top + window.scrollY - Math.max(12, headerH + 8);
  window.scrollTo({ top: y, behavior: 'smooth' });
}
function scrollToProducts(){ scrollToEl(productsEl); }

// --- Ikony Minecraft ---
const MC_ASSETS_VERSION = '1.20.4';
const MC_ASSETS_BASE = `https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@${MC_ASSETS_VERSION}/assets/minecraft/textures`;
const PATH_ITEM = MC_ASSETS_BASE + '/item';
const PATH_BLOCK = MC_ASSETS_BASE + '/block';
const FALLBACK_ICON = PATH_ITEM + '/barrier.png';
const LOCAL_ICON_BASE = '/mc-items';
const localIconPath = key => `${LOCAL_ICON_BASE}/${encodeURIComponent(key)}.png`;
const itemIconPath = key => `${PATH_ITEM}/${encodeURIComponent(key)}.png`;
const blockIconPath = key => `${PATH_BLOCK}/${encodeURIComponent(key)}.png`;

function createIcon(item, size=48, enchanted=false){
  const wrap = document.createElement('div');
  wrap.className = 'item-icon' + (enchanted? ' enchanted':'');
  wrap.style.width = size+'px';
  wrap.style.height = size+'px';
  wrap.classList.add('loading');
  const img = document.createElement('img');
  img.loading='lazy'; img.decoding='async'; img.alt=item;
  wrap.appendChild(img);
  let overlay=null;
  if(enchanted){
    overlay = document.createElement('div'); overlay.className='ench-overlay'; wrap.appendChild(overlay);
  }
  const key = (item||'').toLowerCase();
  const stages = [ localIconPath(key), itemIconPath(key), blockIconPath(key), FALLBACK_ICON ];
  let stageIndex=0;
  function applyStage(){ img.src = stages[stageIndex]; }
  img.addEventListener('load', ()=>{
    wrap.classList.remove('loading');
    if(stageIndex===3){ img.style.opacity='.55'; }
    if(enchanted && overlay){
      const url = `url(${img.src})`;
      overlay.style.maskImage = url; overlay.style.webkitMaskImage = url; wrap.classList.add('masked');
    }
  });
  img.onerror = ()=>{
    if(stageIndex < stages.length-1){ stageIndex++; applyStage(); } else { wrap.classList.remove('loading'); }
  };
  applyStage();
  return wrap;
}

// --- Trasa handlowa: katalog przedmiotów ---
// Klucz węzła grafu to surowy identyfikator Minecraft (item), małymi
// literami. Wyjątek: enchanted/customItem wpisy dzielą jeden id Minecrafta
// mimo że są zupełnie różnymi przedmiotami do wymiany (np. "enchanted_book"
// to i "Zaklęta książka [Naprawa]", i "[Przeszycie IV]"; "paper" bywa
// walutą "Kibelion") – dla nich doklejamy do klucza znormalizowaną nazwę,
// żeby nie zlewać ich w jeden węzeł grafu. Nazwa (nie currentLang) jest
// używana, więc klucz jest stabilny niezależnie od przełącznika języka.
function itemKeyOf(obj){
  if(!obj || !obj.item) return '';
  const base = String(obj.item).toLowerCase().trim();
  if(!base) return '';
  if(obj.enchanted || obj.customItem){
    const label = String(obj.nameEn || obj.name || '').toLowerCase().trim();
    if(label) return `${base}|${label}`;
  }
  return base;
}
function baseItemId(key){ return String(key||'').split('|')[0]; }

function buildItemCatalog(products){
  const map = new Map();
  const looksLikeFallback = (name, key)=> !name || name===key;
  const consider = (key, namePl, nameEn, enchanted)=>{
    if(!key) return;
    const existing = map.get(key);
    if(!existing){
      map.set(key, { key, namePl: namePl || key, nameEn: nameEn || namePl || key, enchanted: !!enchanted });
    } else {
      if(looksLikeFallback(existing.namePl, key) && !looksLikeFallback(namePl, key)) existing.namePl = namePl;
      if(looksLikeFallback(existing.nameEn, key) && !looksLikeFallback(nameEn, key)) existing.nameEn = nameEn;
    }
  };
  products.forEach(p=>{
    consider(itemKeyOf(p.product), p.productName || p.product?.name, p.productNameEn || p.product?.nameEn, p.product?.enchanted);
    [p.price1, p.price2].forEach(pr=>{ if(pr) consider(itemKeyOf(pr), pr.name, pr.nameEn, pr.enchanted); });
  });
  return map;
}

function catalogDisplayName(key){
  const entry = itemCatalog.get(key);
  if(!entry) return key;
  return currentLang==='en' ? (entry.nameEn || entry.namePl || key) : (entry.namePl || entry.nameEn || key);
}

function catalogList(){
  return [...itemCatalog.values()].sort((a,b)=>{
    const an = catalogDisplayName(a.key);
    const bn = catalogDisplayName(b.key);
    return an.localeCompare(bn, 'pl', { sensitivity:'base' });
  });
}

function findItemMatches(queryRaw, limit=8){
  const q = (queryRaw||'').toLowerCase().trim();
  const list = catalogList();
  if(!q) return list.slice(0, limit);
  const scored = [];
  for(const entry of list){
    const namePl = entry.namePl.toLowerCase();
    const nameEn = entry.nameEn.toLowerCase();
    let score = -1;
    if(entry.key===q || namePl===q || nameEn===q) score = 0;
    else if(entry.key.startsWith(q) || namePl.startsWith(q) || nameEn.startsWith(q)) score = 1;
    else if(entry.key.includes(q) || namePl.includes(q) || nameEn.includes(q)) score = 2;
    if(score>=0) scored.push({ entry, score });
  }
  scored.sort((a,b)=> a.score - b.score);
  return scored.slice(0, limit).map(s=>s.entry);
}

function resolveItemKey(inputEl){
  if(!inputEl) return null;
  if(inputEl.dataset.resolvedKey) return inputEl.dataset.resolvedKey;
  const matches = findItemMatches(inputEl.value, 1);
  return matches[0] ? matches[0].key : null;
}

// --- Trasa handlowa: graf wymian ---
// Każda oferta to skierowana krawędź: price1/price2 (co płacisz) -> product
// (co dostajesz). Node grafu = itemKeyOf(...). edgeListings przechowuje
// wszystkie oferty realizujące daną krawędź (do wyboru najlepszej stawki
// i pokazania alternatywnych sklepów), tradeGraph to zdeduplikowana lista
// sąsiadów do przeszukiwania BFS.
function buildTradeGraph(products){
  const graph = new Map();
  const listings = new Map();
  const sellListings = new Map();
  products.forEach(p=>{
    const toKey = itemKeyOf(p.product);
    if(!toKey) return;
    if(!sellListings.has(toKey)) sellListings.set(toKey, []);
    sellListings.get(toKey).push(p);
    [['price1', p.price1], ['price2', p.price2]].forEach(([side, pr])=>{
      if(!pr) return;
      const fromKey = itemKeyOf(pr);
      // brak krawędzi z przedmiotu do samego siebie – to nie jest wymiana
      if(!fromKey || fromKey===toKey) return;
      const edgeKey = `${fromKey}→${toKey}`;
      if(!listings.has(edgeKey)) listings.set(edgeKey, []);
      listings.get(edgeKey).push({ listing: p, priceSideKey: side });
      if(!graph.has(fromKey)) graph.set(fromKey, new Set());
      graph.get(fromKey).add(toKey);
    });
  });
  return { graph, listings, sellListings };
}

function reconstructPath(predecessor, srcKey, dstKey){
  const path = [dstKey];
  let cur = dstKey;
  while(cur !== srcKey){
    cur = predecessor.get(cur);
    path.unshift(cur);
  }
  return path;
}

// BFS zamiast Dijkstry celowo – graf jest nieważony, liczy się liczba
// przeskoków, nie "koszt" krawędzi.
function bfsShortestPath(srcKey, dstKey, excludedEdges){
  if(!srcKey || !dstKey || srcKey === dstKey) return null;
  if(!tradeGraph.has(srcKey)) return null;
  const visited = new Set([srcKey]);
  const predecessor = new Map();
  const queue = [srcKey];
  let qi = 0;
  while(qi < queue.length){
    const cur = queue[qi++];
    const neighbors = tradeGraph.get(cur);
    if(!neighbors) continue;
    for(const next of neighbors){
      if(excludedEdges && excludedEdges.has(`${cur}→${next}`)) continue;
      if(visited.has(next)) continue;
      visited.add(next);
      predecessor.set(next, cur);
      if(next === dstKey) return reconstructPath(predecessor, srcKey, dstKey);
      queue.push(next);
    }
  }
  return null;
}

function pathEdges(path){
  const edges = [];
  for(let i=1;i<path.length;i++) edges.push(`${path[i-1]}→${path[i]}`);
  return edges;
}

// Alternatywy: dla każdej krawędzi głównej trasy szukamy najkrótszej ścieżki
// z jej wykluczeniem. Zatrzymujemy się przy limicie albo gdy kolejna próba
// nie daje nowej, jeszcze niewidzianej trasy – bez sztucznego dopełniania.
function generateAlternateRoutes(primaryPath, srcKey, dstKey, maxAlternates=3){
  const found = [primaryPath];
  const signatures = new Set([primaryPath.join('>')]);
  for(const excluded of pathEdges(primaryPath)){
    if(found.length >= maxAlternates+1) break;
    const candidate = bfsShortestPath(srcKey, dstKey, new Set([excluded]));
    if(candidate){
      const sig = candidate.join('>');
      if(!signatures.has(sig)){ signatures.add(sig); found.push(candidate); }
    }
  }
  return found.slice(1);
}

// Wiele ofert wymaga DWÓCH składników jednocześnie (np. sklep-wioska:
// 12× Szmaragd + 1× Książka -> Zaklęta książka [Naprawa]) – to nie są
// alternatywne sposoby zapłaty, tylko wymagane razem price1 I price2.
// Trasa chodzi tylko po jednym z nich (tym, którym doszła do tej oferty);
// drugi trzeba pokazać jako dodatkowy, niezależny od trasy koszt, zamiast
// go pomijać.
function otherPriceSide(sideKey){ return sideKey==='price1' ? 'price2' : 'price1'; }

// Spośród wszystkich ofert realizujących krawędź from->to wybierz tę o
// najniższej stawce (price.qty/product.qty); remisy rozstrzyga getIdentifier.
function pickBestListingForEdge(fromKey, toKey){
  const candidates = edgeListings.get(`${fromKey}→${toKey}`) || [];
  let best = null, bestRate = Infinity;
  candidates.forEach(c=>{
    const priceObj = c.listing[c.priceSideKey];
    const productObj = c.listing.product;
    if(!priceObj || !productObj || !productObj.qty) return;
    const rate = priceObj.qty / productObj.qty;
    const better = !best || rate < bestRate || (rate === bestRate && getIdentifier(c.listing) < getIdentifier(best.listing));
    if(better){ bestRate = rate; best = c; }
  });
  return { chosen: best, alternateCount: candidates.length ? candidates.length - 1 : 0, allCandidates: candidates };
}

// Ilości wstecz: zaczynamy od "chcę 1 sztukę ostatniego przedmiotu" i idziemy
// od końca trasy do początku, za każdym razem zaokrąglając w górę do pełnych
// "transakcji" oferty. To szacunek – pomija limity zapasów/slotów sklepu.
function computeRouteQuantities(path){
  const rawHops = [];
  let needed = 1;
  for(let i = path.length-1; i>0; i--){
    const fromKey = path[i-1], toKey = path[i];
    const { chosen, alternateCount, allCandidates } = pickBestListingForEdge(fromKey, toKey);
    if(!chosen) return null;
    const priceObj = chosen.listing[chosen.priceSideKey];
    const productObj = chosen.listing.product;
    const neededQty = needed;
    const lots = Math.ceil(neededQty / productObj.qty);
    const spendQty = lots * priceObj.qty;
    const secondaryObj = chosen.listing[otherPriceSide(chosen.priceSideKey)];
    const secondary = secondaryObj ? {
      key: itemKeyOf(secondaryObj),
      name: secondaryObj.name, nameEn: secondaryObj.nameEn,
      enchanted: !!secondaryObj.enchanted,
      qty: secondaryObj.qty * lots,
    } : null;
    rawHops.unshift({
      fromKey, toKey,
      listing: chosen.listing,
      priceSideKey: chosen.priceSideKey,
      producedQty: productObj.qty * lots,
      neededQty, spendQty, lots, secondary,
      alternateCount, allCandidates,
    });
    needed = spendQty;
  }
  return rawHops;
}

function computeRoute(srcKey, dstKey){
  if(!srcKey || !dstKey) return { state: 'unresolved' };
  if(srcKey === dstKey) return { state: 'same' };
  const path = bfsShortestPath(srcKey, dstKey);
  if(!path) return { state: 'notfound' };
  const hops = computeRouteQuantities(path);
  if(!hops) return { state: 'notfound' };
  const alternates = generateAlternateRoutes(path, srcKey, dstKey, 3)
    .map(p=>({ path: p, hops: computeRouteQuantities(p) }))
    .filter(a=>a.hops);
  return { state: 'ok', path, hops, alternates };
}

// Wspólny link do mapy sklepu, używany też przez kartę oferty poniżej.
function shopMapHref(listing){
  const shopId = `${listing.storeLocation || ''}||${listing.storeName || 'Sklep'}`;
  return `/map/?shop=${encodeURIComponent(shopId)}`;
}

// --- Filtry ---
function updateLocationFilter(){
  const locs = [...new Set(allProducts.map(p=>p.storeLocation).filter(Boolean))];
  filterLocation.innerHTML = '<option value="">Wszystkie lokalizacje</option>' + locs.map(l=>`<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
}
function updateStoreFilter(){
  let stores = [];
  if(filterLocation.value){
    attachEvents(); load();
  } else {
    stores = [...new Set(allProducts.map(p=>p.storeName).filter(Boolean))];
  }
  filterStore.innerHTML = '<option value="">Wszystkie sklepy</option>' + stores.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

function passSearch(p, q){
  if(!q) return true;
  const ql = q.toLowerCase();
  if(productMatchesQuery(p, ql)) return true;
  if(priceSearch){
    return [p.price1, p.price2].some(pr => pr && (
      (pr.name || '').toLowerCase().includes(ql) ||
      (pr.nameEn || '').toLowerCase().includes(ql) ||
      (pr.item || '').toLowerCase().includes(ql)
    ));
  }
  return false;
}
function passAmount(pr){
  if(!pr) return false;
  const minOk = priceMin==='' || (typeof pr.qty==='number' && pr.qty >= Number(priceMin));
  const maxOk = priceMax==='' || (typeof pr.qty==='number' && pr.qty <= Number(priceMax));
  return minOk && maxOk;
}

function filterBase(mode='none'){
  let list = allProducts.slice();
  const loc = filterLocation.value;
  const store = filterStore.value;
  const q = searchInput.value.trim();
  if(mode==='city'){
    if(loc) list = list.filter(p=>p.storeLocation===loc);
  } else if(mode==='store'){
    if(store) list = list.filter(p=>p.storeName===store);
  } else {
    if(loc) list = list.filter(p=>p.storeLocation===loc);
    if(store) list = list.filter(p=>p.storeName===store);
  }
  if(q) list = list.filter(p=>passSearch(p,q));
  if(priceMin!=='' || priceMax!==''){
    list = list.filter(p => passAmount(p.price1) || passAmount(p.price2));
  }
  if(typeof clearSearchBtn !== 'undefined' && clearSearchBtn){
    if(q) clearSearchBtn.classList.add('active'); else clearSearchBtn.classList.remove('active');
  }
  return list;
}

// --- Renderowanie kart ofert ---
function createOfferCard(p, includeMeta=true){
  const card = document.createElement('div'); card.className='card fade-in';
  if(p?.product?.customItem) card.classList.add('custom-prod');

  const row = document.createElement('div'); row.className='row';
  const icon = createIcon(p.product.item,48,!!p.product.enchanted); row.appendChild(icon);
  const box = document.createElement('div'); box.className='card-heading';
  const title = document.createElement('h2'); title.className='title'; title.textContent = pickRootName(p) || p.product?.item || '—';
  if(p?.product?.customItem) title.classList.add('title--custom');
  box.appendChild(title);
  if(p.product.qty>1){
    const sub = document.createElement('p'); sub.className='subtitle'; sub.textContent = `×${p.product.qty}`;
    box.appendChild(sub);
  }
  row.appendChild(box); card.appendChild(row);

  // Price sits directly under the item's icon/name/qty — the primary "what &
  // how much" block the user asked to keep together.
  const priceSection = document.createElement('div'); priceSection.className='card-price-section';
  const priceHeading = document.createElement('div'); priceHeading.className='card-prices-label'; priceHeading.textContent = currentLang==='en'? 'Price':'Cena';
  priceSection.appendChild(priceHeading);
  const pricesBox = document.createElement('div'); pricesBox.className='prices';
  function addPrice(label, price){
    if(!price) return; if(priceMin!==''||priceMax!==''){ if(!passAmount(price)) return; }
    const chip = document.createElement('div'); chip.className='price-chip';
    const ic = createIcon(price.item,22,!!price.enchanted); chip.appendChild(ic);
    const span = document.createElement('span'); const displayName = pickName(price, price.item); span.textContent = `${displayName} ×${price.qty}`; chip.title = displayName + ' ('+label+')'; chip.appendChild(span);
    if(price.customItem) chip.classList.add('price-chip--custom'); pricesBox.appendChild(chip);
  }
  addPrice('Cena 1', p.price1); addPrice('Cena 2', p.price2);
  priceSection.appendChild(pricesBox);
  card.appendChild(priceSection);

  // Secondary "where to buy / notes" details — kept below the price, pushed
  // toward the card's bottom edge so short details don't leave dead space.
  const details = document.createElement('div'); details.className='card-details';
  if(includeMeta && (p.storeName || p.storeLocation)){
    const meta = document.createElement('div'); meta.className='card-meta';
    meta.textContent = p.storeName || '—';
    if(p.storeLocation){
      const loc = document.createElement('span'); loc.className='card-meta-loc'; loc.textContent = ` • ${p.storeLocation}`;
      meta.appendChild(loc);
    }
    details.appendChild(meta);
  }
  if(p.storeOwner || p.villageName){
    const badges = document.createElement('div'); badges.className='card-badges';
    if(p.storeOwner){
      const b = document.createElement('span'); b.className='card-badge'; b.textContent = `Właściciel: ${p.storeOwner}`; badges.appendChild(b);
    }
    if(p.villageName){
      const b = document.createElement('span'); b.className='card-badge'; b.textContent = `Wioska: ${p.villageName}`; badges.appendChild(b);
    }
    details.appendChild(badges);
  }
  if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)){
    const btn = document.createElement('button'); btn.type='button'; btn.className='mini-btn card-coords-btn';
    btn.innerHTML = `<span class="ui-icon" style="--icon:url(/icns_ui/map_search.svg)" aria-hidden="true"></span> ${p.x}, ${p.y}, ${p.z}`;
    btn.addEventListener('click', ()=>{ window.open(shopMapHref(p),'_blank','noopener'); });
    details.appendChild(btn);
  }
  if(p.notes){ details.appendChild(createNotesElement(p.notes)); }
  if(details.children.length){ card.appendChild(details); }

  return card;
}

function createNotesElement(text){
  const MAX = 180; const full = String(text||'');
  const wrap = document.createElement('div'); wrap.className='notes-block';
  if(full.length <= MAX){ wrap.textContent=full; return wrap; }
  const short = full.slice(0,MAX).replace(/\s+$/,'')+'…';
  const span = document.createElement('span'); span.textContent=short;
  const btn = document.createElement('button'); btn.type='button'; btn.className='mini-btn notes-more-btn'; btn.textContent='Pokaż więcej';
  let expanded=false; btn.addEventListener('click',()=>{ expanded=!expanded; span.textContent = expanded? full: short; btn.textContent = expanded? 'Pokaż mniej':'Pokaż więcej'; });
  wrap.appendChild(span); wrap.appendChild(btn); return wrap;
}

function renderFlat(list){
  productsEl.classList.remove('grid');
  productsEl.classList.remove('offers-grid');
  productsEl.innerHTML='';
  if(!list.length){ productsEl.hidden=true; emptyEl.hidden=false; emptyEl.textContent='Brak ofert do wyświetlenia.'; return; }
  let rendered=0; const total=list.length;
  const fragment = document.createDocumentFragment();
  const gridWrap = document.createElement('div'); gridWrap.className='offers-grid';
  const renderBatch = ()=>{
    const slice = list.slice(rendered, rendered+PAGE_SIZE);
    slice.forEach(p=> fragment.appendChild(createOfferCard(p,true)));
    rendered += slice.length;
  };
  renderBatch(); gridWrap.appendChild(fragment); productsEl.appendChild(gridWrap);
  productsEl.hidden=false; emptyEl.hidden=true;
  if(total > rendered){
    const moreWrap = document.createElement('div'); moreWrap.style.display='flex'; moreWrap.style.justifyContent='center'; moreWrap.style.margin='1rem 0';
    const btn = document.createElement('button'); btn.type='button'; btn.className='mini-btn';
    const updateLabel = ()=>{ btn.textContent = `Pokaż więcej (${total-rendered})`; };
    updateLabel(); btn.addEventListener('click',()=>{ renderBatch(); gridWrap.appendChild(fragment); if(rendered>=total){ moreWrap.remove(); } else updateLabel(); });
    moreWrap.appendChild(btn); productsEl.appendChild(moreWrap);
  }
}

function renderGroupByCity(list){
  productsEl.classList.remove('offers-grid');
  productsEl.innerHTML='';
  const selectedCity = filterLocation.value;
  if(!selectedCity){
    const head = document.createElement('h3'); head.textContent = 'Miasta'; head.style.fontSize='.8rem'; head.style.letterSpacing='.5px'; head.style.opacity='.85'; head.style.margin='0 0 .5rem';
    productsEl.appendChild(head);
    const cityMap = list.reduce((m,p)=>{ const c = p.storeLocation || '—'; (m[c] ||= 0); m[c]++; return m; },{});
    const gridWrap = document.createElement('div'); gridWrap.className='khandel-grid';
    Object.entries(cityMap).sort((a,b)=> a[0].localeCompare(b[0],'pl')).forEach(([city,count])=>{
      const btn = document.createElement('button'); btn.type='button'; btn.className='khandel-grid-btn';
      btn.innerHTML = `<span class=\"label\">${escapeHtml(city)}</span><span class=\"khandel-badge\">${count}</span>`;
      btn.addEventListener('click',()=>{ filterLocation.value = (city==='—'? '' : city); filterStore.value=''; setGroupMode('city'); renderAll(); requestAnimationFrame(()=> scrollToProducts()); });
      gridWrap.appendChild(btn);
    });
    productsEl.appendChild(gridWrap);
    productsEl.hidden=false; emptyEl.hidden=true; return;
  }
  const topBar = document.createElement('div'); topBar.className='offers-topbar';
  const back = document.createElement('button'); back.type='button'; back.className='mini-btn grid-switch-back'; back.innerHTML='‹ Wstecz'; back.addEventListener('click',()=>{ filterLocation.value=''; setGroupMode('city'); renderAll(); });
  const title = document.createElement('h3'); title.textContent = `Miasto: ${selectedCity}`;
  topBar.appendChild(back); topBar.appendChild(title); productsEl.appendChild(topBar);
  const offers = list.filter(p=> (p.storeLocation||'') === selectedCity);
  if(!offers.length){ productsEl.hidden=true; emptyEl.hidden=false; emptyEl.textContent='Brak ofert.'; return; }
  const grid = document.createElement('div'); grid.className='offers-grid';
  let rendered=0; const total=offers.length; const fragment = document.createDocumentFragment();
  const renderBatch = ()=>{ offers.slice(rendered, rendered+PAGE_SIZE).forEach(p=> fragment.appendChild(createOfferCard(p,false))); rendered += Math.min(PAGE_SIZE, total-rendered); };
  renderBatch(); grid.appendChild(fragment); productsEl.appendChild(grid);
  if(total>rendered){
    const moreWrap = document.createElement('div'); moreWrap.style.display='flex'; moreWrap.style.justifyContent='center'; moreWrap.style.margin='1rem 0';
    const btn = document.createElement('button'); btn.type='button'; btn.className='mini-btn';
    const updateLabel = ()=>{ btn.textContent = `Pokaż więcej (${total-rendered})`; };
    updateLabel(); btn.addEventListener('click',()=>{ renderBatch(); grid.appendChild(fragment); if(rendered>=total){ moreWrap.remove(); } else updateLabel(); });
    moreWrap.appendChild(btn); productsEl.appendChild(moreWrap);
  }
  productsEl.hidden=false; emptyEl.hidden=true;
}

function renderGroupByStore(list){
  productsEl.classList.remove('offers-grid');
  productsEl.innerHTML='';
  const selectedStoreName = filterStore.value;
  if(!selectedStoreName){
    const head = document.createElement('h3'); head.textContent = 'Sklepy'; head.style.fontSize='.8rem'; head.style.letterSpacing='.5px'; head.style.opacity='.85'; head.style.margin='0 0 .5rem';
    productsEl.appendChild(head);
    const byStore = list.reduce((m,p)=>{ const k=p.storeName||'Sklep'; (m[k] ||= 0); m[k]++; return m; },{});
    const gridWrap = document.createElement('div'); gridWrap.className='khandel-grid';
    Object.entries(byStore).sort((a,b)=> a[0].localeCompare(b[0],'pl')).forEach(([name,count])=>{
      const btn = document.createElement('button'); btn.type='button'; btn.className='khandel-grid-btn';
      btn.innerHTML = `<span class=\"label\">${escapeHtml(name)}</span><span class=\"khandel-badge\">${count}</span>`;
      btn.addEventListener('click',()=>{ filterStore.value = name; filterLocation.value=''; setGroupMode('store'); renderAll(); requestAnimationFrame(()=> scrollToProducts()); });
      gridWrap.appendChild(btn);
    });
    productsEl.appendChild(gridWrap);
    productsEl.hidden=false; emptyEl.hidden=true; return;
  }
  const topBar = document.createElement('div'); topBar.className='offers-topbar';
  const back = document.createElement('button'); back.type='button'; back.className='mini-btn grid-switch-back'; back.innerHTML='‹ Wstecz'; back.addEventListener('click',()=>{ filterStore.value=''; setGroupMode('store'); renderAll(); });
  const title = document.createElement('h3'); title.textContent = `Sklep: ${selectedStoreName}`;
  topBar.appendChild(back); topBar.appendChild(title); productsEl.appendChild(topBar);
  const offers = list.filter(p=> (p.storeName||'') === selectedStoreName);
  if(!offers.length){ productsEl.hidden=true; emptyEl.hidden=false; emptyEl.textContent='Brak ofert.'; return; }
  const grid = document.createElement('div'); grid.className='offers-grid';
  let rendered=0; const total=offers.length; const fragment = document.createDocumentFragment();
  const renderBatch = ()=>{ offers.slice(rendered, rendered+PAGE_SIZE).forEach(p=> fragment.appendChild(createOfferCard(p,false))); rendered += Math.min(PAGE_SIZE, total-rendered); };
  renderBatch(); grid.appendChild(fragment); productsEl.appendChild(grid);
  if(total>rendered){
    const moreWrap = document.createElement('div'); moreWrap.style.display='flex'; moreWrap.style.justifyContent='center'; moreWrap.style.margin='1rem 0';
    const btn = document.createElement('button'); btn.type='button'; btn.className='mini-btn';
    const updateLabel = ()=>{ btn.textContent = `Pokaż więcej (${total-rendered})`; };
    updateLabel(); btn.addEventListener('click',()=>{ renderBatch(); grid.appendChild(fragment); if(rendered>=total){ moreWrap.remove(); } else updateLabel(); });
    moreWrap.appendChild(btn); productsEl.appendChild(moreWrap);
  }
  productsEl.hidden=false; emptyEl.hidden=true;
}

// --- Breadcrumb (aktualnie uproszczony) ---
function renderBreadcrumb(){}

// --- Główny render według trybu ---
function renderAll(){
  renderBreadcrumb();
  if(groupMode==='city'){ const list = filterBase('city'); renderGroupByCity(list); return; }
  if(groupMode==='store'){ const list = filterBase('store'); renderGroupByStore(list); return; }
  const list = filterBase('none'); renderFlat(list);
}

// --- Trasa handlowa: renderowanie ---
function routeStateMessage(state){
  const messages = {
    empty: currentLang==='en' ? 'Select both items.' : 'Wybierz oba przedmioty.',
    same: currentLang==='en' ? 'Choose two different items.' : 'Wybierz dwa różne przedmioty.',
    unresolved: currentLang==='en' ? 'Item not found.' : 'Nie znaleziono przedmiotu.',
    notfound: currentLang==='en' ? 'No trade route found between these items.' : 'Nie znaleziono trasy handlowej między tymi przedmiotami.',
  };
  return messages[state] || '';
}

function buildRouteStepsEl(hops){
  const wrap = document.createElement('div'); wrap.className = 'route-steps';
  hops.forEach(hop=>{
    const step = document.createElement('div'); step.className = 'route-step';

    const fromNode = document.createElement('div'); fromNode.className = 'route-step-node';
    fromNode.appendChild(createIcon(baseItemId(hop.fromKey), 32, !!hop.listing[hop.priceSideKey]?.enchanted));
    const fromLabel = document.createElement('span');
    fromLabel.textContent = `${hop.spendQty}× ${catalogDisplayName(hop.fromKey)}`;
    fromNode.appendChild(fromLabel);
    step.appendChild(fromNode);

    const connector = document.createElement('div'); connector.className = 'route-step-connector';
    const arrow = document.createElement('span'); arrow.className = 'route-step-arrow'; arrow.textContent = '→';
    connector.appendChild(arrow);
    const storeLink = document.createElement('a'); storeLink.className = 'route-step-store';
    storeLink.href = shopMapHref(hop.listing); storeLink.target = '_blank'; storeLink.rel = 'noopener';
    storeLink.textContent = [hop.listing.storeName, hop.listing.storeLocation].filter(Boolean).join(' • ') || '—';
    connector.appendChild(storeLink);
    if(hop.secondary){
      const sec = document.createElement('div'); sec.className = 'route-step-secondary';
      sec.title = currentLang==='en'
        ? 'Extra ingredient this trade also requires — not obtained via the route'
        : 'Dodatkowy składnik wymagany do tej transakcji – nieuwzględniony w trasie';
      sec.appendChild(createIcon(baseItemId(hop.secondary.key), 20, hop.secondary.enchanted));
      const secLabel = document.createElement('span');
      const secName = currentLang==='en' ? (hop.secondary.nameEn || hop.secondary.name) : (hop.secondary.name || hop.secondary.nameEn);
      secLabel.textContent = `+ ${hop.secondary.qty}× ${secName || hop.secondary.key}`;
      sec.appendChild(secLabel);
      connector.appendChild(sec);
    }
    if(hop.alternateCount > 0){
      const altBtn = document.createElement('button'); altBtn.type = 'button'; altBtn.className = 'route-step-alt-toggle mini-btn';
      altBtn.textContent = currentLang==='en' ? `+${hop.alternateCount} more offers` : `+${hop.alternateCount} innych ofert`;
      const altList = document.createElement('ul'); altList.className = 'route-alt-list'; altList.hidden = true;
      hop.allCandidates.forEach(c=>{
        if(c.listing === hop.listing && c.priceSideKey === hop.priceSideKey) return;
        const priceObj = c.listing[c.priceSideKey];
        const otherObj = c.listing[otherPriceSide(c.priceSideKey)];
        const extra = otherObj ? ` + ${otherObj.qty}× ${catalogDisplayName(itemKeyOf(otherObj))}` : '';
        const li = document.createElement('li');
        li.textContent = `${c.listing.storeName || '—'}${c.listing.storeLocation ? ' • '+c.listing.storeLocation : ''} (${priceObj.qty}× → ${c.listing.product.qty}×${extra})`;
        altList.appendChild(li);
      });
      altBtn.addEventListener('click', ()=>{ altList.hidden = !altList.hidden; });
      connector.appendChild(altBtn); connector.appendChild(altList);
    }
    step.appendChild(connector);

    const toNode = document.createElement('div'); toNode.className = 'route-step-node';
    toNode.appendChild(createIcon(baseItemId(hop.toKey), 32, !!hop.listing.product?.enchanted));
    const toLabel = document.createElement('span');
    const surplus = hop.producedQty > hop.neededQty ? ` (${currentLang==='en'?'produces':'daje'} ${hop.producedQty})` : '';
    toLabel.textContent = `${hop.neededQty}× ${catalogDisplayName(hop.toKey)}${surplus}`;
    toNode.appendChild(toLabel);
    step.appendChild(toNode);

    wrap.appendChild(step);
  });
  return wrap;
}

// Zsumowane dodatkowe składniki (price2/price1 nieużyte przez trasę) z całej
// głównej trasy, żeby dało się je zobaczyć w jednym miejscu jako listę zakupów.
function collectSecondaryIngredients(hops){
  const totals = new Map();
  hops.forEach(hop=>{
    if(!hop.secondary) return;
    const existing = totals.get(hop.secondary.key);
    if(existing) existing.qty += hop.secondary.qty;
    else totals.set(hop.secondary.key, { ...hop.secondary });
  });
  return [...totals.values()];
}

// Gdzie/u kogo faktycznie kupić dany przedmiot – przeszukuje sellListings
// (wszystkie oferty, gdzie ten przedmiot jest "product", niezależnie od
// tego, czy leży na głównej trasie). Potrzebne dla "dodatkowych składników",
// żeby nie zostawiać gracza z samą nazwą i ilością bez wskazówki skąd to wziąć.
function buildIngredientSourcesEl(key, limit=4){
  const wrap = document.createElement('div'); wrap.className = 'route-extra-sources';
  const candidates = sellListings.get(key) || [];
  if(!candidates.length){
    const p = document.createElement('p'); p.className = 'route-extra-sources-empty';
    p.textContent = currentLang==='en' ? 'No listing in the data sells this.' : 'Brak oferty sprzedaży tego przedmiotu w bazie.';
    wrap.appendChild(p);
    return wrap;
  }
  const list = document.createElement('ul'); list.className = 'route-extra-sources-list';
  candidates.slice(0, limit).forEach(listing=>{
    const li = document.createElement('li');
    const link = document.createElement('a'); link.className = 'route-step-store';
    link.href = shopMapHref(listing); link.target = '_blank'; link.rel = 'noopener';
    link.textContent = [listing.storeName, listing.storeLocation].filter(Boolean).join(' • ') || '—';
    li.appendChild(link);
    const priceParts = [listing.price1, listing.price2].filter(Boolean).map(pr=>{
      const name = currentLang==='en' ? (pr.nameEn || pr.name) : (pr.name || pr.nameEn);
      return `${pr.qty}× ${name || pr.item}`;
    });
    const price = document.createElement('span'); price.className = 'route-extra-source-price';
    price.textContent = `${priceParts.join(' + ')} → ${listing.product.qty}× ${catalogDisplayName(key)}`;
    li.appendChild(price);
    list.appendChild(li);
  });
  wrap.appendChild(list);
  if(candidates.length > limit){
    const more = document.createElement('p'); more.className = 'route-extra-sources-more';
    more.textContent = currentLang==='en' ? `+${candidates.length-limit} more offers` : `+${candidates.length-limit} innych ofert`;
    wrap.appendChild(more);
  }
  return wrap;
}

function renderRouteResult(result){
  if(!routeResultsEl) return;
  routeResultsEl.innerHTML = '';
  if(!result) return;
  if(result.state !== 'ok'){
    const empty = document.createElement('p'); empty.className = 'route-empty';
    empty.textContent = routeStateMessage(result.state);
    routeResultsEl.appendChild(empty);
    return;
  }
  routeResultsEl.appendChild(buildRouteStepsEl(result.hops));

  const extras = collectSecondaryIngredients(result.hops);
  if(extras.length){
    const extraWrap = document.createElement('div'); extraWrap.className = 'route-extras';
    const heading = document.createElement('h3');
    heading.textContent = currentLang==='en' ? 'Also required (outside the route)' : 'Dodatkowo potrzebne (poza trasą)';
    extraWrap.appendChild(heading);
    const list = document.createElement('ul'); list.className = 'route-extras-list';
    extras.forEach(ex=>{
      const li = document.createElement('li');
      const head = document.createElement('div'); head.className = 'route-extras-item-head';
      head.appendChild(createIcon(baseItemId(ex.key), 22, ex.enchanted));
      const span = document.createElement('span');
      const name = currentLang==='en' ? (ex.nameEn || ex.name) : (ex.name || ex.nameEn);
      span.textContent = `${ex.qty}× ${name || ex.key}`;
      head.appendChild(span);
      li.appendChild(head);
      li.appendChild(buildIngredientSourcesEl(ex.key));
      list.appendChild(li);
    });
    extraWrap.appendChild(list);
    routeResultsEl.appendChild(extraWrap);
  }

  const disclaimer = document.createElement('p'); disclaimer.className = 'route-disclaimer';
  disclaimer.textContent = currentLang==='en'
    ? 'Quantities are estimates and ignore shop stock/slot limits.'
    : 'Ilości są szacunkowe i pomijają limity zapasów/slotów sklepów.';
  routeResultsEl.appendChild(disclaimer);

  if(result.alternates && result.alternates.length){
    const altWrap = document.createElement('div'); altWrap.className = 'route-alternates';
    const heading = document.createElement('h3');
    heading.textContent = currentLang==='en' ? 'Alternate routes' : 'Alternatywne trasy';
    altWrap.appendChild(heading);
    result.alternates.forEach(alt=>{
      const details = document.createElement('details'); details.className = 'route-alt-route';
      const summary = document.createElement('summary');
      const middle = alt.path.slice(1,-1).map(k=>catalogDisplayName(k)).join(', ');
      const hopCount = alt.path.length - 1;
      summary.textContent = middle
        ? (currentLang==='en' ? `${hopCount} hops via ${middle}` : `${hopCount} przeskoków przez ${middle}`)
        : (currentLang==='en' ? `${hopCount} hop` : `${hopCount} przeskok`);
      details.appendChild(summary);
      details.appendChild(buildRouteStepsEl(alt.hops));
      altWrap.appendChild(details);
    });
    routeResultsEl.appendChild(altWrap);
  }
}

// --- Trasa handlowa: autouzupełnianie i zdarzenia ---
function renderSuggestList(listEl, matches, onPick){
  listEl.innerHTML = '';
  if(!matches.length){ listEl.hidden = true; return; }
  matches.forEach(entry=>{
    const li = document.createElement('li'); li.className = 'route-suggest-item';
    li.appendChild(createIcon(baseItemId(entry.key), 20, !!entry.enchanted));
    const span = document.createElement('span'); span.textContent = catalogDisplayName(entry.key);
    li.appendChild(span);
    // mousedown (nie click) żeby zdążyć wybrać zanim blur ukryje listę
    li.addEventListener('mousedown', (e)=>{ e.preventDefault(); onPick(entry); });
    listEl.appendChild(li);
  });
  listEl.hidden = false;
}

function wireRouteAutocomplete(inputEl, listEl){
  if(!inputEl || !listEl) return;
  const pick = (entry)=>{
    inputEl.value = catalogDisplayName(entry.key);
    inputEl.dataset.resolvedKey = entry.key;
    listEl.hidden = true;
  };
  const showMatches = ()=>{ renderSuggestList(listEl, findItemMatches(inputEl.value, 8), pick); };
  inputEl.addEventListener('input', ()=>{ delete inputEl.dataset.resolvedKey; showMatches(); });
  inputEl.addEventListener('focus', showMatches);
  inputEl.addEventListener('blur', ()=>{ setTimeout(()=>{ listEl.hidden = true; }, 150); });
}

function updateRouteFinderLangUI(){
  const t = currentLang==='en'
    ? { title:'Trade route', desc:"Enter what you have and what you want to buy — we'll find a chain of trades between offers.", have:'You have', want:'Want to buy', placeholder:'Search item…', swap:'Swap', search:'Find route' }
    : { title:'Trasa handlowa', desc:'Podaj co masz i co chcesz kupić — znajdziemy łańcuch wymian między ofertami.', have:'Masz', want:'Chcesz kupić', placeholder:'Szukaj przedmiotu…', swap:'Zamień miejscami', search:'Znajdź trasę' };
  const setText = (id, text)=>{ const el=document.getElementById(id); if(el) el.textContent = text; };
  setText('route-finder-title', t.title);
  setText('route-finder-desc', t.desc);
  setText('route-have-label', t.have);
  setText('route-want-label', t.want);
  setText('route-search-btn', t.search);
  if(routeHaveInput) routeHaveInput.placeholder = t.placeholder;
  if(routeWantInput) routeWantInput.placeholder = t.placeholder;
  if(routeSwapBtn) routeSwapBtn.setAttribute('aria-label', t.swap);
  if(lastRouteResult) renderRouteResult(lastRouteResult);
}

function attachRouteFinderEvents(){
  wireRouteAutocomplete(routeHaveInput, routeHaveSuggest);
  wireRouteAutocomplete(routeWantInput, routeWantSuggest);
  if(routeSwapBtn){
    routeSwapBtn.addEventListener('click', ()=>{
      const haveValue = routeHaveInput.value, haveKey = routeHaveInput.dataset.resolvedKey;
      const wantValue = routeWantInput.value, wantKey = routeWantInput.dataset.resolvedKey;
      routeHaveInput.value = wantValue;
      routeWantInput.value = haveValue;
      if(wantKey) routeHaveInput.dataset.resolvedKey = wantKey; else delete routeHaveInput.dataset.resolvedKey;
      if(haveKey) routeWantInput.dataset.resolvedKey = haveKey; else delete routeWantInput.dataset.resolvedKey;
    });
  }
  if(routeSearchBtn){
    routeSearchBtn.addEventListener('click', ()=>{
      if(routeHaveSuggest) routeHaveSuggest.hidden = true;
      if(routeWantSuggest) routeWantSuggest.hidden = true;
      const haveEmpty = !routeHaveInput?.value.trim();
      const wantEmpty = !routeWantInput?.value.trim();
      const result = (haveEmpty || wantEmpty)
        ? { state: 'empty' }
        : computeRoute(resolveItemKey(routeHaveInput), resolveItemKey(routeWantInput));
      lastRouteResult = result;
      renderRouteResult(result);
      requestAnimationFrame(()=> scrollToEl(routeResultsEl));
    });
  }
}

// --- Zdarzenia ---
function attachEvents(){
  const applyLangLabel = (btn)=>{ if(!btn) return; btn.textContent = currentLang==='pl'? 'PL':'EN'; };
  const applyMobilePriceLabel = ()=>{ if(priceToggleMobile){ priceToggleMobile.textContent = currentLang==='pl'? 'Szukaj w cenach' : 'Search currency'; } };
  const updateAllLangUI = ()=>{
    applyLangLabel(langToggle); applyLangLabel(langToggleFloat);
    applyMobilePriceLabel();
    if(searchInput){ searchInput.placeholder = computeSearchPlaceholder(); }
    if(mobileSearchInput){ mobileSearchInput.placeholder = computeSearchPlaceholder(); }
    updatePriceToggleVisual();
    updateRouteFinderLangUI();
  };
  const applyLangDataAttr = ()=>{ try { document.documentElement.setAttribute('data-lang', currentLang); } catch(_){} };
  const switchLang = ()=>{
    currentLang = currentLang==='pl'? 'en':'pl';
    localStorage.setItem('khandelLang', currentLang);
    applyLangDataAttr();
    updateAllLangUI();
    renderAll();
  };
  // Inicjalny stan UI językowego
  applyLangDataAttr();
  updateAllLangUI();
  attachRouteFinderEvents();
  // Podłącz jeden, spójny handler do obu przycisków
  if(langToggle){ langToggle.replaceWith(langToggle.cloneNode(true)); }
  if(langToggleFloat){ langToggleFloat.replaceWith(langToggleFloat.cloneNode(true)); }
  langToggle = document.getElementById('lang-toggle');
  langToggleFloat = document.getElementById('lang-toggle-float');
  if(langToggle){ langToggle.addEventListener('click', switchLang); }
  if(langToggleFloat){ langToggleFloat.addEventListener('click', switchLang); }
  if(searchInput){ searchInput.addEventListener('input', ()=>{ renderAll(); }); }
  const syncInputs = (from, to)=>{ if(!from || !to) return; to.value = from.value; };
  if(searchInput && mobileSearchInput){
    searchInput.addEventListener('input', ()=>{ syncInputs(searchInput, mobileSearchInput); if(mobileClearBtn){ mobileClearBtn.classList.toggle('active', !!searchInput.value.trim()); } });
    mobileSearchInput.addEventListener('input', ()=>{ 
      syncInputs(mobileSearchInput, searchInput); 
      const hasQ = !!mobileSearchInput.value.trim();
      if(clearSearchBtn){ clearSearchBtn.classList.toggle('active', hasQ); }
      if(mobileClearBtn){ mobileClearBtn.classList.toggle('active', hasQ); }
      const wrapper = mobileSearchInput.closest('.khandel-bottom-search');
      if(wrapper && hasQ){ wrapper.classList.add('expanded'); }
      renderAll();
    });
    mobileSearchInput.addEventListener('focus', ()=>{ const wrapper = mobileSearchInput.closest('.khandel-bottom-search'); if(wrapper){ wrapper.classList.add('expanded'); } });
    // Aktualizacja placeholderów jest scentralizowana w updateAllLangUI + updatePriceToggleVisual
  }
  if(searchInput){
    searchInput.addEventListener('input', ()=>{
      if(clearSearchBtn){ clearSearchBtn.classList.toggle('active', !!searchInput.value.trim()); }
    });
    searchInput.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){ e.preventDefault(); renderAll(); requestAnimationFrame(()=> scrollToProducts()); }
      else if(e.key==='Escape'){ if(searchInput.value){ searchInput.value=''; clearSearchBtn && clearSearchBtn.classList.remove('active'); renderAll(); } }
    });
  }
  if(doSearchBtn){ doSearchBtn.addEventListener('click', ()=>{ renderAll(); requestAnimationFrame(()=> scrollToProducts()); }); }
  if(filterLocation && filterLocation.tagName==='SELECT'){ filterLocation.addEventListener('change', ()=>{ updateStoreFilter(); filterStore.value=''; renderAll(); }); }
  if(filterStore && filterStore.tagName==='SELECT'){ filterStore.addEventListener('change', ()=>{ renderAll(); }); }
  if(clearSearchBtn){ clearSearchBtn.addEventListener('click', ()=>{
    searchInput.value=''; renderAll(); searchInput.focus();
    clearSearchBtn.classList.remove('active');
  }); }
  if(mobileClearBtn){ mobileClearBtn.addEventListener('click', ()=>{
    mobileSearchInput.value=''; syncInputs(mobileSearchInput, searchInput); renderAll(); mobileSearchInput.focus();
    mobileClearBtn.classList.remove('active'); if(clearSearchBtn) clearSearchBtn.classList.remove('active');
  }); }
  if(priceSearchToggle){ priceSearchToggle.addEventListener('change', ()=>{ priceSearch = !!priceSearchToggle.checked; updatePriceToggleVisual(); renderAll(); }); }
  if(priceToggleMobile){ priceToggleMobile.addEventListener('click', ()=>{ priceSearch = !priceSearch; if(priceSearchToggle){ priceSearchToggle.checked = priceSearch; } updatePriceToggleVisual(); renderAll(); }); }
  if(groupNoneBtn){ groupNoneBtn.addEventListener('click', ()=>{ setGroupMode('none'); renderAll(); }); }
  if(groupCityBtn){ groupCityBtn.addEventListener('click', ()=>{ filterStore.value=''; setGroupMode('city'); renderAll(); }); }
  if(groupStoreBtn){ groupStoreBtn.addEventListener('click', ()=>{ filterLocation.value=''; setGroupMode('store'); renderAll(); }); }
  if(groupNoneBottomBtn){ groupNoneBottomBtn.addEventListener('click', ()=>{ setGroupMode('none'); renderAll(); }); }
  if(groupCityBottomBtn){ groupCityBottomBtn.addEventListener('click', ()=>{ filterStore.value=''; setGroupMode('city'); renderAll(); collapseMobileSearch(); }); }
  if(groupStoreBottomBtn){ groupStoreBottomBtn.addEventListener('click', ()=>{ filterLocation.value=''; setGroupMode('store'); renderAll(); collapseMobileSearch(); }); }
  if(mobileSearchInput){
    mobileSearchInput.addEventListener('keydown',(e)=>{
      if(e.key==='Enter'){ e.preventDefault(); syncInputs(mobileSearchInput, searchInput); renderAll(); requestAnimationFrame(()=> scrollToProducts()); }
      else if(e.key==='Escape'){ if(mobileSearchInput.value){ mobileSearchInput.value=''; syncInputs(mobileSearchInput, searchInput); renderAll(); } }
    });
  }
  if(segmented){
    const tabs = [groupNoneBtn, groupCityBtn, groupStoreBtn].filter(Boolean);
    segmented.addEventListener('keydown',(e)=>{
      const currentIndex = tabs.findIndex(t=>t.getAttribute('aria-selected')==='true');
      if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) e.preventDefault();
      let nextIndex = currentIndex;
      if(e.key==='ArrowRight'){ nextIndex = (currentIndex+1) % tabs.length; }
      else if(e.key==='ArrowLeft'){ nextIndex = (currentIndex-1+tabs.length) % tabs.length; }
      else if(e.key==='Home'){ nextIndex = 0; }
      else if(e.key==='End'){ nextIndex = tabs.length-1; }
      if(nextIndex!==currentIndex){
        const next = tabs[nextIndex];
        next.focus();
        next.click();
      }
    });
  }
}

// Zarządzanie rozwinięciem dolnego paska wyszukiwania (klasa .expanded)
function getBottomSearchWrapper(){ return document.querySelector('.khandel-bottom-search'); }
function expandMobileSearch(){ const w = getBottomSearchWrapper(); if(w) w.classList.add('expanded'); }
function collapseMobileSearch(){ const w = getBottomSearchWrapper(); if(w) w.classList.remove('expanded'); }

// Globalne zdarzenia do zamykania: klik poza, scroll, zmiana zakładki już wywołuje collapse w handlerach powyżej
document.addEventListener('click', (e)=>{
  const w = getBottomSearchWrapper();
  if(!w) return;
  if(w.contains(e.target)){ // klik w obrębie – utrzymujemy expanded
    w.classList.add('expanded');
  } else {
    collapseMobileSearch();
  }
});

// Blokada zwijania podczas interakcji z dolnym paskiem (np. schowanie klawiatury wywołuje scroll)
let _scrollTimeout=null;
let _bottomSearchLock=false;
let _unlockTimer=null;
function lockBottomSearch(ms=800){
  _bottomSearchLock = true;
  if(_unlockTimer) clearTimeout(_unlockTimer);
  _unlockTimer = setTimeout(()=>{ _bottomSearchLock=false; }, ms);
}
const _bsw = getBottomSearchWrapper();
if(_bsw){
  _bsw.addEventListener('pointerdown', ()=>{ lockBottomSearch(900); }, { passive: true });
  _bsw.addEventListener('touchstart', ()=>{ lockBottomSearch(900); }, { passive: true });
  _bsw.addEventListener('focusin', ()=>{ expandMobileSearch(); lockBottomSearch(900); });
}

window.addEventListener('scroll', ()=>{
  if(_scrollTimeout) return;
  _scrollTimeout = setTimeout(()=>{
    _scrollTimeout=null;
    if(_bottomSearchLock) return; // ignoruj scroll tuż po dotyku w panelu
    collapseMobileSearch();
  }, 80);
}, { passive: true });

async function load(){
  try {
    const list = await window.__db.fetchJson('data/khandel-products.json');
    allProducts = Array.isArray(list)? list: [];
    allProducts.sort((a,b)=> getIdentifier(a).localeCompare(getIdentifier(b), 'pl', { sensitivity:'base', numeric:true }));
    itemCatalog = buildItemCatalog(allProducts);
    const graphData = buildTradeGraph(allProducts);
    tradeGraph = graphData.graph;
    edgeListings = graphData.listings;
    sellListings = graphData.sellListings;
    const qParam = new URLSearchParams(window.location.search).get('q');
    if(qParam){
      if(searchInput) searchInput.value = qParam;
      if(mobileSearchInput) mobileSearchInput.value = qParam;
    }
    updateLocationFilter(); updateStoreFilter(); setGroupMode('none'); updatePriceToggleVisual(); renderAll();
  } catch(e){ emptyEl.hidden=false; emptyEl.textContent='Błąd ładowania produktów: '+e.message; }
}

attachEvents(); load();
document.getElementById('back-btn')?.addEventListener('click', () => { window.location.href = '/'; });
