// Ikony przedmiotów Minecraft dla kHandel.
//
// Wyjęte z khandel-core.js bez zmian w logice, żeby ta sama kaskada źródeł
// (lokalny /mc-items → tekstura item → tekstura block → barrier jako
// ostatnia deska ratunku) obsługiwała też stronę pojedynczej oferty
// (khandel-oferta.js) — obie wyspy rysują te same karty.

// --- Ikony Minecraft ---
const MC_ASSETS_VERSION = '1.20.4';
const MC_ASSETS_BASE = `https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@${MC_ASSETS_VERSION}/assets/minecraft/textures`;
const PATH_ITEM = MC_ASSETS_BASE + '/item';
const PATH_BLOCK = MC_ASSETS_BASE + '/block';
const FALLBACK_ICON = PATH_ITEM + '/barrier.png';
const LOCAL_ICON_BASE = '/mc-items';
const localIconPath = key => `${LOCAL_ICON_BASE}/${encodeURIComponent(key)}.png`;
const itemIconPath = key => `${PATH_ITEM}/${encodeURIComponent(key)}.png`;
const blockIconPath = key => `${PATH_BLOCK}/${encodeURIComponent(key)}.png`;

export function createIcon(item, size=48, enchanted=false){
  const wrap = document.createElement('div');
  wrap.className = 'item-icon' + (enchanted? ' enchanted':'');
  wrap.style.width = size+'px';
  wrap.style.height = size+'px';
  wrap.classList.add('loading');
  const img = document.createElement('img');
  img.loading='lazy'; img.decoding='async'; img.alt=item;
  wrap.appendChild(img);
  let overlay=null;
  if(enchanted){
    overlay = document.createElement('div'); overlay.className='ench-overlay'; wrap.appendChild(overlay);
  }
  const key = (item||'').toLowerCase();
  const stages = [ localIconPath(key), itemIconPath(key), blockIconPath(key), FALLBACK_ICON ];
  let stageIndex=0;
  function applyStage(){ img.src = stages[stageIndex]; }
  img.addEventListener('load', ()=>{
    wrap.classList.remove('loading');
    if(stageIndex===3){ img.style.opacity='.55'; }
    if(enchanted && overlay){
      const url = `url(${img.src})`;
      overlay.style.maskImage = url; overlay.style.webkitMaskImage = url; wrap.classList.add('masked');
    }
  });
  img.onerror = ()=>{
    if(stageIndex < stages.length-1){ stageIndex++; applyStage(); } else { wrap.classList.remove('loading'); }
  };
  applyStage();
  return wrap;
}
