import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'Ustawienia',
  description: 'Personalizuj ekran główny i zarządzaj mapą offline.',
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-kotext">Ustawienia</h1>
        <button id="settings-back" type="button" className="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent">
          Strona główna
        </button>
      </div>

      {/* Personalization */}
      <section className="mb-6 rounded-2xl border border-koborder bg-koelev p-4">
        <h2 className="text-lg font-bold text-kotext">Ekran główny</h2>

        <label className="mt-4 flex items-center gap-2 text-sm text-kotext">
          <input id="layout-search-toggle" type="checkbox" className="accent-koaccent" defaultChecked />
          Pokazuj wyszukiwarkę na stronie głównej
        </label>
      </section>

      {/* Nav bar */}
      <section className="mb-6 rounded-2xl border border-koborder bg-koelev p-4">
        <h2 className="text-lg font-bold text-kotext">Pasek nawigacyjny</h2>
        <p className="mt-1 text-sm text-kodim">Zmień kolejność i widoczność linków w górnym pasku aplikacji.</p>

        <div id="nav-tiles-list" role="list" className="mt-4 space-y-2" />

        <button id="nav-reset-btn" type="button" className="mt-4 rounded-xl border border-koborder bg-koelev2 px-4 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent">
          Przywróć domyślny pasek
        </button>
      </section>

      {/* Offline map */}
      <section className="rounded-2xl border border-koborder bg-koelev p-4">
        <h2 className="text-lg font-bold text-kotext">Mapa offline</h2>
        <div id="offline-status" className="mt-2 flex items-center gap-2">
          <span className="offline-map__dot inline-block h-2.5 w-2.5 rounded-full bg-kodim" />
          <span id="offline-status-text" className="text-sm text-kodim">Sprawdzanie…</span>
        </div>

        <div id="offline-progress" hidden className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-koelev2">
            <div id="offline-bar-fill" className="h-full bg-koaccent transition-all" style={{ width: '0%' }} />
          </div>
          <p id="offline-progress-label" className="mt-1 text-xs text-kodim">0%</p>
        </div>

        <p id="offline-hint" className="mt-3 text-sm text-kodim" />

        <div className="mt-4 flex flex-wrap gap-3">
          <button id="offline-download-btn" type="button" className="inline-flex items-center gap-2 rounded-xl bg-koaccent px-4 py-2 text-sm font-semibold text-koaccenttext transition hover:bg-koaccent2">
            <img src="/icns_ui/download.svg" alt="" aria-hidden="true" className="h-4 w-4" style={{ filter: 'brightness(0) invert(1)' }} />
            <span>Pobierz mapę</span>
          </button>
          <a id="offline-open-btn" href="/map/" hidden className="rounded-xl border border-koborder bg-koelev2 px-4 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent">
            Otwórz mapę
          </a>
          <button id="offline-remove-btn" type="button" hidden className="rounded-xl border border-koborder bg-koelev2 px-4 py-2 text-sm font-semibold text-status-error-text transition hover:border-status-error">
            Usuń pobraną mapę
          </button>
        </div>
      </section>

      <IslandLoader db homeLayout navLayout scripts={[{ src: '/settings.js', type: 'module' }]} />
    </div>
  );
}
