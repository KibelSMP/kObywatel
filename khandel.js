// Renderowanie ścieżki nawigacyjnej (breadcrumb)
function renderBreadcrumb() {
  const breadcrumb = document.getElementById('khandel-breadcrumb');
  if (!breadcrumb) return;
  let html = '';
  if (!selectedLocation) {
    html = '<span class="bc-root">Wybierz lokalizację</span>';
  } else if (selectedLocation && !selectedStore) {
    html = `<button class="bc-link" type="button" id="bc-root">Lokalizacje</button> <span class="bc-sep">/</span> <span class="bc-loc">${selectedLocation}</span>`;
  } else if (selectedLocation && selectedStore) {
    html = `<button class="bc-link" type="button" id="bc-root">Lokalizacje</button> <span class="bc-sep">/</span> <button class="bc-link" type="button" id="bc-loc">${selectedLocation}</button> <span class="bc-sep">/</span> <span class="bc-store">${selectedStore}</span>`;
  }
  breadcrumb.innerHTML = html;
  // Obsługa kliknięć
  const rootBtn = document.getElementById('bc-root');
  if(rootBtn){
    rootBtn.onclick = ()=>{
      selectedLocation = '';
      selectedStore = '';
      renderHierarchy();
    };
  }
  const locBtn = document.getElementById('bc-loc');
  if(locBtn){
    locBtn.onclick = ()=>{
      selectedStore = '';
      renderHierarchy();
    };
  }
}
// Funkcja do pobierania nazwy przedmiotu w odpowiednim języku
function pickName(obj, fallback){
  if(!obj) return fallback;
  if(currentLang==='en' && obj.nameEn) return obj.nameEn;
  if(currentLang==='pl' && obj.name) return obj.name;
  return obj.nameEn || obj.name || fallback;
}
// Funkcja do pobierania nazwy produktu w odpowiednim języku
function pickRootName(entry){
  if(currentLang==='en') return entry.productNameEn || entry.productName || (entry.product?.nameEn) || (entry.product?.name) || (entry.product?.item);
  return entry.productName || entry.productNameEn || (entry.product?.name) || (entry.product?.nameEn) || (entry.product?.item);
}
// Pomocnicze funkcje do pobierania lokalizacji i sklepów
function getLocations(products){
  return [...new Set(products.map(p => p.storeLocation).filter(Boolean))];
}
function getStores(products, location){
  return [...new Set(products.filter(p => p.storeLocation === location).map(p => p.storeName).filter(Boolean))];
}

// --- Ikony Minecraft ---
const MC_ASSETS_VERSION = '1.20.4';
const MC_ASSETS_BASE = `https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@${MC_ASSETS_VERSION}/assets/minecraft/textures`;
const PATH_ITEM = MC_ASSETS_BASE + '/item';
const PATH_BLOCK = MC_ASSETS_BASE + '/block';
const FALLBACK_ICON = PATH_ITEM + '/barrier.png';
const LOCAL_ICON_BASE = '/mc-items';

function localIconPath(key){ return `${LOCAL_ICON_BASE}/${encodeURIComponent(key)}.png`; }
function itemIconPath(key){ return `${PATH_ITEM}/${encodeURIComponent(key)}.png`; }
function blockIconPath(key){ return `${PATH_BLOCK}/${encodeURIComponent(key)}.png`; }

function createIcon(item, size=48, enchanted=false){
  const wrap = document.createElement('div');
  wrap.className = 'item-icon' + (enchanted? ' enchanted':'');
  wrap.style.width = size+'px';
  wrap.style.height = size+'px';
  wrap.classList.add('loading');
  const img = document.createElement('img');
  img.loading = 'lazy'; img.decoding='async'; img.alt=item;
  wrap.appendChild(img);
  let overlay=null;
  if(enchanted){
    overlay = document.createElement('div');
    overlay.className = 'ench-overlay';
    wrap.appendChild(overlay);
  }
  const key = item.toLowerCase();
  const stages = [ localIconPath(key), itemIconPath(key), blockIconPath(key), FALLBACK_ICON ];
  let stageIndex = 0;
  function applyStage(){ img.src = stages[stageIndex]; }
  img.addEventListener('load', ()=>{
    wrap.classList.remove('loading');
    if(stageIndex===3){ img.style.opacity='.55'; }
    if(enchanted && overlay){
      const url = `url(${img.src})`;
      overlay.style.maskImage = url;
      overlay.style.webkitMaskImage = url;
      wrap.classList.add('masked');
    }
  });
  img.onerror = ()=>{
    if(stageIndex < stages.length - 1){
      stageIndex++;
      applyStage();
    } else {
      wrap.classList.remove('loading');
    }
  };
  applyStage();
  return wrap;
}

// --- Elementy DOM ---
const locationsEl = document.getElementById('khandel-locations');
const storesEl = document.getElementById('khandel-stores');
const productsEl = document.getElementById('khandel-products');
const emptyEl = document.getElementById('empty');
const langToggle = document.getElementById('lang-toggle');
const searchInput = document.getElementById('khandel-search');
const filterLocation = document.getElementById('khandel-filter-location');
const filterStore = document.getElementById('khandel-filter-store');
const clearFiltersBtn = document.getElementById('khandel-clear-filters');

// Helper: tworzy element notatek z przyciskiem „Pokaż więcej” jeśli długie
function createNotesElement(text){
  const MAX_CHARS = 180; // granica przed zwinięciem
  const wrap = document.createElement('div');
  wrap.className = 'notes-block';
  wrap.style.marginTop = '.45rem';
  wrap.style.fontSize = '.55rem';
  wrap.style.lineHeight = '1.35';
  wrap.style.whiteSpace = 'pre-wrap';
  wrap.style.opacity = '.85';
  const full = String(text);
  if(full.length <= MAX_CHARS){
    wrap.textContent = full;
    return wrap;
  }
  const short = full.slice(0,MAX_CHARS).replace(/\s+$/,'') + '…';
  const contentSpan = document.createElement('span');
  contentSpan.textContent = short;
  const btn = document.createElement('button');
  btn.type='button';
  btn.textContent='Pokaż więcej';
  btn.style.display='inline-block';
  btn.style.marginTop='.35rem';
  btn.style.fontSize='.55rem';
  btn.style.padding='.25rem .5rem';
  btn.style.background='#1a2632';
  btn.style.border='1px solid #26313d';
  btn.style.color='#e6edf3';
  btn.style.borderRadius='8px';
  btn.style.cursor='pointer';
  btn.style.fontWeight='600';
  let expanded = false;
  btn.addEventListener('click', ()=>{
    expanded = !expanded;
    contentSpan.textContent = expanded ? full : short;
    btn.textContent = expanded ? 'Pokaż mniej' : 'Pokaż więcej';
  });
  wrap.appendChild(contentSpan);
  wrap.appendChild(document.createElement('br'));
  wrap.appendChild(btn);
  return wrap;
}

// --- FILTRY I WYSZUKIWANIE ---
function updateLocationFilter() {
  const locations = getLocations(allProducts);
  filterLocation.innerHTML = '<option value="">Wszystkie lokalizacje</option>' +
    locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
}
function updateStoreFilter() {
  let stores = [];
  if (filterLocation.value) {
    stores = getStores(allProducts, filterLocation.value);
  } else {
    stores = [...new Set(allProducts.map(p => p.storeName).filter(Boolean))];
  }
  filterStore.innerHTML = '<option value="">Wszystkie sklepy</option>' +
    stores.map(st => `<option value="${st}">${st}</option>`).join('');
}

function renderFilteredProducts() {
  let filtered = allProducts;
  const loc = filterLocation.value;
  const store = filterStore.value;
  const query = (searchInput.value || '').toLowerCase();
  if (loc) filtered = filtered.filter(p => p.storeLocation === loc);
  if (store) filtered = filtered.filter(p => p.storeName === store);
  if (query) {
    filtered = filtered.filter(p => {
      const namePl = (p.productName || p.product?.name || '').toLowerCase();
      const nameEn = (p.productNameEn || p.product?.nameEn || '').toLowerCase();
      const notesTxt = (p.notes || '').toLowerCase();
      return namePl.includes(query) || nameEn.includes(query) || notesTxt.includes(query);
    });
  }
  productsEl.innerHTML = '';
  if (loc || store || query) {
    clearFiltersBtn.classList.add('active');
  } else {
    clearFiltersBtn.classList.remove('active');
  }
  if (!filtered.length) {
    productsEl.hidden = true;
    emptyEl.hidden = false;
    emptyEl.textContent = 'Brak ofert do wyświetlenia.';
    return;
  }
  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card fade-in';
    const row = document.createElement('div'); row.className='row';
    const icon = createIcon(p.product.item, 48, !!p.product.enchanted);
    row.appendChild(icon);
    const textBox = document.createElement('div');
    const title = document.createElement('h2'); title.className='title';
    const baseTitle = pickRootName(p) || (p.product?.item);
    title.textContent = baseTitle;
    const sub = document.createElement('p'); sub.className='subtitle';
    sub.textContent = (p.product.qty>1? ` ×${p.product.qty}`:'');
    textBox.appendChild(title); textBox.appendChild(sub);
    // Sklep + lokalizacja (dla widoku wyszukiwania/filtrów)
    if(p.storeName || p.storeLocation){
      const meta = document.createElement('div');
      meta.style.marginTop = '.25rem';
      meta.style.fontSize = '.55rem';
      meta.style.letterSpacing = '.4px';
      meta.style.fontWeight='600';
      meta.style.opacity='.9';
      meta.textContent = `${p.storeName || '—'}${p.storeLocation? ' @ '+p.storeLocation: ''}`;
      textBox.appendChild(meta);
    }
    if(p.storeOwner){
      const ownerLine = document.createElement('div');
      ownerLine.style.marginTop = '.25rem';
      const badge = document.createElement('span');
      badge.textContent = p.storeOwner;
      badge.style.display='inline-block';
      badge.style.fontSize='.55rem';
      badge.style.fontWeight='600';
      badge.style.letterSpacing='.4px';
      badge.style.padding='.25rem .55rem';
      badge.style.borderRadius='999px';
      badge.style.background='linear-gradient(135deg,#1f2a35,#16212b)';
      badge.style.border='1px solid #26313d';
      badge.style.boxShadow='0 2px 6px -2px rgba(0,0,0,.4)';
      badge.style.color='#e6edf3';
      ownerLine.appendChild(badge);
      textBox.appendChild(ownerLine);
    }
    if(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)){
      const x = p.x, y = p.y, z = p.z;
      const btn = document.createElement('button');
      btn.type='button';
      btn.textContent = `📍 ${x},${y},${z}`;
      btn.style.marginTop='.3rem';
      btn.style.fontSize='.55rem';
      btn.style.background='#1a2632';
      btn.style.border='1px solid #26313d';
      btn.style.color='#e6edf3';
      btn.style.padding='.35rem .55rem';
      btn.style.borderRadius='8px';
      btn.style.cursor='pointer';
      btn.style.fontWeight='600';
      btn.addEventListener('click', ()=>{
        const label = encodeURIComponent(p.storeName || 'Sklep');
        const url = `/map.html?focus=${x},${y},${z}&label=${label}`;
        window.open(url,'_blank','noopener');
      });
      textBox.appendChild(btn);
    }
    row.appendChild(textBox);
    card.appendChild(row);
    const priceHeading = document.createElement('div');
    priceHeading.textContent = currentLang==='en'? 'Price':'Cena';
    priceHeading.style.fontSize='.6rem';
    priceHeading.style.margin='0.5rem 0 .2rem';
    priceHeading.style.opacity='.85';
    priceHeading.style.letterSpacing='.5px';
    card.appendChild(priceHeading);
    const pricesBox = document.createElement('div'); pricesBox.className='prices';
    function addPrice(label, price){
      if(!price) return;
      const chip = document.createElement('div'); chip.className='price-chip';
      const ic = createIcon(price.item, 22, !!price.enchanted); chip.appendChild(ic);
      const span = document.createElement('span');
      const displayName = pickName(price, price.item);
      span.textContent = `${displayName} ×${price.qty}`;
      chip.title = displayName + ' ('+label+')';
      chip.appendChild(span);
      pricesBox.appendChild(chip);
    }
    addPrice('Cena 1', p.price1);
    addPrice('Cena 2', p.price2);
    card.appendChild(pricesBox);
    if(p.notes){ card.appendChild(createNotesElement(p.notes)); }
    productsEl.appendChild(card);
  });
  productsEl.hidden = false;
  emptyEl.hidden = true;
}

filterLocation.addEventListener('change', () => {
  updateStoreFilter();
  filterStore.value = '';
  renderFilteredProducts();
  locationsEl.hidden = true;
  storesEl.hidden = true;
});
filterStore.addEventListener('change', () => {
  renderFilteredProducts();
  locationsEl.hidden = true;
  storesEl.hidden = true;
});
searchInput.addEventListener('input', () => {
  renderFilteredProducts();
  locationsEl.hidden = true;
  storesEl.hidden = true;
});
clearFiltersBtn.addEventListener('click', () => {
  filterLocation.value = '';
  filterStore.value = '';
  searchInput.value = '';
  updateStoreFilter();
  selectedLocation = '';
  selectedStore = '';
  renderHierarchy();
});
const backBtn = document.getElementById('back-btn');
const currentHeader = document.getElementById('khandel-current');

let currentLang = (localStorage.getItem('khandelLang') || 'pl');
let allProducts = [];
let selectedLocation = '';
let selectedStore = '';
let searchQuery = '';

function updateLangBtn(){
  langToggle.textContent = currentLang === 'pl' ? 'PL 🇵🇱' : 'EN 🇬🇧';
}

if(langToggle){
  updateLangBtn();
  langToggle.addEventListener('click', ()=>{
    currentLang = currentLang === 'pl'? 'en':'pl';
    localStorage.setItem('khandelLang', currentLang);
    updateLangBtn();
    renderHierarchy();
  });
}


// Nadpisujemy renderHierarchy, by obsługiwać tylko nawigację po siatkach
function renderHierarchy(){
  renderBreadcrumb();
  // Siatki nawigacyjne (lokalizacje, sklepy) – tylko jeśli nie ma aktywnych filtrów/wyszukiwania
  const loc = filterLocation.value;
  const store = filterStore.value;
  const query = (searchInput.value || '').toLowerCase();
  if (loc || store || query) {
    locationsEl.hidden = true;
    storesEl.hidden = true;
    renderFilteredProducts();
    return;
  }
  if(!Array.isArray(allProducts) || allProducts.length === 0){
    locationsEl.innerHTML = '';
    locationsEl.hidden = false;
    storesEl.hidden = true;
    productsEl.hidden = true;
    emptyEl.hidden = false;
    emptyEl.textContent = 'Brak danych do wyświetlenia.';
    return;
  }
  // Siatka lokalizacji
  if(!selectedLocation){
    const locations = getLocations(allProducts);
    locationsEl.classList.add('khandel-grid');
    locationsEl.innerHTML = locations.map(loc => `<button class="form-item-btn khandel-grid-btn" data-loc="${loc}">${loc}</button>`).join('');
    locationsEl.hidden = false;
    storesEl.hidden = true;
    productsEl.hidden = true;
    emptyEl.hidden = true;
    locationsEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedLocation = btn.dataset.loc;
        selectedStore = '';
        renderHierarchy();
      });
    });
    return;
  }
  // Siatka sklepów
  if(!selectedStore){
    storesEl.classList.add('khandel-grid');
    const storesHere = getStores(allProducts, selectedLocation);
    storesEl.innerHTML = storesHere.map(st => {
      const offersCount = allProducts.filter(p => p.storeLocation === selectedLocation && p.storeName === st).length;
      return `<button class=\"form-item-btn khandel-grid-btn\" data-store=\"${st}\">${st} <span class=\"khandel-badge\">${offersCount}</span></button>`;
    }).join('');
    locationsEl.hidden = true;
    storesEl.hidden = false;
    productsEl.hidden = true;
    emptyEl.hidden = true;
    storesEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedStore = btn.dataset.store;
        renderHierarchy();
      });
    });
    return;
  }
  // Oferty sklepu
  let offers = allProducts.filter(p => p.storeLocation === selectedLocation && p.storeName === selectedStore);
  productsEl.innerHTML = '';
  if(!offers.length){
    productsEl.hidden = true;
    emptyEl.hidden = false;
    emptyEl.textContent = 'Brak ofert do wyświetlenia.';
    return;
  }
  offers.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card fade-in';
    const row = document.createElement('div'); row.className='row';
    const icon = createIcon(p.product.item, 48, !!p.product.enchanted);
    row.appendChild(icon);
    const textBox = document.createElement('div');
    const title = document.createElement('h2'); title.className='title';
    const baseTitle = pickRootName(p) || (p.product?.item);
    title.textContent = baseTitle;
    const sub = document.createElement('p'); sub.className='subtitle';
    sub.textContent = (p.product.qty>1? ` ×${p.product.qty}`:'');
    textBox.appendChild(title); textBox.appendChild(sub);
    if(p.storeOwner){
      const ownerLine = document.createElement('div');
      ownerLine.style.marginTop = '.25rem';
      const badge = document.createElement('span');
      badge.textContent = p.storeOwner;
      badge.style.display='inline-block';
      badge.style.fontSize='.55rem';
      badge.style.fontWeight='600';
      badge.style.letterSpacing='.4px';
      badge.style.padding='.25rem .55rem';
      badge.style.borderRadius='999px';
      badge.style.background='linear-gradient(135deg,#1f2a35,#16212b)';
      badge.style.border='1px solid #26313d';
      badge.style.boxShadow='0 2px 6px -2px rgba(0,0,0,.4)';
      badge.style.color='#e6edf3';
      ownerLine.appendChild(badge);
      textBox.appendChild(ownerLine);
    }
    if(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)){
      const x = p.x, y = p.y, z = p.z;
      const btn = document.createElement('button');
      btn.type='button';
      btn.textContent = `📍 ${x},${y},${z}`;
      btn.style.marginTop='.3rem';
      btn.style.fontSize='.55rem';
      btn.style.background='#1a2632';
      btn.style.border='1px solid #26313d';
      btn.style.color='#e6edf3';
      btn.style.padding='.35rem .55rem';
      btn.style.borderRadius='8px';
      btn.style.cursor='pointer';
      btn.style.fontWeight='600';
      btn.addEventListener('click', ()=>{
        const label = encodeURIComponent(selectedStore || p.storeName || 'Sklep');
        const url = `/map.html?focus=${x},${y},${z}&label=${label}`;
        window.open(url,'_blank','noopener');
      });
      textBox.appendChild(btn);
    }
    row.appendChild(textBox);
    card.appendChild(row);
    const priceHeading = document.createElement('div');
    priceHeading.textContent = currentLang==='en'? 'Price':'Cena';
    priceHeading.style.fontSize='.6rem';
    priceHeading.style.margin='0.5rem 0 .2rem';
    priceHeading.style.opacity='.85';
    priceHeading.style.letterSpacing='.5px';
    card.appendChild(priceHeading);
    const pricesBox = document.createElement('div'); pricesBox.className='prices';
    function addPrice(label, price){
      if(!price) return;
      const chip = document.createElement('div'); chip.className='price-chip';
      const ic = createIcon(price.item, 22, !!price.enchanted); chip.appendChild(ic);
      const span = document.createElement('span');
      const displayName = pickName(price, price.item);
      span.textContent = `${displayName} ×${price.qty}`;
      chip.title = displayName + ' ('+label+')';
      chip.appendChild(span);
      pricesBox.appendChild(chip);
    }
    addPrice('Cena 1', p.price1);
    addPrice('Cena 2', p.price2);
    card.appendChild(pricesBox);
    if(p.notes){ card.appendChild(createNotesElement(p.notes)); }
    productsEl.appendChild(card);
  });
  locationsEl.hidden = true;
  storesEl.hidden = true;
  productsEl.hidden = false;
  emptyEl.hidden = true;
}


async function load(){
  try {
    const list = await window.__db.fetchJson('data/khandel-products.json');
    allProducts = Array.isArray(list)? list: [];
    updateLocationFilter();
    updateStoreFilter();
    renderHierarchy();
  } catch(e){
    emptyEl.hidden = false; emptyEl.textContent = 'Błąd ładowania produktów: '+e.message;
  }
}

load();
