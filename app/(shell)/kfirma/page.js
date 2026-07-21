import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'kFirma',
  description: 'Przeglądaj zarejestrowane firmy KibelSMP i generuj pliki .kobcomreg.',
  openGraph: {
    title: 'kFirma · kObywatel',
    description: 'Przeglądaj zarejestrowane firmy KibelSMP i generuj pliki .kobcomreg.',
    url: '/kfirma',
    images: ['/assets/og/OG-Standard-kFirma.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-kFirma.png'] },
};

const selectClass =
  'w-full rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm text-kotext outline-none ring-koaccent/40 focus:border-koaccent focus:ring-2';

export default function KfirmaPage() {
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-kotext">kFirma</h1>
          <p className="mt-1 text-sm text-kodim">Rejestr firm zarejestrowanych na serwerze.</p>
        </div>
        <div className="flex items-center gap-2">
          <div id="kf-stats" className="flex gap-2" />
          <a
            href="/kfirma/register/"
            className="rounded-xl bg-koaccent px-4 py-2 text-sm font-semibold text-koaccenttext transition hover:bg-koaccent2"
          >
            Zarejestruj firmę
          </a>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          id="kf-search"
          type="search"
          placeholder="Szukaj firmy, miasta, KNIP…"
          className="w-full rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm text-kotext outline-none ring-koaccent/40 placeholder:text-kodim/80 focus:border-koaccent focus:ring-2 sm:col-span-2 lg:col-span-1"
        />
        <select id="kf-business-type" aria-label="Rodzaj działalności" className={selectClass}>
          <option value="">Dowolny rodzaj</option>
        </select>
        <select id="kf-symbol" aria-label="Symbol działalności" className={selectClass}>
          <option value="">Dowolny symbol</option>
        </select>
        <select id="kf-voiv" aria-label="Województwo" className={selectClass}>
          <option value="">Dowolne województwo</option>
        </select>
      </div>

      <p id="kf-status" className="mb-3 text-sm text-kodim" aria-live="polite" />
      <div id="kf-list" className="grid grid-cols-1 gap-3 lg:grid-cols-2" />

      <IslandLoader db utils scripts={[{ src: '/kfirma-index.js', type: 'module' }]} />
    </>
  );
}
