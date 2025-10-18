window.__db = (function(){
  let base = '';
  async function loadConfig(){
    if(base) return base;
    try {
      const r = await fetch('/db.config.json', { cache:'no-store' });
      const j = await r.json();
      base = (j && j.DB_BASE) ? String(j.DB_BASE).replace(/\/$/, '') : '';
    } catch(_){ base=''; }
    return base;
  }
  async function url(path){
    const b = await loadConfig();
    if(!b) throw new Error('Brak DB_BASE w db.config.json');
    const p = String(path||'').replace(/^\/+/, '');
    return b + '/' + p;
  }
  async function fetchJson(rel){
    const u = await url(rel);
    const r = await fetch(u, { cache:'no-store' });
    if(!r.ok) throw new Error('HTTP '+r.status+' for '+u);
    return r.json();
  }
  return { loadConfig, url, fetchJson };
})();
