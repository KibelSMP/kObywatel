// Waypointy kLink — wspólny moduł dla mapy, kHandel i kFirma.
//
// Mod kLink (repo KibelSMP/kLink, docs/integracja-kobywatel.md) wystawia
// lokalny serwer HTTP na 127.0.0.1:31371 i tą samą operację `waypoint.upsert`
// przez natywny most window.klinkQuery w swojej przeglądarce w grze. Do
// niedawna korzystała z tego tylko mapa; ten moduł wyciąga transport, stan
// połączenia, paletę kolorów i komunikaty w jedno miejsce, żeby przycisk
// „waypoint w grze" dało się postawić przy dowolnym obiekcie z bazy — punkcie
// mapy, sklepie kHandel czy firmie kFirma.
//
// Poza grą i bez uruchomionego Minecrafta cały moduł jest bezczynny:
// ensureConnection() zwraca stan „niedostępny", a strony po prostu nie rysują
// przycisku. Brak odpowiedzi z loopbacku to tu stan oczekiwany, nie awaria.

export const KLINK_BASE = 'http://127.0.0.1:31371';

// --- Kolory waypointów wg kategorii obiektu ---------------------------------
// Klucze to `category` punktu mapy z bazy (data/map-points/meta.json) plus dwa
// własne rodzaje dla obiektów spoza mapy. Wartości to nazwy kolorów Xaero
// (jedna z 21 — nieznana nazwa = odrzucone żądanie), dobrane tak, żeby waypoint
// w grze miał mniej więcej ten kolor, co marker na mapie.
export const WAYPOINT_COLORS = {
  miasto_duze: 'RED',        // #ff4d4d
  miasto: 'RED',             // starsze punkty bez rozróżnienia wielkości
  miasto_male: 'GOLD',       // #ff9e4d
  gracz: 'DARK_GREEN',       // #668f3b
  infra: 'BLUE',             // #4d94ff
  kolej: 'GREEN',            // #10b981
  metro: 'PURPLE',           // #8b5cf6
  airport: 'LIGHT_BLUE',     // #38bdf8
  sklep: 'YELLOW',           // kHandel — brak odpowiednika na mapie punktów
  firma: 'MAGENTA',          // kFirma — j.w.
};

const DEFAULT_COLOR = 'RED';

/** Kolor Xaero dla kategorii punktu / rodzaju obiektu. Nieznana → RED. */
export function colorForKind(kind) {
  if (!kind) return DEFAULT_COLOR;
  return WAYPOINT_COLORS[String(kind).toLowerCase()] || DEFAULT_COLOR;
}

// --- Transport --------------------------------------------------------------
// Dwie drogi do moda (patrz integracja-kobywatel.md):
//  • zwykła przeglądarka — fetch() na loopback;
//  • widok w grze (wbudowana przeglądarka Rinku/CEF) — natywny most
//    window.klinkQuery, bo fetch() do loopbacku jest tam blokowany albo leci
//    bez nagłówka Origin i mod go odrzuca.
// Most bierzemy pod uwagę wyłącznie, gdy mod sam się ogłosił przez
// window.__klink.embedded — sam „skin w grze" (?klinkskin=1) tego nie wystawia
// i musi dalej chodzić po fetchu.
export function useBridge() {
  return !!(window.__klink && window.__klink.embedded && typeof window.klinkQuery === 'function');
}

// Most CEF: jedna funkcja na wszystkie operacje, bez originu, CORS-u i kodu
// statusu HTTP. onSuccess dostaje string JSON w tym samym kształcie, co ciało
// odpowiedniego endpointu HTTP (błędy walidacji też tędy). onFailure jest
// zarezerwowane dla żądań, których mod w ogóle nie zrozumiał (zły JSON,
// brak/nieznane `op`) — traktujemy je jak brak połączenia.
function bridgeRequest(op, fields) {
  return new Promise(resolve => {
    let request;
    try { request = JSON.stringify({ op, ...(fields || {}) }); }
    catch (_) { resolve(null); return; }
    try {
      window.klinkQuery({
        request,
        onSuccess: (response) => {
          try { resolve(JSON.parse(response)); }
          catch (_) { resolve(null); }
        },
        onFailure: () => resolve(null),
      });
    } catch (_) { resolve(null); }
  });
}

// Wspólne wejście dla obu transportów. `op` to jedno z:
// 'health' | 'status' | 'player' | 'waypoint.upsert' | 'waypoint.delete'.
// Zwraca { reachable, data }: reachable=false oznacza brak połączenia (gra nie
// działa / most niedostępny), data to zparsowany JSON odpowiedzi
// ({ ok, status, error, ... }) — kształt identyczny dla fetcha i mostu, więc
// dalej patrzymy już tylko na pola JSON-a, nie na kod statusu HTTP.
export async function call(op, payload) {
  if (useBridge()) {
    const data = await bridgeRequest(op, payload);
    return { reachable: data !== null, data };
  }
  const isWaypoint = op === 'waypoint.upsert' || op === 'waypoint.delete';
  const path = isWaypoint ? '/waypoint' : '/' + op;
  const method = op === 'waypoint.upsert' ? 'POST' : op === 'waypoint.delete' ? 'DELETE' : 'GET';
  const opts = { method };
  if (payload !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(payload);
  }
  let res;
  try { res = await fetch(KLINK_BASE + path, opts); }
  catch (_) { return { reachable: false, data: null }; }
  let data = null;
  try { data = await res.json(); } catch (_) { }
  return { reachable: true, data };
}

export async function checkHealth() {
  const { data } = await call('health');
  return !!(data && data.ok);
}

// --- Stan połączenia --------------------------------------------------------
// `reachable` — mod odpowiada; `waypoints` — ma też Xaero's Minimap, czyli
// POST /waypoint w ogóle ma sens (features.waypoints z GET /status). Bez Xaero
// każdy zapis kończyłby się 501, więc przycisku po prostu nie pokazujemy.

const state = { reachable: false, waypoints: false };
const listeners = new Set();

function setState(reachable, waypoints) {
  if (state.reachable === reachable && state.waypoints === waypoints) return;
  state.reachable = reachable;
  state.waypoints = waypoints;
  listeners.forEach(fn => { try { fn(snapshot()); } catch (_) { } });
}

export function snapshot() {
  return { reachable: state.reachable, waypoints: state.waypoints };
}

/** Czy warto w ogóle pokazywać przycisk waypointa. */
export function canAddWaypoints() {
  return state.reachable && state.waypoints;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Sprawdza mod (health + status) i zapisuje wynik w stanie modułu.
 * Zwraca snapshot. Wołane przy starcie strony i po każdej nieudanej próbie.
 */
export async function refreshConnection() {
  if (!await checkHealth()) { setState(false, false); return snapshot(); }
  const { reachable, data } = await call('status');
  if (!reachable) { setState(false, false); return snapshot(); }
  // Starszy mod bez `features` w /status — zakładamy, że waypointy działają
  // (przed dodaniem tego pola Xaero było twardym wymaganiem moda).
  const features = data && data.features;
  setState(true, features ? features.waypoints !== false : true);
  return snapshot();
}

let ensurePromise = null;
/** refreshConnection(), ale tylko raz na wczytanie strony. */
export function ensureConnection() {
  if (!ensurePromise) ensurePromise = refreshConnection();
  return ensurePromise;
}

// --- Wysyłanie waypointa ----------------------------------------------------

/**
 * Upsert jednego waypointa. `kind` to kategoria obiektu — decyduje o kolorze
 * (patrz WAYPOINT_COLORS). `id` musi być stabilne: ten sam `id` aktualizuje
 * waypoint w miejscu, zamiast tworzyć duplikat.
 *
 * Zwraca kod do pokazania użytkownikowi (patrz message()):
 * 'awaiting' | 'added' | 'offline' | 'not_in_game' | 'not_in_overworld' |
 * 'no_xaero' | 'failed'. Przy 'offline' stan modułu jest już odświeżony, więc
 * subskrybenci zdążą schować przycisk.
 */
export async function sendWaypoint({ x, z, name, id, kind, color, symbol }) {
  const point = { x: Math.round(x), z: Math.round(z), name: String(name || '') };
  if (id) point.id = String(id);
  point.color = color || colorForKind(kind);
  if (symbol) point.symbol = symbol;

  const { reachable, data } = await call('waypoint.upsert', { points: [point] });
  if (!reachable) {
    await refreshConnection();
    return 'offline';
  }
  // Bez kodu statusu HTTP — rozróżniamy po polach JSON-a (identycznie dla
  // fetcha i mostu): awaiting_confirmation = 202, ok = dodane/zaktualizowane.
  if (data?.status === 'awaiting_confirmation') return 'awaiting';
  if (data?.ok) return 'added';
  if (data?.error === 'not_in_overworld') return 'not_in_overworld';
  if (data?.error === 'not_in_game') return 'not_in_game';
  if (data?.error === 'xaerominimap_not_installed') {
    setState(state.reachable, false);
    return 'no_xaero';
  }
  return 'failed';
}

// --- Komunikaty -------------------------------------------------------------

const MESSAGES = {
  pl: {
    pending: 'Otwórz grę, aby potwierdzić dodanie waypointa.',
    awaiting: 'Otwórz grę, aby potwierdzić dodanie waypointa.',
    added: 'Dodano waypoint w grze.',
    offline: 'Nie udało się połączyć z grą. Uruchom Minecraft z modem kLink.',
    not_in_game: 'Wejdź do świata, aby dodać waypoint.',
    not_in_overworld: 'Wróć do Overworldu, aby dodać waypoint.',
    no_xaero: 'Waypointy wymagają Xaero’s Minimap.',
    failed: 'Nie udało się dodać waypointa w grze.',
    button: 'Waypoint w grze',
    buttonTitle: 'Dodaj lub zaktualizuj waypoint w Xaero’s Minimap',
  },
  en: {
    pending: 'Open the game to confirm the waypoint.',
    awaiting: 'Open the game to confirm the waypoint.',
    added: 'Waypoint added in game.',
    offline: 'Could not reach the game. Start Minecraft with the kLink mod.',
    not_in_game: 'Join a world to add a waypoint.',
    not_in_overworld: 'Go back to the Overworld to add a waypoint.',
    no_xaero: 'Waypoints need Xaero’s Minimap.',
    failed: 'Could not add the waypoint in game.',
    button: 'Waypoint in game',
    buttonTitle: 'Add or update a waypoint in Xaero’s Minimap',
  },
};

export function message(code, lang = 'pl') {
  const table = MESSAGES[lang] || MESSAGES.pl;
  return table[code] || table.failed;
}
