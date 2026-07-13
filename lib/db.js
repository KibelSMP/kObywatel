// Modern importable equivalent of public/db-adapter.js for React components.
// Same behavior: reads DB_BASE from /db.config.json at runtime with cache:'no-store'
// (so the external data source stays hot-swappable without a redeploy) and resolves
// relative data paths against it. Ported imperative islands keep using window.__db.

let base = '';

export async function loadConfig() {
  if (base) return base;
  try {
    const r = await fetch('/db.config.json', { cache: 'no-store' });
    const j = await r.json();
    base = j && j.DB_BASE ? String(j.DB_BASE).replace(/\/$/, '') : '';
  } catch (_) {
    base = '';
  }
  return base;
}

export async function dbUrl(path) {
  const b = await loadConfig();
  if (!b) throw new Error('Brak DB_BASE w db.config.json');
  const p = String(path || '').replace(/^\/+/, '');
  return b + '/' + p;
}

export async function fetchJson(rel) {
  const u = await dbUrl(rel);
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + u);
  return r.json();
}

export const db = { loadConfig, url: dbUrl, fetchJson };
export default db;
