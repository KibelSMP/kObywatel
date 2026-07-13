import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'kSejm',
  description: 'Uchwały i ustawy KibelSMP z podglądem Markdown i załącznikami.',
  openGraph: {
    title: 'kSejm · kObywatel',
    description: 'Uchwały i ustawy KibelSMP z podglądem Markdown i załącznikami.',
    url: '/ksejm',
    images: ['/assets/og/OG-Standard-kSejm.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-kSejm.png'] },
};

export default function KsejmPage() {
  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-kotext">kSejm</h1>
          <p className="mt-1 text-sm text-kodim">
            Rejestr ustaw, uchwał i rozporządzeń, podgląd treści oraz załączników.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <a
            href="/ksejm/deputy/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent hover:text-koaccenttext sm:w-auto"
          >
            Dla posła
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
          </a>
          <a
            id="ksejm-detail-register"
            href="#"
            target="_blank"
            rel="noopener"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-koaccent/70 bg-koaccent/15 px-3 py-2 text-sm font-semibold text-koaccenttext transition hover:bg-koaccent/25 hover:text-kotext sm:w-auto"
          >
            Rejestr obrad Sejmu
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-koborder bg-koelev p-4">
          <div className="space-y-3">
            <input
              id="ksejm-search"
              type="search"
              placeholder="Szukaj po tytule, kategorii, zakresie..."
              className="w-full rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm text-kotext outline-none ring-koaccent/40 placeholder:text-kodim/80 focus:border-koaccent focus:ring-2"
            />
            <div
              id="ksejm-kind-filters"
              className="subtle-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-koborder bg-koelev2 p-1"
            >
              <button type="button" data-kind="all" className="ksejm-kind-filter whitespace-nowrap rounded-lg border border-koaccent bg-koaccent px-3 py-2 text-xs font-semibold text-white">Wszystkie</button>
              <button type="button" data-kind="ustawa" className="ksejm-kind-filter whitespace-nowrap rounded-lg border border-koborder bg-koelev2 px-3 py-2 text-xs font-semibold text-kotext">Ustawy</button>
              <button type="button" data-kind="uchwala" className="ksejm-kind-filter whitespace-nowrap rounded-lg border border-koborder bg-koelev2 px-3 py-2 text-xs font-semibold text-kotext">Uchwały</button>
              <button type="button" data-kind="rozporzadzenie" className="ksejm-kind-filter whitespace-nowrap rounded-lg border border-koborder bg-koelev2 px-3 py-2 text-xs font-semibold text-kotext">Rozporządzenia</button>
            </div>
            <select
              id="ksejm-category-filter"
              className="w-full rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm text-kotext outline-none ring-koaccent/40 focus:border-koaccent focus:ring-2"
            >
              <option value="all">Wszystkie kategorie</option>
            </select>
          </div>
          <div id="ksejm-list" className="mt-4 space-y-2" aria-live="polite" />
        </section>

        <section className="rounded-2xl border border-koborder bg-koelev p-5">
          <div
            id="ksejm-detail-empty"
            className="flex min-h-[460px] items-center justify-center rounded-2xl border border-dashed border-koborder bg-koelev2/35 p-8 text-center text-sm text-kodim"
          >
            Wybierz akt prawny z listy, aby zobaczyć pełną treść i załączniki.
          </div>
          <article id="ksejm-detail" className="hidden">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span id="ksejm-detail-kind" className="rounded-full border border-koaccent/70 bg-koaccent/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-koaccenttext" />
              <span id="ksejm-detail-category" className="rounded-full border border-koborder bg-koelev2 px-3 py-1 text-xs font-semibold text-kodim" />
            </div>
            <h2 id="ksejm-detail-title" className="text-2xl font-bold leading-tight" />
            <p className="mt-2 text-sm text-kodim">
              <span className="font-semibold text-kotext">Dotyczy:</span>{' '}
              <span id="ksejm-detail-dotyczy" />
            </p>
            <div id="ksejm-markdown" className="mt-6 space-y-4 text-[15px] leading-7 text-kotext/95" />
            <section className="mt-8 rounded-2xl border border-koborder bg-koelev2/40 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-kodim">Załączniki</h3>
              <div id="ksejm-attachments" className="mt-3 space-y-2" />
            </section>
            <section id="ksejm-attachment-preview-wrap" className="mt-6 hidden rounded-2xl border border-koborder bg-koelev2/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id="ksejm-attachment-preview-title" className="text-sm font-semibold uppercase tracking-wide text-kodim" />
                <button id="ksejm-attachment-preview-close" type="button" className="rounded-lg border border-koborder px-2 py-1 text-xs font-semibold text-kodim transition hover:border-koaccent hover:text-kotext">Zamknij</button>
              </div>
              <div id="ksejm-attachment-preview" className="space-y-4 text-[15px] leading-7 text-kotext/95" />
            </section>
          </article>
        </section>
      </div>

      <IslandLoader
        markdownIt
        utils
        scripts={[{ src: '/ksejm/index.js', type: 'module' }]}
      />
    </>
  );
}
