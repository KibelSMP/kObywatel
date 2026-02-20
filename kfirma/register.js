const API_SYMBOLS = 'https://raw.githubusercontent.com/KibelSMP/kObywatel-db/refs/heads/main/data/companies_symbols.json';
const FILE_VERSION = '1.1';
const DIMENSIONS = ['Overworld', 'Nether', 'The End'];

const overlayEl = document.getElementById('kfreg-overlay');
const overlayCloseBtn = document.getElementById('kfreg-overlay-close');

const form = document.getElementById('kfreg-form');
const symbolsBox = document.getElementById('kfreg-symbols');
const statusEl = document.getElementById('kfreg-status');
const resetBtn = document.getElementById('kfreg-reset');
const backBtn = document.getElementById('back-btn');

let symbolsList = [];
let prefillData = null;
let symbolsPrefilled = false;

function simplifyPolish(str){
	return String(str || '').normalize('NFD').replace(/\p{Diacritic}+/gu, '').replace(/ł/g,'l').replace(/Ł/g,'L');
}

function setStatus(msg, kind=''){
	if(!statusEl) return;
	statusEl.textContent = msg || '';
	statusEl.className = 'kfreg-status' + (kind ? ' ' + kind : '');
}

function escapeHtml(str){
	return String(str||'').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[ch]));
}

function safeFileName(name){
	const base = simplifyPolish(name || 'firma').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
	return base || 'firma';
}

async function loadSymbols(){
	try {
		const r = await fetch(API_SYMBOLS, { cache:'no-store' });
		if(!r.ok) throw new Error('HTTP ' + r.status);
		symbolsList = await r.json();
		renderSymbols();
		applyPrefillSymbols();
	} catch(err){
		console.error(err);
		setStatus('Nie udało się pobrać listy symboli.', 'err');
	}
}

function renderSymbols(){
	if(!symbolsBox) return;
	const entries = Array.isArray(symbolsList) ? symbolsList : [];
	if(!entries.length){
		symbolsBox.innerHTML = '<div style="opacity:.8;">Brak danych o symbolach.</div>';
		return;
	}
	const frag = document.createDocumentFragment();
	entries.sort((a,b)=> String(a.symbol||'').localeCompare(String(b.symbol||''),'pl')).forEach(item => {
		const sym = String(item.symbol || '').trim();
		if(!sym) return;
		const label = document.createElement('label');
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.value = sym;
		input.name = 'symbols';
		const span = document.createElement('span');
		span.innerHTML = `<strong>${escapeHtml(sym)}</strong> — ${escapeHtml(item.name || '')}`;
		label.appendChild(input);
		label.appendChild(span);
		frag.appendChild(label);
	});
	symbolsBox.innerHTML = '';
	symbolsBox.appendChild(frag);
}

function readPrefill(){
	const params = new URLSearchParams(window.location.search);
	const val = name => {
		const v = params.get(name);
		return v === null ? '' : String(v).trim();
	};
	const num = name => {
		const v = val(name);
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	};
	const symbolsRaw = [];
	params.getAll('symbol').forEach(s => symbolsRaw.push(...String(s||'').split(',')));
	const symbolsParam = params.get('symbols');
	if(symbolsParam) symbolsRaw.push(...symbolsParam.split(','));
	const symbols = Array.from(new Set(symbolsRaw.map(s => s.trim()).filter(Boolean)));
	const dimensionParam = val('dimension');
	const dimension = DIMENSIONS.includes(dimensionParam) ? dimensionParam : '';
	return {
		name: val('name'),
		registrar: num('registrar'),
		city: val('city'),
		voiv: val('voiv'),
		street: val('street'),
		x: num('x'),
		z: num('z'),
		dimension,
		symbols
	};
}

function applyPrefillBasic(){
	if(!prefillData) return;
	if(prefillData.name) form.name.value = prefillData.name;
	if(Number.isFinite(prefillData.registrar)) form.registrar.value = prefillData.registrar;
	if(prefillData.city) form.city.value = prefillData.city;
	if(prefillData.voiv) form.voiv.value = prefillData.voiv;
	if(prefillData.street) form.street.value = prefillData.street;
	if(Number.isFinite(prefillData.x)) form.x.value = prefillData.x;
	if(Number.isFinite(prefillData.z)) form.z.value = prefillData.z;
	if(prefillData.dimension) form.dimension.value = prefillData.dimension;
}

function applyPrefillSymbols(){
	if(symbolsPrefilled || !prefillData || !prefillData.symbols?.length) return;
	const inputs = symbolsBox?.querySelectorAll('input[type="checkbox"]') || [];
	prefillData.symbols.forEach(sym => {
		inputs.forEach(input => {
			if(input.value === sym) input.checked = true;
		});
	});
	symbolsPrefilled = true;
}

function collectSymbols(){
	const selected = Array.from(symbolsBox?.querySelectorAll('input[type="checkbox"]:checked') || []).map(i => i.value);
	return Array.from(new Set(selected));
}

function collectData(){
	return {
		name: form.name?.value.trim() || '',
		registrar: Number(form.registrar?.value || ''),
		symbols: collectSymbols(),
		street: form.street?.value.trim() || '',
		city: form.city?.value.trim() || '',
		voiv: form.voiv?.value.trim() || '',
		dimension: form.dimension?.value.trim() || '',
		x: Number(form.x?.value || ''),
		z: Number(form.z?.value || ''),
		declaration: !!form.declaration?.checked,
		documentsDeclaration: !!form.documentsDeclaration?.checked
	};
}

function validate(data){
	const errors = [];
	if(!data.name) errors.push('Podaj nazwę firmy.');
	if(!data.symbols.length) errors.push('Wybierz przynajmniej jeden symbol.');
	if(!Number.isFinite(data.registrar)) errors.push('Podaj poprawny numer registrara.');
	if(!data.city) errors.push('Podaj miasto.');
	if(!data.voiv) errors.push('Podaj województwo.');
	if(!data.street) errors.push('Podaj ulicę.');
	if(!data.dimension || !DIMENSIONS.includes(data.dimension)) errors.push('Wybierz wymiar.');
	if(!Number.isFinite(data.x) || !Number.isFinite(data.z)) errors.push('Podaj współrzędne X i Z.');
	if(!data.declaration) errors.push('Zaznacz oświadczenie o uprawnieniu do rejestracji.');
	if(!data.documentsDeclaration) errors.push('Zaznacz oświadczenie o respektowaniu dokumentów z kDokumenty oraz dokumentów (np. faktur) z kSeF.');
	return errors;
}

function buildPayload(data){
	return {
		version: FILE_VERSION,
		name: data.name,
		symbols: data.symbols,
		registrar_kesel: data.registrar,
		location: {
			dimension: data.dimension,
			coordinates: { x: data.x, z: data.z },
			address: {
				street: data.street,
				city: data.city,
				voivodeship: data.voiv
			}
		}
	};
}

function downloadPayload(payload){
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${safeFileName(payload.name)}.kobcomreg`;
	a.click();
	URL.revokeObjectURL(url);
}

function showOverlay(){
	if(!overlayEl) return;
	overlayEl.classList.add('open');
	overlayEl.setAttribute('aria-hidden', 'false');
	document.body.style.overflow = 'hidden';
}

function hideOverlay(){
	if(!overlayEl) return;
	overlayEl.classList.remove('open');
	overlayEl.setAttribute('aria-hidden', 'true');
	document.body.style.overflow = '';
}

function resetForm(){
	form.reset();
	setStatus('Formularz wyczyszczony.', 'ok');
}

function bindEvents(){
	form?.addEventListener('submit', e => {
		e.preventDefault();
		const data = collectData();
		const errors = validate(data);
		if(errors.length){ setStatus(errors.join(' '), 'err'); return; }
		const payload = buildPayload(data);
		downloadPayload(payload);
		showOverlay();
		setStatus('Plik wygenerowany i pobrany.', 'ok');
	});
	resetBtn?.addEventListener('click', e => { e.preventDefault(); resetForm(); });
	backBtn?.addEventListener('click', ()=> { window.location.href = '/kfirma'; });
	overlayCloseBtn?.addEventListener('click', hideOverlay);
	overlayEl?.querySelector('.kfreg-overlay-backdrop')?.addEventListener('click', hideOverlay);
}

prefillData = readPrefill();
applyPrefillBasic();
loadSymbols();
bindEvents();
