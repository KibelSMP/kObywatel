// Fetch utility (statyczne: ładujemy pełny plik i filtrujemy klientem)
let __playersAll = null;
async function loadAllPlayers(){
  if(__playersAll) return __playersAll;
  try { __playersAll = await window.__db.fetchJson('data/players.json'); }
  catch(e){ __playersAll = []; }
  return __playersAll;
}
async function fetchPlayers(q = '') {
  const all = await loadAllPlayers();
  const term = (q||'').trim().toLowerCase();
  if(!term) return all;
  // Filtrowanie: exact match w performSearch, tutaj zwracamy kandydatów
  return all.filter(p => (p.kesel && String(p.kesel).includes(term)) || (p.nickMinecraft && p.nickMinecraft.toLowerCase().includes(term)));
}

// --- Map points & lines search (miasta / infrastruktura / etykiety / linie) ---
let __mapPointsCache = null; // { points: [...], categories: {...}, meta: {...} }
let __pointCategoryFilter = new Set(); // wybrane kategorie (puste = wszystkie)
let __allPointMatches = []; // pełna lista wyników punktów dla bieżącego zapytania
let __pointsPageSize = 15;
let __pointsShown = 0;
let __mapLinesCache = null; // { lines: [...], categories: {...}, meta: {...} }
let __lineMatches = []; // wyniki linii dla bieżącego zapytania
const __MAX_LINE_RESULTS = 50;
async function fetchMapPoints(){
  if(__mapPointsCache) return __mapPointsCache;
  try {
    // Agreguj z plików w db/data/map-points
    const metaObj = await window.__db.fetchJson('data/map-points/meta.json');
    const meta = metaObj?.meta || {};
    const categories = metaObj?.categories || {};
    const basePoints = Array.isArray(metaObj?.points) ? metaObj.points : [];
    const files = ['localities-large.json','localities-small.json','stations.json','infra.json','airports.json'];
    const parts = await Promise.all(files.map(fn=> window.__db.fetchJson('data/map-points/'+fn).catch(()=>({points:[]}))));
    const extra = parts.flatMap(p => Array.isArray(p?.points) ? p.points : []);
    const points = [...basePoints, ...extra];
    __mapPointsCache = { points, categories, meta };
    return __mapPointsCache;
  } catch(e){
    console.warn('[search] Nie udało się pobrać map-points.json', e);
    __mapPointsCache = { points:[], categories:{}, meta:{} };
    return __mapPointsCache;
  }
}
function searchMapPoints(q){
  if(!__mapPointsCache) return [];
  const term = q.trim().toLowerCase();
  if(!term) return [];
  const cats = __mapPointsCache.categories || {};
  const MAX = 60;
  const matches = __mapPointsCache.points
    .filter(pt => {
      if(pt.hidden) return false;
      if((pt.category||'').toLowerCase()==='players') return false; // wyklucz graczy z sekcji Miejsca
      const displayName = (pt.name || pt.label || pt.id || '').trim();
      if(!displayName) return false;
      return displayName.toLowerCase().includes(term);
    })
    .map(pt => {
      const displayName = (pt.name || pt.label || pt.id || '').trim();
      const catKey = pt.category || '';
      const catLabel = cats[catKey]?.label || catKey;
      return {
        type:'point',
        id: pt.id,
        name: displayName,
        category: catKey,
        categoryLabel: catLabel,
        x: pt.x,
        z: (pt.z !== undefined ? pt.z : pt.y) || 0
      };
    });
  matches.sort((a,b)=>{
    const aPrefix = a.name.toLowerCase().startsWith(term) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(term) ? 0 : 1;
    if(aPrefix !== bPrefix) return aPrefix - bPrefix;
    if(a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name,'pl');
  });
  return matches.slice(0, MAX);
}

async function fetchMapLines(){
  if(__mapLinesCache) return __mapLinesCache;
  try {
    const j = await window.__db.fetchJson('data/map-lines.json');
    if(!j || !Array.isArray(j.lines)) throw new Error('Zły format map-lines.json');
    __mapLinesCache = j;
    return j;
  } catch(e){
    console.warn('[search] Nie udało się pobrać map-lines.json', e);
    __mapLinesCache = { lines:[], categories:{}, meta:{} };
    return __mapLinesCache;
  }
}
function searchMapLines(q){
  if(!__mapLinesCache) return [];
  const term = q.trim().toLowerCase();
  if(!term) return [];
  const cats = __mapLinesCache.categories || {};
  const list = Array.isArray(__mapLinesCache.lines) ? __mapLinesCache.lines : [];
  const out = [];
  for(const ln of list){
    if(!ln) continue;
    const name = (ln.name || ln.id || '').trim();
    if(!name) continue;
    const hay = (name + ' ' + (ln.id||'') + ' ' + (ln.category||'')).toLowerCase();
    if(hay.includes(term)){
      const catLabel = cats[ln.category]?.label || ln.category || '';
      out.push({
        type:'line',
        id: ln.id,
        name,
        category: ln.category || '',
        categoryLabel: catLabel
      });
      if(out.length >= __MAX_LINE_RESULTS) break;
    }
  }
  // Sortuj: prefix match > długość nazwy > alfa
  out.sort((a,b)=>{
    const aPrefix = a.name.toLowerCase().startsWith(term) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(term) ? 0 : 1;
    if(aPrefix !== bPrefix) return aPrefix - bPrefix;
    if(a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name,'pl');
  });
  return out;
}

const queryInput = document.getElementById('query');
const form = document.getElementById('search-form');
const resultsDiv = document.getElementById('results');
const skeleton = document.getElementById('skeleton');
const body = document.body;
const resultsSection = document.getElementById('results-section');
const backBtn = document.getElementById('back-btn');
const formBrowser = document.getElementById('form-browser');
const formListEl = document.getElementById('form-list');
const formViewEl = document.getElementById('form-view');
const btnObywatel = document.getElementById('btn-obywatel');
const btnFirma = document.getElementById('btn-firma');
const btnKDonos = document.getElementById('btn-kdonos');
const tileWnioski = document.getElementById('tile-wnioski');
const homeTiles = document.querySelector('.home-tiles');

let currentCategory = null;
let currentForm = null;

async function fetchJson(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error('Request failed');
  return r.json();
}

function showFormBrowser(){
  if(formBrowser){
    formBrowser.hidden = false;
  }
}
function hideFormBrowser(){
  if(formBrowser){
    formBrowser.hidden = true;
    formListEl.innerHTML='';
    formViewEl.innerHTML='';
    currentCategory=null;currentForm=null;
  }
}

function hideHomeTiles(){
  if(homeTiles){
    homeTiles.setAttribute('data-hidden','true');
    document.body.setAttribute('data-home-tiles-hidden','true');
  }
}

function showHomeTiles(){
  if(homeTiles){
    homeTiles.removeAttribute('data-hidden');
  }
  document.body.removeAttribute('data-home-tiles-hidden');
}

async function loadCategory(cat){
  currentCategory = cat;
  currentForm = null;
  // Placeholder ukrywamy w mobilnym redesignie – zostanie zastąpiony po wyborze
  formViewEl.innerHTML = '<div class="form-empty form-placeholder" data-mobile-hide="true">Wybierz formularz...</div>';
  formListEl.innerHTML = '<div class="form-empty">Ładowanie...</div>';
  try {
    const data = await fetchJson(`/api/forms/${encodeURIComponent(cat)}`);
    if(!data.forms.length){
      formListEl.innerHTML = '<div class="form-empty">Brak formularzy</div>';
      return;
    }
    formListEl.innerHTML = '';
    // Dodaj nagłówek zwijany dla mobile
    const mobileToggle = document.createElement('button');
    mobileToggle.type='button';
    mobileToggle.className='form-list-toggle';
    mobileToggle.setAttribute('aria-expanded','true');
    mobileToggle.innerHTML = '<span class="flt-label">Formularze</span><span class="flt-state" data-open="Zwiń" data-closed="Pokaż">Zwiń</span>';
    formListEl.appendChild(mobileToggle);
    const listBox = document.createElement('div');
    listBox.className = 'form-list-items';
    formListEl.appendChild(listBox);
    data.forms.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'form-item-btn';
      const display = f.title || f.name || f.slug;
      btn.textContent = display;
      btn.setAttribute('data-form', f.slug);
      btn.addEventListener('click', ()=> selectForm(f.slug, btn));
      listBox.appendChild(btn);
    });
    // Animacje rozwijania/zwijania
    function collapseList(){
      if(listBox.hidden) return;
      const h = listBox.scrollHeight;
      listBox.style.height = h+'px';
      listBox.style.opacity = '1';
      requestAnimationFrame(()=>{
        listBox.classList.add('animating');
        listBox.style.height = '0px';
        listBox.style.opacity = '0';
      });
      const end = (e)=>{
        if(e.propertyName!=='height') return;
        listBox.hidden = true;
        listBox.classList.remove('animating');
        listBox.style.height='';
        listBox.style.opacity='';
        listBox.removeEventListener('transitionend', end);
      };
      listBox.addEventListener('transitionend', end);
    }
    function expandList(){
      if(!listBox.hidden && !listBox.style.height) return; // już rozwinięta
      listBox.hidden = false;
      listBox.style.height = '0px';
      listBox.style.opacity = '0';
      const target = listBox.scrollHeight;
      requestAnimationFrame(()=>{
        listBox.classList.add('animating');
        listBox.style.height = target+'px';
        listBox.style.opacity = '1';
      });
      const end = (e)=>{
        if(e.propertyName!=='height') return;
        listBox.classList.remove('animating');
        listBox.style.height='';
        listBox.style.opacity='';
        listBox.removeEventListener('transitionend', end);
      };
      listBox.addEventListener('transitionend', end);
    }
    // Mobile toggle logic (z animacją)
    mobileToggle.addEventListener('click', ()=>{
      const expanded = mobileToggle.getAttribute('aria-expanded')==='true';
      if(expanded){
        collapseList();
        mobileToggle.setAttribute('aria-expanded','false');
      } else {
        expandList();
        mobileToggle.setAttribute('aria-expanded','true');
      }
      const stateEl = mobileToggle.querySelector('.flt-state');
      if(stateEl){
        stateEl.textContent = mobileToggle.getAttribute('aria-expanded')==='true' ? stateEl.getAttribute('data-open') : stateEl.getAttribute('data-closed');
      }
    });
    // Ekspozycja pomocnicza dla selectForm
    mobileToggle.__collapseList = collapseList;
    mobileToggle.__expandList = expandList;
  } catch(e){
    formListEl.innerHTML = '<div class="form-empty">Błąd ładowania</div>';
  }
}

async function selectForm(slug, btnEl){
  if(!currentCategory) return;
  currentForm = slug;
  [...formListEl.querySelectorAll('.form-item-btn')].forEach(b=> b.classList.toggle('active', b===btnEl));
  formViewEl.innerHTML = '<div class="form-empty">Ładowanie...</div>';
  // Po wyborze formularza – na mobile zwiń listę
  const toggleBtn = formListEl.querySelector('.form-list-toggle');
  const listBox = formListEl.querySelector('.form-list-items');
  if(toggleBtn && listBox){
    // Zwiń tylko jeśli toggle jest faktycznie widoczny (mobile) – na desktopie zostaw listę otwartą
    const toggleVisible = window.getComputedStyle(toggleBtn).display !== 'none';
    if(toggleVisible){
      toggleBtn.setAttribute('aria-expanded','false');
      if(typeof toggleBtn.__collapseList === 'function') toggleBtn.__collapseList(); else { listBox.hidden = true; }
      const stateEl = toggleBtn.querySelector('.flt-state');
      if(stateEl){ stateEl.textContent = stateEl.getAttribute('data-closed'); }
    }
  }
  try {
    const data = await fetchJson(`/api/forms/${encodeURIComponent(currentCategory)}/${encodeURIComponent(slug)}`);
    const parsed = data.data;
    const title = parsed?.title || parsed?.name || slug;
    const description = parsed?.description ? `<p class="form-desc">${escapeHtml(parsed.description)}</p>` : '';
    const fields = Array.isArray(parsed?.body) ? parsed.body : [];
    const authMode = (parsed?.auth || 'none').trim();
    const formId = `dyn-form-${Date.now()}`;
    const htmlFields = fields.map(block => renderField(block)).join('');
    // Tożsamość (opcjonalna) – UI tylko gdy auth=optional
    const identityToggle = authMode === 'optional' ? `<label class="identity-opt"><input type="checkbox" id="identity-toggle" /> <span>Dołącz moją tożsamość</span></label>` : '';
    const identityInfo = authMode === 'required' ? `<div class="identity-info required">Twoja tożsamość zostanie dołączona do zgłoszenia.</div>` : (authMode === 'none' ? `<div class="identity-info anon">Zgłoszenie będzie anonimowe.</div>` : '<div class="identity-info optional">Możesz zdecydować czy dołączyć tożsamość.</div>');
  formViewEl.innerHTML = `<h3>${escapeHtml(title)}</h3>${description}<form id="${formId}" class="dynamic-form" novalidate>${htmlFields}<div class="identity-bar">${identityInfo}${identityToggle}</div><div class="form-actions"><button type="submit" class="app-btn submit-btn" disabled>Wyślij</button><div class="submit-extra" role="note">Po kliknięciu „Wyślij” pojawi się prośba o autoryzację.</div></div><div class="form-status" aria-live="polite"></div></form>`;
    const dynForm = document.getElementById(formId);
    if(dynForm){
      const fieldsDef = fields;
      dynForm.addEventListener('input', ()=>{
        const allValid = validateDynamicForm(dynForm, fieldsDef);
        const submit = dynForm.querySelector('.submit-btn');
        if(submit) submit.disabled = !allValid; 
      });
      dynForm.addEventListener('submit', e => {
        e.preventDefault();
        const submitBtn = dynForm.querySelector('.submit-btn');
        const statusEl = dynForm.querySelector('.form-status');
        if(!submitBtn || submitBtn.disabled) return;
        const dataOut = collectDynamicFormData(dynForm, fieldsDef);
        const labelsMap = {};
        fieldsDef.forEach(f=>{ if(f.id && f.attributes?.label) labelsMap[f.id] = f.attributes.label; });
        dataOut.internal_labels = labelsMap;
        const includeIdentity = authMode === 'required' ? true : (authMode === 'optional' ? !!dynForm.querySelector('#identity-toggle')?.checked : false);
        // Krok 1: rozpocznij reautoryzację
        submitBtn.disabled = true;
        submitBtn.textContent = 'Autoryzacja...';
        statusEl.textContent = '';
        let challengeId = null;
        fetch('/api/forms/reauth/begin',{ method:'POST' }).then(r=>r.json()).then(info => {
          if(!info.challengeId || !info.authUrl) throw new Error('Błąd startu autoryzacji');
          challengeId = info.challengeId;
          // Otwórz popup
          const w = 600, h = 700;
          const left = window.screenX + Math.max(0,(window.outerWidth - w)/2);
          const top = window.screenY + Math.max(0,(window.outerHeight - h)/2);
          const popup = window.open(info.authUrl+'&popup=1','reauth','popup=yes,width='+w+',height='+h+',left='+left+',top='+top);
          if(!popup){ throw new Error('Nie udało się otworzyć okna – odblokuj popupy'); }
          // Nasłuch na message (opcjonalny – fallback na polling)
          let verified = false; let closedInterval=null; let pollInterval=null;
          function finishIfVerified(){
            if(!verified) return;
            clearInterval(pollInterval); clearInterval(closedInterval);
            statusEl.innerHTML = '<div class="reauth-step"><span class="reauth-info">Autoryzacja zakończona – wysyłam wniosek...</span></div>';
            submitBtn.textContent = 'Wysyłanie...';
            // Automatyczna wysyłka po weryfikacji
            fetch(`/api/forms/${encodeURIComponent(currentCategory)}/${encodeURIComponent(currentForm)}/submit`, {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ fields: dataOut, includeIdentity, reauthChallenge: challengeId })
            }).then(async r => {
              if(!r.ok){
                const j = await r.json().catch(()=>({error:'Błąd'}));
                throw new Error(j.error || 'Błąd wysyłki');
              }
              return r.json();
            }).then(resp => {
              submitBtn.textContent = 'Wysłano';
              dynForm.classList.add('submitted');
              statusEl.innerHTML = `<div class=\"status-ok\">Wniosek wysłany (ID: ${escapeHtml(resp.submissionId)}) – oczekuje na decyzję.</div>`;
              if(typeof refreshSubs === 'function') setTimeout(()=>{ try { refreshSubs(); } catch(_){} }, 200);
            }).catch(err => {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Wyślij ponownie';
              statusEl.innerHTML = `<div class=\"status-err\">${escapeHtml(err.message||'Błąd wysyłki')}</div>`;
            });
          }
          window.addEventListener('message', ev => {
            if(ev.data && ev.data.type === 'reauth-complete' && ev.data.challenge === challengeId){
              verified = true;
              finishIfVerified();
            }
          }, { once:false });
          // Polling status (fallback jeśli postMessage nie zadziała)
          pollInterval = setInterval(()=>{
            fetch(`/api/forms/reauth/status?challenge=${encodeURIComponent(challengeId)}`).then(r=>r.json()).then(s => {
              if(s.verified){ verified = true; finishIfVerified(); }
            }).catch(()=>{});
          }, 1500);
          closedInterval = setInterval(()=>{ if(popup.closed){ clearInterval(closedInterval); } }, 500);
        }).catch(err => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Wyślij ponownie';
          statusEl.innerHTML = `<div class="status-err">${escapeHtml(err.message||'Błąd autoryzacji')}</div>`;
        });
      });
    }
  } catch(e){
    formViewEl.innerHTML = '<div class="form-empty">Błąd pobierania formularza</div>';
  }
}

function escapeHtml(str){
  return str.replace(/[&<>"]+/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

function renderField(block){
  if(!block || typeof block !== 'object') return '';
  const type = block.type;
  const id = block.id || `f-${Math.random().toString(36).slice(2)}`;
  const attrs = block.attributes || {};
  const label = attrs.label ? escapeHtml(attrs.label) : id;
  const required = block.validations?.required ? 'required' : '';
  const desc = attrs.description ? `<div class="f-help">${escapeHtml(attrs.description)}</div>` : '';
  const placeholder = attrs.placeholder ? `placeholder="${escapeHtml(attrs.placeholder)}"` : '';
  const minLength = block.validations?.minLength ? `minlength="${Number(block.validations.minLength)}"` : '';
  const maxLength = block.validations?.maxLength ? `maxlength="${Number(block.validations.maxLength)}"` : '';
  const pattern = block.validations?.pattern ? `pattern="${escapeHtml(block.validations.pattern)}"` : '';
  const value = attrs.value !== undefined ? `value="${escapeHtml(attrs.value)}"` : '';
  const readonly = block.validations?.readonly ? 'readonly' : '';

  if(type === 'markdown'){
    const body = attrs.value || attrs.text || block.value || '';
    return `<div class="f-markdown">${markdownToHtml(body)}</div>`;
  }
  if(type === 'input'){
    return `<div class="f-group"><label for="${id}" class="f-label">${label}${required?'<span class=\"req\">*</span>':''}</label><input id="${id}" name="${id}" type="text" class="f-control" ${placeholder} ${required} ${minLength} ${maxLength} ${pattern} ${value} ${readonly} /></div>${desc}`;
  }
  if(type === 'dropdown'){
    const multiple = attrs.multiple ? 'multiple' : '';
    const options = (attrs.options||[]).map(o=>{
      const optLabel = typeof o === 'object' && o !== null ? (o.label||o.value||JSON.stringify(o)) : String(o);
      const optValue = typeof o === 'object' && o !== null ? (o.value||o.label||optLabel) : String(o);
      return `<option value="${escapeHtml(String(optValue))}">${escapeHtml(String(optLabel))}</option>`;
    }).join('');
    return `<div class="f-group"><label for="${id}" class="f-label">${label}${required?'<span class=\"req\">*</span>':''}${attrs.multiple?'<span class=\"f-multi-info\">(wiele)</span>':''}</label><select id="${id}" name="${id}" class="f-control" ${required} ${multiple}>${options}</select>${desc}</div>`;
  }
  if(type === 'textarea'){
    const val = attrs.value !== undefined ? escapeHtml(attrs.value) : '';
    return `<div class="f-group"><label for="${id}" class="f-label">${label}${required?'<span class=\"req\">*</span>':''}</label><textarea id="${id}" name="${id}" rows="5" class="f-control" ${placeholder} ${required} ${minLength} ${maxLength} ${readonly}>${val}</textarea>${desc}</div>`;
  }
  if(type === 'checkboxes'){
    const options = (attrs.options||[]).map((o,i)=>{
      const optLabel = typeof o === 'object' && o !== null ? (o.label||o.value||`Opcja ${i+1}`) : String(o);
      const optValue = typeof o === 'object' && o !== null ? (o.value||o.label||optLabel) : String(o);
      const optId = `${id}__${i}`;
      return `<div class="f-choice"><input type="checkbox" id="${optId}" name="${id}" value="${escapeHtml(optValue)}" class="f-check" /> <label for="${optId}" class="f-choice-label">${escapeHtml(optLabel)}</label></div>`;
    }).join('');
    return `<fieldset class="f-group f-group-check" data-field-id="${id}"><legend class="f-label">${label}${required?'<span class=\"req\">*</span>':''}</legend>${options}${desc}</fieldset>`;
  }
  return `<div class="f-group"><div class="f-unknown">Nieobsługiwany typ: ${escapeHtml(type||'?')}</div></div>`;
}

function validateDynamicForm(formEl, fields){
  return fields.every(f => {
    // Obsługa readonly: jeśli pole readonly, sprawdź czy wartość nie została zmieniona
    if(f.validations?.readonly) {
      const el = formEl.querySelector(`[name="${f.id}"]`);
      if(!el) return false;
      let expected = '';
      if(f.type === 'textarea' || f.type === 'input') {
        expected = (f.attributes?.value ?? '');
        if(el.value !== expected) return false;
      }
      // inne typy można dodać w razie potrzeby
    }
    if(!f.validations?.required) return true;
    if(f.type === 'checkboxes'){
      const boxes = formEl.querySelectorAll(`input[type=checkbox][name="${f.id}"]`);
      return Array.from(boxes).some(b => b.checked);
    }
    const el = formEl.querySelector(`[name="${f.id}"]`);
    if(!el) return false;
    if(f.type === 'dropdown'){
      if(el.multiple){
        return Array.from(el.selectedOptions).length > 0;
      }
      return el.value.trim().length > 0;
    }
    if(['SELECT','TEXTAREA','INPUT'].includes(el.tagName)){
      if(el.value.trim().length === 0) return false;
      if(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement){
        if(!el.checkValidity()) return false;
      }
      return true;
    }
    return true;
  });
}

function collectDynamicFormData(formEl, fields){
  const out = {};
  fields.forEach(f => {
    if(f.type === 'checkboxes'){
      const boxes = formEl.querySelectorAll(`input[type=checkbox][name="${f.id}"]`);
      out[f.id] = Array.from(boxes).filter(b=>b.checked).map(b=>b.value);
      return;
    }
    const el = formEl.querySelector(`[name="${f.id}"]`);
    if(!el) return;
    if(f.type === 'dropdown' && el.multiple){
      out[f.id] = Array.from(el.selectedOptions).map(o=>o.value);
    } else {
      out[f.id] = el.value;
    }
  });
  return out;
}

// Very light markdown to sanitized HTML (bold, italic, line breaks, lists)
function markdownToHtml(src=''){
  let s = escapeHtml(src);
  s = s.replace(/^### (.*)$/gm,'<h4>$1</h4>')
       .replace(/^## (.*)$/gm,'<h3>$1</h3>')
       .replace(/^# (.*)$/gm,'<h2>$1</h2>')
       .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
       .replace(/\*(.+?)\*/g,'<em>$1</em>')
       .replace(/`([^`]+)`/g,'<code>$1</code>');
  // Lists
  if(/^[-*] /m.test(s)){
    s = s.replace(/^(?:[-*] .*(?:\n|$))+?/gm, block => {
      const items = block.trim().split(/\n/).map(l=>l.replace(/^[-*] /,'').trim()).filter(Boolean);
      return '<ul>' + items.map(i=>`<li>${i}</li>`).join('') + '</ul>';
    });
  }
  return `<div class="md-block">${s.replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br/>')}</div>`;
}

function handleCategoryClick(cat){
  showFormBrowser();
  loadCategory(cat);
  if(!body.dataset.mode || body.dataset.mode !== 'condensed'){
    requestAnimationFrame(()=> body.setAttribute('data-mode','condensed'));
  }
  body.setAttribute('data-search-hidden','true');
  hideHomeTiles();
  // Hide search results if any
  resultsDiv.innerHTML='';
}

// Przyciski w kafelku Wnioski
// if(btnObywatel){ btnObywatel.addEventListener('click', ()=> handleCategoryClick('citizen')); }
if(btnFirma){ btnFirma.addEventListener('click', ()=> handleCategoryClick('company')); }
// if(btnKDonos){ btnKDonos.addEventListener('click', (e)=>{ e.preventDefault(); handleCategoryClick('cbs'); hideHomeTiles(); }); }

// Toggle rozkładania kafelka "Wnioski"
// if(tileWnioski){
//   const actions = tileWnioski.querySelector('.tile-wnioski-actions');
//   function toggle(open){
//     const isOpen = open!==undefined ? open : tileWnioski.getAttribute('aria-expanded') !== 'true';
//     tileWnioski.setAttribute('aria-expanded', String(isOpen));
//     if(actions){ actions.hidden = !isOpen; }
//   }
//   tileWnioski.addEventListener('click', (e)=>{
//     // jeżeli klik był na przycisku w środku – nie toggluj dwukrotnie
//     if(e.target.closest('.app-btn')) return;
//     toggle();
//   });
//   tileWnioski.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle(); } });
// }

function buildCard(p){
  const nickMC = p.nickMinecraft || 'Nieznany';
  const adresParts = [p.ulica, p.mieszkanie, p.miasto, p.wojewodztwo].filter(Boolean);
  const adres = adresParts.length ? adresParts.join(', ') : '<span class="empty">–</span>';
  const coords = (p.x||p.x===0) ? `${p.x} ${p.y} ${p.z}` : '<span class="empty">–</span>';
  // Konwersja stringu zatrudnienia do linków firmowych (format "Stanowisko Firma" lub "Firma") oddzielone ;
  let pracaHtml = '<span class="empty">–</span>';
  if((p.employment||'').trim()){
    const parts = p.employment.split(/\s*;\s*/).filter(Boolean);
    pracaHtml = parts.map(seg => {
      // Spróbuj wydzielić stanowisko (jeśli występuje spacja przed ostatnim słowem, które może być nazwą firmy wielowyrazową – zostaw całość jako firma bez dzielenia)
      // Prostota: link całego segmentu wyszukuje firmę po fragmencie (pełny segment i fallback ostatnie słowa >=2 znaki)
      const safe = seg.replace(/</g,'&lt;');
      const query = encodeURIComponent(seg.trim());
      return `<button type="button" class="inline-link link-firma" data-q="${query}" title="Pokaż firmę">${safe}</button>`;
    }).join(', ');
  }
  const praca = pracaHtml;
  const skinUrl = p.uuid ? `/skin/${p.uuid}` : '/logo.png';
  const mapBtn = (p.x||p.x===0) ? `<div class="field field-map"><div class="label">MAPA</div><div class="value"><button type="button" class="mini-btn icon-btn goto-map" data-x="${p.x}" data-z="${(p.z??p.y) || 0}" data-nick="${nickMC.replace(/"/g,'&quot;')}" aria-label="Pokaż gracza ${nickMC} na mapie"><img src="/icns_ui/map_search.svg" alt="" class="icon" aria-hidden="true"/>Pokaż na mapie</button></div></div>` : '';
  return `<article class="player-sheet" aria-labelledby="pl-${p.kesel}" tabindex="0">
    <div class="sheet-grid">
      <div class="sheet-cols">
        <div class="field"><div class="label">NICK MINECRAFT</div><div class="value nick" id="pl-${p.kesel}">${nickMC}</div></div>
        <div class="field"><div class="label">NUMER KESEL</div><div class="value mono">${p.kesel}</div></div>
        <div class="field"><div class="label">ADRES ZAMIESZKANIA</div><div class="value">${adres}</div></div>
        <div class="field"><div class="label">KOORDYNATY MIEJSCA ZAMIESZKANIA</div><div class="value">${coords}</div></div>
        <div class="field"><div class="label">PRACA</div><div class="value">${praca}</div></div>
        ${mapBtn}
      </div>
      <div class="sheet-avatar-wrap">
        <div class="skin-frame">
          <img src="${skinUrl}" alt="Twarz skina Minecraft" class="skin-face" loading="lazy"/>
        </div>
      </div>
    </div>
  </article>`;
}

function hideSkeleton(){
  if(skeleton){
    skeleton.classList.add('hidden');
    skeleton.setAttribute('aria-hidden','true');
  }
}
function showSkeleton(){
  if(skeleton){
    skeleton.classList.remove('hidden');
    skeleton.setAttribute('aria-hidden','false');
  }
}

// --- Przywrócone helpery wyszukiwarki punktów / mapy ---
function attachMapButtons(){
  const btns = resultsDiv.querySelectorAll('.goto-map');
  btns.forEach(btn=>{
    if(btn.dataset.bound === '1') return;
    btn.dataset.bound='1';
    btn.addEventListener('click', ()=>{
      const hasLine = btn.hasAttribute('data-lineid');
      if(hasLine){
        const lineId = btn.getAttribute('data-lineid');
        if(!lineId) return;
        try {
          sessionStorage.setItem('map.focus.line', JSON.stringify({ lineId, ts: Date.now() }));
          window.location.href = `/map?line=${encodeURIComponent(lineId)}`;
        } catch(_){ window.location.href = `/map?line=${encodeURIComponent(lineId)}`; }
        return;
      }
      const x = Number(btn.getAttribute('data-x'));
      const z = Number(btn.getAttribute('data-z'));
      const label = btn.getAttribute('data-nick') || 'Gracz';
      if(!isFinite(x) || !isFinite(z)) return;
      try {
        sessionStorage.setItem('map.focus.player', JSON.stringify({ x, z, label, ts: Date.now() }));
        const url = `/map?fx=${encodeURIComponent(x)}&fz=${encodeURIComponent(z)}&fl=${encodeURIComponent(label)}`;
        window.location.href = url;
      } catch(_){
        window.location.href = `/map?fx=${encodeURIComponent(x)}&fz=${encodeURIComponent(z)}`;
      }
    });
  });
  // Linie (przycisk goto-line aliasuje do goto-map jeśli brak współrzędnych)
  const lineBtns = resultsDiv.querySelectorAll('.goto-line');
  lineBtns.forEach(b=>{ if(!b.classList.contains('goto-map')) b.classList.add('goto-map'); });
}

function getFilteredPointMatches(){
  if(__pointCategoryFilter.size===0) return __allPointMatches;
  return __allPointMatches.filter(p=> __pointCategoryFilter.has(p.category));
}

function initPointFilters(){
  const bar = resultsDiv.querySelector('.point-filters');
  if(!bar) return;
  bar.addEventListener('click', e => {
    const btn = e.target.closest('button.pf-btn');
    if(!btn) return;
    const cat = btn.getAttribute('data-cat');
    if(cat === '__all'){
      __pointCategoryFilter.clear();
    } else {
      if(__pointCategoryFilter.has(cat)) __pointCategoryFilter.delete(cat); else __pointCategoryFilter.add(cat);
    }
    bar.querySelectorAll('button.pf-btn').forEach(b=>{
      const c = b.getAttribute('data-cat');
      if(c==='__all'){
        b.setAttribute('aria-pressed', String(__pointCategoryFilter.size===0));
      } else {
        b.setAttribute('aria-pressed', String(__pointCategoryFilter.has(c)));
      }
    });
    __pointsShown = Math.min(__pointsPageSize, getFilteredPointMatches().length);
    renderPointsList();
  });
}

function renderPointsList(){
  const box = resultsDiv.querySelector('#points-container');
  if(!box) return;
  const all = getFilteredPointMatches();
  if(!all.length){ box.innerHTML = '<div class="empty" style="font-size:.65rem;opacity:.7;">Brak wyników po filtrach</div>'; return; }
  const subset = all.slice(0, __pointsShown);
  const cats = (__mapPointsCache?.categories)||{};
  box.innerHTML = '<div class="points-list">'+ subset.map(p=>{
    const col = cats[p.category]?.color || '#AC1943';
    const catTag = p.category ? `<span class=\"pt-cat\" title=\"${escapeHtml(p.categoryLabel||p.category)}\">${escapeHtml(p.categoryLabel||p.category)}</span>` : '';
    return `<div class=\"point-result\" data-id=\"${p.id||''}\" data-cat=\"${escapeHtml(p.category)}\">`
      + `<div class=\"pr-row\"><span class=\"pt-color-dot\" style=\"background:${col}\"></span><span class=\"pr-name goto-map\" role=\"button\" tabindex=\"0\" data-x=\"${p.x}\" data-z=\"${p.z}\" data-nick=\"${escapeHtml(p.name)}\">${escapeHtml(p.name)}</span>${catTag}</div>`
      + `<div class=\"pr-meta\">X:${p.x} Z:${p.z}</div>`
      + `<div class=\"pr-actions\"><button type=\"button\" class=\"mini-btn icon-btn goto-map\" data-x=\"${p.x}\" data-z=\"${p.z}\" data-nick=\"${escapeHtml(p.name)}\"><img src=\"/icns_ui/map_search.svg\" alt=\"\" class=\"icon\" aria-hidden=\"true\"/>Pokaż</button></div>`
      + `</div>`;
  }).join('') + '</div>' + (all.length>subset.length ? `<div class=\"points-more\"><button type=\"button\" id=\"points-more-btn\" class=\"mini-btn icon-btn\">Pokaż więcej (${all.length - subset.length})</button></div>` : '');
  attachMapButtons();
  const moreBtn = resultsDiv.querySelector('#points-more-btn');
  if(moreBtn){
    moreBtn.addEventListener('click', ()=>{
      __pointsShown = Math.min(__pointsShown + __pointsPageSize, getFilteredPointMatches().length);
      renderPointsList();
    });
  }
}

let __companiesAll = null;
async function loadAllCompanies(){
  if(__companiesAll) return __companiesAll;
  try { __companiesAll = await window.__db.fetchJson('data/companies.json'); }
  catch(e){ __companiesAll = []; }
  return __companiesAll;
}
async function fetchCompanies(q=''){
  const term = (q||'').trim().toLowerCase(); if(!term) return [];
  const all = await loadAllCompanies();
  // Proste filtrowanie: po KNIP, nazwie, mieście
  return all.filter(c => (c.knip && String(c.knip).includes(term))
    || (c.nazwa && c.nazwa.toLowerCase().includes(term))
    || (c.miasto && c.miasto.toLowerCase().includes(term))
    || (Array.isArray(c.employees) && c.employees.some(e => (e.kesel && String(e.kesel).includes(term)) || (e.nick && e.nick.toLowerCase().includes(term))))
  );
}

function render(results){
  const { query, pointMatches, lineMatches } = results;
  __allPointMatches = pointMatches || [];
  __pointsShown = Math.min(__pointsPageSize, __allPointMatches.length);
  __lineMatches = lineMatches || [];
  if(!query && !pointMatches.length){
    resultsDiv.innerHTML=''; hideSkeleton(); return;
  }
  if(!pointMatches.length && !__lineMatches.length){
    resultsDiv.innerHTML = `<div class="empty">Brak wyników dla: <strong>${query}</strong></div>`;
    hideSkeleton(); return;
  }
  let html = '';
  // --- Miejsca ---
  if(pointMatches.length){
    const cats = Object.entries(__mapPointsCache?.categories || {}).filter(([k])=> k.toLowerCase()!=='players');
    const filterBar = cats.length ? `<div class="point-filters" role="group" aria-label="Filtry kategorii">`
      + `<button type="button" class="pf-btn pf-all" data-cat="__all" aria-pressed="${__pointCategoryFilter.size===0}">Wszystkie</button>`
      + cats.map(([k,v])=>{
        const active = __pointCategoryFilter.has(k);
        const color = v.color || '#888';
        return `<button type="button" class="pf-btn" data-cat="${escapeHtml(k)}" aria-pressed="${active}"><span class="pf-dot" style="background:${color}"></span>${escapeHtml(v.label||k)}</button>`;
      }).join('')
      + `</div>` : '';
    html += `<section class="res-block res-points" aria-label="Miejsca"><h3 id="pts-head" class="res-head">Miejsca (${pointMatches.length})</h3>${filterBar}<div id="points-container"></div></section>`;
  }
  // --- Linie ---
  if(__lineMatches.length){
    const cats = __mapLinesCache?.categories || {};
    const items = __lineMatches.map(ln=>{
      const color = cats[ln.category]?.color || '#666';
      const catLabel = ln.categoryLabel || ln.category || '';
      return `<div class="line-result" data-lineid="${ln.id}">`
        + `<div class="lr-row"><span class="lr-color" style="background:${color}"></span>`
        + `<span class="lr-name">${escapeHtml(ln.name)}</span>`
        + (catLabel?`<span class="lr-cat">${escapeHtml(catLabel)}</span>`:'')
        + `<button type="button" class="mini-btn icon-btn goto-line" data-lineid="${ln.id}" aria-label="Pokaż linię ${escapeHtml(ln.name)}"><img src="/icns_ui/map_search.svg" class="icon" alt="" aria-hidden="true"/>Pokaż</button>`
        + `</div>`
        + `</div>`;
    }).join('');
    html += `<section class="res-block res-lines" aria-label="Linie"><h3 class="res-head">Linie (${__lineMatches.length})</h3><div class="lines-container">${items}</div></section>`;
  }
  resultsDiv.innerHTML = html;
  hideSkeleton();
  attachMapButtons();
  if(pointMatches.length){
    initPointFilters();
    renderPointsList();
  }
}
