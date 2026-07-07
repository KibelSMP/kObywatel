// Współdzielony model personalizacji strony głównej.
// Używany przez app.js (stosuje układ do kafelków) oraz settings.js (edytor układu).
// Utrzymuje jedno źródło prawdy o kafelkach, żeby edytor nie zależał od DOM-u.
window.HomeLayout = (function(){
  const STORAGE_KEY = 'kob.home.layout.v1';
  // Kanoniczna lista kafelków w domyślnej kolejności (zgodna z index.html).
  const DEFAULT_TILES = [
    { id:'tile-mapa', label:'Mapa' },
    { id:'tile-khandel', label:'kHandel' },
    { id:'tile-kwiedza', label:'kWiedza' },
    { id:'tile-ksejm', label:'kSejm' },
    { id:'tile-ksef', label:'kSeF' },
    { id:'tile-kfirma', label:'kFirma' },
    { id:'tile-kdokumenty', label:'kDokumenty' },
    { id:'tile-kpack', label:'kPack' },
    { id:'tile-report', label:'Zgłoszenia' },
    { id:'tile-creators', label:'Twórcy' }
  ];
  // Kafelki zawsze widoczne (nie można ich ukryć ani – w praktyce – sensownie chować).
  const LOCKED = new Set(['tile-report','tile-creators']);

  function defaults(){
    return { searchHidden:false, tiles: DEFAULT_TILES.map(t=> ({ id:t.id, label:t.label, hidden:false, locked: LOCKED.has(t.id) })) };
  }

  // Uporządkuj zapisany stan wg dostępnych kafelków, dokładając brakujące na koniec.
  function normalize(raw){
    const base = defaults();
    const available = new Map(base.tiles.map(t=> [t.id, t]));
    const ordered = [];
    const storedTiles = Array.isArray(raw?.tiles) ? raw.tiles : [];
    storedTiles.forEach(t=>{
      if(!t?.id || !available.has(t.id)) return;
      const ref = available.get(t.id);
      const locked = LOCKED.has(ref.id);
      ordered.push({ id:ref.id, label:ref.label, hidden: locked ? false : !!t.hidden, locked });
      available.delete(t.id);
    });
    available.forEach(t=> ordered.push({ ...t }));
    return { searchHidden: !!raw?.searchHidden, tiles: ordered };
  }

  function load(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return defaults();
      return normalize(JSON.parse(raw));
    } catch(_){
      return defaults();
    }
  }

  function save(state){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(_){ /* ignore */ }
  }

  return { STORAGE_KEY, DEFAULT_TILES, LOCKED, defaults, normalize, load, save };
})();
