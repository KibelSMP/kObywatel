// Przypinanie ofert kHandel do okienek kLink.
//
// Most JS↔gra: mod kLink wystawia w swojej wbudowanej przeglądarce
// window.klinkQuery (natywny kanał CEF, nie fetch — patrz
// docs/integracja-kobywatel.md w repo kLink). Operacje pin.add / pin.remove /
// pin.list tworzą, usuwają i wyliczają pływające okienka z ofertą, rysowane
// przez mod nad światem gry i nad widokiem kObywatela.
//
// Poza grą (zwykła karta przeglądarki) window.klinkQuery nie istnieje i cały
// ten moduł jest bezczynny — isEmbedded() zwraca false, a kHandel po prostu
// nie rysuje przycisków przypinania. Tak samo zachowuje się starsza wersja
// moda, która zna window.klinkQuery, ale nie zna operacji pin.* — odpowiada
// wtedy przez onFailure('unknown_op') i traktujemy to jak brak funkcji.

const DEFAULT_MAX = 5;

const state = {
  // Mod odpowiada na pin.* (czyli: gramy w kLinku i mod jest dość nowy).
  supported: false,
  // Można teraz przypinać — piny są zapisywane per świat/serwer, więc w menu
  // głównym (jeszcze bez świata) mod odpowiada 'not_in_game'.
  active: false,
  pinned: new Set(),
  max: DEFAULT_MAX,
  // Kod błędu z ostatniej operacji ('pin_limit_reached', 'not_in_game', …).
  lastError: null,
};

const listeners = new Set();

export function isEmbedded(){
  return !!(window.__klink && window.__klink.embedded && typeof window.klinkQuery === 'function');
}

function query(op, fields){
  return new Promise((resolve, reject)=>{
    if(!isEmbedded()){ reject(new Error('kLink: brak window.klinkQuery')); return; }
    window.klinkQuery({
      request: JSON.stringify(Object.assign({ op }, fields || {})),
      onSuccess: (response)=>{
        try { resolve(JSON.parse(response)); }
        catch(e){ reject(new Error('kLink: nieczytelna odpowiedź na '+op)); }
      },
      // onFailure to wyłącznie „mod nie zrozumiał żądania" (nieznane op na
      // starszej wersji moda). Błędy operacji przychodzą przez onSuccess
      // jako {ok:false,error:…}.
      onFailure: (code, message)=> reject(new Error(message || ('kLink: '+op+' nieobsługiwane'))),
    });
  });
}

// Każda odpowiedź pin.* niesie pełną listę przypiętych ofert i limit, więc
// jeden round trip wystarcza, żeby zsynchronizować wszystkie przyciski —
// także po odpięciu okienka w grze, o czym strona nie dowiedziałaby się inaczej.
function apply(data){
  state.supported = true;
  // Jedyne dwa błędy, które mówią „przypinanie w ogóle teraz nie działa";
  // reszta ('pin_limit_reached', 'already_pinned', …) dotyczy tej jednej operacji.
  state.active = data.error !== 'not_in_game' && data.error !== 'browser_unavailable';
  if(Array.isArray(data.pins)) state.pinned = new Set(data.pins.map(String));
  if(Number.isFinite(data.max)) state.max = data.max;
  state.lastError = data.ok ? null : (data.error || null);
  notify();
  return data;
}

function notify(){
  listeners.forEach(fn=>{ try { fn(snapshot()); } catch(_){} });
}

export function subscribe(fn){
  listeners.add(fn);
  return ()=> listeners.delete(fn);
}

export function snapshot(){
  return {
    supported: state.supported,
    active: state.active,
    count: state.pinned.size,
    max: state.max,
    full: state.pinned.size >= state.max,
    lastError: state.lastError,
  };
}

export function isPinned(offerId){
  return state.pinned.has(String(offerId));
}

/** Pobiera stan przypięć z gry. Zwraca false, jeśli mod ich nie obsługuje. */
export async function refresh(){
  if(!isEmbedded()) return false;
  try {
    apply(await query('pin.list'));
    return true;
  } catch(_){
    state.supported = false;
    state.active = false;
    notify();
    return false;
  }
}

export async function pin(offerId){
  return apply(await query('pin.add', { id: String(offerId) }));
}

export async function unpin(offerId){
  return apply(await query('pin.remove', { id: String(offerId) }));
}

// Lista przypięć potrafi się zmienić bez udziału strony: w widoku kObywatela
// gracz ma okienka tuż obok katalogu i może zamknąć któreś jego własnym
// krzyżykiem. Po każdej zmianie mod rozgłasza w otwartych stronach to
// zdarzenie (PageBridge.broadcast po stronie kLinka) — wystarczy dociągnąć
// świeży stan, a subskrybenci przepiszą go na przyciski.
if(isEmbedded()){
  window.addEventListener('klink-pins-changed', ()=>{ refresh(); });
}
