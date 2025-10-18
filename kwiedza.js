// kWiedza frontend: kafelki + render Markdown i przycisk Powrót

function $(sel){ return document.querySelector(sel); }
const gridEl = $('#docs-grid');
const contentEl = $('#doc-content');
const searchEl = $('#search');
const backBtn = $('#back-btn');

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
    tile.addEventListener('click', ()=> navigateTo(d.slug));
    frag.appendChild(tile);
  });
  gridEl.appendChild(frag);
}

async function fetchList(){
  // Lista dokumentów pobierana dynamicznie z GitHub API, z tytułami z plików .md
  try {
    const response = await fetch('https://api.github.com/repos/KibelSMP/kObywatel/contents/assets/docs');
    if (!response.ok) throw new Error('Nie udało się pobrać listy dokumentów');
    const files = await response.json();
    const docs = await Promise.all(files
      .filter(f => f.name.endsWith('.md'))
      .map(async f => {
        const slug = f.name.replace('.md', '');
        const url = `https://raw.githubusercontent.com/KibelSMP/kObywatel/main/assets/docs/${encodeURI(slug)}.md`;
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error();
          const fullContent = await r.text();
          const { meta, content: rawContent } = parseFrontmatter(fullContent);
          let title = meta.title || slug.replace(/_/g, ' ');
          const lines = rawContent.split('\n');
          if (lines[0] && lines[0].startsWith('# ')) {
            title = lines[0].substring(2).trim();
          }
          return { slug, title, meta };
        } catch (e) {
          return { slug, title: slug.replace(/_/g, ' '), meta: {} };
        }
      }));
    return docs;
  } catch (e) {
    console.warn('Błąd pobierania listy z GitHub:', e);
    return [];
  }
}
async function fetchDoc(slug){
  // Pobierz Markdown bezpośrednio z lokalnego folderu assets/docs/
  const list = await fetchList();
  const entry = list.find(d => d.slug === slug);
  const url = `https://raw.githubusercontent.com/KibelSMP/kObywatel/main/assets/docs/${encodeURI(slug)}.md`;
  const r = await fetch(url, { cache: 'no-store' });
  if(!r.ok) throw new Error('HTTP '+r.status);
  const fullContent = await r.text();
  const { meta: frontMeta, content: rawContent } = parseFrontmatter(fullContent);
  let title = frontMeta.title || (entry && entry.title) || slug;
  let content = rawContent;
  // Jeśli tytuł nie jest ustawiony, sprawdź pierwszą linię na # Tytuł
  if(!frontMeta.title && !entry?.title){
    const lines = content.split('\n');
    if(lines[0] && lines[0].startsWith('# ')){
      title = lines[0].substring(2).trim();
      content = lines.slice(1).join('\n').trim();
    }
  }
  // Jeśli content zaczyna się od # Tytuł, który jest taki sam jak title, usuń go aby uniknąć duplikatu
  const lines = content.split('\n');
  if(lines[0] && lines[0].startsWith('# ') && lines[0].substring(2).trim() === title){
    content = lines.slice(1).join('\n').trim();
  }
  const meta = { ...frontMeta, ...entry?.meta };
  let pdfUrl = entry?.pdfUrl || frontMeta.pdf || null;
  if(pdfUrl && !pdfUrl.startsWith('/assets/docs/')){
    pdfUrl = `/assets/docs/${pdfUrl.replace(/^\//, '')}`;
  }
  return { title, content, html: null, meta, pdfUrl };
}

// Funkcja do parsowania frontmatter z Markdown
function parseFrontmatter(md){
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = md.match(frontmatterRegex);
  if(!match) return { meta: {}, content: md };
  const frontmatter = match[1];
  const content = match[2];
  const meta = {};
  frontmatter.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if(key && valueParts.length){
      const value = valueParts.join(':').trim();
      if(value.startsWith('[') && value.endsWith(']')){
        meta[key.trim()] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        meta[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
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
  document.body.setAttribute('data-mode','condensed');
  if(gridEl) gridEl.hidden = true;
  if(contentEl) contentEl.hidden = false;
  contentEl.innerHTML = '<p>Ładowanie...</p>';
  try {
    const { title, content, html: serverHtml, meta, pdfUrl } = await fetchDoc(slug);
    const html = serverHtml || mdToHtml(content||'');
    const metaHtml = renderMetaChips(meta);
    // Uwaga: serverHtml pochodzi z markdown-it po stronie serwera; ufamy źródłu (lokalne pliki).
    const actions = pdfUrl ? `<div class="doc-actions"><a class="mini-btn icon-btn" href="${encodeURI(pdfUrl)}" download><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Pobierz PDF</a></div>` : '';
  contentEl.innerHTML = `<div class="doc-wrap"><h1>${escapeHtml(title||slug)}</h1>${actions}${metaHtml}\n${html}</div>`;
    // accessibility announce
    contentEl.setAttribute('aria-busy','false');
    document.title = `kWiedza – ${title||slug}`;
  } catch(e){
    contentEl.innerHTML = `<p>Błąd ładowania dokumentu: ${escapeHtml(e.message)}</p>`;
  }
}

function getSlugFromPath(){
  const url = new URL(location);
  return url.searchParams.get('slug') || '';
}
function navigateTo(slug){
  history.pushState({ slug }, '', `?${encodeURIComponent(slug)}`);
  renderDoc(slug);
}
window.addEventListener('popstate', ()=>{
  const slug = getSlugFromPath();
  if(slug) renderDoc(slug); else showHome();
});

function showHome(){
  document.body.removeAttribute('data-mode');
  if(gridEl) gridEl.hidden = false;
  if(contentEl){
    contentEl.hidden = true;
    contentEl.innerHTML = '';
  }
  document.title = 'kWiedza – Dokumenty';
}

async function init(){
  try {
    let docs = await fetchList();
    renderTiles(docs);
    const slug = getSlugFromPath();
    if(slug){ await renderDoc(slug); } else { showHome(); }
    searchEl?.addEventListener('input', ()=>{
      const q = (searchEl.value||'').toLowerCase();
      const filtered = !q? docs: docs.filter(d => (d.title||'').toLowerCase().includes(q) || (d.slug||'').toLowerCase().includes(q));
      renderTiles(filtered);
    });
    backBtn?.addEventListener('click', ()=>{
      history.pushState({}, '', '/kwiedza');
      showHome();
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
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
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
