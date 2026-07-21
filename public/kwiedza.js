// kWiedza island: kategorie -> lista dokumentów -> dokument.
// Ported from the legacy kwiedza.js — logic (state machine, history deep-linking,
// global search context save/restore, markdown rendering) is unchanged; only the
// injected markup class strings were reskinned to Tailwind. Globals expected:
// window.__db, window.escapeHtml, window.markdownit, window.KWiedzaData.

function $(sel) { return document.querySelector(sel); }
const gridEl = $('#docs-grid');
const contentEl = $('#doc-content');
const searchEl = $('#search');
const backBtn = $('#kw-back');

const state = {
  mode: 'categories',
  allDocs: [],
  currentCategory: '',
  currentDoc: '',
  searchActive: false,
  prev: null,
};

const TILE_CLASS =
  'group flex w-full items-center gap-3 rounded-2xl border border-koborder bg-koelev p-4 text-left transition hover:border-koaccent/70 hover:bg-koelev2';

function renderTiles(docs) {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  docs.forEach((d) => {
    const tile = document.createElement('button');
    tile.className = TILE_CLASS;
    tile.type = 'button';
    tile.dataset.slug = d.slug;
    const fullTitle = String(d.title || d.slug || '');
    const MAX_TITLE_LEN = 160;
    const shortTitle =
      fullTitle.length > MAX_TITLE_LEN ? fullTitle.slice(0, MAX_TITLE_LEN - 1) + '…' : fullTitle;
    tile.title = fullTitle;
    const hierParts = [d?.hierarchy?.section, d?.hierarchy?.category, d?.hierarchy?.group]
      .filter(Boolean)
      .map((s) => escapeHtml(String(s)));
    const hier = hierParts.length
      ? `<div class="mt-1 text-xs font-medium text-kodim">${hierParts.join(' / ')}</div>`
      : '';
    const excerpt = d.excerpt
      ? `<div class="mt-1 line-clamp-2 text-sm text-kodim">${escapeHtml(String(d.excerpt))}</div>`
      : '';
    tile.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-semibold text-kotext">${escapeHtml(shortTitle)}</div>
        ${hier}
        ${excerpt}
      </div>
      <svg class="h-5 w-5 shrink-0 text-kodim transition group-hover:text-koaccent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;
    tile.addEventListener('click', () => navigateToDoc(state.currentCategory || getDocCategory(d), d.slug));
    frag.appendChild(tile);
  });
  gridEl.appendChild(frag);
}

async function fetchDoc(slug) {
  const entry = state.allDocs.find((d) => d.slug === slug);
  if (!entry) throw new Error('Nie znaleziono dokumentu');
  const title = entry.title || slug;
  let pdfUrl = null;
  let mdContent = '';
  const mergedMeta = { ...(entry.meta || {}) };
  if (entry._filePdf) pdfUrl = `/assets/docs/${entry._filePdf}`;
  if (entry._fileMd) {
    try {
      const url = `/assets/docs/${entry._fileMd}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      let mdRaw = await r.text();
      const fm = parseFrontmatter(mdRaw);
      const fmMeta = fm.meta || {};
      const fmAuthor = String(fmMeta.author ?? fmMeta.autor ?? '').trim();
      if (!mergedMeta.author && fmAuthor) mergedMeta.author = fmAuthor;
      let md = fm.content != null ? fm.content : mdRaw;
      const lines = md.split(/\r?\n/);
      let i = 0;
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i < lines.length && /^#\s+/.test(lines[i])) lines.splice(i, 1);
      mdContent = lines.join('\n');
    } catch (e) {
      if (!pdfUrl) throw e;
    }
  }
  if (!pdfUrl && !mdContent) {
    return { title, content: 'Brak treści dokumentu.', html: null, meta: mergedMeta, pdfUrl: null };
  }
  return { title, content: mdContent, html: null, meta: mergedMeta, pdfUrl };
}

function parseFrontmatter(md) {
  const stripBOM = (s) => s.replace(/^﻿/, '');
  md = stripBOM(md);
  const frontmatterRegex = /^[\s\r\n]*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = md.match(frontmatterRegex);
  if (!match) return { meta: {}, content: md };
  const frontmatter = match[1];
  const content = match[2];
  const meta = {};
  let currentListKey = null;
  frontmatter.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/\t/g, '    ');
    const keyVal = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    const listItem = line.match(/^\s*-\s*(.*)$/);
    if (keyVal) {
      const key = keyVal[1].trim();
      const value = keyVal[2] != null ? keyVal[2].trim() : '';
      currentListKey = null;
      if (value === '') {
        meta[key] = [];
        currentListKey = key;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        meta[key] = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        meta[key] = value.replace(/^["']|["']$/g, '');
      }
    } else if (listItem && currentListKey) {
      const v = listItem[1].trim().replace(/^["']|["']$/g, '');
      if (Array.isArray(meta[currentListKey])) meta[currentListKey].push(v);
    }
  });
  return { meta, content };
}

function renderMetaChips(meta) {
  if (!meta || typeof meta !== 'object') return '';
  const SKIP = new Set(['title', 'pdf', 'pdfpath', 'pdf_url', 'pdf-url', 'pdfurl', 'haspdf']);
  const entries = Object.entries(meta).filter(
    ([k, v]) => !SKIP.has(String(k).toLowerCase()) && v != null && String(v).trim() !== ''
  );
  if (!entries.length) return '';
  const chips = entries
    .map(
      ([k, v]) =>
        `<span class="inline-flex items-center gap-1 rounded-full border border-koborder bg-koelev2 px-2.5 py-1 text-xs"><span class="font-semibold text-kodim">${escapeHtml(k)}:</span> <span class="text-kotext">${escapeHtml(String(v))}</span></span>`
    )
    .join('');
  return `<div class="mb-4 flex flex-wrap gap-2">${chips}</div>`;
}

async function renderDoc(slug) {
  state.mode = 'doc';
  state.currentDoc = slug;
  if (gridEl) gridEl.hidden = true;
  if (contentEl) contentEl.hidden = false;
  contentEl.innerHTML = '<p class="text-kodim">Ładowanie...</p>';
  try {
    const { title, content, html: serverHtml, meta, pdfUrl } = await fetchDoc(slug);
    const html = serverHtml || mdToHtml(content || '');
    const authorVal = meta && (meta.author || meta.autor) ? String(meta.author || meta.autor) : '';
    const authorLine = authorVal
      ? `<div class="mb-3 text-sm text-kodim"><span class="font-semibold text-kotext">Autor:</span> ${escapeHtml(authorVal)}</div>`
      : '';
    const actions = pdfUrl
      ? `<div class="mb-5"><a class="inline-flex items-center gap-2 rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent" href="${encodeURI(pdfUrl)}" download><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Pobierz PDF</a></div>`
      : '';
    contentEl.innerHTML = `<div class="prose-kob"><h1>${escapeHtml(title || slug)}</h1>${authorLine}${actions}\n${html}</div>`;
    contentEl.setAttribute('aria-busy', 'false');
    document.title = `kWiedza – ${title || slug}`;
  } catch (e) {
    contentEl.innerHTML = `<p class="text-status-error-text">Błąd ładowania dokumentu: ${escapeHtml(e.message)}</p>`;
  }
}

function parseRoute() {
  const url = new URL(location);
  const params = url.searchParams;
  const cat = params.get('cat') || '';
  const doc = params.get('doc') || '';
  if (!cat && !doc && url.search && !url.search.includes('=')) {
    return { cat: '', doc: decodeURIComponent(url.search.slice(1)) };
  }
  return { cat, doc };
}
function navigateToCategories() {
  state.mode = 'categories';
  state.currentCategory = '';
  state.currentDoc = '';
  history.pushState({ mode: 'categories' }, '', '/kwiedza/');
  renderCategories();
}
function navigateToCategory(cat) {
  state.mode = 'list';
  state.currentCategory = cat;
  state.currentDoc = '';
  history.pushState({ mode: 'list', cat }, '', `?cat=${encodeURIComponent(cat)}`);
  renderDocsList(cat);
}
function navigateToDoc(cat, slug) {
  state.mode = 'doc';
  state.currentCategory = cat || state.currentCategory;
  state.currentDoc = slug;
  const sp = new URLSearchParams();
  if (state.currentCategory) sp.set('cat', state.currentCategory);
  sp.set('doc', slug);
  history.pushState({ mode: 'doc', cat: state.currentCategory, doc: slug }, '', `?${sp.toString()}`);
  renderDoc(slug);
}
window.addEventListener('popstate', () => {
  const { cat, doc } = parseRoute();
  if (doc) {
    state.currentCategory = cat || state.currentCategory;
    renderDoc(doc);
  } else if (cat) {
    navigateToCategory(cat);
  } else {
    renderCategories();
  }
});

function getDocCategory(d) {
  const m = d?.meta || {};
  const c =
    typeof m.category === 'string'
      ? m.category.trim()
      : Array.isArray(m.category)
        ? String(m.category[0]).trim()
        : '';
  return c || 'Inne';
}

function computeCategories(docs) {
  const map = new Map();
  docs.forEach((d) => {
    let c = getDocCategory(d);
    if (typeof c === 'string') c = c.trim();
    if (!c) c = 'Inne';
    map.set(c, (map.get(c) || 0) + 1);
  });
  return map;
}

function renderGlobalSearchList(q) {
  const query = (q || '').toLowerCase();
  if (!query) return renderCategories();
  if (!state.searchActive) {
    state.prev = { mode: state.mode, cat: state.currentCategory, doc: state.currentDoc };
    state.searchActive = true;
  }
  if (contentEl) { contentEl.hidden = true; contentEl.innerHTML = ''; }
  if (gridEl) { gridEl.hidden = false; gridEl.innerHTML = ''; }
  state.mode = 'list';
  state.currentCategory = '';
  const docs = state.allDocs
    .filter((d) => {
      const t = (d.title || '').toLowerCase();
      const s = (d.slug || '').toLowerCase();
      const cat = getDocCategory(d).toLowerCase();
      return t.includes(query) || s.includes(query) || cat.includes(query);
    })
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pl', { sensitivity: 'base' }));
  renderTiles(docs);
  document.title = `kWiedza – Wyniki: ${q}`;
}

function endGlobalSearchIfAny() {
  if (!state.searchActive) {
    if (state.mode === 'doc' && state.currentDoc) renderDoc(state.currentDoc);
    else if (state.mode === 'list' && state.currentCategory) renderDocsList(state.currentCategory);
    else renderCategories();
    return;
  }
  const prev = state.prev || { mode: 'categories', cat: '', doc: '' };
  state.searchActive = false;
  state.prev = null;
  if (prev.mode === 'doc' && prev.doc) renderDoc(prev.doc);
  else if (prev.mode === 'list' && prev.cat) renderDocsList(prev.cat);
  else renderCategories();
}

function renderCategories() {
  const qActive = (searchEl?.value || '').trim();
  if (qActive) return renderGlobalSearchList(qActive);
  state.mode = 'categories';
  if (contentEl) { contentEl.hidden = true; contentEl.innerHTML = ''; }
  if (gridEl) { gridEl.hidden = false; gridEl.innerHTML = ''; }
  if (searchEl) searchEl.placeholder = 'Szukaj dokumentów…';
  const catsMap = computeCategories(state.allDocs);
  const q = (searchEl?.value || '').toLowerCase();
  const cats = Array.from(catsMap.entries())
    .filter(([name]) => !q || name.toLowerCase().includes(q))
    .sort((a, b) => a[0].localeCompare(b[0], 'pl'));
  const frag = document.createDocumentFragment();
  cats.forEach(([name, count]) => {
    const tile = document.createElement('button');
    tile.className = TILE_CLASS;
    tile.type = 'button';
    tile.dataset.category = name;
    tile.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-semibold text-kotext">${escapeHtml(name)}</div>
        <div class="mt-1 text-xs font-medium text-kodim">Kategoria</div>
      </div>
      <span class="rounded-full border border-koborder bg-koelev2 px-2.5 py-0.5 text-xs font-bold text-kodim">${count}</span>`;
    tile.addEventListener('click', () => navigateToCategory(name));
    frag.appendChild(tile);
  });
  gridEl.appendChild(frag);
  document.title = 'kWiedza – Kategorie';
}

function renderDocsList(cat) {
  const qActive = (searchEl?.value || '').trim();
  if (qActive) return renderGlobalSearchList(qActive);
  state.mode = 'list';
  if (contentEl) { contentEl.hidden = true; contentEl.innerHTML = ''; }
  if (gridEl) { gridEl.hidden = false; gridEl.innerHTML = ''; }
  const all = state.allDocs.filter((d) => getDocCategory(d) === cat);
  const q = (searchEl?.value || '').toLowerCase();
  const docs = (!q ? all : all.filter((d) => (d.title || '').toLowerCase().includes(q) || (d.slug || '').toLowerCase().includes(q)))
    .slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pl', { sensitivity: 'base' }));
  renderTiles(docs);
  document.title = `kWiedza – ${cat}`;
}

async function init() {
  try {
    state.allDocs = await window.KWiedzaData.fetchDocs();
    const { cat, doc } = parseRoute();
    if (doc) { state.currentCategory = cat || ''; await renderDoc(doc); }
    else if (cat) navigateToCategory(cat);
    else renderCategories();
    searchEl?.addEventListener('input', () => {
      const q = searchEl.value.trim();
      if (q) renderGlobalSearchList(q);
      else endGlobalSearchIfAny();
    });
    backBtn?.addEventListener('click', () => {
      if (state.mode === 'doc' && state.currentCategory) navigateToCategory(state.currentCategory);
      else if (state.mode === 'categories') window.location.href = '/';
      else navigateToCategories();
    });
  } catch (e) {
    contentEl.innerHTML = `<p class="text-status-error-text">Błąd inicjalizacji: ${escapeHtml(e.message)}</p>`;
  }
}

function mdToHtml(md) {
  if (typeof window.markdownit !== 'function') return '<p>Biblioteka Markdown-it nie została załadowana.</p>';
  const mdParser = window.markdownit({ html: true, linkify: true, typographer: true });
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const cleanMd = md.replace(frontmatterRegex, '');
  return mdParser.render(cleanMd);
}

window.__db.loadConfig().then(init).catch((err) => {
  const el = document.getElementById('doc-content');
  if (el) el.innerHTML = `<p class="text-status-error-text">Błąd konfiguracji danych: ${String(err.message || err)}</p>`;
});
