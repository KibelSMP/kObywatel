import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'kSeF',
  description: 'Wystaw Fakturę KAT w PDF na podstawie prostego formularza.',
  openGraph: {
    title: 'kSeF · kObywatel',
    description: 'Wystaw Fakturę KAT w PDF na podstawie prostego formularza.',
    url: '/ksef',
    images: ['/assets/og/OG-Standard-kSeF.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-kSeF.png'] },
};

const input =
  'w-full rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm text-kotext outline-none ring-koaccent/40 placeholder:text-kodim/70 focus:border-koaccent focus:ring-2';
const lbl = 'mb-1 block text-sm font-medium text-kotext';

export default function KsefPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-kotext">kSeF</h1>
          <p className="mt-1 text-sm text-kodim">Wystaw Fakturę KAT i pobierz ją jako PDF.</p>
        </div>
        <button id="ksef-back" type="button" className="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent">
          Strona główna
        </button>
      </div>

      <form id="ksef-form" className="space-y-6">
        <section className="grid gap-4 rounded-2xl border border-koborder bg-koelev p-4 sm:grid-cols-4">
          <div><label className={lbl} htmlFor="invoiceNumber">Numer faktury</label><input id="invoiceNumber" name="invoiceNumber" type="text" maxLength={32} className={input} /></div>
          <div><label className={lbl} htmlFor="issueDate">Data wystawienia</label><input id="issueDate" name="issueDate" type="date" required className={input} /></div>
          <div><label className={lbl} htmlFor="saleDate">Data sprzedaży</label><input id="saleDate" name="saleDate" type="date" required className={input} /></div>
          <div><label className={lbl} htmlFor="currency">Waluta</label><input id="currency" name="currency" type="text" defaultValue="PMK" required className={input} /></div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-koborder bg-koelev p-4">
            <h2 className="mb-3 text-lg font-bold text-kotext">Sprzedawca</h2>
            <div className="space-y-3">
              <div><label className={lbl} htmlFor="sellerName">Nazwa</label><input id="sellerName" name="sellerName" type="text" className={input} /></div>
              <div><label className={lbl} htmlFor="sellerId">ID / KNIP</label><input id="sellerId" name="sellerId" type="text" className={input} /></div>
              <div><label className={lbl} htmlFor="sellerAddress">Adres</label><input id="sellerAddress" name="sellerAddress" type="text" className={input} /></div>
            </div>
          </section>
          <section className="rounded-2xl border border-koborder bg-koelev p-4">
            <h2 className="mb-3 text-lg font-bold text-kotext">Nabywca</h2>
            <div className="space-y-3">
              <div><label className={lbl} htmlFor="buyerName">Nazwa</label><input id="buyerName" name="buyerName" type="text" className={input} /></div>
              <div><label className={lbl} htmlFor="buyerId">ID / KNIP</label><input id="buyerId" name="buyerId" type="text" className={input} /></div>
              <div><label className={lbl} htmlFor="buyerAddress">Adres</label><input id="buyerAddress" name="buyerAddress" type="text" className={input} /></div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-koborder bg-koelev p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-kotext">Pozycje</h2>
            <button id="add-item" type="button" className="rounded-xl border border-koborder bg-koelev2 px-3 py-1.5 text-sm font-semibold text-kotext transition hover:border-koaccent">
              + Dodaj pozycję
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-koborder text-xs uppercase tracking-wide text-kodim">
                  <th className="px-2 py-2">Lp</th>
                  <th className="px-2 py-2">Nazwa</th>
                  <th className="px-2 py-2">Ilość</th>
                  <th className="px-2 py-2">Jm</th>
                  <th className="px-2 py-2">Cena</th>
                  <th className="px-2 py-2">KAT %</th>
                  <th className="px-2 py-2 text-right">Brutto</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody id="items-body" />
            </table>
          </div>
          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <div>Razem netto: <span id="total-net" className="font-mono font-semibold text-kotext">0,00</span></div>
            <div>KAT: <span id="total-kat" className="font-mono font-semibold text-kotext">0,00</span></div>
            <div className="text-base">Razem brutto: <span id="total-gross" className="font-mono font-bold text-koaccent2">0,00</span></div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-koborder bg-koelev p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={lbl} htmlFor="paymentMethod">Metoda płatności</label>
            <select id="paymentMethod" name="paymentMethod" defaultValue="Gotówka" className={input}>
              <option value="Gotówka">Gotówka</option>
              <option value="Przelew">Przelew</option>
              <option value="BLIK">BLIK</option>
              <option value="Karta">Karta</option>
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="paymentStatus">Status płatności</label>
            <select id="paymentStatus" name="paymentStatus" defaultValue="Oczekuje" className={input}>
              <option value="Oczekuje">Oczekuje</option>
              <option value="Opłacona">Opłacona</option>
              <option value="Częściowa">Częściowa</option>
            </select>
          </div>
          <div><label className={lbl} htmlFor="paymentTerms">Termin płatności</label><input id="paymentTerms" name="paymentTerms" type="date" required className={input} /></div>
          <div><label className={lbl} htmlFor="extraNotes">Uwagi</label><input id="extraNotes" name="extraNotes" type="text" className={input} /></div>
        </section>

        <p id="ksef-status" className="text-sm text-kodim" aria-live="polite" />

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-xl bg-koaccent px-5 py-2.5 font-semibold text-koaccenttext transition hover:bg-koaccent2">Generuj PDF</button>
          <button id="export-json" type="button" className="rounded-xl border border-koborder bg-koelev2 px-5 py-2.5 font-semibold text-kotext transition hover:border-koaccent">Eksport (.ksefkob)</button>
          <button id="import-json" type="button" className="rounded-xl border border-koborder bg-koelev2 px-5 py-2.5 font-semibold text-kotext transition hover:border-koaccent">Import (.ksefkob)</button>
          <button id="reset-form" type="button" className="rounded-xl border border-koborder bg-koelev2 px-5 py-2.5 font-semibold text-kotext transition hover:border-koaccent">Wyczyść</button>
          <input id="import-file" type="file" accept=".ksefkob,application/json" className="hidden" />
        </div>
      </form>

      <IslandLoader jspdf autotable utils scripts={[{ src: '/ksef.js', type: 'module' }]} />
    </div>
  );
}
