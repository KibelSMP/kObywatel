// kWiedza: kategorie -> lista dokumentów -> dokument

function $(sel){ return document.querySelector(sel); }
const gridEl = $('#docs-grid');
const contentEl = $('#doc-content');
const searchEl = $('#search');
const backBtn = $('#back-btn');
// Mobile search controls (kWiedza)
const searchMobileEl = document.getElementById('kw-search-mobile');
const clearSearchMobileBtn = document.getElementById('kw-clear-search-mobile');

// Stan aplikacji
const state = {
  mode: 'categories', // 'categories' | 'list' | 'doc'
  allDocs: [],
  currentCategory: '',
  currentDoc: '',
  // Kontekst wyszukiwania globalnego (aby po wyczyszczeniu wrócić do poprzedniego widoku)
  searchActive: false,
  prev: null
};

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch])); }

function renderTiles(docs){
  if(!gridEl) return;
  gridEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  docs.forEach(d => {
    const tile = document.createElement('button');
    tile.className = 'docs-tile';
    tile.type = 'button';
    tile.dataset.slug = d.slug;
    // Przygotuj tytuł do kafelka: max 160 znaków (tooltip zawiera pełny)
    const fullTitle = String(d.title || d.slug || '');
    const MAX_TITLE_LEN = 160;
    const shortTitle = fullTitle.length > MAX_TITLE_LEN ? (fullTitle.slice(0, MAX_TITLE_LEN - 1) + '…') : fullTitle;
    tile.title = fullTitle; // tooltip z pełnym tytułem
    const hierParts = [d?.hierarchy?.section, d?.hierarchy?.category, d?.hierarchy?.group]
      .filter(Boolean)
      .map(s => escapeHtml(String(s)));
    const hier = hierParts.length ? `<div class="tile-hier"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>${hierParts.join(' / ')}</div>` : '';
  const excerpt = d.excerpt ? `<div class="tile-excerpt">${escapeHtml(String(d.excerpt))}</div>` : '';
    tile.innerHTML = `
      <div class="tile-main">
        <div class="tile-title">${escapeHtml(shortTitle)}</div>
        ${hier}
        ${excerpt}
      </div>
      <svg class="tile-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;
    tile.addEventListener('click', ()=> navigateToDoc(state.currentCategory || getDocCategory(d), d.slug));
    frag.appendChild(tile);
  });
  gridEl.appendChild(frag);
}

function setBackButtonVisible(visible){
  if(backBtn){ backBtn.hidden = !visible; }
}

async function fetchList(){
  try{
    const r = await fetch('/assets/docs/index.json', { cache: 'no-store' });
    if(!r.ok) throw new Error('Nie udało się pobrać index.json');
    const data = await r.json();
    // Obsługa skompresowanego schema: dopuszczamy aliasy kluczy
    // Root: categories | c
    const categories = Array.isArray(data?.categories) ? data.categories : (Array.isArray(data?.c) ? data.c : null);
    if(!categories) throw new Error('Niepoprawny format index.json (brak categories)');
    const flat = [];
    categories.forEach(cat => {
      const cname = String((cat && (cat.name ?? cat.n)) || 'Inne').trim();
      const docsArr = Array.isArray(cat?.docs) ? cat.docs : (Array.isArray(cat?.d) ? cat.d : []);
      docsArr.forEach(doc => {
        const slug = String((doc.slug ?? doc.s ?? '')).trim();
        const title = String((doc.title ?? doc.t ?? slug)).trim();
        const excerpt = String((doc.excerpt ?? doc.e ?? '')).trim();
        const author = String((doc.author ?? doc.autor ?? doc.au ?? '')).trim();
        const fileMd = (doc.md ?? doc.m) ? String(doc.md ?? doc.m) : null;
        const filePdf = (doc.pdf ?? doc.p) ? String(doc.pdf ?? doc.p) : null;
        flat.push({
          slug,
          title,
          meta: { category: cname, excerpt, author },
          excerpt,
          _fileMd: fileMd,
          _filePdf: filePdf
        });
      });
    });
    return flat;
  } catch(e){
    console.warn('Błąd pobierania index.json:', e);
    return [];
  }
}

async function fetchDoc(slug){
  const entry = state.allDocs.find(d => d.slug === slug);
  if(!entry) throw new Error('Nie znaleziono dokumentu');
  const title = entry.title || slug;
  let pdfUrl = null;
  let mdContent = '';
  // Skopiuj meta, które mogą zostać wzbogacone o dane z frontmatter MD
  const mergedMeta = { ...(entry.meta || {}) };
  if(entry._filePdf){
    pdfUrl = `/assets/docs/${entry._filePdf}`;
  }
  if(entry._fileMd){
    try{
      const url = `/assets/docs/${entry._fileMd}`;
      const r = await fetch(url, { cache: 'no-store' });
      if(!r.ok) throw new Error('HTTP '+r.status);
      let mdRaw = await r.text();
      // Parsuj frontmatter, aby wyłuskać np. autora; następnie usuń # Tytuł
      const fm = parseFrontmatter(mdRaw);
      const fmMeta = fm.meta || {};
      // Uzupełnij autora z frontmatter, jeśli brak/empty w JSON
      const fmAuthor = String((fmMeta.author ?? fmMeta.autor ?? '')).trim();
      if(!mergedMeta.author && fmAuthor){ mergedMeta.author = fmAuthor; }
      let md = fm.content != null ? fm.content : mdRaw;
      const lines = md.split(/\r?\n/);
      let i=0; while(i<lines.length && lines[i].trim()==='') i++;
      if(i<lines.length && /^#\s+/.test(lines[i])){ lines.splice(i,1); }
      mdContent = lines.join('\n');
    } catch(e){
      // Jeśli nie udało się pobrać MD, a mamy PDF – pokaż chociaż PDF
      if(!pdfUrl) throw e;
    }
  }
  if(!pdfUrl && !mdContent){
    return { title, content: 'Brak treści dokumentu.', html: null, meta: mergedMeta, pdfUrl: null };
  }
  return { title, content: mdContent, html: null, meta: mergedMeta, pdfUrl };
}

// Funkcja do parsowania frontmatter z Markdown
function parseFrontmatter(md){
  // Usuń BOM i obsłuż LF/CRLF; zezwól na wiodące puste linie
  const stripBOM = s => s.replace(/^\uFEFF/, '');
  md = stripBOM(md);
  const frontmatterRegex = /^[\s\r\n]*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = md.match(frontmatterRegex);
  if(!match) return { meta: {}, content: md };
  const frontmatter = match[1];
  const content = match[2];
  const meta = {};
  let currentListKey = null;
  frontmatter.split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.replace(/\t/g, '    ');
    const keyVal = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    const listItem = line.match(/^\s*-\s*(.*)$/);
    if(keyVal){
      const key = keyVal[1].trim();
      const value = keyVal[2] != null ? keyVal[2].trim() : '';
      currentListKey = null;
      if(value === ''){
        // Potencjalna lista w kolejnych liniach
        meta[key] = [];
        currentListKey = key;
      } else if(value.startsWith('[') && value.endsWith(']')){
        meta[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        meta[key] = value.replace(/^["']|["']$/g, '');
      }
    } else if(listItem && currentListKey){
      const v = listItem[1].trim().replace(/^["']|["']$/g, '');
      if(Array.isArray(meta[currentListKey])) meta[currentListKey].push(v);
    }
  });
  return { meta, content };
}

function renderMetaChips(meta){
  if(!meta || typeof meta !== 'object') return '';
  const SKIP = new Set(['title','pdf','pdfpath','pdf_url','pdf-url','pdfurl','haspdf']);
  const entries = Object.entries(meta).filter(([k,v]) => !SKIP.has(String(k).toLowerCase()) && v != null && String(v).trim() !== '');
  if(!entries.length) return '';
  const chips = entries.map(([k,v])=> `<span class="meta-chip"><span class="k">${escapeHtml(k)}:</span> <span class="v">${escapeHtml(String(v))}</span></span>`).join('');
  return `<div class="meta-bar">${chips}</div>`;
}

async function renderDoc(slug){
  state.mode = 'doc';
  state.currentDoc = slug;
  document.body.setAttribute('data-mode','condensed');
  setBackButtonVisible(true);
  if(gridEl) gridEl.hidden = true;
  if(contentEl) contentEl.hidden = false;
  contentEl.innerHTML = '<p>Ładowanie...</p>';
  try {
    const { title, content, html: serverHtml, meta, pdfUrl } = await fetchDoc(slug);
    const html = serverHtml || mdToHtml(content||'');
    // Na stronie dokumentu: pokazujemy tylko autora pod tytułem, bez kategorii i excerpt
    const authorVal = (meta && (meta.author || meta.autor)) ? String(meta.author || meta.autor) : '';
    const authorLine = authorVal ? `<div class="doc-author" style="margin:-.35rem 0 .85rem;opacity:.8;font-size:.9rem;"><span style="font-weight:600;letter-spacing:.3px;">Autor:</span> ${escapeHtml(authorVal)}</div>` : '';
    // Uwaga: serverHtml pochodzi z markdown-it po stronie serwera; ufamy źródłu (lokalne pliki).
    const actions = pdfUrl ? `<div class="doc-actions"><a class="mini-btn icon-btn" href="${encodeURI(pdfUrl)}" download><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Pobierz PDF</a></div>` : '';
    contentEl.innerHTML = `<div class="doc-wrap"><h1>${escapeHtml(title||slug)}</h1>${authorLine}${actions}\n${html}</div>`;
    // accessibility announce
    contentEl.setAttribute('aria-busy','false');
    document.title = `kWiedza – ${title||slug}`;
  } catch(e){
    contentEl.innerHTML = `<p>Błąd ładowania dokumentu: ${escapeHtml(e.message)}</p>`;
  }
}

function parseRoute(){
  const url = new URL(location);
  const params = url.searchParams;
  const cat = params.get('cat') || '';
  const doc = params.get('doc') || '';
  if(!cat && !doc && url.search && !url.search.includes('=')){
    // legacy: ?slug
    return { cat: '', doc: decodeURIComponent(url.search.slice(1)) };
  }
  return { cat, doc };
}
function navigateToCategories(){
  state.mode = 'categories'; state.currentCategory = ''; state.currentDoc = '';
  history.pushState({ mode: 'categories' }, '', '/kwiedza');
  renderCategories();
}
function navigateToCategory(cat){
  state.mode = 'list'; state.currentCategory = cat; state.currentDoc = '';
  history.pushState({ mode: 'list', cat }, '', `?cat=${encodeURIComponent(cat)}`);
  renderDocsList(cat);
}
function navigateToDoc(cat, slug){
  state.mode = 'doc'; state.currentCategory = cat || state.currentCategory; state.currentDoc = slug;
  const sp = new URLSearchParams();
  if(state.currentCategory) sp.set('cat', state.currentCategory);
  sp.set('doc', slug);
  history.pushState({ mode: 'doc', cat: state.currentCategory, doc: slug }, '', `?${sp.toString()}`);
  renderDoc(slug);
}
window.addEventListener('popstate', ()=>{
  const { cat, doc } = parseRoute();
  if(doc){ state.currentCategory = cat || state.currentCategory; renderDoc(doc); }
  else if(cat){ navigateToCategory(cat); }
  else { renderCategories(); }
});

function showHome(){ navigateToCategories(); }

function getDocCategory(d){
  const m = d?.meta || {};
  const c = typeof m.category === 'string' ? m.category.trim() : (Array.isArray(m.category) ? String(m.category[0]).trim() : '');
  return c || 'Inne';
}

function computeCategories(docs){
  const map = new Map();
  docs.forEach(d => {
    let c = getDocCategory(d);
    if(typeof c === 'string') c = c.trim();
    if(!c){ c = 'Inne'; }
    if(c === 'Inne' && d?.meta){ console.warn('Brak category w dokumencie', d.slug, d.meta); }
    map.set(c, (map.get(c) || 0) + 1);
  });
  return map;
}

// Globalne wyniki wyszukiwania (wszystkie dokumenty pasujące do zapytania), zastępuje widok kategorii / listy
function renderGlobalSearchList(q){
  const query = (q||'').toLowerCase();
  if(!query){ return renderCategories(); }
  // Zapisz kontekst tylko raz – przy pierwszym wejściu w wyszukiwanie
  if(!state.searchActive){
    state.prev = { mode: state.mode, cat: state.currentCategory, doc: state.currentDoc };
    state.searchActive = true;
  }
  document.body.setAttribute('data-mode','condensed'); // pokaż przycisk wstecz
  if(contentEl){ contentEl.hidden = true; contentEl.innerHTML = ''; }
  if(gridEl){ gridEl.hidden = false; gridEl.innerHTML=''; }
  setBackButtonVisible(true);
  // Nie zmieniamy state.mode na 'list' ani 'categories' – tworzymy pseudo tryb wyszukiwania; użyjemy 'list' dla logiki back button
  state.mode = 'list';
  state.currentCategory = ''; // globalny zakres
  const docs = state.allDocs.filter(d => {
    const t = (d.title||'').toLowerCase();
    const s = (d.slug||'').toLowerCase();
    const cat = getDocCategory(d).toLowerCase();
    return t.includes(query) || s.includes(query) || cat.includes(query);
  }).sort((a,b)=> (a.title||'').localeCompare(b.title||'', 'pl', { sensitivity: 'base' }));
  renderTiles(docs);
  document.title = `kWiedza – Wyniki: ${q}`;
}

function endGlobalSearchIfAny(){
  if(!state.searchActive){
    // Odśwież aktualny widok bez zmiany kontekstu
    if(state.mode==='doc' && state.currentDoc){ renderDoc(state.currentDoc); }
    else if(state.mode==='list' && state.currentCategory){ renderDocsList(state.currentCategory); }
    else { renderCategories(); }
    return;
  }
  const prev = state.prev || { mode: 'categories', cat: '', doc: '' };
  state.searchActive = false; state.prev = null;
  if(prev.mode==='doc' && prev.doc){ renderDoc(prev.doc); }
  else if(prev.mode==='list' && prev.cat){ renderDocsList(prev.cat); }
  else { renderCategories(); }
}

function renderCategories(){
  // Jeśli aktywne wyszukiwanie - pokaż listę wyników globalnych zamiast kategorii
  const qActive = (searchEl?.value || searchMobileEl?.value || '').trim();
  if(qActive){ return renderGlobalSearchList(qActive); }
  state.mode = 'categories';
  document.body.removeAttribute('data-mode');
  if(contentEl){ contentEl.hidden = true; contentEl.innerHTML = ''; }
  if(gridEl){ gridEl.hidden = false; gridEl.innerHTML=''; }
  setBackButtonVisible(false);
  // Dopasuj placeholdery
  if(searchEl){ searchEl.placeholder = 'Szukaj dokumentów…'; }
  if(searchMobileEl){ searchMobileEl.placeholder = 'Szukaj dokumentów…'; }
  const catsMap = computeCategories(state.allDocs);
  const q = (searchEl?.value || '').toLowerCase();
  const cats = Array.from(catsMap.entries())
    .filter(([name]) => !q || name.toLowerCase().includes(q))
    .sort((a,b)=> a[0].localeCompare(b[0],'pl'));
  const frag = document.createDocumentFragment();
  cats.forEach(([name,count])=>{
    const tile = document.createElement('button');
    tile.className = 'docs-tile'; tile.type='button'; tile.dataset.category=name;
    tile.innerHTML = `
      <div class="tile-main">
        <div class="tile-title">${escapeHtml(name)}</div>
        <div class="tile-hier">Kategoria</div>
      </div>
      <span class="khandel-badge" style="background:#1e2a36;border:1px solid #2a3a47;padding:.25rem .55rem;border-radius:999px;font-size:.75rem;font-weight:700;">${count}</span>`;
    tile.addEventListener('click', ()=> navigateToCategory(name));
    frag.appendChild(tile);
  });
  gridEl.appendChild(frag);
  document.title = 'kWiedza – Kategorie';
}

function renderDocsList(cat){
  // Jeśli aktywne wyszukiwanie - pokaż listę wyników globalnych zamiast listy kategorii
  const qActive = (searchEl?.value || searchMobileEl?.value || '').trim();
  if(qActive){ return renderGlobalSearchList(qActive); }
  state.mode = 'list';
  // Użyj tego samego trybu co widok dokumentu, aby pokazać przycisk wstecz w nagłówku
  document.body.setAttribute('data-mode','condensed');
  if(contentEl){ contentEl.hidden = true; contentEl.innerHTML = ''; }
  if(gridEl){ gridEl.hidden = false; gridEl.innerHTML=''; }
  const all = state.allDocs.filter(d => getDocCategory(d) === cat);
  const q = (searchEl?.value || '').toLowerCase();
  const docs = (!q? all : all.filter(d => (d.title||'').toLowerCase().includes(q) || (d.slug||'').toLowerCase().includes(q)))
    .slice()
    .sort((a,b)=> (a.title||'').localeCompare(b.title||'', 'pl', { sensitivity: 'base' }));
  setBackButtonVisible(true);
  renderTiles(docs);
  document.title = `kWiedza – ${cat}`;
}

async function init(){
  try {
    state.allDocs = await fetchList();
    const { cat, doc } = parseRoute();
    if(doc){ state.currentCategory = cat || ''; await renderDoc(doc); }
    else if(cat){ navigateToCategory(cat); }
    else { renderCategories(); }
    searchEl?.addEventListener('input', ()=>{
      const q = searchEl.value.trim();
      if(q){ renderGlobalSearchList(q); }
      else { endGlobalSearchIfAny(); }
    });
    // Mobile search sync
    const syncInputs = (from, to)=>{ if(!from || !to) return; to.value = from.value; };
    if(searchEl && searchMobileEl){
      // PC -> Mobile
      searchEl.addEventListener('input', ()=>{ 
        syncInputs(searchEl, searchMobileEl); 
        const hasQ = !!searchEl.value.trim();
        if(clearSearchMobileBtn){ clearSearchMobileBtn.classList.toggle('active', hasQ); }
      });
      searchMobileEl.addEventListener('input', ()=>{
        syncInputs(searchMobileEl, searchEl);
        const hasQ = !!searchMobileEl.value.trim();
        if(clearSearchMobileBtn){ clearSearchMobileBtn.classList.toggle('active', hasQ); }
        const q = searchMobileEl.value.trim();
        if(q){ renderGlobalSearchList(q); }
        else { endGlobalSearchIfAny(); }
      });
      searchMobileEl.addEventListener('keydown', (e)=>{
        if(e.key==='Enter'){
          e.preventDefault();
          const q = searchMobileEl.value.trim();
          if(q){ renderGlobalSearchList(q); }
          else { endGlobalSearchIfAny(); }
        } else if(e.key==='Escape'){
          if(searchMobileEl.value){
            searchMobileEl.value=''; syncInputs(searchMobileEl, searchEl);
            endGlobalSearchIfAny();
          }
        }
      });
    }
    if(clearSearchMobileBtn){
      clearSearchMobileBtn.addEventListener('click', ()=>{
        if(searchMobileEl){ searchMobileEl.value=''; }
        if(searchEl){ searchEl.value=''; }
        clearSearchMobileBtn.classList.remove('active'); // ukrywa przycisk (CSS display:none)
        endGlobalSearchIfAny();
        searchMobileEl?.focus();
      });
      // Inicjalnie ukryty
      clearSearchMobileBtn.classList.remove('active');
    }
    // Rozwijanie/zamykanie paska na mobile
    function getKwBottomSearch(){ return document.querySelector('.kw-bottom-search'); }
    function expandKwMobileSearch(){ const w = getKwBottomSearch(); if(w) w.classList.add('expanded'); }
    function collapseKwMobileSearch(){ const w = getKwBottomSearch(); if(w) w.classList.remove('expanded'); }
    if(searchMobileEl){
      searchMobileEl.addEventListener('focus', ()=>{ expandKwMobileSearch(); });
    }
    document.addEventListener('click', (e)=>{
      const w = getKwBottomSearch(); if(!w) return;
      if(w.contains(e.target)){ w.classList.add('expanded'); } else { collapseKwMobileSearch(); }
    });
    backBtn?.addEventListener('click', ()=>{
      if(state.mode==='doc' && state.currentCategory){ navigateToCategory(state.currentCategory); }
      else { navigateToCategories(); }
    });
  } catch(e){
    contentEl.innerHTML = `<p>Błąd inicjalizacji: ${escapeHtml(e.message)}</p>`;
  }
}

// Konwerter Markdown->HTML używający Markdown-it
function mdToHtml(md){
  if(typeof window.markdownit !== 'function') return '<p>Biblioteka Markdown-it nie została załadowana.</p>';
  const mdParser = window.markdownit({
    html: true,        // Zezwalaj na HTML w Markdown
    linkify: true,     // Automatycznie linkuj URL
    typographer: true  // Inteligentne cudzysłowy itp.
  });
  // Usuń frontmatter jeśli istnieje
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const cleanMd = md.replace(frontmatterRegex, '');
  return mdParser.render(cleanMd);
}

// User menu init (based on khandel.js minimal)
// Wersja publiczna: ukryj elementy loginu; menu użytkownika niewspierane w trybie statycznym
(async function initUserMenu(){
  try {
    // Brak backendu – schowaj elementy loginu jeśli istnieją
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    const toggle = document.getElementById('user-toggle');
    const dropdown = document.getElementById('user-dropdown');
    const loginBtn = document.getElementById('login-btn');
    if(toggle) toggle.hidden = true;
    if(loginBtn) loginBtn.hidden = true;
    if(avatarEl) avatarEl.hidden = true;
    if(nameEl) nameEl.hidden = true;
  } catch(_){
    // ignore
  }
})();

// Upewnij się, że adapter jest gotowy
window.__db.loadConfig().then(init).catch(err=>{
  const contentEl = document.getElementById('doc-content');
  if(contentEl) contentEl.innerHTML = `<p>Błąd konfiguracji danych: ${String(err.message||err)}</p>`;
});
