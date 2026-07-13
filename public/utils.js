// Wspólne funkcje pomocnicze używane przez wiele stron (patrz CLAUDE.md: "Shared conventions").
// Utrzymuj ten plik małym i bez efektów ubocznych przy wczytaniu — jest ładowany na wielu stronach.

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[ch]));
}

// Oferta/produkt kHandel: dopasowanie zapytania wyszukiwania do nazwy PL, nazwy EN i notatek
// (khandel.js#passSearch, map.js#renderShopOffersInResults — logika była zduplikowana 1:1).
function productMatchesQuery(entry, queryLower){
  const namePl = (entry.productName || entry.product?.name || '').toLowerCase();
  const nameEn = (entry.productNameEn || entry.product?.nameEn || '').toLowerCase();
  const notes = (entry.notes || '').toLowerCase();
  return namePl.includes(queryLower) || nameEn.includes(queryLower) || notes.includes(queryLower);
}

// Oferta/produkt kHandel: nazwa niezależna od języka (pierwsza dostępna wartość),
// używana tam, gdzie nie liczy się aktualny currentLang, tylko jakakolwiek nazwa do wyświetlenia/wyszukania
// (app.js#searchKhandelProducts, map.js — lista sklepów w wynikach wyszukiwania).
function productFallbackName(entry){
  return entry.productName || entry.product?.name || entry.productNameEn || entry.product?.nameEn || entry.product?.item || '';
}
