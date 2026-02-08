const API_SYMBOLS = 'https://raw.githubusercontent.com/KibelSMP/kObywatel-db/refs/heads/main/data/companies_symbols.json';

const form = document.getElementById('kfreg-form');
const symbolsBox = document.getElementById('kfreg-symbols');
const statusEl = document.getElementById('kfreg-status');
const resetBtn = document.getElementById('kfreg-reset');
const backBtn = document.getElementById('back-btn');

let symbolsList = [];

function setStatus(msg, kind=''){
	if(!statusEl) return;
	statusEl.textContent = msg || '';
	statusEl.className = 'kfreg-status' + (kind ? ' ' + kind : '');
}

function escapeHtml(str){
	return String(str||'').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[ch]));
}

function safeFileName(name){
	const base = (name || 'firma').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
	return base || 'firma';
}

async function loadSymbols(){
	try {
		const r = await fetch(API_SYMBOLS, { cache:'no-store' });
		if(!r.ok) throw new Error('HTTP ' + r.status);
		symbolsList = await r.json();
		renderSymbols();
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
		x: Number(form.x?.value || ''),
		z: Number(form.z?.value || ''),
		declaration: !!form.declaration?.checked
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
	if(!Number.isFinite(data.x) || !Number.isFinite(data.z)) errors.push('Podaj współrzędne X i Z.');
	if(!data.declaration) errors.push('Zaznacz oświadczenie o uprawnieniu do rejestracji.');
	return errors;
}

function buildPayload(data){
	return {
		name: data.name,
		symbols: data.symbols,
		registrar_kesel: data.registrar,
		location: {
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
		setStatus('Plik wygenerowany i pobrany.', 'ok');
	});
	resetBtn?.addEventListener('click', e => { e.preventDefault(); resetForm(); });
	backBtn?.addEventListener('click', ()=> { window.location.href = '/kfirma'; });
}

loadSymbols();
bindEvents();
