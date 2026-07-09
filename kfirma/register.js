const FILE_VERSION = '1.1';
const DIMENSIONS = ['Overworld', 'Nether', 'The End'];
const BUSINESS_TYPE_LABELS = {
    JDG: 'Jednoosobowa Działalność Gospodarcza',
	SPOLKA: 'Spółka Prywatna',
    PSK: 'Państwowa Spółka Kiblowa'
};
const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_LABELS);
const BUSINESS_TYPE_ALIASES = {
	JDG: 'JDG',
	'JEDNOOSOBOWA DZIALALNOSC GOSPODARCZA': 'JDG',
	SPOLKA: 'SPOLKA',
	'SPOLKA PRYWATNA': 'SPOLKA',
	'PRYWATNA SPOLKA': 'SPOLKA',
	PSK: 'PSK',
	'PANSTWOWA SPOLKA KIBLOWA': 'PSK'
};

const overlayEl = document.getElementById('kfreg-overlay');
const overlayCloseBtn = document.getElementById('kfreg-overlay-close');

const aiOverlayEl = document.getElementById('kfreg-ai-overlay');
const aiCancelBtn = document.getElementById('kfreg-ai-cancel');
const aiOpenBtn = document.getElementById('kfreg-ai-open');

const form = document.getElementById('kfreg-form');
const symbolsBox = document.getElementById('kfreg-symbols');
const statusEl = document.getElementById('kfreg-status');
const resetBtn = document.getElementById('kfreg-reset');
const backBtn = document.getElementById('back-btn');
const aiBtn = document.getElementById('kfreg-ai-btn');

function duckduckgoAiUrl(prompt){
	return 'https://duckduckgo.com/?ia=chat&q=' + encodeURIComponent(prompt);
}

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

function safeFileName(name){
	const base = simplifyPolish(name || 'firma').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
	return base || 'firma';
}

function normalizeBusinessType(val){
    const raw = simplifyPolish(String(val || '')).trim().toUpperCase().replace(/\s+/g, ' ');
    if(!raw) return '';
    if(BUSINESS_TYPE_ALIASES[raw]) return BUSINESS_TYPE_ALIASES[raw];
    if(BUSINESS_TYPES.includes(raw)) return raw;
    return '';
}

function renderBusinessTypeOptions(){
	const select = form?.businessType;
	if(!select) return;
	const options = ['<option value="" disabled>Wybierz rodzaj działalności</option>'];
	BUSINESS_TYPES.forEach(type => {
		const label = BUSINESS_TYPE_LABELS[type] || type;
		options.push(`<option value="${escapeHtml(type)}">${escapeHtml(label)}</option>`);
	});
	select.innerHTML = options.join('');
}

async function loadSymbols(){
	try {
		symbolsList = await window.__db.fetchJson('data/companies_symbols.json');
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
	const valAny = (...names) => {
		for(const name of names){
			const v = val(name);
			if(v) return v;
		}
		return '';
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
	const businessTypeParam = valAny('businessType', 'business_type', 'legalForm', 'type');
	const businessType = normalizeBusinessType(businessTypeParam);
	return {
		name: val('name'),
		registrar: num('registrar'),
		businessType,
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
	if(prefillData.businessType) form.businessType.value = prefillData.businessType;
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
		businessType: normalizeBusinessType(form.businessType?.value),
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
	if(!data.businessType || !BUSINESS_TYPES.includes(data.businessType)) errors.push('Wybierz rodzaj działalności.');
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
		business_type: data.businessType,
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

function showAiOverlay(){
	if(!aiOverlayEl) return;
	aiOverlayEl.classList.add('open');
	aiOverlayEl.setAttribute('aria-hidden', 'false');
	document.body.style.overflow = 'hidden';
}

function hideAiOverlay(){
	if(!aiOverlayEl) return;
	aiOverlayEl.classList.remove('open');
	aiOverlayEl.setAttribute('aria-hidden', 'true');
	document.body.style.overflow = '';
}

function resetForm(){
	form.reset();
	setStatus('Formularz wyczyszczony.', 'ok');
}

function buildAiPrompt(){
	const raw = v => String(v ?? '').trim();
	const registerUrl = window.location.origin + '/kfirma/register';
	const businessTypesText = BUSINESS_TYPES.map(t => `${t} (${BUSINESS_TYPE_LABELS[t]})`).join(', ');
	const symbolsText = (Array.isArray(symbolsList) ? symbolsList : [])
		.map(s => `${raw(s.symbol)} — ${raw(s.name)}`)
		.filter(line => line !== '—')
		.join('\n');

	const filled = [];
	if(raw(form.name?.value)) filled.push(`Nazwa: ${raw(form.name.value)}`);
	if(raw(form.businessType?.value)) filled.push(`Rodzaj działalności: ${raw(form.businessType.value)}`);

	const registrarRaw = raw(form.registrar?.value);
	if(registrarRaw && Number(registrarRaw) === 0) filled.push('KESEL osoby rejestrującej: nie zostało wypełnione');
	else if(registrarRaw) filled.push(`KESEL osoby rejestrującej: ${registrarRaw}`);

	const symbols = collectSymbols();
	if(symbols.length) filled.push(`Symbole działalności: ${symbols.join(', ')}`);
	if(raw(form.voiv?.value)) filled.push(`Województwo: ${raw(form.voiv.value)}`);
	if(raw(form.city?.value)) filled.push(`Miasto: ${raw(form.city.value)}`);
	if(raw(form.street?.value)) filled.push(`Ulica: ${raw(form.street.value)}`);
	if(raw(form.dimension?.value)) filled.push(`Wymiar: ${raw(form.dimension.value)}`);

	const xRaw = raw(form.x?.value);
	const zRaw = raw(form.z?.value);
	const coordsBothZero = xRaw && zRaw && Number(xRaw) === 0 && Number(zRaw) === 0;
	if(coordsBothZero){
		filled.push('Koordynaty X i Z: nie zostały wypełnione');
	} else {
		if(xRaw) filled.push(`Koordynata X: ${xRaw}`);
		if(zRaw) filled.push(`Koordynata Z: ${zRaw}`);
	}

	return [
		'Pomóż mi wypełnić formularz rejestracji firmy/organizacji w systemie kFirma na serwerze Minecraft KibelSMP.',
		'Formularz ma następujące pola:',
		'- Nazwa firmy/organizacji (dowolny tekst)',
		`- Rodzaj działalności — jedna z wartości: ${businessTypesText}`,
		'- KESEL (numer identyfikacyjny) osoby rejestrującej',
		`- Symbole działalności (jeden lub więcej) do wyboru:\n${symbolsText}`,
		'- Lokalizacja w świecie gry: województwo, miasto, ulica',
		'- Wymiar: Overworld, Nether albo The End — domyślnie zakładaj Overworld, chyba że powiem inaczej (nie musisz o to pytać)',
		'- Koordynaty X i Z (liczby całkowite)',
		'',
		filled.length
			? `Dane, które już podałem/podałam w formularzu:\n${filled.join('\n')}`
			: 'Nie podałem/podałam jeszcze żadnych danych w formularzu.',
		'',
		'Zadawaj mi pytania, dopóki nie zbierzesz kompletu powyższych informacji i nie rozwiejesz moich wątpliwości (np. pomóż dobrać właściwe symbole działalności do opisu tego, czym się zajmuję). Nie generuj żadnego linku, dopóki nie będziesz mieć kompletu wszystkich powyższych danych. Dopiero gdy zbierzesz komplet danych, na końcu odpowiedzi wygeneruj DOKŁADNIE JEDEN link w poniższym formacie, z wartościami zakodowanymi do URL (encodeURIComponent) — jeśli wybrano więcej niż jeden symbol, powtórz parametr "symbol" osobno dla każdego z nich:',
		`${registerUrl}?name=...&businessType=...&registrar=...&symbol=...&symbol=...&voiv=...&city=...&street=...&dimension=...&x=...&z=...`,
		'Po otwarciu tego linku mój formularz rejestracji w kObywatel zostanie automatycznie wypełniony tymi danymi.'
	].join('\n');
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
	aiBtn?.addEventListener('click', showAiOverlay);
	aiCancelBtn?.addEventListener('click', hideAiOverlay);
	aiOverlayEl?.querySelector('.kfreg-overlay-backdrop')?.addEventListener('click', hideAiOverlay);
	aiOpenBtn?.addEventListener('click', () => {
		const url = duckduckgoAiUrl(buildAiPrompt());
		window.open(url, '_blank', 'noopener,noreferrer');
		hideAiOverlay();
	});
	overlayCloseBtn?.addEventListener('click', hideOverlay);
	overlayEl?.querySelector('.kfreg-overlay-backdrop')?.addEventListener('click', hideOverlay);
}

prefillData = readPrefill();
renderBusinessTypeOptions();
applyPrefillBasic();
(async () => {
	await loadSymbols();
	bindEvents();
})();
