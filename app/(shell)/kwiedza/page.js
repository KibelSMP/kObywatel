import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'kWiedza',
  description: 'Przeglądaj dokumenty i poradniki dotyczące serwera KibelSMP.',
  openGraph: {
    title: 'kWiedza · kObywatel',
    description: 'Przeglądaj dokumenty i poradniki dotyczące serwera KibelSMP.',
    url: '/kwiedza',
    images: ['/assets/og/OG-Standard-kWiedza.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-kWiedza.png'] },
};

export default function KwiedzaPage() {
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-kotext">kWiedza</h1>
          <p className="mt-1 text-sm text-kodim">Dokumenty i poradniki dotyczące serwera.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="kw-back"
            type="button"
            className="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent"
          >
            Wstecz
          </button>
          <input
            id="search"
            type="search"
            placeholder="Szukaj dokumentów…"
            className="w-full rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm text-kotext outline-none ring-koaccent/40 placeholder:text-kodim/80 focus:border-koaccent focus:ring-2 sm:w-72"
          />
        </div>
      </div>

      <div id="docs-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" />
      <article id="doc-content" hidden className="mx-auto max-w-3xl" />

      <IslandLoader
        db
        utils
        markdownIt
        kwiedzaData
        scripts={[{ src: '/kwiedza.js', type: 'module' }]}
      />
    </>
  );
}
