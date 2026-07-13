import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'kHandel',
  description: 'Sprawdź co gdzie kupisz – od bazarków po AdminShopy.',
  openGraph: {
    title: 'kHandel · kObywatel',
    description: 'Sprawdź co gdzie kupisz – od bazarków po AdminShopy.',
    url: '/khandel',
    images: ['/assets/og/OG-Standard-kHandel.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-kHandel.png'] },
};

const groupBtn =
  'rounded-lg border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent aria-pressed:border-koaccent aria-pressed:bg-koaccent/15';

export default function KhandelPage() {
  return (
    <>
      {/* khandel-core.js injects .card/.offers-grid/.item-icon markup styled here */}
      <link rel="stylesheet" href="/khandel.css" />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-kotext">kHandel</h1>
            <p className="mt-1 text-sm text-kodim">Katalog ofert sklepów na serwerze.</p>
          </div>
          <button
            id="lang-toggle"
            type="button"
            className="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent"
          >
            PL 🇵🇱
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5" role="group" aria-label="Grupowanie">
            <button id="group-none-bottom" type="button" className={groupBtn} aria-pressed="true">
              Wszystko
            </button>
            <button id="group-city-bottom" type="button" className={groupBtn} aria-pressed="false">
              Wg miasta
            </button>
            <button id="group-store-bottom" type="button" className={groupBtn} aria-pressed="false">
              Wg sklepu
            </button>
          </div>

          <div className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-koborder bg-koelev2 px-3 py-2 focus-within:border-koaccent">
              <input
                id="khandel-search"
                type="text"
                placeholder="Szukaj przedmiotu…"
                aria-label="Szukaj przedmiotu"
                className="w-full bg-transparent text-sm text-kotext outline-none placeholder:text-kodim/70"
              />
              <button id="khandel-clear-search" type="button" aria-label="Wyczyść" className="text-kodim hover:text-kotext">
                ×
              </button>
            </div>
            <button
              id="khandel-do-search"
              type="button"
              className="rounded-xl bg-koaccent px-4 py-2 text-sm font-semibold text-koaccenttext transition hover:bg-koaccent2"
            >
              Szukaj
            </button>
          </div>

          <label id="khandel-price-toggle-label" className="flex items-center gap-2 text-sm text-kodim">
            <input id="khandel-price-toggle" type="checkbox" className="accent-koaccent" />
            Szukaj w cenach
          </label>
        </div>
      </div>

      <div id="empty" hidden className="rounded-2xl border border-dashed border-koborder bg-koelev2/40 p-8 text-center text-kodim" />
      <div id="khandel-products" />

      <IslandLoader db utils scripts={[{ src: '/khandel-core.js', type: 'module' }]} />
    </>
  );
}
