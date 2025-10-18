console.log('[map] script start');
const imgEl = document.getElementById('map-image');
const canvas = document.getElementById('map-canvas');
const viewport = document.getElementById('map-viewport');
const markersLayer = document.getElementById('markers-layer');
const linesCanvas = document.getElementById('lines-layer');
const linesCtx = linesCanvas ? linesCanvas.getContext('2d') : null;
const loadingEl = document.getElementById('loading');
const panel = document.getElementById('point-panel');
const panelContent = document.getElementById('point-content');
const closePanelBtn = document.getElementById('close-panel');
const pinPanelBtn = document.getElementById('pin-panel');
const legendEl = document.getElementById('legend');
const filtersPanelEl = document.getElementById('filters-panel');
// Dynamiczny wskaźnik koordynatów kursora (desktop)
let legendCursorEl = null;
let legendCursorRowEl = null;
const searchInput = document.getElementById('point-search');
const pointResultsEl = document.getElementById('point-search-results');
const pointDetailEl = document.getElementById('point-search-detail');
const pointSearchClearBtn = document.getElementById('point-search-clear');
// Nowa legenda linii (prawy dolny róg)
const linesLegendEl = document.getElementById('lines-legend');
const linesLegendBodyEl = document.getElementById('lines-legend-body');
const linesLegendToggleBtn = document.getElementById('lines-legend-toggle');
const linesLegendStatusEl = document.getElementById('lines-legend-status');
// Mobile filters toggle
const filtersToggleBtn = document.getElementById('btn-filters');
const searchBubble = document.getElementById('search-bubble');
const toolbarEl = document.querySelector('.map-toolbar');
// Logo/brand (przenoszone nad wyszukiwarkę na mobile)
const brandEl = document.getElementById('map-brand');
const appRoot = document.getElementById('map-app');
const isAdminView = document.body?.querySelector('.panel') ? true : false;

const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const btnTheme = document.getElementById('btn-theme');
const btnCopyFocus = document.getElementById('btn-copy-focus');
// Tryb mapy
const modeButtons = document.querySelectorAll('.mode-btn');
let currentMode = 'general'; // 'general' | 'transport'

let mapData = null;
let linesData = null;
let scale = 1; // current zoom scale
let minScale = 0.25;
let maxScale = 4;
let originX = 0; // top-left of canvas in viewport coords
let originY = 0;
let imgWidth = 0;
let imgHeight = 0;
let baseLogicalWidth = 0; // zapamiętana logika 1x
let baseLogicalHeight = 0;
let currentResolutionFactor = 1; // 1 / 2 / 4
let tilesLayer = null; // kontener na kafelki hi-res
let tiles = new Map(); // klucz => element
const TILE_CONFIG = {
  2: { grid:3 },
  4: { grid:5 }
};
// Gating ukrycia obrazu bazowego do czasu załadowania pierwszego kafelka hi-res
let awaitingFirstHiResTile = false;
// Ścieżki do bazowych obrazów i katalogów kafelków (umożliwia przeniesienie grafik do podfolderów)
const MAP_PATHS = {
  baseLight: '/map/base/map_light.webp',
  baseDark: '/map/base/map_dark.webp',
  baseLight2x: '/map/base/map_light@2x.webp',
  baseDark2x: '/map/base/map_dark@2x.webp',
  baseLight4x: '/map/base/map_light@4x.webp',
  baseDark4x: '/map/base/map_dark@4x.webp',
  tiles2xLightDir: '/map/tiles2x/light',
  tiles2xDarkDir: '/map/tiles2x/dark',
  tiles4xLightDir: '/map/tiles4x/light',
  tiles4xDarkDir: '/map/tiles4x/dark'
};
let isPanning = false;
let panStart = { x:0, y:0 };
let panOriginStart = { x:0, y:0 };
// Pinch-to-zoom (mobile)
const pointers = new Map(); // id -> {x,y}
let pinchActive = false;
let lastPinchCenter = null; // {x,y} w współrzędnych klienta (viewport)
let lastPinchDistance = 0;
let currentTheme = 'auto'; // auto|light|dark (auto -> wg preferencji systemu)
let activeCategories = new Set(); // puste = wszystkie
let showHidden = false; // zwykła mapa: ukryte nie są pokazywane
// Jeżeli jesteśmy w panelu admina (obecność .admin-shell), pokaż też ukryte
if (document.querySelector('.admin-shell')) {
  showHidden = true;
}
const isAdmin = !!document.querySelector('.admin-shell');
// Dwa rozdzielne przełączniki widoczności linii: kolej/metro vs lotnicze
let showRailLines = false;
let showFlightLines = false;
let showLines = false; // pochodna (zachowana dla wstecznej kompatybilności)
// Zbiór ukrytych kategorii linii (IC/REGIO/METRO/ON). Pusty = wszystkie widoczne (gdy showLines=true)
let hiddenLineCategories = new Set();
// Flaga: czy udało się wczytać stan legendy z localStorage
let hasLoadedLegendState = false;
// Podświetlana/aktywna linia (id) – do dynamicznej grubszej kreski
let highlightedLineId = null; // chwilowe (hover)
let selectedLineId = null; // trwałe (klik)
// Map<lineId, {stations: string[]}> – stacje w kolejności przejazdu dla podświetlenia trasy (każda noga)
let routeHighlightedSegments = null;
let routeAnimationActive = false;
let routeAnimFrame = null;
let routeEndpoints = null; // { start:{id,x,y}, end:{id,x,y} }
let lastRouteBBoxKey = null; // zapobieganie wielokrotnemu fokuso-zoom przy tej samej trasie

function ensureRouteAnimation(){
  if(!routeHighlightedSegments){ routeAnimationActive = false; if(routeAnimFrame){ cancelAnimationFrame(routeAnimFrame); routeAnimFrame=null; } return; }
  if(routeAnimationActive) return;
  routeAnimationActive = true;
  const loop = ()=>{
    if(!routeHighlightedSegments){ routeAnimationActive=false; routeAnimFrame=null; return; }
    // Redraw tylko warstwę linii (pełny drawLines – proste, mała skala danych). Można optymalizować.
    drawLines(true);
    routeAnimFrame = requestAnimationFrame(loop);
  };
  routeAnimFrame = requestAnimationFrame(loop);
}
// Zapamiętany stan widoczności linii z trybu ogólnego (aby po powrocie przywrócić to, co użytkownik ustawił)
let lastGeneralShowLines = false; // legacy (zachowane dla wstecznej kompatybilności)
let lastGeneralShowRailLines = false;
let lastGeneralShowFlightLines = false;
// Flaga wymuszająca niską rozdzielczość rysowania (np. na mobile) – ustawiana później przy detekcji urządzenia
let __MOBILE_LITE_FORCE_DPR1 = false;

// --- Klastrowanie punktów ---
// Przy mniejszym powiększeniu wiele punktów nachodzi na siebie – grupujemy je.
// Prosty algorytm O(n^2) wystarczający dla kilkuset punktów (można później zopt. siatką).
// (tuning) większy próg zoom -> klastruj częściej oraz większy promień łączenia
const CLUSTER_ZOOM_THRESHOLD = 1.2; // poniżej tego scale aktywuj klastrowanie (wcześniej 0.9)
const CLUSTER_SCREEN_DISTANCE = 52; // odległość w px przy scale=1 (wcześniej 34) – większy zasięg łączenia
let suppressClustering = false; // tymczasowe wyłączenie (np. aktywne wyszukiwanie)
let lastClusteringActive = false;
let lastScaleForClusterEval = scale;
let clusterPopoverEl = null; // aktualnie otwarty popover listy punktów w klastrze

// Snapshot poprzedniego stanu dla animacji
let previousClusterSnapshot = {
  clusters: new Map(), // key -> { cx, cy, count, members:Set }
  pointToCluster: new Map(), // pointId -> { cx, cy }
  clusterKeys: new Set()
};

function closeClusterPopover(){
  if(clusterPopoverEl && clusterPopoverEl.isConnected){ clusterPopoverEl.remove(); }
  clusterPopoverEl = null;
}

function clusteringCurrentlyEnabled(){
  return !suppressClustering && scale < CLUSTER_ZOOM_THRESHOLD;
}

function maybeUpdateClusters(){
  // Aby nie przebudowywać nadmiernie – sprawdzaj tylko jeśli zmiana scale przekroczy 2% lub stan logiczny się zmienił
  const active = clusteringCurrentlyEnabled();
  const scaleDelta = Math.abs(scale - lastScaleForClusterEval);
  if(active !== lastClusteringActive || scaleDelta > 0.02){
    lastScaleForClusterEval = scale;
    if(active !== lastClusteringActive){
      lastClusteringActive = active;
      buildMarkers();
    } else if(active){
      // przy aktywnym klastrowaniu aktualizuj pozycje (pełna odbudowa – prościej)
      buildMarkers();
    }
  }
}

// Persistencja ustawień (localStorage)
function saveLegendState(){
  try {
    localStorage.setItem('map.legend.pointHidden', JSON.stringify(Array.from(activeCategories)));
    localStorage.setItem('map.legend.lineHidden', JSON.stringify(Array.from(hiddenLineCategories)));
    // Nowe klucze
    localStorage.setItem('map.legend.showRailLines', JSON.stringify(!!showRailLines));
    localStorage.setItem('map.legend.showFlightLines', JSON.stringify(!!showFlightLines));
    localStorage.setItem('map.legend.generalShowRailLines', JSON.stringify(!!lastGeneralShowRailLines));
    localStorage.setItem('map.legend.generalShowFlightLines', JSON.stringify(!!lastGeneralShowFlightLines));
    // Back-compat – zapis scalonego stanu
    localStorage.setItem('map.legend.showLines', JSON.stringify(!!(showRailLines || showFlightLines)));
    localStorage.setItem('map.legend.generalShowLines', JSON.stringify(!!(lastGeneralShowRailLines || lastGeneralShowFlightLines)));
    if(linesLegendEl){
      localStorage.setItem('map.legend.linesLegendCollapsed', JSON.stringify(linesLegendEl.classList.contains('collapsed')));
    }
  } catch(_) {}
}

function loadLegendState(){
  let found = false;
  try {
    const ph = localStorage.getItem('map.legend.pointHidden');
    if(ph !== null){
      const arr = JSON.parse(ph); if(Array.isArray(arr)) { activeCategories = new Set(arr); found = true; }
    }
    const lh = localStorage.getItem('map.legend.lineHidden');
    if(lh !== null){
      const arr = JSON.parse(lh); if(Array.isArray(arr)) { hiddenLineCategories = new Set(arr); found = true; }
    }
    // Nowe przełączniki
    const srl = localStorage.getItem('map.legend.showRailLines');
    const sfl = localStorage.getItem('map.legend.showFlightLines');
    if(srl !== null){ showRailLines = !!JSON.parse(srl); found = true; }
    if(sfl !== null){ showFlightLines = !!JSON.parse(sfl); found = true; }
    // Back-compat: stary scalony klucz
    if(srl === null && sfl === null){
      const sl = localStorage.getItem('map.legend.showLines');
      if(sl !== null){ const v = !!JSON.parse(sl); showRailLines = v; showFlightLines = v; found = true; }
    }
    // General-mode zapamiętanie
    const gsrl = localStorage.getItem('map.legend.generalShowRailLines');
    const gsfl = localStorage.getItem('map.legend.generalShowFlightLines');
    if(gsrl !== null){ lastGeneralShowRailLines = !!JSON.parse(gsrl); found = true; }
    if(gsfl !== null){ lastGeneralShowFlightLines = !!JSON.parse(gsfl); found = true; }
    if(gsrl === null && gsfl === null){
      const gsl = localStorage.getItem('map.legend.generalShowLines');
      if(gsl !== null){ const v = !!JSON.parse(gsl); lastGeneralShowRailLines = v; lastGeneralShowFlightLines = v; found = true; }
    }
    // Stare klucze dla kompatybilności (nie wymagane, ale zachowane w pamięci lokalnej)
    const slLegacy = localStorage.getItem('map.legend.showLines');
    if(slLegacy !== null){ showLines = !!JSON.parse(slLegacy); }
    const gslLegacy = localStorage.getItem('map.legend.generalShowLines');
    if(gslLegacy !== null){ lastGeneralShowLines = !!JSON.parse(gslLegacy); }
    // Przywróć stan rozwinięcia legendy linii
    const lc = localStorage.getItem('map.legend.linesLegendCollapsed');
    if(lc !== null && linesLegendEl){
      const collapsed = !!JSON.parse(lc);
      linesLegendEl.classList.toggle('collapsed', collapsed);
      if(linesLegendToggleBtn){ linesLegendToggleBtn.setAttribute('aria-expanded', (!collapsed).toString()); }
      if(linesLegendBodyEl){ linesLegendBodyEl.hidden = collapsed; }
    }
  } catch(_) {}
  hasLoadedLegendState = found;
  // Ustal pochodną scaloną
  showLines = !!(showRailLines || showFlightLines);
}

// Konfiguracja domyślna widoczności kategorii:
// W trybie ogólnym mają być widoczne tylko duże miejscowości (miasto_duze) + ewentualny spawn (miasto) + inne kategorie infrastruktury jeśli zostaną włączone.
// Dlatego przy pierwszym załadowaniu (gdy brak stanu w localStorage) ukrywamy: miasto_male, kolej, metro, infrastruktura (opcjonalnie), players (opcjonalnie).
// Zostawiamy odsłonięte: miasto_duze, miasto.
function applyInitialCategoryVisibility(){
  if(hasLoadedLegendState) return; // użytkownik ma już swój stan – nic nie zmieniamy
  // Domyślnie chcemy ukryć małe miejscowości i transport
  activeCategories.add('miasto_male');
  activeCategories.add('kolej');
  activeCategories.add('metro');
  activeCategories.add('airport');
  // Dodatkowo ukrywamy infrastrukturę i graczy na starcie (zgodnie z wymaganiem)
  activeCategories.add('infrastruktura');
  activeCategories.add('players');
}

function saveThemeState(){ try { localStorage.setItem('map.theme', currentTheme); } catch(_){} }
function loadThemeState(){
  try {
    const t = localStorage.getItem('map.theme');
    if(t === 'light' || t === 'dark' || t === 'auto'){ currentTheme = t; }
  } catch(_){}
}

function pickTheme(){
  if(currentTheme === 'light' || currentTheme === 'dark') return currentTheme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light':'dark';
}

function updateImageSource(){
  const t = pickTheme();
  // Po migracji wszystkie pliki znajdują się w nowej strukturze katalogów – fallback legacy usunięty.
  let src;
  // Celowo zawsze używamy bazowego obrazu 1x – hi-res realizują kafelki.
  // (Pliki @2x/@4x mogą nie istnieć, więc nie podmieniamy src na nie)
  src = t === 'light' ? MAP_PATHS.baseLight : MAP_PATHS.baseDark;
  if(imgEl.getAttribute('src') !== src){ imgEl.src = src; }
}

function setScale(next, screenX, screenY){
  const clamped = Math.min(maxScale, Math.max(minScale, next));
  if(clamped === scale) return;
  // screenX/screenY są w układzie viewportu (ekran), więc przeliczymy przesunięcie originu w tym układzie.
  const factor = clamped / scale;
  originX = screenX - (screenX - originX) * factor;
  originY = screenY - (screenY - originY) * factor;
  scale = clamped;
  applyTransform();
}

function applyTransform(){
  canvas.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
  // UI markerów ma być stałej wielkości — kompensujemy zoomem odwrotnym
  const uiScale = (1/scale).toFixed(5);
  markersLayer.style.setProperty('--ui-scale', uiScale);
  // Zneutralizuj skalowanie dla warstwy linii (rysujemy w przestrzeni ekranu dla ostrości)
  if(linesCanvas){
    // Parent transform: translate(originX, originY) scale(scale)
    // Child inverse: scale(1/scale) translate(-originX, -originY) => net identity
    linesCanvas.style.transformOrigin = '0 0';
    linesCanvas.style.transform = `scale(${1/scale}) translate(${-originX}px, ${-originY}px)`;
  }
  // Odśwież rysunek linii po zmianie skali/pan
  drawLines();
  maybeUpgradeToHiRes();
  updateVisibleTiles();
  if(__lastPointerPos){ updateCursorCoords(__lastPointerPos.x, __lastPointerPos.y); }
}
// Progi dla podbijania rozdzielczości (wartość scale*dpr)
const HI_RES_THRESHOLD_2X = 1.15;
const HI_RES_THRESHOLD_4X = 2.3; // uzysk 4x dopiero przy większym przybliżeniu

function desiredResolutionForZoom(prod){
  if(prod >= HI_RES_THRESHOLD_4X) return 4;
  if(prod >= HI_RES_THRESHOLD_2X) return 2;
  return 1;
}

function maybeUpgradeToHiRes(){
  // Dostosowanie rozdzielczości kafelków na podstawie zoom*dpr – bez wymagania bazowych plików @2x/@4x.
  const dpr = window.devicePixelRatio || 1;
  const prod = scale * dpr;
  const desired = desiredResolutionForZoom(prod);
  // Mobile lite: pomijamy hi-res w całości
  if(mobileLiteMode){
    if(currentResolutionFactor !== 1){
      currentResolutionFactor = 1;
      clearTiles();
      canvas.classList.remove('hires-on');
      awaitingFirstHiResTile = false;
      updateImageSource();
    }
    return;
  }
  if(desired === currentResolutionFactor) return;
  // Downgrade lub upgrade
  if(desired <= 1){
    currentResolutionFactor = 1;
    clearTiles();
    canvas.classList.remove('hires-on');
    awaitingFirstHiResTile = false;
    updateImageSource();
    return;
  }
  // desired jest 2 lub 4 – przełącz na kafelki hi-res
  currentResolutionFactor = desired;
  updateImageSource(); // utrzymaj bazę 1x (tylko zmiana motywu)
  imgEl.style.width = baseLogicalWidth + 'px';
  imgEl.style.height = baseLogicalHeight + 'px';
  ensureTilesContainer();
  // Poczekaj z ukryciem base do czasu załadowania pierwszego widocznego kafelka
  canvas.classList.remove('hires-on');
  awaitingFirstHiResTile = true;
  buildTilesForCurrentLevel();
  updateVisibleTiles();
}

function centerOnSpawn(){
// Po zakończeniu inicjalizacji (ładowanie danych punktów) spróbuj wycentrować na focus
// W pliku istnieje logika ładowania – dopniemy hook po globalnym fetchu mapy.
// Szukamy miejsca gdzie mapData jest ustawiane – użyjemy prostego interwału jako fallback.
setTimeout(()=> centerOnFocusParam(), 600);
  const spawn = mapData?.points?.find(p=> p.id === 'spawn');
  if(!spawn) return;
  const meta = mapData.meta || {};
  const unitsPerPixel = meta.unitsPerPixel || 4;
  const originMode = meta.origin || 'top-left';
  let spawnPxX, spawnPxY;
  const spawnLogicY = (spawn.z !== undefined ? spawn.z : spawn.y) || 0;
  if(originMode === 'center'){
    spawnPxX = (imgWidth/2) + (spawn.x / unitsPerPixel);
    spawnPxY = (imgHeight/2) + (spawnLogicY / unitsPerPixel);
  } else {
    spawnPxX = spawn.x; spawnPxY = spawnLogicY;
  }
  const cx = -spawnPxX + viewport.clientWidth/2;
  const cy = -spawnPxY + viewport.clientHeight/2;
  originX = cx * scale;
  originY = cy * scale;
  applyTransform();
}

// Center na współrzędnych z parametru URL ?focus=x,y,z (logiczne współrzędne świata)
function centerOnFocusParam(){
  try {
    const usp = new URLSearchParams(location.search);
    const f = usp.get('focus');
    if(!f) return;
    // Obsługa focus=x,y,z oraz focus=x,z (2 lub 3 liczby). Traktujemy ostatnią wartość jako Z.
    const parts = f.split(',').map(s=> s.trim()).filter(Boolean);
    if(parts.length !== 2 && parts.length !== 3) return;
    const x = Number(parts[0]);
    const z = Number(parts[parts.length-1]);
    if(!isFinite(x) || !isFinite(z)) return;
    // Jeśli mapa nie gotowa – ponów później
    if(!mapData || !imgWidth || !imgHeight){
      const retry = ()=>{ if(mapData && imgWidth && imgHeight){ centerOnFocusParam(); } else { setTimeout(retry, 150); } };
      setTimeout(retry, 150); return;
    }
    // Skorzystaj z istniejącej funkcji – centrowanie + tymczasowy marker (pulse)
    ensurePlayersLayerVisible();
  const label = usp.get('fl') || usp.get('label') || 'Cel';
    focusLogicalPoint(x, z, { pulse:true, label });
  } catch(_){ }
}

// Konwersja współrzędnych ekranu (wewnątrz viewportu) na współrzędne logiczne świata (X,Z)
function screenToLogical(sX, sY){
  const mapPxX = (sX - originX) / scale;
  const mapPxY = (sY - originY) / scale;
  const meta = mapData?.meta || {}; const units = meta.unitsPerPixel || 4; const originMode = meta.origin || 'top-left';
  if(originMode === 'center'){
    return { x: (mapPxX - imgWidth/2) * units, z: (mapPxY - imgHeight/2) * units };
  }
  return { x: mapPxX, z: mapPxY };
}

// Aktualizacja wskaźnika koordynatów (desktop)
let __lastPointerPos = null; // w układzie viewportu
function updateCursorCoords(clientX, clientY){
  if(!legendCursorEl || !viewport) return;
  const rect = viewport.getBoundingClientRect();
  const sX = clientX - rect.left; const sY = clientY - rect.top;
  if(sX < 0 || sY < 0 || sX > rect.width || sY > rect.height){ legendCursorEl.textContent = '—'; return; }
  const {x,z} = screenToLogical(sX, sY);
  const rx = Math.round(x); const rz = Math.round(z);
  legendCursorEl.textContent = `${rx}, ${rz}`;
}

function buildLegend(){
  if(!legendEl) return; // w panelu admina legenda może być ukryta lub nie istnieć
  legendEl.innerHTML = '';
  if(!mapData?.categories) return;
  // Domyślne ukrycie kategorii transportowych zostało wymuszone przy ładowaniu i przy zmianie trybu.
  // --- PUNKTY (inne niż kolej/metro) NA GÓRZE ---
  const transportCatKeys = ['kolej','metro','airport'];
  const headingPoints = document.createElement('div'); headingPoints.className='legend-heading'; headingPoints.textContent='PUNKTY'; legendEl.appendChild(headingPoints);
  Object.entries(mapData.categories).forEach(([key,val])=>{
    if(transportCatKeys.includes(key)) return; // pomiń transport tutaj
    const div = document.createElement('label');
    div.className = 'legend-item';
    const dot = document.createElement('span'); dot.className='legend-dot'; dot.style.background = val.color || '#888';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.style.marginRight='.35rem';
    cb.checked = !activeCategories.has(key);
    cb.addEventListener('change', ()=>{
      if(cb.checked) activeCategories.delete(key); else activeCategories.add(key);
      saveLegendState();
      buildMarkers(); drawLines(); buildLinesLegend();
    });
    div.appendChild(cb);
    div.appendChild(dot);
    const lab = document.createElement('span'); lab.className='legend-label'; lab.textContent = val.label || key; div.appendChild(lab);
    legendEl.appendChild(div);
  });
  // Separator między punktami a sekcją transportową
  const sepTop = document.createElement('div'); sepTop.className='legend-sep'; legendEl.appendChild(sepTop);

  // --- TRANSPORT / LINIE ---
  const headingTransport = document.createElement('div'); headingTransport.className='legend-heading'; headingTransport.textContent='TRANSPORT'; legendEl.appendChild(headingTransport);
  // Dwa niezależne przełączniki widoczności linii
  const mkToggle = (label, color, getter, setter)=>{
    const el = document.createElement('label'); el.className='legend-item';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = getter(); cb.style.marginRight='.35rem';
    cb.addEventListener('change', ()=>{ setter(cb.checked); showLines = !!(showRailLines || showFlightLines); saveLegendState(); drawLines(); buildLegend(); buildLinesLegend(); });
    const dot = document.createElement('span'); dot.className='legend-dot'; dot.style.background = color;
    const lab = document.createElement('span'); lab.className='legend-label'; lab.textContent = label;
    el.appendChild(cb); el.appendChild(dot); el.appendChild(lab);
    legendEl.appendChild(el);
  };
  mkToggle('Linie kolej/metro', '#888', ()=> showRailLines, (v)=>{ showRailLines = v; });
  mkToggle('Linie lotnicze', '#38bdf8', ()=> showFlightLines, (v)=>{ showFlightLines = v; });

  // Przełączniki kategorii stacji transportowych (Kolej/Metro) – razem z sekcją transportu
  transportCatKeys.forEach(key => {
    const cat = mapData.categories?.[key];
    if(!cat) return;
    // W trybie general: traktuj te kategorie jako filtrowalne tylko jeśli użytkownik ręcznie włączy.
    const row = document.createElement('label');
    row.className = 'legend-item';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.style.marginRight='.35rem';
    cb.checked = !activeCategories.has(key);
    cb.addEventListener('change', ()=>{
      if(cb.checked) activeCategories.delete(key); else activeCategories.add(key);
      saveLegendState();
      buildMarkers(); drawLines(); buildLinesLegend();
    });
    const dot = document.createElement('span'); dot.className='legend-dot'; dot.style.background = cat.color || '#10b981';
    row.appendChild(cb);
    row.appendChild(dot);
    const lab = document.createElement('span'); lab.className='legend-label'; lab.textContent = cat.label || key; row.appendChild(lab);
    legendEl.appendChild(row);
  });

  // Jeśli mamy dane o kategoriach linii i którykolwiek toggle jest włączony – dodaj przełączniki kategorii linii
  if ((showRailLines || showFlightLines) && window && typeof linesData === 'object' && linesData && linesData.categories) {
    const headingLinesCats = document.createElement('div'); headingLinesCats.className='legend-heading'; headingLinesCats.textContent='TYPY LINII'; legendEl.appendChild(headingLinesCats);
    Object.entries(linesData.categories).forEach(([k, v]) => {
      const isFlight = /FLIGHT|AIR|LOT/i.test(k);
      if(isFlight && !showFlightLines) return;
      if(!isFlight && !showRailLines) return;
      const row = document.createElement('label');
      row.className = 'legend-item';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.style.marginRight='.35rem';
      cb.checked = !hiddenLineCategories.has(k);
      cb.addEventListener('change', ()=>{
        if(cb.checked) hiddenLineCategories.delete(k); else hiddenLineCategories.add(k);
        saveLegendState();
        drawLines(); buildLinesLegend();
      });
      const dot = document.createElement('span'); dot.className='legend-dot'; dot.style.background = v.color || '#888';
      row.appendChild(cb);
      row.appendChild(dot);
      const displayLabel = (k === 'ON') ? 'NŻ' : (v.label || k);
      const lab = document.createElement('span'); lab.className='legend-label'; lab.textContent = displayLabel; row.appendChild(lab);
      legendEl.appendChild(row);
    });
  }

  // (Sekcja punktów już wyrenderowana wyżej)
  // Wskaźnik koordynatów kursora (desktop only) – pod legendą
  renderLegendCursor();
}

function renderLegendCursor(){
  // Usuń poprzedni wiersz
  if(legendCursorRowEl && legendCursorRowEl.parentElement){ legendCursorRowEl.parentElement.removeChild(legendCursorRowEl); }
  legendCursorRowEl = null; legendCursorEl = null;
  try {
    const isDesktop = (navigator.maxTouchPoints||0) === 0 && window.matchMedia('(pointer: fine)').matches;
    if(!isDesktop || !filtersPanelEl || !legendEl) return;
    const row = document.createElement('div');
    row.className = 'legend-coords';
    row.style.cssText = 'margin-top:.5rem;font-size:.62rem;opacity:.95;display:flex;gap:.4rem;align-items:center;';
    // dekoracyjna kropka
    const dot = document.createElement('span'); dot.className='legend-dot'; dot.style.background = '#64748b';
    const label = document.createElement('span'); label.textContent = 'Kursor:'; label.style.minWidth = '52px';
    const val = document.createElement('span'); val.textContent = '—'; val.style.fontWeight='700'; val.style.letterSpacing='.2px';
    row.appendChild(dot); row.appendChild(label); row.appendChild(val);
    // wstaw tuż pod legendą
    if(legendEl.nextSibling){ filtersPanelEl.insertBefore(row, legendEl.nextSibling); } else { filtersPanelEl.appendChild(row); }
    legendCursorRowEl = row; legendCursorEl = val;
  } catch(_) { legendCursorEl = null; legendCursorRowEl = null; }
}

function buildMarkers(){
  closeClusterPopover();
  markersLayer.innerHTML = '';
  if(!mapData?.points) return;
  const meta = mapData.meta || {};
  const unitsPerPixel = meta.unitsPerPixel || 4; // 1px = X metrów
  const originMode = meta.origin || 'top-left';
  if(originMode === 'center' && (!imgWidth || !imgHeight)){
    // Nie pozycjonujemy dopóki nie mamy wymiarów
    return;
  }
  // --- Filtruj punkty wg legendy ---
  const visiblePoints = mapData.points.filter(pt => {
    if(pt.hidden && !showHidden) return false;
    if(activeCategories.size>0 && activeCategories.has(pt.category)) return false;
    return true;
  });

  // Oblicz pozycje pikselowe (map space) + pozycje ekranowe do klastrowania
  const enriched = visiblePoints.map(pt => {
    const logicY = (pt.z !== undefined ? pt.z : pt.y) || 0;
    let pxX, pxY;
    if(originMode === 'center'){
      pxX = (imgWidth/2) + (pt.x / unitsPerPixel);
      pxY = (imgHeight/2) + (logicY / unitsPerPixel);
    } else { pxX = pt.x; pxY = logicY; }
    const screenX = originX + pxX * scale;
    const screenY = originY + pxY * scale;
    return { pt, pxX, pxY, screenX, screenY };
  });

  // Przygotuj dane poprzednie (do animacji) – pobieramy referencję, z której będziemy korzystać po renderze
  const prev = previousClusterSnapshot;

  // Zbierz listę wcześniejszych klastrów (do ewentualnego ghost fade-out przy rozpadzie)
  const prevClusterKeys = new Set(prev.clusterKeys);
  const prevClustersMap = prev.clusters; // key -> {cx,cy,count}

  // Nowa struktura pod snapshot
  const nextSnapshot = {
    clusters: new Map(),
    pointToCluster: new Map(),
    clusterKeys: new Set()
  };

  const newClusterDescriptors = []; // do animacji klastrów
  const newSingles = []; // {pt, pxX, pxY, el}

  if(clusteringCurrentlyEnabled()){
    const clusters = [];
    const taken = new Set();
    const dist = CLUSTER_SCREEN_DISTANCE; // w px przy scale=1
    const threshold = dist; // działamy w screen px już przeskalowanych
    for(let i=0;i<enriched.length;i++){
      if(taken.has(i)) continue;
      const a = enriched[i];
      const groupIdx = [i];
      for(let j=i+1;j<enriched.length;j++){
        if(taken.has(j)) continue;
        const b = enriched[j];
        const dx = a.screenX - b.screenX; const dy = a.screenY - b.screenY;
        if(dx*dx + dy*dy <= threshold*threshold){
          groupIdx.push(j); taken.add(j);
        }
      }
      taken.add(i);
      const members = groupIdx.map(k => enriched[k]);
      // centroid w przestrzeni mapy (px przed skalą) – średnia
      const cx = members.reduce((s,m)=>s+m.pxX,0)/members.length;
      const cy = members.reduce((s,m)=>s+m.pxY,0)/members.length;
      clusters.push({ members, cx, cy });
    }
    // Render klastrów
    clusters.forEach(cl => {
      if(cl.members.length === 1){
        const m = cl.members[0];
        const el = renderSingleMarker(m.pt, m.pxX, m.pxY);
        newSingles.push({ pt:m.pt, pxX:m.pxX, pxY:m.pxY, el });
      } else {
        // zbuduj klucz klastra – sortowane id
        const key = cl.members.map(m=>m.pt.id).sort().join('|');
        const el = renderClusterMarker(cl, key);
        newClusterDescriptors.push({ key, cl, el });
        nextSnapshot.clusters.set(key, { cx:cl.cx, cy:cl.cy, count:cl.members.length, members: new Set(cl.members.map(m=>m.pt.id)) });
        nextSnapshot.clusterKeys.add(key);
        cl.members.forEach(m=> nextSnapshot.pointToCluster.set(m.pt.id, { cx:cl.cx, cy:cl.cy }));
      }
    });
  } else {
    // Brak klastrowania – zwykłe markery
    enriched.forEach(m => {
      const el = renderSingleMarker(m.pt, m.pxX, m.pxY);
      newSingles.push({ pt:m.pt, pxX:m.pxX, pxY:m.pxY, el });
    });
  }

  // --- Animacje ---
  // 1. Split: nowy single mający poprzednio klaster -> animacja rozchodzenia
  newSingles.forEach(ns => {
    const prevCluster = prev.pointToCluster.get(ns.pt.id);
    if(prevCluster){
      const dx = prevCluster.cx - ns.pxX;
      const dy = prevCluster.cy - ns.pxY;
      ns.el.classList.add('split-from');
      ns.el.style.setProperty('--from-dx', dx+'px');
      ns.el.style.setProperty('--from-dy', dy+'px');
    }
  });
  // 2. Merge: nowy klaster, którego klucz nie występował wcześniej -> animacja scalania
  newClusterDescriptors.forEach(desc => {
    if(!prevClusterKeys.has(desc.key)){
      desc.el.classList.add('merge-from');
    }
  });
  // 3. Disappear: klastery poprzednie, których już nie ma – ghost fade-out
  prevClusterKeys.forEach(key => {
    if(!nextSnapshot.clusterKeys.has(key)){
      const info = prevClustersMap.get(key);
      if(!info) return;
      const ghost = document.createElement('div');
      ghost.className = 'marker cluster-marker cluster-ghost cluster-disappear';
      ghost.style.left = info.cx + 'px';
      ghost.style.top = info.cy + 'px';
      const btn = document.createElement('button');
      btn.className = 'marker-btn cluster-btn';
      const count = info.count || (info.members ? info.members.size : 0) || 1;
      btn.textContent = count > 99 ? '99+' : String(count);
      ghost.appendChild(btn);
      markersLayer.appendChild(ghost);
      setTimeout(()=> ghost.remove(), 420); // po animacji usuń
    }
  });

  // Zaktualizuj snapshot na przyszłe przebudowy
  previousClusterSnapshot = nextSnapshot;
}

function renderSingleMarker(pt, pxX, pxY){
  const wrap = document.createElement('div');
  wrap.className = 'marker';
  if (isAdmin && pt.hidden) wrap.classList.add('is-hidden');
  wrap.style.left = pxX + 'px';
  wrap.style.top = pxY + 'px';
  wrap.dataset.id = pt.id;
  wrap.dataset.category = pt.category || '';
  wrap.dataset.px = String(pxX);
  wrap.dataset.py = String(pxY);
  const btn = document.createElement('button');
  btn.className = 'marker-btn';
  btn.style.background = mapData.categories?.[pt.category]?.color || '#AC1943';
  btn.textContent = pt.name?.charAt(0).toUpperCase() || '?';
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    openPoint(pt.id);
    if(isAdmin){
      window.dispatchEvent(new CustomEvent('admin:point-picked', { detail:{ id: pt.id } }));
    }
  });
  const label = document.createElement('div');
  label.className = 'marker-label';
  label.textContent = pt.name;
  wrap.appendChild(btn); wrap.appendChild(label);
  markersLayer.appendChild(wrap);
  return wrap;
}

function renderClusterMarker(cluster, key){
  const count = cluster.members.length;
  const wrap = document.createElement('div');
  wrap.className = 'marker cluster-marker';
  if(count >= 10) wrap.classList.add('cluster-large'); else if(count >=5) wrap.classList.add('cluster-medium'); else wrap.classList.add('cluster-small');
  wrap.style.left = cluster.cx + 'px';
  wrap.style.top = cluster.cy + 'px';
  wrap.dataset.cluster = '1';
  wrap.dataset.count = String(count);
  const ids = cluster.members.map(m=>m.pt.id);
  wrap.dataset.ids = ids.join(',');
  if(key) wrap.dataset.ckey = key;
  const btn = document.createElement('button');
  btn.className = 'marker-btn cluster-btn';
  btn.textContent = count > 99 ? '99+' : String(count); // liczba jako label (prostota)
  wrap.appendChild(btn);
  markersLayer.appendChild(wrap);
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    toggleClusterPopover(wrap, cluster);
  });
  return wrap;
}

function toggleClusterPopover(anchorEl, cluster){
  if(clusterPopoverEl && clusterPopoverEl.anchor === anchorEl){
    closeClusterPopover(); return;
  }
  closeClusterPopover();
  clusterPopoverEl = document.createElement('div');
  clusterPopoverEl.className = 'cluster-popover';
  clusterPopoverEl.anchor = anchorEl;
  const list = cluster.members
    .slice() // kopia
    .sort((a,b)=> (a.pt.name||'').localeCompare(b.pt.name||''))
    .map(m=> `<div class="cp-item" data-id="${m.pt.id}"><span class="cp-dot" style="background:${mapData.categories?.[m.pt.category]?.color||'#666'}"></span><span class="cp-name">${m.pt.name}</span><span class="cp-cat">${m.pt.category||''}</span></div>`)
    .join('');
  clusterPopoverEl.innerHTML = `<div class="cp-header">${cluster.members.length} punktów</div><div class="cp-list">${list}</div>`;
  clusterPopoverEl.style.left = anchorEl.style.left;
  clusterPopoverEl.style.top = anchorEl.style.top;
  markersLayer.appendChild(clusterPopoverEl);
  clusterPopoverEl.querySelectorAll('.cp-item').forEach(el=>{
    el.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = el.getAttribute('data-id');
      closeClusterPopover();
      focusPointById(id);
    });
  });
  // Klik poza – zamknij
  setTimeout(()=>{
    const handler = (ev)=>{
      if(clusterPopoverEl && !clusterPopoverEl.contains(ev.target) && !anchorEl.contains(ev.target)){
        closeClusterPopover();
        window.removeEventListener('click', handler, true);
      }
    };
    window.addEventListener('click', handler, true);
  });
}

function openPoint(id){
  const pt = mapData.points.find(p=>p.id===id);
  if(!pt) return;
  renderPointDetail(pt);
}

function closePanel(){ if(panel) panel.hidden = true; }

function handleSearch(){
  // Bez danych mapy nie ma czego filtrować
  if(!mapData || !Array.isArray(mapData.points)){
    if(pointResultsEl){ pointResultsEl.innerHTML=''; pointResultsEl.hidden = true; }
    return;
  }
  const q = searchInput.value.trim().toLowerCase();
  const all = markersLayer.querySelectorAll('.marker');
  all.forEach(m=>{ m.style.opacity = 1; m.style.filter=''; });
  if(!q){
    if(pointResultsEl){ pointResultsEl.innerHTML=''; pointResultsEl.hidden = true; }
    if(pointDetailEl) pointDetailEl.hidden = true;
    if(suppressClustering){ suppressClustering=false; buildMarkers(); }
    return;
  }
  // W trybie wyszukiwania wyłącz klastrowanie (aby użytkownik mógł kliknąć pojedynczy punkt)
  if(!suppressClustering && clusteringCurrentlyEnabled()){
    suppressClustering = true;
    buildMarkers();
  }
  // Widoczne punkty po filtrach legendy
  const visiblePoints = mapData.points.filter(pt => (!pt.hidden || showHidden) && !(activeCategories.size>0 && activeCategories.has(pt.category)));
  const matched = [];
  visiblePoints.forEach(pt => {
    const match = pt.name.toLowerCase().includes(q) || (pt.tags||[]).some(t=> t.toLowerCase().includes(q));
    const markerEl = markersLayer.querySelector(`.marker[data-id="${pt.id}"]`);
    if(markerEl){
      if(!match){ markerEl.style.opacity = .15; markerEl.style.filter='grayscale(1)'; }
      else matched.push(pt);
    }
  });
  renderPointSearchResults(matched, q);
}

function renderPointSearchResults(points, query){
  if(!pointResultsEl) return;
  if(currentMode==='transport'){ pointResultsEl.innerHTML=''; return; }
  if(!points.length){ pointResultsEl.innerHTML='<div class="empty" style="padding:.2rem .1rem;">Brak wyników.</div>'; pointResultsEl.hidden=false; return; }
  const norm = s=> s.toLowerCase();
  const qNorm = norm(query);
  const html = points.slice(0,100).map(pt=>{
    const nameHighlighted = pt.name.replace(new RegExp(qNorm,'ig'), m=>`<mark>${m}</mark>`);
    const tags = (pt.tags||[]).filter(t=> norm(t).includes(qNorm)).slice(0,6).map(t=> `<span class="point-result-tag">${t}</span>`).join('');
    return `<div class="point-result-item" data-id="${pt.id}">
      <div class="point-result-name">${nameHighlighted}</div>
      ${tags?`<div class="point-result-tags">${tags}</div>`:''}
    </div>`;
  }).join('');
  pointResultsEl.innerHTML = html; pointResultsEl.hidden = false;
  // Kliknięcia
  pointResultsEl.querySelectorAll('.point-result-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      const id = item.getAttribute('data-id');
      focusPointById(id);
    });
  });
}

function focusPointById(id){
  const pt = mapData.points.find(p=>p.id===id);
  if(!pt) return;
  const meta = mapData.meta || {}; const unitsPerPixel = meta.unitsPerPixel || 4; const originMode = meta.origin || 'top-left';
  const logicY = (pt.z !== undefined ? pt.z : pt.y) || 0;
  let pxX, pxY;
  if(originMode === 'center'){
    pxX = (imgWidth/2) + (pt.x / unitsPerPixel);
    pxY = (imgHeight/2) + (logicY / unitsPerPixel);
  } else { pxX = pt.x; pxY = logicY; }
  originX = (viewport.clientWidth/2) - pxX * scale;
  originY = (viewport.clientHeight/2) - pxY * scale;
  applyTransform();
  renderPointDetail(pt);
}

function renderPointDetail(pt){
  if(!pointDetailEl){ return; }
  if(!pt){ pointDetailEl.innerHTML=''; return; }
  pointDetailEl.hidden = false;
  const logicY = (pt.z !== undefined ? pt.z : pt.y) || 0;
  const tags = (pt.tags||[]).map(t=> `<span class="tag">${t}</span>`).join('');
  pointDetailEl.innerHTML = `<h4>${pt.name}</h4>${pt.description?`<div>${pt.description}</div>`:''}
    <div class="meta"><span>X:${pt.x}</span><span>Z:${logicY}</span><span>ID:${pt.id}</span>${pt.category?`<span>Kategoria:${pt.category}</span>`:''}</div>
    ${tags?`<div class="tags">${tags}</div>`:''}`;
}

if(pointSearchClearBtn){
  pointSearchClearBtn.addEventListener('click', ()=>{
    if(searchInput){ searchInput.value=''; }
    if(pointResultsEl){ pointResultsEl.innerHTML=''; pointResultsEl.hidden = true; }
    if(pointDetailEl){ pointDetailEl.innerHTML=''; pointDetailEl.hidden = true; }
    // Przywróć pełną widoczność markerów
    const all = markersLayer.querySelectorAll('.marker');
    all.forEach(m=>{ m.style.opacity = 1; m.style.filter=''; });
    // Po wyczyszczeniu wyszukiwania przywróć klastrowanie jeśli powinno działać
    if(suppressClustering){ suppressClustering = false; buildMarkers(); }
  });
}

// Prosta funkcja debounce do ograniczenia liczby przebudów przy wpisywaniu
function debounce(fn, wait=120){
  let t; return function(...args){ clearTimeout(t); t = setTimeout(()=> fn.apply(this,args), wait); };
}

// Podpięcie wyszukiwarki punktów
if(searchInput){
  const onInput = debounce(()=> handleSearch(), 90);
  searchInput.addEventListener('input', onInput);
  searchInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      searchInput.value = '';
      handleSearch();
      e.stopPropagation();
      return;
    }
    if(e.key === 'Enter'){
      // Wybierz pierwszy wynik jeśli istnieje
      const first = pointResultsEl?.querySelector('.point-result-item');
      if(first){ first.dispatchEvent(new MouseEvent('click', { bubbles:true })); }
    }
  });
  // Jeśli pole ma już wartość (np. powrót do karty), przelicz wyniki po starcie
  if(searchInput.value && searchInput.value.trim()){
    setTimeout(()=> handleSearch(), 0);
  }
}

async function fetchMapData(noCache=false){
  console.log('[map] fetchMapData (db) start noCache=%s', noCache);
  try {
    // 1) Meta + kategorie
    const metaObj = await window.__db.fetchJson('data/map-points/meta.json');
    const meta = metaObj?.meta || {};
    const categories = metaObj?.categories || {};
    const basePoints = Array.isArray(metaObj?.points) ? metaObj.points : [];
    // 2) Pliki z punktami
    const files = [
      'localities-large.json',
      'localities-small.json',
      'stations.json',
      'infra.json',
      'airports.json'
    ];
    const loaders = files.map(fn => window.__db.fetchJson('data/map-points/' + fn).catch(()=>({points:[]})));
    const parts = await Promise.all(loaders);
    const extra = parts.flatMap(p => Array.isArray(p?.points) ? p.points : []);
    const points = [...basePoints, ...extra];
    if(!Array.isArray(points)) throw new Error('Invalid points');
    mapData = { meta, categories, points };
    console.log('[map] fetchMapData ok points=%d categories=%d', points.length, Object.keys(categories||{}).length);
  } catch(e){
    console.error('[map] Błąd ładowania mapy', e);
    if(loadingEl) loadingEl.textContent = 'Błąd ładowania danych mapy';
    throw e;
  }
}

async function fetchLinesData(noCache=false){
  try {
    linesData = await window.__db.fetchJson('data/map-lines.json');
  } catch(_){ linesData = null; }
}

function pointToPx(pt){
  const meta = mapData?.meta || {}; const unitsPerPixel = meta.unitsPerPixel || 4; const originMode = meta.origin || 'top-left';
  const logicY = (pt.z !== undefined ? pt.z : pt.y) || 0;
  if(originMode === 'center'){
    const pxX = (imgWidth/2) + (pt.x / unitsPerPixel);
    const pxY = (imgHeight/2) + (logicY / unitsPerPixel);
    return { x:pxX, y:pxY };
  } else {
    return { x: pt.x, y: logicY };
  }
}

function drawLines(fromAnimLoop=false){
  if(!linesCtx || !linesCanvas || !linesData || !mapData) return;
  // Bufor segmentów ekranu dla pickingu linii w panelu admina
  if(isAdmin){ window.__adminLineSegments = window.__adminLineSegments || []; window.__adminLineSegments.length = 0; }
  // Ograniczenie kosztu pamięci/rysowania: w trybie lite wymuszamy DPR=1
  const dpr = __MOBILE_LITE_FORCE_DPR1 ? 1 : (window.devicePixelRatio || 1);
  // Dopasuj rozmiar canvasu do viewportu (ekranowa przestrzeń rysowania)
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if(linesCanvas.width !== Math.round(vw * dpr) || linesCanvas.height !== Math.round(vh * dpr)){
    linesCanvas.width = Math.round(vw * dpr);
    linesCanvas.height = Math.round(vh * dpr);
    linesCanvas.style.width = vw + 'px';
    linesCanvas.style.height = vh + 'px';
  }
  linesCtx.setTransform(dpr,0,0,dpr,0,0); // przygotuj na rysowanie w CSS px
  if(!fromAnimLoop){
    linesCtx.clearRect(0,0,vw,vh);
  } else {
    // Przy animacji czyścimy też całość – inaczej dasha się rozmaże
    linesCtx.clearRect(0,0,vw,vh);
  }
  if(!(showRailLines || showFlightLines)) return;
  const index = new Map(mapData.points.map(p => [p.id, p]));
  const catColors = (linesData && linesData.categories) || {};
  const list = (linesData && Array.isArray(linesData.lines)) ? linesData.lines : [];
  // Czas (animacja pulsu / dash)
  const now = performance.now();
  const pulse = 0.5 + 0.5 * Math.sin(now / 620); // 0..1
  const pendingOverlays = [];
  for(const line of list){
    const lineCategory = (line.category||'').toUpperCase();
    const isFlightGroup = /FLIGHT|AIR|LOT/.test(lineCategory);
    if(isFlightGroup && !showFlightLines) continue;
    if(!isFlightGroup && !showRailLines) continue;
    if(hiddenLineCategories.has(line.category)) continue;
  const rawSeq = Array.isArray(line.stations) ? line.stations : [];
  const seq = rawSeq.map(s=> typeof s==='string' ? s.replace(/\*$/,'') : s);
    if(seq.length < 2) continue;
    const theme = pickTheme();
    const color = (theme==='dark' ? (line.colorDark || line.color) : (line.colorLight || line.color)) || catColors?.[line.category]?.color || '#888';
  const isLegendHover = (highlightedLineId === line.id) || (selectedLineId === line.id);
  const routeSeg = routeHighlightedSegments?.get(line.id) || null;
    // Rysujemy podstawową linię (całość) – jeśli istnieje szczegółowe podświetlenie, linia bazowa jest przygaszona
    linesCtx.save();
    linesCtx.strokeStyle = color;
    linesCtx.lineJoin = 'round';
    linesCtx.lineCap = 'round';
    if(routeSeg){
      linesCtx.globalAlpha = isLegendHover ? 0.55 : 0.25; // przygaszona gdy mamy szczegółową trasę
      linesCtx.lineWidth = 2;
    } else {
      linesCtx.globalAlpha = 1;
      linesCtx.lineWidth = isLegendHover ? 4 : 2;
    }
    linesCtx.beginPath();
    let started = false;
    for(const sid of seq){
      const pt = index.get(sid); if(!pt) continue;
      const { x:baseX, y:baseY } = pointToPx(pt);
      const sx = originX + baseX * scale; const sy = originY + baseY * scale;
      if(!started){ linesCtx.moveTo(sx, sy); started = true; } else { linesCtx.lineTo(sx, sy); }
      if(isAdmin){
        // Zapisz segmenty dla pickingu – para poprzednia -> bieżąca
        if(!line.__lastPointForHit){ line.__lastPointForHit = { sx, sy }; }
        else {
          window.__adminLineSegments.push({ lineId: line.id, x1: line.__lastPointForHit.sx, y1: line.__lastPointForHit.sy, x2: sx, y2: sy });
          line.__lastPointForHit = { sx, sy };
        }
      }
    }
    linesCtx.stroke();
    linesCtx.restore();
    if(isAdmin){ delete line.__lastPointForHit; }
  // Jeśli mamy częściowe podświetlenie (trasa) – przygotuj overlay do narysowania po pętli (na wierzchu)
  if(routeSeg){
      const stations = routeSeg.stations.map(s=> s.replace(/\*$/,''));
      if(stations.length >= 2){
        const glowConf = glowConfigForCategory(lineCategory);
        const pathPoints = [];
        for(const sid of stations){
          const pt = index.get(sid); if(!pt) continue;
          const { x:baseX, y:baseY } = pointToPx(pt);
          const sx = originX + baseX * scale; const sy = originY + baseY * scale;
          pathPoints.push([sx,sy]);
        }
        if(pathPoints.length>=2){ pendingOverlays.push({ color, glowConf, pathPoints }); }
      }
    }
    // Jeśli linia jest podświetlona (hover/kliknięcie w legendzie), ale nie ma segmentu trasy – przygotuj overlay całej linii
    if(isLegendHover && !routeSeg){
      const glowConf = glowConfigForCategory(lineCategory);
      const pathPoints = [];
      for(const sid of seq){
        const pt = index.get(sid); if(!pt) continue;
        const { x:baseX, y:baseY } = pointToPx(pt);
        const sx = originX + baseX * scale; const sy = originY + baseY * scale;
        pathPoints.push([sx,sy]);
      }
      if(pathPoints.length>=2){ pendingOverlays.push({ color, glowConf, pathPoints }); }
    }
  }
  // Druga warstwa: overlay tras na wierzchu
  for(const ov of pendingOverlays){
    const { color, glowConf, pathPoints } = ov;
    // Warstwa glow
    linesCtx.save();
    linesCtx.strokeStyle = color;
    linesCtx.lineJoin = 'round'; linesCtx.lineCap='round';
    const widthOuter = glowConf.widthOuter * (0.9 + 0.25*pulse);
    linesCtx.lineWidth = widthOuter;
    linesCtx.shadowColor = glowConf.shadowColor || color;
    linesCtx.shadowBlur = glowConf.shadowBlur * (0.85 + 0.3*pulse);
    linesCtx.globalAlpha = glowConf.outerAlpha * (0.75 + 0.25*pulse);
    linesCtx.beginPath();
    let first=true; for(const [sx,sy] of pathPoints){ if(first){ linesCtx.moveTo(sx,sy); first=false; } else { linesCtx.lineTo(sx,sy); } }
    linesCtx.stroke();
    linesCtx.restore();
    // Warstwa rdzenia
    linesCtx.save();
    linesCtx.strokeStyle = color;
    linesCtx.lineJoin='round'; linesCtx.lineCap='round';
    linesCtx.lineWidth = glowConf.widthInner * (0.95 + 0.15*pulse);
    linesCtx.globalAlpha = 1;
    linesCtx.beginPath();
    first=true; for(const [sx,sy] of pathPoints){ if(first){ linesCtx.moveTo(sx,sy); first=false; } else { linesCtx.lineTo(sx,sy); } }
    linesCtx.stroke();
    linesCtx.restore();
    // Animowany dash (przesuwający się) – cieńszy
    const t = now;
    linesCtx.save();
    linesCtx.strokeStyle = '#fff';
    linesCtx.globalAlpha = 0.7;
    linesCtx.lineWidth = glowConf.dashWidth;
    linesCtx.setLineDash(glowConf.dashPattern);
    linesCtx.lineDashOffset = - (t * glowConf.dashSpeed / 1000);
    linesCtx.lineJoin='round'; linesCtx.lineCap='round';
    linesCtx.beginPath();
    first=true; for(const [sx,sy] of pathPoints){ if(first){ linesCtx.moveTo(sx,sy); first=false; } else { linesCtx.lineTo(sx,sy); } }
    linesCtx.stroke();
    linesCtx.restore();
  }
}

function glowConfigForCategory(cat){
  // cat uppercase: IC / METRO / REGIO / ON / etc.
  switch(true){
    case /IC/.test(cat): return { shadowBlur:18, widthOuter:10, widthInner:5, outerAlpha:0.95, dashPattern:[28,16], dashSpeed:55, dashWidth:3 };
    case /METRO/.test(cat): return { shadowBlur:14, widthOuter:9, widthInner:5, outerAlpha:0.9, dashPattern:[22,14], dashSpeed:70, dashWidth:3 };
    case /FLIGHT|AIR|LOT/.test(cat): return { shadowBlur:16, widthOuter:10, widthInner:5, outerAlpha:0.92, dashPattern:[26,14], dashSpeed:80, dashWidth:3 };
    case /ON/.test(cat): return { shadowBlur:12, widthOuter:8, widthInner:4, outerAlpha:0.9, dashPattern:[18,12], dashSpeed:60, dashWidth:2.8 };
    default: return { shadowBlur:10, widthOuter:8, widthInner:4, outerAlpha:0.85, dashPattern:[20,14], dashSpeed:50, dashWidth:2.6 };
  }
}

// --- Rozwijana legenda linii (lista wszystkich linii gdy dostępne dane) ---
function buildLinesLegend(){
  if(!linesLegendBodyEl || !linesLegendEl) return; // panel admin może nie mieć tej legendy
  linesLegendBodyEl.innerHTML = '';
  if(!linesData || !Array.isArray(linesData.lines)){
    linesLegendStatusEl && (linesLegendStatusEl.textContent = 'Brak danych');
    return;
  }
  const linesList = linesData.lines.slice();
  // Można sortować np. po kategorii i nazwie
  linesList.sort((a,b)=> (a.category||'').localeCompare(b.category||'') || (a.name||'').localeCompare(b.name||''));
  let visibleCount = 0;
  for(const ln of linesList){
    const catUp = (ln.category||'').toUpperCase();
    const isFlightGroup = /FLIGHT|AIR|LOT/.test(catUp);
    if(isFlightGroup && !showFlightLines) continue;
    if(!isFlightGroup && !showRailLines) continue;
    if(hiddenLineCategories.has(ln.category)) continue; // jeśli kategoria wyłączona w filtrach – pomijamy
    visibleCount++;
    const theme = pickTheme();
    const color = (theme==='dark' ? (ln.colorDark || ln.color) : (ln.colorLight || ln.color)) || '#777';
    const entry = document.createElement('div');
    entry.className = 'line-entry';
  if(selectedLineId === ln.id || highlightedLineId === ln.id) entry.classList.add('active');
    entry.dataset.lineId = ln.id;
    const colorBox = document.createElement('span'); colorBox.className='line-color'; colorBox.style.background = color;
    const metaBox = document.createElement('div'); metaBox.className='line-meta';
    const nameEl = document.createElement('span'); nameEl.className='line-name';
    let displayName = ln.name || ln.id;
    // Twarde skrócenie aby nie kolidowało z badge kategorii (dodatkowo CSS line-clamp)
    const MAX_LEN = 20; // znaków
    if(displayName.length > MAX_LEN){
      displayName = displayName.slice(0, MAX_LEN-1) + '…';
    }
    nameEl.textContent = displayName;
    // Identyfikator linii ukrywamy w widoku – zachowujemy go tylko jako atrybut title (tooltip / debug)
    entry.title = `${ln.name || ln.id} (${ln.id})`;
    metaBox.appendChild(nameEl);
    const catBadge = document.createElement('span'); catBadge.className='line-category-badge'; catBadge.textContent = ln.category;
    entry.appendChild(colorBox); entry.appendChild(metaBox); entry.appendChild(catBadge);
  entry.addEventListener('mouseenter', ()=>{ highlightedLineId = ln.id; drawLines(); entry.classList.add('active'); });
  entry.addEventListener('mouseleave', ()=>{ highlightedLineId = null; if(selectedLineId !== ln.id) entry.classList.remove('active'); drawLines(); });
    entry.addEventListener('click', ()=>{
      // Klik toggluje podświetlenie; przy nowym wyborze przełącz w tryb transport i przybliż bbox linii
      if(selectedLineId === ln.id){
        selectedLineId = null; highlightedLineId = null; drawLines(); buildLinesLegend();
        // Wyczyść ewentualne podświetlenie trasy i pola wyszukiwarki
        try {
          window.dispatchEvent(new CustomEvent('route:highlight', { detail:{ legs: [] } }));
          window.dispatchEvent(new CustomEvent('route:selectEndpoints', { detail:{ startId:null, endId:null } }));
        } catch(_) { /* ignore */ }
        return;
      }
      selectedLineId = ln.id; highlightedLineId = ln.id; drawLines(); buildLinesLegend();
      lastRouteBBoxKey = null; // pozwól późniejszej trasie ponownie wymusić zoom
      if(currentMode !== 'transport') applyMode('transport');
      // Użyj requestAnimationFrame aby odczekać przebudowę UI (legendy, tryb)
      requestAnimationFrame(()=>{
        try {
          if(!mapData || !Array.isArray(ln.stations) || ln.stations.length<2) return;
          // Zasymuluj "wyszukiwanie" trasy po kliknięciu linii: podświetl całą linię i ustaw pola OD/DO
          try {
            const stations = ln.stations.slice();
            const clean = (sid)=> typeof sid==='string' ? sid.replace(/\*$/,'') : sid;
            const startId = clean(stations[0]);
            const endId = clean(stations[stations.length-1]);
            // 1) podświetl na mapie segmenty tej linii (jak trasa)
            window.dispatchEvent(new CustomEvent('route:highlight', { detail:{ legs:[ { lineId: ln.id, stations } ] } }));
            // 2) uzupełnij i uruchom wyszukiwarkę tras z preferencją wyboru tej linii, jeśli możliwe
            window.dispatchEvent(new CustomEvent('route:selectEndpoints', { detail:{ startId, endId, preferLineId: ln.id } }));
          } catch(_e){ /* ignore synthetic route dispatch */ }
          const idx = new Map(mapData.points.map(p=>[p.id,p]));
          let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
          for(const sid of ln.stations){
            const pt = idx.get(sid); if(!pt) continue;
            const {x,y} = pointToPx(pt);
            if(x<minX) minX=x; if(y<minY) minY=y; if(x>maxX) maxX=x; if(y>maxY) maxY=y;
          }
          if(!isFinite(minX)||!isFinite(minY)||!isFinite(maxX)||!isFinite(maxY)) return;
          focusBoundingBox(minX,minY,maxX,maxY,0.68);
        } catch(_){ /* ignore */ }
      });
    });
    linesLegendBodyEl.appendChild(entry);
  }
  if(linesLegendStatusEl){
    linesLegendStatusEl.textContent = `${visibleCount} linii`;
  }
}

function focusLine(line){
  if(!line || !Array.isArray(line.stations) || line.stations.length < 2 || !mapData) return;
  // Wylicz bounding box linii w układzie pikseli mapy
  const index = new Map(mapData.points.map(p=>[p.id,p]));
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const sid of line.stations){
    const pt = index.get(sid); if(!pt) continue;
    const {x,y} = pointToPx(pt);
    if(x<minX) minX=x; if(y<minY) minY=y; if(x>maxX) maxX=x; if(y>maxY) maxY=y;
  }
  if(!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;
  // Użyj tej samej proporcji (fill factor) co focusRouteBBox dla spójności UX
  focusBoundingBox(minX,minY,maxX,maxY,0.68);
}

function focusBoundingBox(minX,minY,maxX,maxY,fillFactor){
  const w = maxX - minX; const h = maxY - minY; if(w<=0||h<=0) return;
  const viewW = viewport.clientWidth; const viewH = viewport.clientHeight;
  const targetScale = Math.min( (viewW*fillFactor)/w, (viewH*fillFactor)/h );
  const clamped = Math.min(maxScale, Math.max(minScale, targetScale));
  scale = clamped;
  const cx = (minX + maxX)/2; const cy = (minY + maxY)/2;
  originX = (viewW/2) - cx * scale;
  originY = (viewH/2) - cy * scale;
  applyTransform();
}

async function load(){
  console.log('[map] load() start');
  // Wczytaj preferencje motywu zanim ustawimy źródło obrazka
  loadThemeState();
  updateImageSource();
  loadingEl.hidden = false;
  await new Promise(res=> setTimeout(res, 60));
  try { await fetchMapData(false); } catch(e){ return; }
  if(!mapData){
    loadingEl.hidden = false;
    loadingEl.textContent = 'Brak danych mapy';
    return;
  }
  // Wczytaj stan legendy (jeśli istnieje); w przeciwnym razie ustaw domyślne ukrycie kolei/metra i linii
  loadLegendState();
  if(!hasLoadedLegendState){
    activeCategories = new Set(['kolej','metro','airport']);
    showRailLines = false; showFlightLines = false; showLines = false;
  } else {
    // Jeśli użytkownik ma zapisany stan, ale jesteśmy w trybie ogólnym podczas ładowania – wymuś ukrycie kolei/metra.
    if(currentMode === 'general'){
      activeCategories.add('kolej');
      activeCategories.add('metro');
    }
  }
  // Zapamiętaj startowy stan linii dla general (po wczytaniu/ustawieniu domyślnym)
  if(currentMode === 'general'){
    lastGeneralShowRailLines = showRailLines;
    lastGeneralShowFlightLines = showFlightLines;
    lastGeneralShowLines = !!(showRailLines || showFlightLines);
  }
  buildLegend();
  buildLinesLegend();
  await new Promise((resolve,reject)=>{
    imgEl.onload = ()=> resolve();
    imgEl.onerror = ()=> reject();
    if(imgEl.complete) resolve();
  });
  try {
  imgWidth = imgEl.naturalWidth; imgHeight = imgEl.naturalHeight;
  if(!imgWidth || !imgHeight) throw new Error('Brak wymiarów mapy');
  baseLogicalWidth = imgWidth; baseLogicalHeight = imgHeight; // zapisz logiczny rozmiar 1x
    // Ustaw fizyczny rozmiar płótna i warstw
    canvas.style.width = imgWidth + 'px';
    canvas.style.height = imgHeight + 'px';
    if(linesCanvas){
      // Początkowa neutralizacja transformu i rozmiar dopasowany do viewportu
      linesCanvas.style.position = 'absolute';
      linesCanvas.style.top = '0';
      linesCanvas.style.left = '0';
      linesCanvas.style.pointerEvents = 'none';
      linesCanvas.style.zIndex = '10';
      // markersLayer jest w tym samym kontenerze i przychodzi po canvasie w DOM, więc pozostaje nad liniami
      if(markersLayer){
        markersLayer.style.zIndex = '20';
      }
    }
    markersLayer.style.width = imgWidth + 'px';
    markersLayer.style.height = imgHeight + 'px';
  ensureTilesContainer();
    // Dopiero teraz budujemy warstwy (znamy środek)
    await fetchLinesData(false);
  // Po wczytaniu linii dobuduj sekcję kategorii linii
  buildLegend();
  buildLinesLegend();
    drawLines();
    buildMarkers();
    // Fallback gdy viewport ma 0 wysokości (np. brak rozciągnięcia rodzica)
    requestAnimationFrame(()=>{
      const rect = viewport.getBoundingClientRect();
      if(rect.height < 40){
        viewport.style.minHeight = '100vh';
      }
    });
    loadingEl.hidden = true;
    // Po wczytaniu – sprawdź czy mamy żądanie fokusu z wyszukiwarki / sesji
    if(!applyFocusFromSearchParams() && !applyFocusFromSession()){
      centerOnSpawn();
    }
  } catch(e){
    loadingEl.hidden = false;
    loadingEl.textContent = 'Nie udało się ustalić wymiarów mapy (brak pliku mapy?)';
    console.error('[map] load() fatal', e);
  }
}


function ensurePlayersLayerVisible(){
  // Usuń ewentualne ukrycie kategorii players
  if(activeCategories.has('players')){ activeCategories.delete('players'); buildLegend(); saveLegendState(); }
}

// Panowanie
function computeCenterAndDistance(){
  const arr = Array.from(pointers.values());
  if(arr.length < 2) return { center:null, distance:0 };
  const [a,b] = arr;
  const center = { x:(a.x + b.x)/2, y:(a.y + b.y)/2 };
  const dx = a.x - b.x; const dy = a.y - b.y;
  const distance = Math.hypot(dx, dy);
  return { center, distance };
}

viewport.addEventListener('pointerdown', e=>{
  // Kliknięcia w elementy UI (w tym link marki) nie powinny rozpoczynać panowania ani przechwytywać wskaźnika
  const isUi = !!(e.target.closest('.marker')
    || e.target.closest('.map-toolbar')
    || e.target.closest('.map-sidepanel')
    || e.target.closest('.point-panel')
    || e.target.closest('#map-brand')
    || e.target.closest('#lines-legend')
    || e.target.closest('#btn-filters'));
  if(isUi) return;
  pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if(pointers.size === 2){
    // Start pinch
    pinchActive = true;
    isPanning = false;
    const { center, distance } = computeCenterAndDistance();
    lastPinchCenter = center; lastPinchDistance = distance;
  } else if(pointers.size === 1 && !pinchActive){
    if(isUi) return; // klik na UI/markerze – nie zaczynaj panowania ani capture
    isPanning = true; panStart.x = e.clientX; panStart.y = e.clientY; panOriginStart.x = originX; panOriginStart.y = originY;
    viewport.setPointerCapture(e.pointerId);
  }
});

viewport.addEventListener('pointermove', e=>{
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if(pinchActive && pointers.size >= 2){
    const { center, distance } = computeCenterAndDistance();
    if(!center || !lastPinchCenter || !lastPinchDistance) return;
    // Pan o zmianę środka gestu
    originX += (center.x - lastPinchCenter.x);
    originY += (center.y - lastPinchCenter.y);
    // Zoom względem bieżącego środka
    const factor = distance / lastPinchDistance;
    // setScale oczekuje współrzędnych ekranowych (względem viewportu)
    const rect = viewport.getBoundingClientRect();
    const sX = center.x - rect.left;
    const sY = center.y - rect.top;
    setScale(scale * factor, sX, sY);
    lastPinchCenter = center; lastPinchDistance = distance;
    return;
  }
  if(!isPanning) return;
  originX = panOriginStart.x + (e.clientX - panStart.x);
  originY = panOriginStart.y + (e.clientY - panStart.y);
  applyTransform();
});

function endPointerInteraction(e){
  // Usuń pointer z mapy
  if(pointers.has(e.pointerId)) pointers.delete(e.pointerId);
  // Jeśli kończymy gest pinch (mniej niż 2 aktywne) – reset
  if(pinchActive && pointers.size < 2){
    pinchActive = false;
    lastPinchCenter = null; lastPinchDistance = 0;
  }
  // Zakończ panowanie po puszczeniu głównego wskaźnika
  if(isPanning){
    isPanning = false;
  }
}

viewport.addEventListener('pointerup', endPointerInteraction);
viewport.addEventListener('pointercancel', endPointerInteraction);
// Fallback: jeśli z jakiegoś powodu capture się nie utrzymało i użytkownik wyjdzie kursorem poza viewport
window.addEventListener('mouseup', () => { if(isPanning) isPanning=false; pinchActive=false; pointers.clear(); });

// --- Focus helpers (naprawiona sekcja) ---
function applyFocusFromSearchParams(){
  const params = new URLSearchParams(window.location.search);
  // 1) focus=x,y,z lub focus=x,z – centrowanie i tymczasowy marker
  const focusRaw = params.get('focus');
  if(focusRaw){
    const parts = focusRaw.split(',').map(s=> s.trim()).filter(Boolean);
    if(parts.length === 2 || parts.length === 3){
      const x = Number(parts[0]);
      const z = Number(parts[parts.length-1]);
      if(isFinite(x) && isFinite(z)){
        ensurePlayersLayerVisible();
  const label = params.get('fl') || params.get('label') || 'Cel';
        focusLogicalPoint(x, z, { pulse:true, label });
        return true;
      }
    }
  }
  const fx = params.get('fx'); const fz = params.get('fz'); const fl = params.get('fl');
  const lineParam = params.get('line');
  if(lineParam){
    // Spróbuj podświetlić linię po jej ID
    if(linesData && Array.isArray(linesData.lines)){
      const ln = linesData.lines.find(l=> l.id === lineParam);
      if(ln){
        highlightedLineId = ln.id;
        // Włącz tryb transport i linie
        if(currentMode !== 'transport') applyMode('transport');
        showLines = true;
        drawLines(); buildLinesLegend();
        // Przybliż bbox linii
        focusLine(ln);
        return true;
      }
    }
    // Jeśli nie znaleziono – nie przerywaj, może jest focus punktowy równolegle
  }
  if(fx===null || fz===null) return false;
  const x = Number(fx), z = Number(fz);
  if(!isFinite(x) || !isFinite(z)) return false;
  ensurePlayersLayerVisible();
  focusLogicalPoint(x, z, { pulse:true, label: fl });
  return true;
}
function applyFocusFromSession(){
  try {
    // Najpierw linia (ważniejsze – większy obiekt)
    const rawLine = sessionStorage.getItem('map.focus.line');
    if(rawLine){
      const objL = JSON.parse(rawLine);
      if(objL && objL.lineId && (!objL.ts || (Date.now()-objL.ts) < 10*60*1000)){
        if(linesData && Array.isArray(linesData.lines)){
          const ln = linesData.lines.find(l=> l.id === objL.lineId);
          if(ln){
            highlightedLineId = ln.id;
            if(currentMode !== 'transport') applyMode('transport');
            showLines = true;
            drawLines(); buildLinesLegend();
            focusLine(ln);
            sessionStorage.removeItem('map.focus.line');
            return true;
          }
        }
      }
    }
    const raw = sessionStorage.getItem('map.focus.player');
    if(!raw) return false;
    const obj = JSON.parse(raw);
    if(!obj || typeof obj !== 'object') return false;
    const { x, z, ts, label } = obj;
    if(!isFinite(x) || !isFinite(z)) return false;
    if(ts && (Date.now() - ts) > 5*60*1000) return false;
    ensurePlayersLayerVisible();
    focusLogicalPoint(x, z, { pulse:true, label });
    sessionStorage.removeItem('map.focus.player');
    return true;
  } catch(_){ return false; }
}
function focusLogicalPoint(x,z, opts){
  opts = opts || {}; const withPulse = !!opts.pulse; const label = opts.label || null;
  const meta = mapData?.meta || {}; const unitsPerPixel = meta.unitsPerPixel || 4; const originMode = meta.origin || 'top-left';
  let pxX, pxY;
  if(originMode === 'center'){
    pxX = (imgWidth/2) + (x / unitsPerPixel);
    pxY = (imgHeight/2) + (z / unitsPerPixel);
  } else { pxX = x; pxY = z; }
  const desiredScale = Math.max(scale, 1.4);
  scale = Math.min(maxScale, Math.max(minScale, desiredScale));
  originX = (viewport.clientWidth/2) - pxX * scale;
  originY = (viewport.clientHeight/2) - pxY * scale;
  applyTransform();
  if(withPulse){ pulseAt(pxX, pxY, label); }
}
function pulseAt(pxX, pxY, label){
  try {
    buildMarkers();
    const markers = Array.from(markersLayer.querySelectorAll('.marker'));
    let candidate = null;
    if(label){
      const norm = label.toLowerCase();
      candidate = markers.find(m => m.querySelector('.marker-label')?.textContent?.toLowerCase() === norm) || null;
    }
    if(!candidate){
      let best=null; let bestDist=Infinity;
      for(const m of markers){
        if(m.dataset.category !== 'players') continue;
        const mx = Number(m.dataset.px), my = Number(m.dataset.py);
        const dx = mx - pxX, dy = my - pxY; const d = dx*dx + dy*dy;
        if(d<bestDist){ bestDist=d; best=m; }
      }
      if(best && bestDist <= 1600) candidate = best;
    }
    if(candidate){
      // Restart animacji jeśli wcześniej już pulsował
      if(candidate.classList.contains('pulse')){
        candidate.classList.remove('pulse');
        // wymuszenie reflow aby animacja mogła się ponownie uruchomić
        void candidate.offsetWidth;
      }
      candidate.classList.add('pulse');
      // Dodaj również pierścień aby użytkownik na pewno zauważył fokus
      const ring = document.createElement('div');
      ring.className='focus-pulse';
      ring.style.left = candidate.dataset.px + 'px';
      ring.style.top = candidate.dataset.py + 'px';
      markersLayer.appendChild(ring);
      setTimeout(()=> ring.remove(), 4500);
      setTimeout(()=> candidate.classList.remove('pulse'), 4200);
      return;
    }
    // Brak markera – utwórz tymczasowy (ephemeral) marker gracza aby wizualnie wskazać punkt
    const wrap = document.createElement('div');
    wrap.className = 'marker pulse ephemeral-player';
    wrap.style.left = pxX + 'px';
    wrap.style.top = pxY + 'px';
    wrap.dataset.category = 'players';
    wrap.dataset.px = String(pxX);
    wrap.dataset.py = String(pxY);
    const btn = document.createElement('button');
    btn.className = 'marker-btn';
    btn.style.background = '#AC1943';
    btn.textContent = (label ? label.charAt(0) : 'P').toUpperCase();
    const lab = document.createElement('div');
    lab.className = 'marker-label';
    lab.textContent = label || 'Gracz';
    wrap.appendChild(btn); wrap.appendChild(lab);
    markersLayer.appendChild(wrap);
    setTimeout(()=>{ wrap.classList.remove('pulse'); }, 4200);
    // Usuń całkowicie po kilku sekundach żeby nie zaśmiecać warstwy
    setTimeout(()=>{ if(wrap.isConnected) wrap.remove(); }, 15000);
  } catch(_){ }
}

// Wheel zoom (naprawiony listener)
viewport.addEventListener('wheel', e=>{
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.15 : 0.85;
  const rect = viewport.getBoundingClientRect();
  const sX = e.clientX - rect.left; const sY = e.clientY - rect.top;
  setScale(scale * delta, sX, sY);
  maybeUpdateClusters();
}, { passive:false });

// Zoom buttons (zapewnienie pojedynczych listenerów)
if(btnZoomIn) btnZoomIn.addEventListener('click', ()=>{ const cx=viewport.clientWidth/2, cy=viewport.clientHeight/2; setScale(scale*1.25, cx, cy); });
if(btnZoomOut) btnZoomOut.addEventListener('click', ()=>{ const cx=viewport.clientWidth/2, cy=viewport.clientHeight/2; setScale(scale*0.8, cx, cy); maybeUpdateClusters(); });
if(btnZoomReset) btnZoomReset.addEventListener('click', ()=>{ scale=1; originX=0; originY=0; applyTransform(); centerOnSpawn(); });
if (closePanelBtn) closePanelBtn.addEventListener('click', closePanel);
if (pinPanelBtn) pinPanelBtn.addEventListener('click', ()=>{ panel?.classList.toggle('pinned'); const img=document.getElementById('pin-panel-icon'); if(img){ if(panel.classList.contains('pinned')){ img.src='/icns_ui/unpin.svg'; } else { img.src='/icns_ui/pin.svg'; } }});
// if (pinPanelBtn) pinPanelBtn.addEventListener('click', ()=>{ panel?.classList.toggle('pinned'); });
// Przełącz motyw mapy (tylko grafika mapy: base + kafelki). Nie zmienia stylu całego UI.
if(btnTheme){
  btnTheme.addEventListener('click', ()=>{
    // Przełącz z obecnie renderowanego motywu na przeciwny (bazując na pickTheme dla spójności z auto)
    const currentRendered = pickTheme();
    const next = currentRendered === 'light' ? 'dark' : 'light';
    currentTheme = next; // ustaw tryb jawny (wyłącz auto)
    saveThemeState();
    // Odśwież bazowy obraz i kafelki w nowym motywie z płynnym przejściem
    updateImageSource();
    drawLines(); // kolory linii mogą mieć warianty light/dark
    purgeTilesOfOtherTheme();
    if(currentResolutionFactor > 1){
      awaitingFirstHiResTile = true;
      canvas.classList.remove('hires-on'); // dopóki pierwszy kafelek nie dojedzie
    }
    updateVisibleTiles();
    window.dispatchEvent(new CustomEvent('theme-change'));
  });
}

// Kopiuj link z fokusem na aktualny środek widoku
if(btnCopyFocus){
  btnCopyFocus.addEventListener('click', async ()=>{
    try {
      if(!mapData || !imgWidth || !imgHeight){ return; }
      const meta = mapData.meta || {}; const unitsPerPixel = meta.unitsPerPixel || 4; const originMode = meta.origin || 'top-left';
      // Środek viewportu w przestrzeni mapy (px)
      const centerMapX = (-originX + viewport.clientWidth/2) / scale;
      const centerMapY = (-originY + viewport.clientHeight/2) / scale;
      // Przelicz na współrzędne logiczne (x,z)
      let logicX, logicZ;
      if(originMode === 'center'){
        logicX = (centerMapX - (imgWidth/2)) * unitsPerPixel;
        logicZ = (centerMapY - (imgHeight/2)) * unitsPerPixel;
      } else {
        logicX = centerMapX;
        logicZ = centerMapY;
      }
      // Zaokrąglij do pełnych jednostek dla czytelności
      const X = Math.round(logicX);
      const Z = Math.round(logicZ);
      const url = new URL(location.href);
      url.searchParams.set('focus', `${X},${Z}`);
      url.searchParams.set('label', 'Cel');
      // Kopiuj do schowka
      await navigator.clipboard.writeText(url.toString());
      // Prosta informacja zwrotna (title swap)
      const prevTitle = btnCopyFocus.title;
      btnCopyFocus.title = 'Skopiowano!';
      setTimeout(()=>{ btnCopyFocus.title = prevTitle || 'Kopiuj link do celu'; }, 1200);
    } catch(_e){ /* ciche pominięcie */ }
  });
}
viewport.addEventListener('click', (e)=>{
  if(!panel || panel.hidden) return;
  if(panel.classList.contains('pinned')) return; // przypięty – nie zamykaj kliknięciem w tło
  // jeśli klik w środku panelu – pomiń
  const within = panel.contains(e.target) || !!e.target.closest('.marker');
  if(within) return;
  closePanel();
});

// Picking linii w trybie admina – detekcja najbliższego segmentu kliknięcia
if(isAdmin){
  viewport.addEventListener('click', (e)=>{
    if(!showLines) return; // linie nieaktywne
    // pomiń kliknięcia na markerach (obsługuje je osobny listener)
    if(e.target.closest('.marker')) return;
    const segs = window.__adminLineSegments || [];
    if(!segs.length) return;
    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    let best=null; let bestDist=Infinity; const THRESH=8; // px
    for(const s of segs){
      const dist = pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2);
      if(dist < bestDist){ bestDist=dist; best=s; }
    }
    if(best && bestDist <= THRESH){
      window.dispatchEvent(new CustomEvent('admin:line-picked', { detail:{ id: best.lineId } }));
    }
  });
}

function pointSegmentDistance(px,py,x1,y1,x2,y2){
  const dx = x2 - x1; const dy = y2 - y1;
  if(dx===0 && dy===0) return Math.hypot(px-x1, py-y1);
  let t = ((px - x1)*dx + (py - y1)*dy) / (dx*dx + dy*dy);
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t*dx; const cy = y1 + t*dy;
  return Math.hypot(px-cx, py-cy);
}

window.addEventListener('keydown', e=>{
  const ae = document.activeElement;
  const tag = (ae && ae.tagName) ? ae.tagName.toLowerCase() : '';
  const editable = ae && (ae.isContentEditable === true);
  if(tag === 'input' || tag === 'textarea' || tag === 'select' || editable){
    return; // nie obsługuj skrótów mapy podczas edycji pól
  }
  if(e.key === 'Escape') closePanel();
  if(e.key === '+') setScale(scale*1.2, viewport.clientWidth/2 - originX, viewport.clientHeight/2 - originY);
  if(e.key === '-') { setScale(scale*0.8, viewport.clientWidth/2 - originX, viewport.clientHeight/2 - originY); maybeUpdateClusters(); }
  if(e.key === '0') { scale=1; originX=0; originY=0; applyTransform(); }
});

// Reaguj na zmianę rozmiaru – odrysuj linie w przestrzeni ekranu
window.addEventListener('resize', ()=>{ drawLines(); });

// --- Kafelki hi-res ---
function ensureTilesContainer(){
  if(tilesLayer) return;
  tilesLayer = document.createElement('div');
  tilesLayer.className = 'hires-tiles';
  // Umieszczamy w canvasie mapy (przed markersLayer), bo canvas ma transform wspólny
  canvas.insertBefore(tilesLayer, markersLayer);
}

function buildTilesForCurrentLevel(){
  if(currentResolutionFactor === 1) { clearTiles(); return; }
  const cfg = TILE_CONFIG[currentResolutionFactor];
  if(!cfg) return;
  const grid = cfg.grid;
  const baseW = baseLogicalWidth;
  const baseH = baseLogicalHeight;
  const tileW = baseW / grid;
  const tileH = baseH / grid;
  // Jeśli już mamy kafelki dla tego poziomu, nie nadpisuj (lazy loading)
  // Sprzątnij kafelki poprzedniego (jeśli downgraded - obecnie brak downgrade, ale zabezpieczenie)
  for(const [key, el] of tiles.entries()){
    if(!key.startsWith(currentResolutionFactor + 'x:')){ el.remove(); tiles.delete(key); }
  }
  for(let row=0; row<grid; row++){
    for(let col=0; col<grid; col++){
      const key = `${currentResolutionFactor}x:${row}:${col}`;
      if(tiles.has(key)) continue;
      const div = document.createElement('div');
      div.className = 'tile';
      div.style.left = (col*tileW) + 'px';
      div.style.top = (row*tileH) + 'px';
      div.style.width = tileW + 'px';
      div.style.height = tileH + 'px';
      // Obraz doładowany później (on-demand)
      tilesLayer.appendChild(div);
      tiles.set(key, div);
    }
  }
}

function clearTiles(){
  for(const el of tiles.values()) el.remove();
  tiles.clear();
  if(tilesLayer){ tilesLayer.innerHTML=''; }
}

function updateVisibleTiles(){
  if(currentResolutionFactor === 1) return;
  const cfg = TILE_CONFIG[currentResolutionFactor];
  if(!cfg) return;
  const grid = cfg.grid;
  const baseW = baseLogicalWidth;
  const baseH = baseLogicalHeight;
  const tileW = baseW / grid;
  const tileH = baseH / grid;
  // Ekran do układu mapy (odwrócenie transformu)
  // punkt (0,0) mapy przekształcony na ekran: (originX, originY)
  // więc odwrotnie: pxMapX = (screenX - originX)/scale
  const viewLeft = -originX/scale;
  const viewTop = -originY/scale;
  const viewRight = viewLeft + viewport.clientWidth/scale;
  const viewBottom = viewTop + viewport.clientHeight/scale;
  const margin = 0.5 * Math.max(tileW, tileH); // prefetch pół kafla
  for(let row=0; row<grid; row++){
    for(let col=0; col<grid; col++){
      const key = `${currentResolutionFactor}x:${row}:${col}`;
      const div = tiles.get(key);
      if(!div) continue;
      const x0 = col*tileW;
      const y0 = row*tileH;
      const x1 = x0 + tileW;
      const y1 = y0 + tileH;
      const visible = !(x1 < viewLeft - margin || x0 > viewRight + margin || y1 < viewTop - margin || y0 > viewBottom + margin);
      if(visible){
        if(!div.firstChild){
          const img = new Image();
          // Ścieżka kafelka: /map_light@2x_r{row}_c{col}.webp lub @4x
          const theme = pickTheme();
          let dir;
          if(currentResolutionFactor === 2){
            dir = theme === 'light' ? MAP_PATHS.tiles2xLightDir : MAP_PATHS.tiles2xDarkDir;
          } else if(currentResolutionFactor === 4){
            dir = theme === 'light' ? MAP_PATHS.tiles4xLightDir : MAP_PATHS.tiles4xDarkDir;
          }
          img.decoding = 'async';
          img.loading = 'lazy';
          img.addEventListener('load', ()=> {
            img.classList.add('loaded');
            // Po pierwszym kafelku hi-res załaduj – ukryj base
            if(awaitingFirstHiResTile){
              awaitingFirstHiResTile = false;
              canvas.classList.add('hires-on');
            }
          });
          img.src = `${dir}/map_${theme}@${currentResolutionFactor}x_r${row}_c${col}.webp`;
          div.appendChild(img);
        }
        div.style.opacity = '1';
      } else {
        // Możemy wyczyścić dla oszczędności pamięci (lub zostawić). Zostawiamy obraz by uniknąć przeładowań.
        div.style.opacity = '0';
      }
    }
  }
}

function purgeTilesOfOtherTheme(){
  if(!tilesLayer) return;
  const theme = pickTheme();
  for(const [key, el] of [...tiles.entries()]){
    const img = el.querySelector('img');
    if(!img) continue;
    const isLight = img.src.includes('/light/');
    if((theme === 'light' && !isLight) || (theme === 'dark' && isLight)){
      el.remove();
      tiles.delete(key);
    }
  }
}

load();
// Globalne nasłuchy błędów runtime dla diagnostyki
window.addEventListener('error', ev => {
  console.error('[map] window error', ev.error || ev.message);
});
window.addEventListener('unhandledrejection', ev => {
  console.error('[map] unhandledrejection', ev.reason);
});

// --- Tryby mapy ---
function applyMode(mode){
  const prev = currentMode;
  currentMode = mode;
  if(appRoot){ appRoot.dataset.mode = mode; }
  // Ustaw aria-pressed na przyciskach
  modeButtons.forEach(btn => {
    const m = btn.getAttribute('data-mode');
    btn.setAttribute('aria-pressed', (m===mode).toString());
  });
  // Sterowanie widocznością sekcji wyszukiwania (bez względu na kolejność ładowania route-search.js)
  const pointSec = document.getElementById('point-search-section');
  const routeSec = document.getElementById('route-search-section');
  if(mode === 'transport'){
    // Zapamiętaj stan linii w trybie ogólnym zanim wymusimy showLines
    if(prev === 'general'){
      lastGeneralShowRailLines = showRailLines;
      lastGeneralShowFlightLines = showFlightLines;
      lastGeneralShowLines = !!(showRailLines || showFlightLines); // legacy store
    }
    // Włącz widoczność linii automatycznie (obie grupy)
    showRailLines = true;
    showFlightLines = true;
    showLines = true;
    // Usuń z ukrytych kategorii linii wszystko (pokaż wszystkie), zachowaj hiddenLineCategories ale czyść
    hiddenLineCategories.clear();
    // Włącz kategorie stacji kolej/metro (usuń z activeCategories jeżeli były ukryte)
  activeCategories.delete('kolej');
  activeCategories.delete('metro');
  activeCategories.delete('airport');
    // Pokaż panel tras
    window.TransportMode?.enable?.();
    if(pointSec) pointSec.hidden = true;
    if(routeSec) routeSec.hidden = false;
    if(linesLegendEl) linesLegendEl.hidden = false;
  } else {
    // Wracamy do ogólnej: przywróć showLines wg legendy (nie nadpisujemy, ale jeśli chcemy można zostawić włączone)
    window.TransportMode?.disable?.();
    routeHighlightedSegments = null;
    if(pointSec) pointSec.hidden = false;
    if(routeSec) routeSec.hidden = true;
  if(linesLegendEl) linesLegendEl.hidden = true;
    // W trybie ogólnym zawsze ukrywamy stacje i metro (domyślnie niewidoczne).
  activeCategories.add('kolej');
  activeCategories.add('metro');
  activeCategories.add('airport');
    // Przywróć wcześniejszy stan linii z general
    showRailLines = !!lastGeneralShowRailLines;
    showFlightLines = !!lastGeneralShowFlightLines;
    showLines = !!(showRailLines || showFlightLines);
  }
  // Wyczyść / odśwież wyniki punktów po zmianie trybu
  if(pointResultsEl){
    if(currentMode==='transport') pointResultsEl.innerHTML='';
    else if(searchInput && searchInput.value.trim()) handleSearch();
  }
  saveLegendState();
  buildLegend();
  buildLinesLegend();
  // Natychmiast przebuduj markery, aby odzwierciedlić widoczność kategorii po zmianie trybu
  try { buildMarkers(); } catch(_){ }
  // Po zmianie trybu zaktualizuj ewentualne repozycjonowanie legendy linii (CSS korzysta z data-mode)
  repositionLinesLegend();
  // Natychmiastowy redraw warstwy linii (bug: pojawiały się dopiero po ruchu)
  try {
    drawLines(true);
  } catch(e){ console.warn('[map] immediate drawLines failed', e); }
  // Drugi redraw w następnym frame (czasem pierwszy następuje przed recalculacją layoutu paneli)
  requestAnimationFrame(()=>{ try { drawLines(true); } catch(_e){} });
}

modeButtons.forEach(btn => {
  btn.addEventListener('click', ()=>{
    const m = btn.getAttribute('data-mode');
    applyMode(m);
  });
});

// Eksponuj do konsoli
window.MapAppMode = { apply: applyMode };

// Po pełnym załadowaniu DOM wymuś synchronizację (pozostajemy w domyślnym 'general')
window.addEventListener('DOMContentLoaded', ()=>{ applyMode(currentMode); });
// Zastosuj domyślne ukrycia przed pierwszym budowaniem legendy / markerów (load() już ruszyło asynchronicznie)
applyInitialCategoryVisibility();

// === Warstwa polityczna (SVG) ===
const politicalLayerEl = document.getElementById('political-layer');
let politicalSvgLoaded = false;
let politicalVisible = false;
let politicalOpacity = 0.5; // domyślnie
let politicalCheckboxEl = null; // legend checkbox
let politicalOpacityWrapperEl = null; // slider container in legend
function loadPoliticalSvg(){
  if(politicalSvgLoaded || !politicalLayerEl) return;
  fetch('/map/political.svg').then(r=>{
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.text();
  }).then(txt=>{
    politicalLayerEl.innerHTML = txt;
    politicalSvgLoaded = true;
    applyPoliticalTransform();
  }).catch(e=>{
    console.warn('[map] political svg load failed', e.message);
  });
}
function applyPoliticalTransform(){
  if(!politicalLayerEl) return;
  // Warstwa skalowana razem z mapą przez transform rodzica (#map-canvas)
  // Nic specjalnego – SVG wypełnia 100% logicznej wielkości mapy.
}
// Włącz/wyłącz widoczność
function updatePoliticalVisibility(){
  if(!politicalLayerEl) return;
  politicalLayerEl.style.display = politicalVisible ? 'block' : 'none';
  politicalLayerEl.setAttribute('aria-hidden', (!politicalVisible).toString());
  if(politicalVisible && !politicalSvgLoaded){ loadPoliticalSvg(); }
  updatePoliticalControlsUI();
}
function updatePoliticalOpacity(){
  if(!politicalLayerEl) return;
  politicalLayerEl.style.opacity = politicalOpacity.toFixed(2);
  try { localStorage.setItem('map.political.opacity', politicalOpacity.toString()); } catch(_){ }
}
function updatePoliticalControlsUI(){
  if(politicalCheckboxEl){
    politicalCheckboxEl.checked = politicalVisible;
  }
  if(politicalOpacityWrapperEl){
    politicalOpacityWrapperEl.hidden = !politicalVisible;
  }
}
// Przy uruchomieniu odczytaj poprzedni stan
try {
  const storedOp = localStorage.getItem('map.political.opacity');
  if(storedOp){ const v = parseFloat(storedOp); if(!isNaN(v) && v>=0 && v<=1) politicalOpacity = v; }
  const storedVis = localStorage.getItem('map.political.visible');
  if(storedVis){ politicalVisible = storedVis === '1'; }
} catch(_){ }
updatePoliticalVisibility();
updatePoliticalOpacity();

// UI kontrolki – doczep do toolbara
window.addEventListener('theme-change', ()=>{ /* hook na przyszłe kolory SVG */ });

// Rozszerzenie legendy o checkbox warstwy politycznej
const origBuildLegend = buildLegend;
buildLegend = function(){
  origBuildLegend();
  try { addPoliticalLegendEntry(); } catch(_){ }
};
function addPoliticalLegendEntry(){
  if(!legendEl) return;
  // Jeśli już istnieje wpis – zaktualizuj referencję i wyjdź
  const existing = legendEl.querySelector('[data-legend-political] input[type="checkbox"]');
  if(existing){
    politicalCheckboxEl = existing;
    // Upewnij się, że wrapper suwaka istnieje
    ensurePoliticalOpacityWrapper();
    placePoliticalOpacityWrapper();
    updatePoliticalControlsUI();
    return;
  }
  // Kontener nagłówka WARSTWY jeśli brak
  if(!legendEl.querySelector('[data-legend-political-heading]')){
    const sep = document.createElement('div'); sep.className='legend-sep'; legendEl.appendChild(sep);
    const heading = document.createElement('div'); heading.className='legend-heading'; heading.textContent='WARSTWY'; heading.setAttribute('data-legend-political-heading','1'); legendEl.appendChild(heading);
  }
  const label = document.createElement('label'); label.className='legend-item'; label.setAttribute('data-legend-political','1');
  const fakeDot = document.createElement('span'); fakeDot.className='legend-dot'; fakeDot.style.background = '#AC1943';
  const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = politicalVisible; cb.setAttribute('aria-label','Pokaż mapę polityczną');
  cb.addEventListener('change', ()=>{
    politicalVisible = cb.checked;
    try { localStorage.setItem('map.political.visible', politicalVisible? '1':'0'); } catch(_){ }
    updatePoliticalVisibility();
  });
  const text = document.createElement('span'); text.className='legend-label'; text.textContent='Mapa polityczna';
  label.appendChild(cb); label.appendChild(fakeDot); label.appendChild(text);
  legendEl.appendChild(label);
  politicalCheckboxEl = cb;
  ensurePoliticalOpacityWrapper(label);
  placePoliticalOpacityWrapper();
  updatePoliticalControlsUI();
}

function ensurePoliticalOpacityWrapper(afterElement){
  if(politicalOpacityWrapperEl) return;
  const wrap = document.createElement('div');
  wrap.className = 'political-opacity-legend';
  const lab = document.createElement('label'); lab.textContent='Przezroczystość'; lab.setAttribute('for','political-opacity');
  const range = document.createElement('input'); range.type='range'; range.min='0'; range.max='1'; range.step='0.01'; range.id='political-opacity'; range.value = politicalOpacity.toString(); range.setAttribute('aria-label','Przezroczystość mapy politycznej');
  range.addEventListener('input', ()=>{ politicalOpacity = parseFloat(range.value)||0; updatePoliticalOpacity(); });
  wrap.appendChild(lab); wrap.appendChild(range);
  politicalOpacityWrapperEl = wrap;
  if(afterElement){
    afterElement.insertAdjacentElement('afterend', wrap);
  } else if(legendEl){
    legendEl.appendChild(wrap);
  }
}

function placePoliticalOpacityWrapper(){
  if(!politicalOpacityWrapperEl || !legendEl) return;
  const isMobile = window.innerWidth <= 860;
  const labelEl = legendEl.querySelector('[data-legend-political]');
  if(isMobile){
    // Wewnątrz legendy tuż pod etykietą
    if(labelEl && politicalOpacityWrapperEl.previousElementSibling !== labelEl){
      labelEl.insertAdjacentElement('afterend', politicalOpacityWrapperEl);
    }
    politicalOpacityWrapperEl.classList.add('in-legend-mobile');
  } else {
    // Osobny bąbelek poza legendą (w panelu) – wstaw po elemencie legendy
    const sidepanel = document.getElementById('filters-panel');
    if(sidepanel && politicalOpacityWrapperEl.parentElement !== sidepanel){
      legendEl.insertAdjacentElement('afterend', politicalOpacityWrapperEl);
    } else if(sidepanel && politicalOpacityWrapperEl.previousElementSibling !== legendEl){
      legendEl.insertAdjacentElement('afterend', politicalOpacityWrapperEl);
    }
    politicalOpacityWrapperEl.classList.remove('in-legend-mobile');
  }
}

window.addEventListener('resize', placePoliticalOpacityWrapper);


// --- REPOZYCJONOWANIE WYSZUKIWARKI (aby nie nachodziła na toolbar/przyciski) ---
function repositionSearchBubble(){
  if(!searchBubble) return;
  const isNarrow = window.innerWidth <= 860;
  const bottomLayout = window.innerWidth <= 720; // dolne pozycjonowanie (CSS media query)
  if(isNarrow){
    searchBubble.style.left = '50%';
    searchBubble.style.transform = 'translateX(-50%)';
  } else {
    searchBubble.style.left = '.75rem';
    searchBubble.style.transform = 'none';
  }
  if(bottomLayout){
    // Tryb dolny: top:auto + bottom stałe (pozostaw CSS bottom jeśli ustawiony), ale usuń wcześniejsze top
    searchBubble.style.top = 'auto';
    // Zapewnij spójność gdy inline style bottom był wcześniej zdjęty
    if(!searchBubble.style.bottom) searchBubble.style.bottom = '5.1rem';
  } else {
    // Górne pozycjonowanie (desktop lub szerokie tablety)
    const margin = 12;
    let top = 0;
    if(toolbarEl){
      const rect = toolbarEl.getBoundingClientRect();
      top = rect.bottom + margin;
      // aktualizuj zmienną dla innych komponentów (np. lines-legend w trybie transport na mobile)
      document.documentElement.style.setProperty('--toolbar-bottom', rect.bottom + 'px');
    } else { top = 70; }
    searchBubble.style.top = `${Math.max(top, 8)}px`;
    searchBubble.style.bottom = '';
  }
  // Dopasowanie szerokości, aby nie zachodziło na panel boczny (desktop)
  if(!isNarrow){
    const sidepanel = document.querySelector('.map-sidepanel');
    if(sidepanel){
      const spRect = sidepanel.getBoundingClientRect();
      const maxRight = spRect.left - 12; // odstęp
      const bubbleRect = searchBubble.getBoundingClientRect();
      const currentLeft = bubbleRect.left;
      if(currentLeft + bubbleRect.width > maxRight){
        const newWidth = Math.max(260, maxRight - currentLeft);
        if(newWidth < bubbleRect.width){
          searchBubble.style.width = newWidth + 'px';
        }
      } else {
        searchBubble.style.width = '380px';
      }
    }
  } else {
    searchBubble.style.width = 'min(640px, 100% - 1.5rem)';
  }
  // Ustaw wysokość dymka jako zmienną CSS dla obliczenia pozycji brandu nad nim (mobile bottom)
  if(bottomLayout && brandEl){
    // Poczekaj aż layout się ustabilizuje (wysokość po zmianach szerokości)
    requestAnimationFrame(()=>{
      const h = searchBubble.offsetHeight;
      document.documentElement.style.setProperty('--sb-height', h + 'px');
    });
  } else {
    // Usuń zmienną gdy nie potrzebna
    document.documentElement.style.removeProperty('--sb-height');
  }
}
window.addEventListener('resize', repositionSearchBubble);
window.addEventListener('orientationchange', ()=> setTimeout(repositionSearchBubble, 150));
// Odroczone pierwsze wyliczenie po załadowaniu layoutu
requestAnimationFrame(()=> { repositionSearchBubble(); repositionLinesLegend(); });

// Repozycjonowanie legendy linii w zależności od trybu i szerokości
function repositionLinesLegend(){
  if(!linesLegendEl) return;
  const mobileBottom = window.innerWidth <= 720;
  if(mobileBottom && currentMode === 'transport'){
    // Top under toolbar – CSS zajmie się pozycjonowaniem przez media queries, więc wyczyść inline bottom jeśli istniało
    linesLegendEl.style.bottom = '';
    // Zostaw top pusty – styl ustawi go przez CSS; w razie gdy inline wcześniej był ustawiony usuń go
    linesLegendEl.style.top = '';
  } else {
    // Domyślna pozycja (dół) – usuwamy top żeby bottom z CSS działał
    linesLegendEl.style.top = '';
    linesLegendEl.style.bottom = '';
  }
}
window.addEventListener('resize', repositionLinesLegend);

// --- MOBILE UI: wysuwany panel filtrów ---
let mobileFiltersEnabled = false;
let mobileSheetInitialized = false;
function isMobileLayout(){ return window.innerWidth <= 860; }
function ensureMobileSheet(){
  if(!legendEl) return;
  const sidepanel = document.getElementById('filters-panel');
  if(!sidepanel) return;
  if(isMobileLayout()){
    mobileFiltersEnabled = true;
    // Dodaj klasę sheet
  sidepanel.classList.add('mobile-sheet');
    // Dodaj handle (raz)
    if(!mobileSheetInitialized){
      const handle = document.createElement('div'); handle.className='filters-handle'; sidepanel.appendChild(handle);
      mobileSheetInitialized = true;
    }
    // Ukryj przycisk jeśli nie ma legendy
    if(filtersToggleBtn) filtersToggleBtn.hidden = false;
    // Domyślnie ukryty (brak auto-open) – użytkownik sam otwiera przyciskiem
    if(filtersToggleBtn) filtersToggleBtn.setAttribute('aria-pressed','false');
  } else {
    mobileFiltersEnabled = false;
  sidepanel.classList.remove('mobile-sheet','open');
    if(filtersToggleBtn) filtersToggleBtn.hidden = true;
  }
}
ensureMobileSheet();
window.addEventListener('resize', ()=>{ ensureMobileSheet(); });
if(filtersToggleBtn){
  filtersToggleBtn.addEventListener('click', ()=>{
    const sidepanel = document.getElementById('filters-panel');
    if(!sidepanel) return;
    const open = sidepanel.classList.toggle('open');
    filtersToggleBtn.setAttribute('aria-pressed', open.toString());
    // Ukryj przycisk gdy panel otwarty (fallback jeśli selektor rodzeństwa nie zadziała)
    if(open) { filtersToggleBtn.classList.add('hide'); } else { filtersToggleBtn.classList.remove('hide'); }
    sidepanel.dataset.userToggled = '1';
    if(open){
      // Focus first checkbox (jeśli istnieje)
      const firstCbx = sidepanel.querySelector('.legend-item input[type="checkbox"]');
      if(firstCbx) firstCbx.focus({preventScroll:true});
    }
  });
}

// --- Gest przeciągania panelu filtrów (mobile) ---
(function initFiltersDrag(){
  const panel = document.getElementById('filters-panel');
  if(!panel) return;
  let startY = 0; let dragging = false; let currentTranslate = 0; let handleEl = null;
  function isMobile(){ return window.innerWidth <= 860; }
  function onPointerDown(e){
    if(!isMobile()) return;
    if(!panel.classList.contains('open')) return; // otwieramy tylko przyciskiem
    handleEl = panel.querySelector('.filters-handle');
    if(!handleEl) return;
    if(!e.target.closest('.filters-handle')) return; // drag tylko po uchwycie
    startY = e.clientY; dragging = true; currentTranslate = 0; panel.classList.add('dragging');
    panel.style.transition = 'none';
  }
  function onPointerMove(e){
    if(!dragging) return;
    const dy = e.clientY - startY;
    if(dy < 0) return; // nie pozwól ciągnąć w górę
    currentTranslate = dy;
    panel.style.transform = `translateY(${dy}px)`;
  }
  function onPointerUp(){
    if(!dragging) return;
    dragging = false;
    panel.classList.remove('dragging');
    panel.style.transition = '';
    const threshold = Math.min(160, Math.max(90, window.innerHeight * 0.18)); // adaptacyjny próg
    if(currentTranslate > threshold){
      panel.classList.remove('open');
      if(filtersToggleBtn) filtersToggleBtn.setAttribute('aria-pressed','false');
      if(filtersToggleBtn) filtersToggleBtn.classList.remove('hide');
      panel.style.transform = ''; // wróci do translateY(102%) przez klasę (bez .open)
    } else {
      panel.classList.add('open');
      panel.style.transform = '';
      if(filtersToggleBtn) filtersToggleBtn.classList.add('hide');
    }
  }
  panel.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
})();
// Zamknij panel filtrów przy tap poza (mobile)
document.addEventListener('click', (e)=>{
  if(!mobileFiltersEnabled) return;
  const sidepanel = document.getElementById('filters-panel');
  if(!sidepanel || !sidepanel.classList.contains('open')) return;
  if(sidepanel.contains(e.target) || (filtersToggleBtn && filtersToggleBtn.contains(e.target))) return;
  sidepanel.classList.remove('open');
  if(filtersToggleBtn) filtersToggleBtn.setAttribute('aria-pressed','false');
  if(filtersToggleBtn) filtersToggleBtn.classList.remove('hide');
});

// --- Wskaźnik koordynatów kursora (desktop) ---
(()=>{
  try{
    const isDesktop = (navigator.maxTouchPoints||0) === 0 && window.matchMedia('(pointer: fine)').matches;
    if(!isDesktop || !viewport) return;
    viewport.addEventListener('pointermove', (e)=>{ __lastPointerPos = { x:e.clientX, y:e.clientY }; updateCursorCoords(e.clientX, e.clientY); });
    viewport.addEventListener('pointerleave', ()=>{ __lastPointerPos = null; if(legendCursorEl) legendCursorEl.textContent='—'; });
  }catch(_){ }
})();

// Odbierz highlight trasy z route-search.js
window.addEventListener('route:highlight', e=>{
  const legs = e.detail?.legs || [];
  if(!linesData || !Array.isArray(linesData.lines)) return;
  if(legs.length === 0){
    routeHighlightedSegments = null;
    highlightedLineId = null;
    selectedLineId = null;
    routeEndpoints = null;
    removeRouteEndpointMarkers();
    lastRouteBBoxKey = null;
    drawLines();
    return;
  }
  // Upewnij się, że stacje kolej/metro oraz lotniska są widoczne (użytkownik może mieć je wyłączone w trybie general przed przełączeniem)
  activeCategories.delete('kolej');
  activeCategories.delete('metro');
  activeCategories.delete('airport');
  saveLegendState();
  buildLegend();
  // Budujemy mapę lineId -> stacje po kolei (scalamy, jeśli kilka nóg tej samej linii – rzadkie)
  const map = new Map();
  for(const leg of legs){
    if(!leg?.lineId || !Array.isArray(leg.stations) || leg.stations.length<2) continue;
    if(!map.has(leg.lineId)) map.set(leg.lineId, { stations:[...leg.stations] });
    else {
      const entry = map.get(leg.lineId);
      // Spróbuj płynnie dokleić (gdy ostatni == pierwszy nowego lub odwrotnie) – w przeciwnym razie zostaw pierwszą sekwencję
      const cur = entry.stations;
      const first = leg.stations[0];
      const last = leg.stations[leg.stations.length-1];
      if(cur[cur.length-1] === first){
        entry.stations.push(...leg.stations.slice(1));
      } else if(cur[0] === last){
        // Odwrócona kolejność – doklej z przodu
        entry.stations = [...leg.stations.slice(0,-1), ...entry.stations];
      }
    }
  }
  routeHighlightedSegments = map;
  // Endpoints (pierwsza stacja pierwszej nogi & ostatnia stacja ostatniej nogi)
  try {
    const firstLeg = legs[0];
    const lastLeg = legs[legs.length-1];
    const startId = firstLeg.stations[0];
    const endId = lastLeg.stations[lastLeg.stations.length-1];
    const idx = new Map(mapData.points.map(p=>[p.id,p]));
    const sp = idx.get(startId); const ep = idx.get(endId);
    if(sp && ep){
      const spPx = pointToPx(sp); const epPx = pointToPx(ep);
      routeEndpoints = { start:{ id:startId, x:spPx.x, y:spPx.y }, end:{ id:endId, x:epPx.x, y:epPx.y } };
      renderRouteEndpointMarkers();
    }
  } catch(_){ routeEndpoints=null; }
  // Nie ustawiamy highlightedLineId żeby nie pogrubiać całej linii – tylko segmenty.
  if(currentMode !== 'transport') applyMode('transport');
  drawLines();
  ensureRouteAnimation();
  focusRouteBBox(legs);
});

function focusRouteBBox(legs){
  if(!mapData || !Array.isArray(legs) || !legs.length) return;
  const idx = new Map(mapData.points.map(p=>[p.id,p]));
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const leg of legs){
    for(const sidRaw of (leg.stations||[])){
      const sid = typeof sidRaw==='string' ? sidRaw.replace(/\*$/,'') : sidRaw;
      const pt = idx.get(sid); if(!pt) continue;
      const {x,y} = pointToPx(pt);
      if(x<minX) minX=x; if(y<minY) minY=y; if(x>maxX) maxX=x; if(y>maxY) maxY=y;
    }
  }
  if(!isFinite(minX)||!isFinite(minY)||!isFinite(maxX)||!isFinite(maxY)) return;
  const key = [minX,minY,maxX,maxY].map(n=>n.toFixed(1)).join('|');
  if(key === lastRouteBBoxKey) return; // uniknij powtórnego zoomowania tej samej trasy
  lastRouteBBoxKey = key;
  const w = maxX - minX; const h = maxY - minY; if(w<=0||h<=0) return;
  const viewW = viewport.clientWidth; const viewH = viewport.clientHeight;
  const targetScale = Math.min( (viewW*0.68)/w, (viewH*0.68)/h );
  const clamped = Math.min(maxScale, Math.max(minScale, targetScale));
  scale = clamped;
  const cx = (minX + maxX)/2; const cy = (minY + maxY)/2;
  originX = (viewW/2) - cx * scale;
  originY = (viewH/2) - cy * scale;
  applyTransform();
}

function renderRouteEndpointMarkers(){
  if(!markersLayer) return;
  removeRouteEndpointMarkers();
  if(!routeEndpoints) return;
  const create = (id,label,cls)=>{
    const el = document.createElement('div');
    el.id = id; el.className = 'route-marker '+cls; el.setAttribute('aria-label', label);
    el.textContent = label;
    markersLayer.appendChild(el);
    return el;
  };
  const startEl = create('route-start-marker','S','start');
  const endEl = create('route-end-marker','E','end');
  positionRouteEndpointMarkers();
}
function positionRouteEndpointMarkers(){
  if(!routeEndpoints) return;
  const startEl = document.getElementById('route-start-marker');
  const endEl = document.getElementById('route-end-marker');
  if(startEl){ startEl.style.left = routeEndpoints.start.x + 'px'; startEl.style.top = routeEndpoints.start.y + 'px'; }
  if(endEl){ endEl.style.left = routeEndpoints.end.x + 'px'; endEl.style.top = routeEndpoints.end.y + 'px'; }
}
function removeRouteEndpointMarkers(){
  const s = document.getElementById('route-start-marker'); if(s) s.remove();
  const e = document.getElementById('route-end-marker'); if(e) e.remove();
}

// Aktualizuj po transformie (pozycje bazowe w pikselach mapy nie zmieniają się – transform rodzica skaluje). Jeśli jednak zmienisz system później, łatwo dopasować.
const origApplyTransform = applyTransform;
applyTransform = function(){
  origApplyTransform();
  positionRouteEndpointMarkers();
  maybeUpdateClusters();
};

// Udostępnij prosty interfejs dla panelu admina (live-reload markerów po zapisie)
window.MapApp = {
  reload: async () => {
    await fetchMapData(true);
    await fetchLinesData(true);
    buildLegend();
    buildLinesLegend();
    drawLines();
    buildMarkers();
  },
  rebuildMarkers: () => { drawLines(); buildMarkers(); },
  focusPoint: (pointId) => {
    if(!mapData) return;
    const p = mapData.points.find(pt=>pt.id===pointId); if(!p) return;
    const { x, y } = pointToPx(p);
    const viewW = viewport.clientWidth; const viewH = viewport.clientHeight;
    originX = (viewW/2) - x * scale;
    originY = (viewH/2) - y * scale;
    applyTransform();
  },
  reloadLines: (data)=>{
    if(data && data.lines){ linesData = data; }
    buildLinesLegend();
    drawLines();
  },
  highlightLine: (lineId)=>{
    if(!linesData) return;
    const ln = linesData.lines.find(l=>l.id===lineId); if(!ln) return;
    const evt = new CustomEvent('route:highlight', { detail:{ legs:[ { lineId:ln.id, stations: ln.stations||[] } ] } });
    window.dispatchEvent(evt);
  }
};

// Reaguj na zmianę systemowego motywu, gdy tryb ustawiony na auto
try {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  if(mql && typeof mql.addEventListener === 'function'){
    mql.addEventListener('change', () => {
      if(currentTheme === 'auto') {
        updateImageSource();
        drawLines();
        // Zmień zestaw kafelków na właściwy motyw i dopiero po pierwszym kafelku ukryj base
        purgeTilesOfOtherTheme();
        if(currentResolutionFactor > 1){
          awaitingFirstHiResTile = true;
          canvas.classList.remove('hires-on');
        }
        updateVisibleTiles();
      }
      window.dispatchEvent(new CustomEvent('theme-change'));
    });
  }
} catch(_) {}

// Obsługa toggle legendy linii
if(linesLegendToggleBtn && linesLegendEl && linesLegendBodyEl){
  linesLegendToggleBtn.addEventListener('click', ()=>{
    const collapsed = linesLegendEl.classList.toggle('collapsed');
    linesLegendBodyEl.hidden = collapsed;
    linesLegendToggleBtn.setAttribute('aria-expanded', (!collapsed).toString());
    linesLegendToggleBtn.textContent = collapsed ? 'Linie ▼' : 'Linie ▲';
    saveLegendState();
  });
}

// Odbuduj listę po zmianie motywu (kolory różne w jasnym/ciemnym)
document.addEventListener('visibilitychange', ()=> { if(!document.hidden) buildLinesLegend(); });

// --- Tryb mobilny lite (wydajność) ---
const isMobileDevice = (()=> {
  const ua = navigator.userAgent || '';
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || (matchMedia('(pointer:coarse)').matches && window.innerWidth < 1100);
})();
const mobileLiteMode = isMobileDevice && (window.innerWidth < 950); // główna heurystyka
if(mobileLiteMode){
  document.documentElement.classList.add('lite-map');
  // Ogranicz maksymalny zoom (mniejsze zużycie CPU przy skalowaniu UI)
  maxScale = 2.2;
  // Wymuś DPR=1 dla rysowania linii – oszczędność pamięci i fill-rate
  __MOBILE_LITE_FORCE_DPR1 = true;
}

// Throttle rysowania linii dla mobile (redukcja CPU przy szybkim pan/zoom)
let scheduledLines = false;
function scheduleDrawLines(){
  if(!mobileLiteMode){ drawLines(); return; }
  if(scheduledLines) return;
  scheduledLines = true;
  requestAnimationFrame(()=>{ scheduledLines = false; drawLines(); });
}

// Wrap or patch funkcje wydajności w trybie lite
const origMaybeUpgradeToHiRes = maybeUpgradeToHiRes;
maybeUpgradeToHiRes = function(){
  if(mobileLiteMode) return; // pomiń ładowanie hi-res na mobile
  origMaybeUpgradeToHiRes();
};

// Ograniczenie animacji tras – brak stałej pętli na mobile
const origEnsureRouteAnimation = ensureRouteAnimation;
ensureRouteAnimation = function(){
  if(mobileLiteMode){
    // Na mobile statyczne podświetlenie – po prostu narysuj raz
    drawLines();
    return;
  }
  origEnsureRouteAnimation();
};

// Patch applyTransform by throttle
const _origApplyTransformLiteWrap = applyTransform;
applyTransform = function(){
  _origApplyTransformLiteWrap();
  if(mobileLiteMode){
    // zamień bezpośrednie drawLines na harmonogram
    scheduleDrawLines();
    // Pokaż etykiety dopiero przy większym zbliżeniu
    const root = document.documentElement;
    if(scale > 1.1){
      if(!root.classList.contains('lite-show-labels')) root.classList.add('lite-show-labels');
    } else {
      if(root.classList.contains('lite-show-labels')) root.classList.remove('lite-show-labels');
    }
  }
};

// Zapobiegaj przewijaniu strony/pull-to-refresh w obszarze mapy
if(mobileLiteMode){
  viewport.addEventListener('touchmove', e=>{ e.preventDefault(); }, { passive:false });
  // Linie legend toggle – zablokuj double-tap zoom i overscroll
  if(linesLegendToggleBtn){
    linesLegendToggleBtn.addEventListener('touchstart', e=>{ e.preventDefault(); }, { passive:false });
  }
  // Minimalizuj częstotliwość przebudowy klastrów: bardziej agresywne klastrowanie
  // (nadpisujemy parametry jeśli wcześniejsze były załadowane)
  if(typeof CLUSTER_ZOOM_THRESHOLD !== 'undefined'){
    // Wymuszone klastrowanie prawie zawsze przy mniejszym i średnim zoomie – brak bezpośredniego redeklarowania const, więc dodajemy globalną flage
    window.__clusterMobileBias = 1;
  }
}

