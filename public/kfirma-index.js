// kFirma registry browser (island). Ported from the legacy kfirma/index.js:
// data normalization, business-type aliases, and filtering logic are unchanged;
// injected markup reskinned to Tailwind. Globals: window.__db, window.escapeHtml.

const listEl = document.getElementById('kf-list');
const statusEl = document.getElementById('kf-status');
const statsEl = document.getElementById('kf-stats');
const searchEl = document.getElementById('kf-search');
const businessTypeEl = document.getElementById('kf-business-type');
const symbolEl = document.getElementById('kf-symbol');
const voivEl = document.getElementById('kf-voiv');
const backBtn = document.getElementById('kf-back');
let modalEl = null;

const BUSINESS_TYPE_LABELS = { JDG: 'JDG', SPOLKA: 'Spółka', PSK: 'PSK' };
const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_LABELS);
const BUSINESS_TYPE_ALIASES = {
  JDG: 'JDG',
  'JEDNOOSOBOWA DZIALALNOSC GOSPODARCZA': 'JDG',
  SPOLKA: 'SPOLKA',
  'SPOLKA PRYWATNA': 'SPOLKA',
  'PRYWATNA SPOLKA': 'SPOLKA',
  PSK: 'PSK',
  'PANSTWOWA SPOLKA KIBLOWA': 'PSK',
};

const state = { companies: [], symbols: new Map(), loading: false };

function setStatus(msg, kind = '') {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
  const color = kind === 'err' ? 'text-status-error-text' : kind === 'ok' ? 'text-kodim' : 'text-kodim';
  statusEl.className = `text-sm ${color}`;
}

function cleanField(val) {
  const v = String(val || '').trim();
  return v === '-' ? '' : v;
}
function simplifyPolish(str) {
  return String(str || '').normalize('NFD').replace(/\p{Diacritic}+/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
}
function normalizeBusinessType(val) {
  const raw = simplifyPolish(String(val || '')).trim().toUpperCase().replace(/\s+/g, ' ');
  if (!raw) return '';
  if (BUSINESS_TYPE_ALIASES[raw]) return BUSINESS_TYPE_ALIASES[raw];
  if (BUSINESS_TYPES.includes(raw)) return raw;
  return '';
}
function readBusinessType(item) {
  return normalizeBusinessType(
    item?.business_type ?? item?.businessType ?? item?.legal_form ?? item?.legalForm ??
    item?.type ?? item?.rodzaj_dzialalnosci ?? item?.rodzajDzialalnosci
  );
}

function normalizeCompanies(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const addr = item?.location?.address || {};
    const coords = item?.location?.coordinates || {};
    const dimensionRaw = cleanField(item?.location?.dimension || '');
    const businessType = readBusinessType(item);
    return {
      name: String(item?.name || 'Nieznana firma').trim(),
      businessType,
      symbols: Array.isArray(item?.symbols) ? item.symbols.map((s) => String(s).trim()).filter(Boolean) : [],
      knip: item?.knip ?? '',
      registrar: item?.registrar_kesel ?? item?.registrarKesel ?? '',
      dimension: dimensionRaw || 'Overworld',
      address: {
        street: cleanField(addr.street),
        city: cleanField(addr.city),
        voiv: cleanField(addr.voivodeship || addr.wojewodztwo),
      },
      coords: { x: coords?.x ?? null, y: coords?.y ?? coords?.z ?? null },
    };
  });
}

function fillSelect(el, placeholder, options) {
  if (!el) return;
  el.innerHTML = [`<option value="">${placeholder}</option>`, ...options].join('');
}

function renderBusinessTypesSelect() {
  fillSelect(businessTypeEl, 'Dowolny rodzaj', BUSINESS_TYPES.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(BUSINESS_TYPE_LABELS[t])}</option>`));
}
function renderSymbolsSelect() {
  const entries = Array.from(state.symbols.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
  fillSelect(symbolEl, 'Dowolny symbol', entries.map(([sym, label]) => `<option value="${escapeHtml(sym)}">${escapeHtml(sym)} — ${escapeHtml(label)}</option>`));
}
function renderVoivSelect() {
  const set = new Set(state.companies.map((c) => c.address.voiv).filter(Boolean));
  const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
  fillSelect(voivEl, 'Dowolne województwo', list.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`));
}

function renderStats() {
  if (!statsEl) return;
  if (!state.companies.length) { statsEl.innerHTML = ''; return; }
  const citySet = new Set(state.companies.map((c) => c.address.city).filter(Boolean));
  const items = [
    { label: 'Firmy', value: state.companies.length },
    { label: 'Miasta', value: citySet.size },
  ];
  statsEl.innerHTML = items
    .map(
      (i) =>
        `<div class="rounded-xl border border-koborder bg-koelev2 px-4 py-2 text-center"><div class="text-xs text-kodim">${escapeHtml(i.label)}</div><div class="text-lg font-bold text-kotext">${escapeHtml(i.value)}</div></div>`
    )
    .join('');
}

function ensureModal() {
  if (modalEl) return modalEl;
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[70] hidden items-center justify-center p-4';
  wrap.innerHTML = `
    <div class="kf-modal-backdrop absolute inset-0 bg-black/60"></div>
    <div class="relative z-10 w-full max-w-md rounded-2xl border border-koborder bg-koelev p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="kf-modal-title">
      <div class="mb-3 flex items-center justify-between">
        <h3 id="kf-modal-title" class="text-lg font-bold text-kotext">Symbole działalności</h3>
        <button type="button" class="kf-modal-close grid h-8 w-8 place-items-center rounded-lg text-kodim hover:bg-koelev2 hover:text-kotext" aria-label="Zamknij okno">×</button>
      </div>
      <div class="space-y-2" id="kf-modal-body"></div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.kf-modal-backdrop')?.addEventListener('click', hideModal);
  wrap.querySelector('.kf-modal-close')?.addEventListener('click', hideModal);
  modalEl = wrap;
  return modalEl;
}
function hideModal() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  modalEl.classList.remove('flex');
  document.body.style.overflow = '';
}
function showSymbolsModal(symbols) {
  const modal = ensureModal();
  const body = modal.querySelector('#kf-modal-body');
  if (body) {
    body.innerHTML = !symbols.length
      ? '<p class="text-kodim">Brak symboli do wyświetlenia.</p>'
      : symbols
          .map((sym) => {
            const desc = state.symbols.get(sym) || 'Brak opisu';
            return `<div class="flex items-start gap-3 rounded-xl border border-koborder bg-koelev2 p-3"><span class="rounded-md bg-koaccent/15 px-2 py-0.5 text-sm font-bold text-koaccent2">${escapeHtml(sym)}</span><span class="text-sm text-kotext">${escapeHtml(desc)}</span></div>`;
          })
          .join('');
  }
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function renderList(companies) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!state.loading && !companies.length) {
    listEl.innerHTML = '<div class="rounded-2xl border border-dashed border-koborder bg-koelev2/40 p-8 text-center text-kodim">Brak wyników po zastosowaniu filtrów.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  companies.forEach((c) => {
    const article = document.createElement('article');
    article.className = 'rounded-2xl border border-koborder bg-koelev p-4';
    const symbolsLabel = c.symbols.length ? c.symbols.join(', ') : 'Brak symboli';
    const symbolsData = c.symbols.map((s) => escapeHtml(s)).join('|');
    const businessTypeLabel = c.businessType ? BUSINESS_TYPE_LABELS[c.businessType] || c.businessType : 'Nie podano';
    const hasCoords = (c.coords.x || c.coords.x === 0) && (c.coords.y || c.coords.y === 0);
    const coordsLabel = hasCoords ? `${c.coords.x}, ${c.coords.y}` : 'Brak współrzędnych';
    const mapLink = c.dimension === 'Overworld' && hasCoords ? `/map/?company=${encodeURIComponent(c.knip)}` : '';
    const addressLines = [c.address.city, c.address.street, c.address.voiv].filter(Boolean);
    const addressHtml = addressLines.length ? addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('') : '<div>Adres nieznany</div>';
    const dimensionLabel = c.dimension && c.dimension !== 'Overworld' ? `<span class="rounded-md bg-koaccent/15 px-1.5 py-0.5 text-xs font-semibold text-koaccent2">${escapeHtml(c.dimension)}</span>` : '';
    article.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-lg font-bold text-kotext">${escapeHtml(c.name)}</h3>
          <div class="mt-1">
            <button type="button" class="kf-symbol-btn inline-flex flex-col items-start rounded-lg border border-koborder bg-koelev2 px-3 py-1.5 text-left transition hover:border-koaccent disabled:opacity-60" data-symbols="${symbolsData}" ${c.symbols.length ? '' : 'disabled'}>
              <span class="text-[11px] font-semibold uppercase tracking-wide text-kodim">Zakres działalności</span>
              <span class="text-sm text-kotext">${escapeHtml(symbolsLabel)}</span>
            </button>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1 text-xs text-kodim">
          <span title="KNIP">KNIP: ${escapeHtml(c.knip || '—')}</span>
          <span title="Rodzaj działalności">Rodzaj: ${escapeHtml(businessTypeLabel)}</span>
        </div>
      </div>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <div class="flex items-start gap-2 text-sm text-kotext">
          <svg class="mt-0.5 h-4 w-4 shrink-0 text-kodim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <div>${addressHtml}</div>
        </div>
        <div class="flex items-start gap-2 text-sm text-kotext">
          <svg class="mt-0.5 h-4 w-4 shrink-0 text-kodim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          <div class="flex items-center gap-2">${dimensionLabel}${mapLink ? `<a href="${mapLink}" class="text-koaccent2 underline underline-offset-2 hover:text-koaccent" target="_blank" rel="noopener">${escapeHtml(coordsLabel)}</a>` : escapeHtml(coordsLabel)}</div>
        </div>
      </div>`;
    const btn = article.querySelector('.kf-symbol-btn');
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      const data = btn.dataset.symbols || '';
      const symbols = data ? data.split('|').filter(Boolean) : [];
      showSymbolsModal(symbols);
    });
    frag.appendChild(article);
  });
  listEl.appendChild(frag);
}

function applyFilters() {
  const q = (searchEl?.value || '').trim().toLowerCase();
  const businessType = businessTypeEl?.value || '';
  const sym = symbolEl?.value || '';
  const voiv = voivEl?.value || '';
  const filtered = state.companies.filter((c) => {
    if (businessType && c.businessType !== businessType) return false;
    if (sym && !c.symbols.includes(sym)) return false;
    if (voiv && c.address.voiv !== voiv) return false;
    if (!q) return true;
    const hay = [c.name, c.address.city, c.address.voiv, c.address.street, String(c.knip || ''), String(c.registrar || ''), c.businessType, BUSINESS_TYPE_LABELS[c.businessType] || '', c.symbols.join(' ')].join(' ').toLowerCase();
    return hay.includes(q);
  });
  renderList(filtered);
  if (state.companies.length) setStatus(`Wyświetlane: ${filtered.length} z ${state.companies.length}`, 'ok');
}

function bindFilters() {
  let t = null;
  const DEBOUNCE = 220;
  searchEl?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(applyFilters, DEBOUNCE); });
  businessTypeEl?.addEventListener('change', applyFilters);
  symbolEl?.addEventListener('change', applyFilters);
  voivEl?.addEventListener('change', applyFilters);
}
function bindBack() {
  backBtn?.addEventListener('click', () => { window.location.href = '/'; });
}

async function init() {
  try {
    state.loading = true;
    setStatus('Ładuję dane firm...', 'ok');
    const [companiesRaw, symbolsRaw] = await Promise.all([
      window.__db.fetchJson('data/companies.json'),
      window.__db.fetchJson('data/companies_symbols.json'),
    ]);
    state.symbols = new Map(
      (Array.isArray(symbolsRaw) ? symbolsRaw : [])
        .map((item) => [String(item.symbol || '').trim(), String(item.name || '').trim()])
        .filter(([k]) => !!k)
    );
    state.companies = normalizeCompanies(companiesRaw);
    const qParam = new URLSearchParams(window.location.search).get('q');
    if (qParam && searchEl) searchEl.value = qParam;
    renderBusinessTypesSelect();
    renderSymbolsSelect();
    renderVoivSelect();
    renderStats();
    applyFilters();
    setStatus('Dane załadowane.', 'ok');
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Nie udało się załadować danych.', 'err');
    if (listEl) listEl.innerHTML = '<div class="rounded-2xl border border-dashed border-koborder bg-koelev2/40 p-8 text-center text-kodim">Nie udało się pobrać listy firm.</div>';
  } finally {
    state.loading = false;
  }
}

bindFilters();
bindBack();
window.__db.loadConfig().then(init).catch((err) => setStatus(String(err.message || err), 'err'));
