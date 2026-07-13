export const metadata = { title: '404 – Nie znaleziono' };

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <main>
        <p className="text-7xl font-black tracking-tight text-koaccent">404</p>
        <p className="mt-4 text-lg text-kotext">Nie znaleziono żądanego zasobu.</p>
        <p className="text-kodim">Sprawdź adres lub wróć na stronę główną.</p>
        <a
          href="/"
          className="mt-6 inline-block rounded-xl bg-koaccent px-5 py-2.5 font-semibold text-koaccenttext transition hover:bg-koaccent2"
        >
          Strona główna
        </a>
        <p className="mt-8 text-sm text-kodim">kObywatel</p>
      </main>
    </div>
  );
}
