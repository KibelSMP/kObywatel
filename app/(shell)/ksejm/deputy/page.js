import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'Dla posła · kSejm',
  description: 'Szablony projektów ustaw i uchwał oraz regulamin Sejmu KibelSMP.',
};

function TemplateCard({ title, desc, mdHref, odtHref, gdocHref, gdocLabel }) {
  const link =
    'inline-flex w-full items-center justify-between rounded-xl border border-koborder bg-koelev px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent hover:text-koaccenttext';
  return (
    <article className="rounded-2xl border border-koborder bg-koelev2/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-kotext">{title}</h2>
        <span className="rounded-full border border-koborder bg-koelev px-2.5 py-1 text-xs font-semibold text-kodim">
          3 formaty
        </span>
      </div>
      <p className="mb-4 text-sm text-kodim">{desc}</p>
      <div className="space-y-2">
        <a href={mdHref} download className={link}>
          Markdown (.md) <span className="text-xs text-kodim">Pobierz</span>
        </a>
        <a href={odtHref} download className={link}>
          OpenDocument (.odt) <span className="text-xs text-kodim">Pobierz</span>
        </a>
        <a href={gdocHref} target="_blank" rel="noopener" className={link}>
          Dokumenty Google <span className="text-xs text-kodim">{gdocLabel}</span>
        </a>
      </div>
    </article>
  );
}

export default function DeputyPage() {
  return (
    <>
      <section className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-kotext sm:text-3xl">Dla posła</h1>
        <p className="mt-2 max-w-3xl text-sm text-kodim sm:text-base">
          Materiały robocze dla posłów: szablony projektów ustaw i uchwał oraz aktualny regulamin
          Sejmu. Na stronie dostępne są też wersje archiwalne regulaminu.
        </p>
      </section>

      <section className="mb-4 rounded-2xl border border-koborder bg-koelev2/40 p-4" id="deputy-regulation-section">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-kotext">Regulamin Sejmu</h2>
          <div className="flex items-center gap-2">
            <span id="deputy-regulations-updated" className="rounded-full border border-koborder bg-koelev px-2.5 py-1 text-xs font-semibold text-kodim">Aktualizacja: -</span>
            <button
              id="deputy-regulation-toggle"
              type="button"
              aria-expanded="false"
              aria-controls="deputy-regulation-body"
              className="inline-flex items-center gap-2 rounded-xl border border-koaccent/80 bg-koaccent px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-koaccent2 focus:outline-none focus:ring-2 focus:ring-koaccent/60"
            >
              <span id="deputy-regulation-toggle-label">Pokaż</span>
              <svg id="deputy-regulation-toggle-icon" viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          </div>
        </div>
        <div id="deputy-regulation-body" hidden>
          <p className="mb-4 text-sm text-kodim">
            Poniżej wyświetlana jest aktualna wersja regulaminu. Archiwalne wersje pozostają dostępne na liście.
          </p>
          <div id="deputy-regulation-alert" className="mb-4 hidden rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article className="rounded-xl border border-koborder bg-koelev p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-koaccent/70 bg-koaccent/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-koaccenttext">Aktualna wersja</span>
                <span id="deputy-regulation-date" className="rounded-full border border-koborder bg-koelev2 px-2.5 py-1 text-xs font-semibold text-kodim">-</span>
              </div>
              <h3 id="deputy-regulation-title" className="text-xl font-bold text-kotext">Ładowanie regulaminu...</h3>
              <div id="deputy-regulation-content" className="mt-4 space-y-4 text-[15px] leading-7 text-kotext/95" />
            </article>
            <aside className="rounded-xl border border-koborder bg-koelev p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-kodim">Archiwum regulaminu</h3>
              <p className="mt-1 text-xs text-kodim">Lista wersji wraz z podglądem Markdown i opcją pobrania.</p>
              <div id="deputy-regulation-list" className="mt-3 space-y-2" />
            </aside>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TemplateCard
          title="Projekt ustawy"
          desc="Szablon aktu prawnego do przygotowania projektu ustawy wraz z podstawową strukturą artykułów."
          mdHref="/ksejm/deputy/download/Szablon%20projektu%20ustawy.md"
          odtHref="/ksejm/deputy/download/Szablon%20projektu%20ustawy.odt"
          gdocHref="https://docs.google.com/document/d/1PkcIC5pkjnMI4yZ5yRQ7vtCR1K2bRxyLOl25HxAGr-0/edit?usp=sharing"
          gdocLabel="Google Drive"
        />
        <TemplateCard
          title="Projekt uchwały"
          desc="Szablon aktu prawnego do przygotowania projektu uchwały wraz z podstawową strukturą artykułów."
          mdHref="/ksejm/deputy/download/Szablon%20projektu%20uchwa%C5%82y.md"
          odtHref="/ksejm/deputy/download/Szablon%20projektu%20uchwa%C5%82y.odt"
          gdocHref="https://docs.google.com/document/d/1Z7_0KlHFYhGvjU79Lzr2IUyY7BKlyJ413MeI1tMPmus/edit?usp=sharing"
          gdocLabel="Google Drive"
        />
      </section>

      <IslandLoader markdownIt utils scripts={[{ src: '/ksejm/deputy/index.js', type: 'module' }]} />
    </>
  );
}
