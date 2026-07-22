import SiteHeader from '@/components/SiteHeader';
import Icon from '@/components/Icon';
import IslandLoader from '@/components/IslandLoader';
import { LOCKED } from '@/lib/homeLayout';

const TILES = [
  { id: 'tile-mapa', href: '/map/', icon: 'map', title: 'Mapa', desc: 'Przeglądaj punkty, linie i wyszukuj miejsca.' },
  { id: 'tile-khandel', href: '/khandel/', icon: 'storefront', title: 'kHandel', desc: 'Sprawdź co gdzie kupisz – od bazarków po AdminShopy.' },
  { id: 'tile-kwiedza', href: '/kwiedza/', icon: 'book', title: 'kWiedza', desc: 'Przeglądaj dokumenty i poradniki dotyczące serwera.' },
  { id: 'tile-ksejm', href: '/ksejm/', icon: 'ksejm', title: 'kSejm', desc: 'Przeglądaj akty prawne wraz z załącznikami oraz rejestrem obrad.' },
  { id: 'tile-ksef', href: '/ksef/', icon: 'invoice', title: 'kSeF', desc: 'Wystaw Fakturę KAT w PDF na podstawie prostego formularza.' },
  { id: 'tile-kfirma', href: '/kfirma/', icon: 'company', title: 'kFirma', desc: 'Przeglądaj zarejestrowane firmy i generuj pliki .kobcomreg.' },
  { id: 'tile-kdokumenty', href: '/kdokumenty/', icon: 'document', title: 'kDokumenty', desc: 'Przygotuj dokumenty i zapisz je do PDF.' },
  { id: 'tile-kpack', href: 'https://modrinth.com/modpack/kpack', icon: 'package', title: 'kPack', desc: 'Paczka modów stworzona specjalnie dla graczy KibelSMP.', external: true },
  { id: 'tile-report', href: '/report/', icon: 'bug_report', title: 'Zgłoszenia', desc: 'Zgłaszaj problemy oraz sugestie dotyczące kObywatela.' },
  { id: 'tile-creators', href: '/creators/', icon: 'people', title: 'Twórcy', desc: 'Poznaj osoby, które tworzą i rozwijają aplikację kObywatel.' },
];

function Tile({ tile }) {
  const props = tile.external ? { target: '_blank', rel: 'noopener' } : {};
  const hideable = !LOCKED.has(tile.id);
  return (
    <div id={tile.id} data-tile-wrapper className="tile-wrapper relative h-full">
      <a
        href={tile.href}
        {...props}
        className="tile group flex h-full flex-col rounded-2xl border border-koborder bg-koelev p-5 pr-24 transition hover:-translate-y-0.5 hover:border-koaccent/70 hover:shadow-lg"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-koaccent/15 text-koaccent2">
            <Icon name={tile.icon} size={24} />
          </span>
          <h2 className="flex items-center gap-1.5 text-lg font-bold text-kotext">
            {tile.title}
            {tile.external && (
              <span className="text-kodim" title="Otwiera się w nowej karcie" aria-label="Otwiera się w nowej karcie">
                <Icon name="open_in_new_16dp" size={14} />
              </span>
            )}
          </h2>
        </div>
        <p className="mt-3 line-clamp-2 min-h-10 text-sm text-kodim">{tile.desc}</p>
      </a>
      <button
        type="button"
        data-drag-handle
        className="tile-drag-handle absolute right-2 top-2 grid h-9 w-9 touch-none place-items-center rounded-lg text-kodim/70 transition hover:bg-koelev2 hover:text-kotext focus-visible:outline focus-visible:outline-2 focus-visible:outline-koaccent"
        aria-label={`Przeciągnij, aby zmienić kolejność kafelka „${tile.title}”`}
      >
        <Icon name="drag_indicator" size={18} />
      </button>
      {hideable && (
        <button
          type="button"
          data-hide-toggle
          className="tile-hide-toggle absolute right-12 top-2 grid h-9 w-9 place-items-center rounded-lg text-kodim/70 transition hover:bg-koelev2 hover:text-kotext focus-visible:outline focus-visible:outline-2 focus-visible:outline-koaccent"
          aria-label={`Ukryj lub pokaż kafelek „${tile.title}”`}
        >
          <span className="tile-hide-icon-visible">
            <Icon name="visibility" size={18} />
          </span>
          <span className="tile-hide-icon-hidden">
            <Icon name="visibility_off" size={18} />
          </span>
        </button>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-kotext sm:text-4xl">Szukaj</h1>
          <p className="mt-2 text-kodim">Miasta, stacje, linie, produkty, firmy, dokumenty i akty prawne.</p>
          <form id="search-form" role="search" autoComplete="off" className="mt-6" aria-label="Wyszukiwarka">
            <div className="flex items-center gap-2 rounded-2xl border border-koborder bg-koelev2 px-4 py-3 focus-within:border-koaccent">
              <span className="search-icon inline-flex items-center text-kodim" role="button" tabIndex={-1} aria-label="Aktywuj pole wyszukiwania">
                <Icon name="search" size={22} />
              </span>
              <input
                id="query"
                type="text"
                placeholder="Wyszukaj miasto, stację, produkt…"
                aria-label="Pole wyszukiwania"
                className="w-full bg-transparent text-kotext outline-none placeholder:text-kodim/70"
              />
            </div>
          </form>
        </section>

        <div id="skeleton" className="hidden" aria-hidden="true" />
        <div id="results" className="mt-8" aria-live="polite" />

        <div id="home-tiles-root" className="mt-10">
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              id="tiles-edit-toggle"
              className="tiles-edit-toggle inline-flex items-center gap-1.5 rounded-lg border border-koborder bg-koelev2 px-3 py-1.5 text-xs font-semibold text-kotext transition hover:border-koaccent"
              aria-pressed="false"
            >
              <Icon name="edit" size={16} />
              <span className="tiles-edit-toggle-label-off">Edytuj kafelki</span>
              <span className="tiles-edit-toggle-label-on">Zakończ edycję</span>
            </button>
          </div>
          <div className="home-tiles-grid grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TILES.map((t) => (
              <Tile key={t.id} tile={t} />
            ))}
          </div>
        </div>
      </main>

      <IslandLoader db utils homeLayout kwiedzaData scripts={[{ src: '/home.js', type: 'module' }]} />
    </div>
  );
}
