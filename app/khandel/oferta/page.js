import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'Oferta kHandel',
  description: 'Pojedyncza oferta kHandel.',
  // Katalogiem ofert jest /khandel/ — ta strona to jedna karta pod
  // bezpośrednim linkiem i nie ma po co trafiać do wyszukiwarek.
  robots: { index: false, follow: false },
};

// Widok jednej oferty kHandel, wybieranej przez ?id=<id oferty z kobywatel-db>.
//
// Powstał pod przypięte okienka moda kLink: mod otwiera ten adres w małym,
// pływającym oknie nad światem gry (patrz public/klink-pins.js i sekcja o
// przypinaniu w docs/integracja-kobywatel.md w repo kLink), więc strona jest
// celowo poza grupą (shell) — bez wspólnego nagłówka i stopki, które w oknie
// wielkości znaczka pocztowego zajęłyby cały widok. Otwarta w zwykłej
// przeglądarce pokazuje dokładnie to samo: jedną kartę oferty.
export default function KhandelOfferPage() {
  return (
    <>
      {/* Kartę, chipy cen i ikony przedmiotów rysuje khandel-oferta.js w tej
          samej strukturze DOM co katalog, więc style karty biorą się stąd. */}
      <link rel="stylesheet" href="/khandel.css" />
      <link rel="stylesheet" href="/khandel-oferta.css" />

      <main className="offer-frame">
        <div id="offer-status" className="offer-status">Wczytywanie oferty…</div>
        <div id="offer-card" hidden />
      </main>

      <IslandLoader db scripts={[{ src: '/khandel-oferta.js', type: 'module' }]} />
    </>
  );
}
