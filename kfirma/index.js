const API_COMPANIES = 'https://raw.githubusercontent.com/KibelSMP/kObywatel-db/refs/heads/main/data/companies.json';
const API_SYMBOLS = 'https://raw.githubusercontent.com/KibelSMP/kObywatel-db/refs/heads/main/data/companies_symbols.json';

const listEl = document.getElementById('kf-list');
const statusEl = document.getElementById('kf-status');
const statsEl = document.getElementById('kf-stats');
const searchEl = document.getElementById('kf-search');
const symbolEl = document.getElementById('kf-symbol');
const voivEl = document.getElementById('kf-voiv');
const backBtn = document.getElementById('back-btn');
let modalEl = null;

const state = {
	companies: [],
	symbols: new Map(),
	loading: false
};

function setStatus(msg, kind = ''){
	if(!statusEl) return;
	statusEl.textContent = msg || '';
	statusEl.className = 'kf-status' + (kind ? ' ' + kind : '');
}

async function fetchJson(url, label){
	const r = await fetch(url, { cache: 'no-store' });
	if(!r.ok) throw new Error(`Błąd pobierania ${label || 'danych'} (${r.status})`);
	return r.json();
}

function normalizeCompanies(data){
	if(!Array.isArray(data)) return [];
	return data.map(item => {
		const addr = item?.location?.address || {};
		const coords = item?.location?.coordinates || {};
		return {
			name: String(item?.name || 'Nieznana firma').trim(),
			symbols: Array.isArray(item?.symbols) ? item.symbols.map(s => String(s).trim()).filter(Boolean) : [],
			knip: item?.knip ?? '',
			registrar: item?.registrar_kesel ?? item?.registrarKesel ?? '',
			address: {
				street: String(addr.street || '').trim(),
				city: String(addr.city || '').trim(),
				voiv: String(addr.voivodeship || addr.wojewodztwo || '').trim()
			},
			coords: {
				x: coords?.x ?? null,
				y: coords?.y ?? coords?.z ?? null
			}
		};
	});
}

function renderSymbolsSelect(){
	if(!symbolEl) return;
	const opts = ['<option value="">Dowolny symbol</option>'];
	const entries = Array.from(state.symbols.entries()).sort((a,b)=> a[0].localeCompare(b[0],'pl'));
	entries.forEach(([sym, label])=>{
		opts.push(`<option value="${escapeHtml(sym)}">${escapeHtml(sym)} — ${escapeHtml(label)}</option>`);
	});
	symbolEl.innerHTML = opts.join('');
}

function renderVoivSelect(){
	if(!voivEl) return;
	const set = new Set(state.companies.map(c => c.address.voiv).filter(Boolean));
	const list = Array.from(set).sort((a,b)=> a.localeCompare(b,'pl'));
	const opts = ['<option value="">Dowolne województwo</option>', ...list.map(v=> `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)];
	voivEl.innerHTML = opts.join('');
}

function escapeHtml(str){
	return String(str||'').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[ch]));
}

function renderStats(){
	if(!statsEl) return;
	if(!state.companies.length){ statsEl.innerHTML=''; return; }
	const citySet = new Set(state.companies.map(c => c.address.city).filter(Boolean));
	const items = [
		{ label: 'Firmy', value: state.companies.length },
		{ label: 'Miasta', value: citySet.size }
	];
	statsEl.innerHTML = items.map(i => `<div class="kf-stat"><div class="lbl">${escapeHtml(i.label)}</div><div class="val">${escapeHtml(i.value)}</div></div>`).join('');
}

function formatSymbols(symbols){
	if(!symbols.length) return '<span class="kf-chip">Brak symboli</span>';
	return symbols.map(sym => {
		const desc = state.symbols.get(sym) || '';
		return `<span class="kf-chip"><span class="sym">${escapeHtml(sym)}</span>${desc ? `<span class="desc">${escapeHtml(desc)}</span>` : ''}</span>`;
	}).join('');
}

function ensureModal(){
	if(modalEl) return modalEl;
	const wrap = document.createElement('div');
	wrap.className = 'kf-modal hidden';
	wrap.innerHTML = `
	  <div class="kf-modal-backdrop"></div>
	  <div class="kf-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="kf-modal-title">
	    <div class="kf-modal-head">
	      <h3 id="kf-modal-title">Symbole działalności</h3>
	      <button type="button" class="kf-modal-close" aria-label="Zamknij okno">×</button>
	    </div>
	    <div class="kf-modal-body" id="kf-modal-body"></div>
	  </div>`;
	document.body.appendChild(wrap);
	wrap.querySelector('.kf-modal-backdrop')?.addEventListener('click', hideModal);
	wrap.querySelector('.kf-modal-close')?.addEventListener('click', hideModal);
	modalEl = wrap;
	return modalEl;
}

function hideModal(){
	if(!modalEl) return;
	modalEl.classList.add('hidden');
	modalEl.classList.remove('open');
	document.body.style.overflow = '';
}

function showSymbolsModal(symbols){
	const modal = ensureModal();
	const body = modal.querySelector('#kf-modal-body');
	if(body){
		if(!symbols.length){
			body.innerHTML = '<p>Brak symboli do wyświetlenia.</p>';
		} else {
			body.innerHTML = symbols.map(sym => {
				const desc = state.symbols.get(sym) || 'Brak opisu';
				return `<div class="kf-modal-row"><span class="kf-modal-sym">${escapeHtml(sym)}</span><span class="kf-modal-desc">${escapeHtml(desc)}</span></div>`;
			}).join('');
		}
	}
	modal.classList.remove('hidden');
	modal.classList.add('open');
	document.body.style.overflow = 'hidden';
}

function renderList(companies){
	if(!listEl) return;
	listEl.innerHTML = '';
	if(!state.loading && !companies.length){
		listEl.innerHTML = '<div class="kf-empty">Brak wyników po zastosowaniu filtrów.</div>';
		return;
	}
	const frag = document.createDocumentFragment();
	companies.forEach(c => {
		const article = document.createElement('article');
		article.className = 'kf-card';
		const symbolsLabel = c.symbols.length ? c.symbols.join(', ') : 'Brak symboli';
		const symbolsData = c.symbols.map(s => escapeHtml(s)).join('|');
		const hasCoords = (c.coords.x||c.coords.x===0) && (c.coords.y||c.coords.y===0);
		const coordsLabel = hasCoords ? `${c.coords.x}, ${c.coords.y}` : 'Brak współrzędnych';
		const mapLink = `/map/?company=${encodeURIComponent(c.knip)}`;
		article.innerHTML = `
		  <div class="kf-card-head">
			<div>
			  <h3>${escapeHtml(c.name)}</h3>
			  <div class="kf-meta">
			    <button type="button" class="kf-symbol-btn" data-symbols="${symbolsData}" ${c.symbols.length ? '' : 'disabled'}>
			    	<span class="kf-symbol-label">Zakres działalności</span>
			    	<span class="kf-symbol-values">${escapeHtml(symbolsLabel)}</span>
			    </button>
			  </div>
			</div>
			<div class="kf-ids">
			  <span title="KNIP">KNIP: ${escapeHtml(c.knip || '—')}</span>
			</div>
		  </div>
		  <div class="kf-row">
			<div class="kf-tag">
			  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
			  <div class="kf-addr">
				<div>${escapeHtml(c.address.city || 'Miasto nieznane')}</div>
				<div>${escapeHtml(c.address.street || 'Adres nieznany')}</div>
				<div>${escapeHtml(c.address.voiv || 'Województwo nieznane')}</div>
			  </div>
			</div>
			<div class="kf-tag">
			  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
			  <div class="kf-coords">${mapLink ? `<a href="${mapLink}" class="kf-coords-link" target="_blank" rel="noopener">${escapeHtml(coordsLabel)}</a>` : escapeHtml(coordsLabel)}</div>
			</div>
		  </div>
		`;
		const btn = article.querySelector('.kf-symbol-btn');
		btn?.addEventListener('click', e => {
			e.preventDefault();
			const data = btn.dataset.symbols || '';
			const symbols = data ? data.split('|').filter(Boolean) : [];
			showSymbolsModal(symbols);
		});
		frag.appendChild(article);
	});
	listEl.appendChild(frag);
}

function applyFilters(){
	const q = (searchEl?.value || '').trim().toLowerCase();
	const sym = symbolEl?.value || '';
	const voiv = voivEl?.value || '';
	const filtered = state.companies.filter(c => {
		if(sym && !c.symbols.includes(sym)) return false;
		if(voiv && c.address.voiv !== voiv) return false;
		if(!q) return true;
		const hay = [c.name, c.address.city, c.address.voiv, c.address.street, String(c.knip||''), String(c.registrar||''), c.symbols.join(' ')].join(' ').toLowerCase();
		return hay.includes(q);
	});
	renderList(filtered);
	if(state.companies.length){
		setStatus(`Wyświetlane: ${filtered.length} z ${state.companies.length}`, 'ok');
	}
}

function bindFilters(){
	let t = null; const DEBOUNCE = 220;
	searchEl?.addEventListener('input', ()=>{ clearTimeout(t); t = setTimeout(applyFilters, DEBOUNCE); });
	symbolEl?.addEventListener('change', applyFilters);
	voivEl?.addEventListener('change', applyFilters);
}

function bindBack(){
	if(!backBtn) return;
	backBtn.addEventListener('click', ()=> { window.location.href = '/'; });
}

async function init(){
	try {
		state.loading = true;
		setStatus('Ładuję dane firm...', 'ok');
		const [companiesRaw, symbolsRaw] = await Promise.all([
			fetchJson(API_COMPANIES, 'firm'),
			fetchJson(API_SYMBOLS, 'symboli')
		]);
		state.symbols = new Map((Array.isArray(symbolsRaw)? symbolsRaw : []).map(item => [String(item.symbol||'').trim(), String(item.name||'').trim()]).filter(([k])=> !!k));
		state.companies = normalizeCompanies(companiesRaw);
		renderSymbolsSelect();
		renderVoivSelect();
		renderStats();
		applyFilters();
		setStatus('Dane załadowane.', 'ok');
	} catch(err){
		console.error(err);
		setStatus(err.message || 'Nie udało się załadować danych.', 'err');
		if(listEl){ listEl.innerHTML = '<div class="kf-empty">Nie udało się pobrać listy firm.</div>'; }
	} finally {
		state.loading = false;
	}
}

bindFilters();
bindBack();
init();
