// Shared fetch + normalization of /assets/docs/index.json (kWiedza docs).
// Ported from the legacy kwiedza-data.js — one source of truth for the index.json
// schema (including the compressed key-alias handling). Used by the kWiedza page
// and the home-page search.

let cache = null;

export async function fetchDocs() {
  if (cache) return cache;
  try {
    const r = await fetch('/assets/docs/index.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('Nie udało się pobrać index.json');
    const data = await r.json();
    const categories = Array.isArray(data?.categories)
      ? data.categories
      : Array.isArray(data?.c)
        ? data.c
        : [];
    const flat = [];
    categories.forEach((cat) => {
      const cname = String((cat && (cat.name ?? cat.n)) || 'Inne').trim();
      const docsArr = Array.isArray(cat?.docs) ? cat.docs : Array.isArray(cat?.d) ? cat.d : [];
      docsArr.forEach((doc) => {
        const slug = String(doc.slug ?? doc.s ?? '').trim();
        if (!slug) return;
        const title = String(doc.title ?? doc.t ?? slug).trim();
        const excerpt = String(doc.excerpt ?? doc.e ?? '').trim();
        const author = String(doc.author ?? doc.autor ?? doc.au ?? '').trim();
        const fileMd = doc.md ?? doc.m ? String(doc.md ?? doc.m) : null;
        const filePdf = doc.pdf ?? doc.p ? String(doc.pdf ?? doc.p) : null;
        flat.push({
          slug,
          title,
          meta: { category: cname, excerpt, author },
          excerpt,
          _fileMd: fileMd,
          _filePdf: filePdf,
        });
      });
    });
    cache = flat;
  } catch (e) {
    console.warn('[kwiedza-data] Błąd pobierania index.json:', e);
    cache = [];
  }
  return cache;
}
