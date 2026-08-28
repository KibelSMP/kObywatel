// Shared helpers, ported from the legacy utils.js. React/JSX auto-escapes text,
// so escapeHtml is only needed by the imperative islands (map.js/khandel.js);
// productMatchesQuery / productFallbackName are the kHandel search helpers reused
// by the home page and the map's shop results.

export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  );
}

export function productMatchesQuery(entry, queryLower) {
  const namePl = (entry.productName || entry.product?.name || '').toLowerCase();
  const nameEn = (entry.productNameEn || entry.product?.nameEn || '').toLowerCase();
  const notes = (entry.notes || '').toLowerCase();
  return (
    namePl.includes(queryLower) || nameEn.includes(queryLower) || notes.includes(queryLower)
  );
}

export function productFallbackName(entry) {
  return (
    entry.productName ||
    entry.product?.name ||
    entry.productNameEn ||
    entry.product?.nameEn ||
    entry.product?.item ||
    ''
  );
}

export function debounce(fn, wait = 120) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// True when the page runs inside the kLink mod's embedded browser (or the
// ?klinkskin=1 preview). The layout's beforeInteractive script stamps
// <html data-klink="embedded"> before any component mounts, so this is safe to
// read synchronously in a client effect.
export function isKlinkEmbedded() {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.klink === 'embedded'
  );
}
