// Pojedyncza oferta kHandel — strona pod przypięte okienka kLink.
//
// Mod kLink otwiera ten adres (/khandel/oferta/?id=<id oferty>) we własnym,
// małym okienku rysowanym nad światem gry i nad widokiem kObywatela; okienko
// można przesuwać i skalować, a mod pamięta je między sesjami (patrz
// docs/integracja-kobywatel.md w repo kLink). Stąd cała strona to jedna karta
// oferty bez nagłówka i nawigacji — okno bywa wielkości znaczka pocztowego.
//
// Poza grą strona działa normalnie: ten sam adres pokazuje po prostu jedną
// ofertę pod bezpośrednim linkiem. Nie jest nigdzie linkowana i ma noindex,
// bo katalogiem ofert jest /khandel/.

import { createIcon } from '/khandel-item-icon.js';
import * as klinkWaypoints from '/klink-waypoints.js';

const currentLang = (localStorage.getItem('khandelLang') || 'pl') === 'en' ? 'en' : 'pl';

const TEXTS = {
  pl: {
    loading: 'Wczytywanie oferty…',
    missingId: 'Brak identyfikatora oferty w adresie.',
    notFound: 'Nie znaleziono takiej oferty. Mogła zostać usunięta z katalogu.',
    error: 'Nie udało się wczytać oferty: ',
    price: 'Cena',
    owner: 'Właściciel',
    village: 'Wioska',
  },
  en: {
    loading: 'Loading offer…',
    missingId: 'No offer id in the address.',
    notFound: 'No such offer. It may have been removed from the catalogue.',
    error: 'Could not load the offer: ',
    price: 'Price',
    owner: 'Owner',
    village: 'Village',
  },
};
const t = key => TEXTS[currentLang][key];

const statusEl = document.getElementById('offer-status');
const cardEl = document.getElementById('offer-card');

function pickName(obj, fallback){
  if(!obj) return fallback;
  const pl = obj.name || obj.namePl || obj.namePL || obj.name_pl;
  const en = obj.nameEn || obj.nameEN || obj.name_en;
  return currentLang==='en' ? (en || pl || fallback) : (pl || en || fallback);
}

function pickProductName(offer){
  const product = offer.product || {};
  const pl = offer.productName || product.name || product.namePl || product.namePL || product.name_pl;
  const en = offer.productNameEn || product.nameEn || product.nameEN || product.name_en;
  return (currentLang==='en' ? (en || pl) : (pl || en)) || product.item || '—';
}

function showStatus(text){
  statusEl.textContent = text;
  statusEl.hidden = false;
  cardEl.hidden = true;
}

// --- Waypoint kLink do sklepu ---
// Ta sama para (lokalizacja, nazwa sklepu) i ten sam kolor, co w katalogu
// (/khandel-core.js), więc oba widoki aktualizują jeden waypoint, nie dwa.
function shopSlug(text){
  return String(text || '')
    .normalize('NFD').replace(/\p{Diacritic}+/gu, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createWaypointButton(offer){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mini-btn offer-waypoint-btn';
  btn.innerHTML = '<span class="ui-icon" style="--icon:url(/icns_ui/my_location.svg)" aria-hidden="true"></span>';
  btn.appendChild(document.createTextNode(' ' + klinkWaypoints.message('button', currentLang)));
  btn.title = klinkWaypoints.message('buttonTitle', currentLang);
  btn.hidden = !klinkWaypoints.canAddWaypoints();
  btn.addEventListener('click', async ()=>{
    btn.disabled = true;
    showToast(klinkWaypoints.message('pending', currentLang));
    try {
      const slug = shopSlug(`${offer.storeLocation || ''}-${offer.storeName || 'sklep'}`) || 'sklep';
      const code = await klinkWaypoints.sendWaypoint({
        x: offer.x,
        z: offer.z,
        name: [offer.storeName, offer.storeLocation].filter(Boolean).join(' • ') || 'Sklep kHandel',
        id: ('shop-' + slug).slice(0, 64),
        kind: 'sklep',
      });
      if(code !== 'awaiting') showToast(klinkWaypoints.message(code, currentLang));
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}

// Okienko bywa wielkości znaczka, więc komunikat leci na wierzch, przy dolnej
// krawędzi — wpisany w linię statusu rozepchnąłby kartę poza widoczny obszar.
let toastEl = null;
let toastTimer = null;
function showToast(text){
  if(!toastEl){
    toastEl = document.createElement('div');
    toastEl.className = 'offer-toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toastEl.classList.remove('visible'), 4000);
}

function syncWaypointButtons(){
  const visible = klinkWaypoints.canAddWaypoints();
  document.querySelectorAll('.offer-waypoint-btn').forEach(btn=>{ btn.hidden = !visible; });
}

klinkWaypoints.subscribe(syncWaypointButtons);
klinkWaypoints.ensureConnection().then(syncWaypointButtons);

function renderOffer(offer){
  const product = offer.product || {};
  const card = document.createElement('div');
  card.className = 'card';
  if(product.customItem) card.classList.add('custom-prod');

  const row = document.createElement('div'); row.className = 'row';
  row.appendChild(createIcon(product.item, 36, !!product.enchanted));
  const heading = document.createElement('div'); heading.className = 'card-heading';
  const title = document.createElement('h1'); title.className = 'title';
  title.textContent = pickProductName(offer);
  if(product.customItem) title.classList.add('title--custom');
  heading.appendChild(title);
  if(product.qty > 1){
    const qty = document.createElement('p'); qty.className = 'subtitle'; qty.textContent = `×${product.qty}`;
    heading.appendChild(qty);
  }
  row.appendChild(heading);
  card.appendChild(row);

  const priceSection = document.createElement('div'); priceSection.className = 'card-price-section';
  const priceLabel = document.createElement('div'); priceLabel.className = 'card-prices-label';
  priceLabel.textContent = t('price');
  priceSection.appendChild(priceLabel);
  const prices = document.createElement('div'); prices.className = 'prices';
  [offer.price1, offer.price2].forEach(price=>{
    if(!price) return;
    const chip = document.createElement('div'); chip.className = 'price-chip';
    if(price.customItem) chip.classList.add('price-chip--custom');
    chip.appendChild(createIcon(price.item, 18, !!price.enchanted));
    const label = document.createElement('span');
    label.textContent = `${pickName(price, price.item)} ×${price.qty}`;
    chip.appendChild(label);
    prices.appendChild(chip);
  });
  priceSection.appendChild(prices);
  card.appendChild(priceSection);

  const details = document.createElement('div'); details.className = 'card-details';
  if(offer.storeName || offer.storeLocation){
    const meta = document.createElement('div'); meta.className = 'card-meta';
    meta.textContent = offer.storeName || '—';
    if(offer.storeLocation){
      const loc = document.createElement('span'); loc.className = 'card-meta-loc';
      loc.textContent = ` • ${offer.storeLocation}`;
      meta.appendChild(loc);
    }
    details.appendChild(meta);
  }
  if(offer.storeOwner || offer.villageName){
    const badges = document.createElement('div'); badges.className = 'card-badges';
    if(offer.storeOwner){
      const badge = document.createElement('span'); badge.className = 'card-badge';
      badge.textContent = `${t('owner')}: ${offer.storeOwner}`;
      badges.appendChild(badge);
    }
    if(offer.villageName){
      const badge = document.createElement('span'); badge.className = 'card-badge';
      badge.textContent = `${t('village')}: ${offer.villageName}`;
      badges.appendChild(badge);
    }
    details.appendChild(badges);
  }
  // Współrzędne są tu tekstem, nie przyciskiem do mapy jak w katalogu:
  // w przypiętym okienku nie ma dokąd nawigować — cały widok to ta jedna
  // oferta, a odpowiednikiem „pokaż na mapie" jest sama gra dookoła.
  if(Number.isFinite(offer.x) && Number.isFinite(offer.y) && Number.isFinite(offer.z)){
    const coords = document.createElement('div'); coords.className = 'offer-coords';
    coords.innerHTML = '<span class="ui-icon" style="--icon:url(/icns_ui/map_search.svg)" aria-hidden="true"></span>';
    coords.appendChild(document.createTextNode(` ${offer.x}, ${offer.y}, ${offer.z}`));
    details.appendChild(coords);
  }
  // Jedyny przycisk „gdzieś idź" w tym okienku: nie ma dokąd nawigować w
  // samej stronie, ale waypoint w Xaero prowadzi do sklepu w świecie gry.
  if(Number.isFinite(offer.x) && Number.isFinite(offer.z)){
    details.appendChild(createWaypointButton(offer));
  }
  if(offer.notes){
    const notes = document.createElement('div'); notes.className = 'notes-block';
    notes.textContent = offer.notes;
    details.appendChild(notes);
  }
  if(details.children.length) card.appendChild(details);

  // Celowo bez linku do katalogu: w przypiętym okienku przeniósłby ten mały
  // widok na pełną listę ofert, z której nie ma jak wrócić, a poza grą i tak
  // wchodzi się tu z katalogu.

  cardEl.replaceChildren(card);
  cardEl.hidden = false;
  statusEl.hidden = true;
}

async function load(){
  const offerId = new URLSearchParams(window.location.search).get('id');
  if(!offerId){ showStatus(t('missingId')); return; }
  document.title = offerId + ' · kHandel';

  try {
    const list = await window.__db.fetchJson('data/khandel-products.json');
    const offer = (Array.isArray(list) ? list : []).find(entry => String(entry.id) === offerId);
    if(!offer){ showStatus(t('notFound')); return; }
    renderOffer(offer);
    document.title = pickProductName(offer) + ' · kHandel';
  } catch(e){
    showStatus(t('error') + e.message);
  }
}

showStatus(t('loading'));
load();
