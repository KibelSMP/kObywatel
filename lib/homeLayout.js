// Home-screen personalization model, ported from the legacy home-layout.js.
// Single source of truth for tile order/visibility, shared by the home page
// (applies it) and settings (edits it) via localStorage key kob.home.layout.v1.

export const STORAGE_KEY = 'kob.home.layout.v1';

// Canonical tile list in default order (mirrors the legacy index.html).
export const DEFAULT_TILES = [
  { id: 'tile-mapa', label: 'Mapa' },
  { id: 'tile-khandel', label: 'kHandel' },
  { id: 'tile-kwiedza', label: 'kWiedza' },
  { id: 'tile-ksejm', label: 'kSejm' },
  { id: 'tile-ksef', label: 'kSeF' },
  { id: 'tile-kfirma', label: 'kFirma' },
  { id: 'tile-kdokumenty', label: 'kDokumenty' },
  { id: 'tile-kpack', label: 'kPack' },
  { id: 'tile-report', label: 'Zgłoszenia' },
  { id: 'tile-creators', label: 'Twórcy' },
];

// Tiles that can never be hidden.
export const LOCKED = new Set(['tile-report', 'tile-creators']);

export function defaults() {
  return {
    searchHidden: false,
    tiles: DEFAULT_TILES.map((t) => ({
      id: t.id,
      label: t.label,
      hidden: false,
      locked: LOCKED.has(t.id),
    })),
  };
}

// Reconcile a stored state against the available tiles, appending any missing.
export function normalize(raw) {
  const base = defaults();
  const available = new Map(base.tiles.map((t) => [t.id, t]));
  const ordered = [];
  const storedTiles = Array.isArray(raw?.tiles) ? raw.tiles : [];
  storedTiles.forEach((t) => {
    if (!t?.id || !available.has(t.id)) return;
    const ref = available.get(t.id);
    const locked = LOCKED.has(ref.id);
    ordered.push({ id: ref.id, label: ref.label, hidden: locked ? false : !!t.hidden, locked });
    available.delete(t.id);
  });
  available.forEach((t) => ordered.push({ ...t }));
  return { searchHidden: !!raw?.searchHidden, tiles: ordered };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    return normalize(JSON.parse(raw));
  } catch (_) {
    return defaults();
  }
}

export function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    /* ignore */
  }
}
