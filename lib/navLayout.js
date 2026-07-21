// Top navigation bar personalization model, same shape as home-layout.js but
// drives SiteHeader's nav links. Shared by SiteHeader (applies it) and settings
// (edits it) via localStorage key kob.nav.layout.v1.

export const STORAGE_KEY = 'kob.nav.layout.v1';
// Fired on save() so mounted consumers (SiteHeader) can update live, without a
// reload — the localStorage "storage" event only fires in *other* tabs.
export const CHANGE_EVENT = 'kob:navlayout-change';

// Canonical nav items in default order. href/icon are the source of truth here,
// never stored in localStorage, so a renamed route or icon self-heals.
export const DEFAULT_ITEMS = [
  { id: 'nav-map', href: '/map/', label: 'Mapa', icon: 'map' },
  { id: 'nav-khandel', href: '/khandel/', label: 'kHandel', icon: 'storefront' },
  { id: 'nav-kwiedza', href: '/kwiedza/', label: 'kWiedza', icon: 'book' },
  { id: 'nav-ksejm', href: '/ksejm/', label: 'kSejm', icon: 'ksejm' },
  { id: 'nav-ksef', href: '/ksef/', label: 'kSeF', icon: 'invoice' },
  { id: 'nav-kfirma', href: '/kfirma/', label: 'kFirma', icon: 'company' },
  { id: 'nav-kdokumenty', href: '/kdokumenty/', label: 'kDokumenty', icon: 'document' },
];

export function defaults() {
  return {
    items: DEFAULT_ITEMS.map((i) => ({ id: i.id, label: i.label, hidden: false })),
  };
}

// Reconcile a stored state against the available items, appending any missing.
export function normalize(raw) {
  const base = defaults();
  const available = new Map(base.items.map((i) => [i.id, i]));
  const ordered = [];
  const stored = Array.isArray(raw?.items) ? raw.items : [];
  stored.forEach((i) => {
    if (!i?.id || !available.has(i.id)) return;
    const ref = available.get(i.id);
    ordered.push({ id: ref.id, label: ref.label, hidden: !!i.hidden });
    available.delete(i.id);
  });
  available.forEach((i) => ordered.push({ ...i }));
  return { items: ordered };
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
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch (_) {
    /* ignore */
  }
}

// Merge the personalized order/visibility with the canonical href/icon, for
// rendering — drops hidden items.
export function resolve(state) {
  const byId = new Map(DEFAULT_ITEMS.map((i) => [i.id, i]));
  return state.items
    .filter((i) => !i.hidden)
    .map((i) => byId.get(i.id))
    .filter(Boolean);
}
