let currentLang = (localStorage.getItem('khandelLang') || 'pl');
let allProducts = [];
let selectedStore = '';
let searchQuery = '';
let priceSearch = false;
let priceMin = '';
let priceMax = '';
let groupMode = 'none';
const PAGE_SIZE = 60;

const breadcrumbEl = null;
const productsEl = document.getElementById('khandel-products');
const emptyEl = document.getElementById('empty');
const langToggle = document.getElementById('lang-toggle');
const langToggleFloat = document.getElementById('lang-toggle-float');
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

// Płynne przewinięcie do wyników z uwzględnieniem wysokości nagłówka
function scrollToProducts(){
  if(!productsEl) return;
  const header = document.querySelector('.app-header');
  const headerH = header ? header.offsetHeight : 0;
  const y = productsEl.getBoundingClientRect().top + window.scrollY - Math.max(12, headerH + 8);
  window.scrollTo({ top: y, behavior: 'smooth' });
}

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

// --- Filtry ---
function updateLocationFilter(){
  const locs = [...new Set(allProducts.map(p=>p.storeLocation).filter(Boolean))];
  filterLocation.innerHTML = '<option value="">Wszystkie lokalizacje</option>' + locs.map(l=>`<option value="${l}">${l}</option>`).join('');
}
function updateStoreFilter(){
  let stores = [];
  if(filterLocation.value){
    attachEvents(); load();
  } else {
    stores = [...new Set(allProducts.map(p=>p.storeName).filter(Boolean))];
  }
  filterStore.innerHTML = '<option value="">Wszystkie sklepy</option>' + stores.map(s=>`<option value="${s}">${s}</option>`).join('');
}

function passSearch(p, q){
  if(!q) return true;
  const ql = q.toLowerCase();
  const namePl = (p.productName || p.product?.name || '').toLowerCase();
  const nameEn = (p.productNameEn || p.product?.nameEn || '').toLowerCase();
  const notesTxt = (p.notes || '').toLowerCase();
  if(namePl.includes(ql) || nameEn.includes(ql) || notesTxt.includes(ql)) return true;
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
  const box = document.createElement('div');
  const title = document.createElement('h2'); title.className='title'; title.textContent = pickRootName(p) || p.product?.item || '—';
  if(p?.product?.customItem) title.classList.add('title--custom');
  const sub = document.createElement('p'); sub.className='subtitle'; sub.textContent = (p.product.qty>1? ` ×${p.product.qty}`:'');
  box.appendChild(title); box.appendChild(sub);
  if(includeMeta && (p.storeName || p.storeLocation)){
    const meta = document.createElement('div'); meta.style.marginTop='.25rem'; meta.style.fontSize='.55rem'; meta.style.letterSpacing='.4px'; meta.style.fontWeight='600'; meta.style.opacity='.9';
    meta.textContent = `${p.storeName || '—'}${p.storeLocation? ' @ '+p.storeLocation:''}`; box.appendChild(meta);
  }
  if(p.storeOwner){
    const ownerLine = document.createElement('div'); ownerLine.style.marginTop='.25rem';
    const badge = document.createElement('span'); badge.textContent=p.storeOwner; badge.style.display='inline-block'; badge.style.fontSize='.55rem'; badge.style.fontWeight='600'; badge.style.letterSpacing='.4px'; badge.style.padding='.25rem .55rem'; badge.style.borderRadius='999px'; badge.style.background='linear-gradient(135deg,#1f2a35,#16212b)'; badge.style.border='1px solid #26313d'; badge.style.boxShadow='0 2px 6px -2px rgba(0,0,0,.4)'; badge.style.color='#e6edf3'; ownerLine.appendChild(badge); box.appendChild(ownerLine);
  }
  if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)){
    const btn = document.createElement('button'); btn.type='button'; btn.innerHTML = `<img src="/icns_ui/map_search.svg" alt="" aria-hidden="true" style="width:16px;height:16px;vertical-align:middle;margin-right:.4rem;filter:drop-shadow(0 0 1px rgba(0,0,0,.4));"/> ${p.x},${p.y},${p.z}`; btn.style.marginTop='.3rem'; btn.style.fontSize='.55rem'; btn.style.background='#1a2632'; btn.style.border='1px solid #26313d'; btn.style.color='#e6edf3'; btn.style.padding='.35rem .55rem'; btn.style.borderRadius='8px'; btn.style.cursor='pointer'; btn.style.fontWeight='600';
    btn.addEventListener('click', ()=>{ const shopId = `${p.storeLocation || ''}||${p.storeName || 'Sklep'}`; window.open(`/map/?shop=${encodeURIComponent(shopId)}`,'_blank','noopener'); }); box.appendChild(btn);
  }
  row.appendChild(box); card.appendChild(row);
  const priceHeading = document.createElement('div'); priceHeading.textContent = currentLang==='en'? 'Price':'Cena'; priceHeading.style.fontSize='.6rem'; priceHeading.style.margin='0.5rem 0 .2rem'; priceHeading.style.opacity='.85'; priceHeading.style.letterSpacing='.5px'; card.appendChild(priceHeading);
  const pricesBox = document.createElement('div'); pricesBox.className='prices';
  function addPrice(label, price){
    if(!price) return; if(priceMin!==''||priceMax!==''){ if(!passAmount(price)) return; }
    const chip = document.createElement('div'); chip.className='price-chip';
    const ic = createIcon(price.item,22,!!price.enchanted); chip.appendChild(ic);
    const span = document.createElement('span'); const displayName = pickName(price, price.item); span.textContent = `${displayName} ×${price.qty}`; chip.title = displayName + ' ('+label+')'; chip.appendChild(span);
    if(price.customItem) chip.classList.add('price-chip--custom'); pricesBox.appendChild(chip);
  }
  addPrice('Cena 1', p.price1); addPrice('Cena 2', p.price2); card.appendChild(pricesBox);
  if(p.notes){ card.appendChild(createNotesElement(p.notes)); }
  return card;
}

function createNotesElement(text){
  const MAX = 180; const full = String(text||'');
  const wrap = document.createElement('div'); wrap.className='notes-block'; wrap.style.marginTop='.45rem'; wrap.style.fontSize='.55rem'; wrap.style.lineHeight='1.35'; wrap.style.whiteSpace='pre-wrap'; wrap.style.opacity='.85';
  if(full.length <= MAX){ wrap.textContent=full; return wrap; }
  const short = full.slice(0,MAX).replace(/\s+$/,'')+'…';
  const span = document.createElement('span'); span.textContent=short;
  const btn = document.createElement('button'); btn.type='button'; btn.textContent='Pokaż więcej'; btn.style.display='inline-block'; btn.style.marginTop='.35rem'; btn.style.fontSize='.55rem'; btn.style.padding='.25rem .5rem'; btn.style.background='#1a2632'; btn.style.border='1px solid #26313d'; btn.style.color='#e6edf3'; btn.style.borderRadius='8px'; btn.style.cursor='pointer'; btn.style.fontWeight='600';
  let expanded=false; btn.addEventListener('click',()=>{ expanded=!expanded; span.textContent = expanded? full: short; btn.textContent = expanded? 'Pokaż mniej':'Pokaż więcej'; });
  wrap.appendChild(span); wrap.appendChild(document.createElement('br')); wrap.appendChild(btn); return wrap;
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
      btn.innerHTML = `<span class=\"label\">${city}</span><span class=\"khandel-badge\">${count}</span>`;
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
      btn.innerHTML = `<span class=\"label\">${name}</span><span class=\"khandel-badge\">${count}</span>`;
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

// --- Zdarzenia ---
function attachEvents(){
  const applyLangLabel = (btn)=>{ if(!btn) return; btn.textContent = currentLang==='pl'? 'PL 🇵🇱':'EN 🇬🇧'; };
  const applyMobilePriceLabel = ()=>{ if(priceToggleMobile){ priceToggleMobile.textContent = currentLang==='pl'? 'Szukaj w cenach' : 'Search currency'; } };
  const updateAllLangUI = ()=>{
    applyLangLabel(langToggle); applyLangLabel(langToggleFloat);
    applyMobilePriceLabel();
    if(searchInput){ searchInput.placeholder = computeSearchPlaceholder(); }
    if(mobileSearchInput){ mobileSearchInput.placeholder = computeSearchPlaceholder(); }
    updatePriceToggleVisual();
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
  // Podłącz jeden, spójny handler do obu przycisków
  if(langToggle){ langToggle.replaceWith(langToggle.cloneNode(true)); }
  if(langToggleFloat){ langToggleFloat.replaceWith(langToggleFloat.cloneNode(true)); }
  const _langToggle = document.getElementById('lang-toggle');
  const _langToggleFloat = document.getElementById('lang-toggle-float');
  if(_langToggle){ _langToggle.addEventListener('click', switchLang); }
  if(_langToggleFloat){ _langToggleFloat.addEventListener('click', switchLang); }
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
    updateLocationFilter(); updateStoreFilter(); setGroupMode('none'); updatePriceToggleVisual(); renderAll();
  } catch(e){ emptyEl.hidden=false; emptyEl.textContent='Błąd ładowania produktów: '+e.message; }
}

attachEvents(); load();
