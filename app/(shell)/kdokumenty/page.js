import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'kDokumenty',
  description: 'Przygotuj pisma urzędowe i zapisz je do PDF.',
  openGraph: {
    title: 'kDokumenty · kObywatel',
    description: 'Przygotuj pisma urzędowe i zapisz je do PDF.',
    url: '/kdokumenty',
    images: ['/assets/og/OG-Standard-kDokumenty.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-kDokumenty.png'] },
};

const input =
  'w-full rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm text-kotext outline-none ring-koaccent/40 placeholder:text-kodim/70 focus:border-koaccent focus:ring-2';
const lbl = 'mb-1 block text-sm font-medium text-kotext';

function Party({ prefix, title }) {
  return (
    <section className="kdok-box rounded-2xl border border-koborder bg-koelev p-4">
      <h2 className="mb-3 text-lg font-bold text-kotext">{title}</h2>
      <div className="mb-3">
        <label className={lbl} htmlFor={`${prefix}Type`}>Typ</label>
        <select id={`${prefix}Type`} name={`${prefix}Type`} defaultValue="institution" className={input}>
          <option value="institution">Instytucja / firma</option>
          <option value="person">Osoba prywatna</option>
        </select>
      </div>

      {/* Institution fields */}
      <div data-entity="institution" className="space-y-3">
        <div><label className={lbl} htmlFor={`${prefix}Company`}>Nazwa firmy/instytucji</label><input id={`${prefix}Company`} name={`${prefix}Company`} type="text" className={input} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl} htmlFor={`${prefix}Knip`}>KNIP</label><input id={`${prefix}Knip`} name={`${prefix}Knip`} type="text" className={input} /></div>
          <div><label className={lbl} htmlFor={`${prefix}Unit`}>Dział/jednostka</label><input id={`${prefix}Unit`} name={`${prefix}Unit`} type="text" className={input} /></div>
        </div>
        <div><label className={lbl} htmlFor={`${prefix}Address`}>Adres</label><input id={`${prefix}Address`} name={`${prefix}Address`} type="text" className={input} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl} htmlFor={`${prefix}Nick`}>Nick reprezentanta</label><input id={`${prefix}Nick`} name={`${prefix}Nick`} type="text" className={input} /></div>
          <div><label className={lbl} htmlFor={`${prefix}RepPesel`}>KESEL reprezentanta</label><input id={`${prefix}RepPesel`} name={`${prefix}RepPesel`} type="text" className={input} /></div>
        </div>
      </div>

      {/* Person fields (hidden by default; default type is institution) */}
      <div data-entity="person" hidden className="space-y-3">
        <div><label className={lbl} htmlFor={`${prefix}NickPerson`}>Nick</label><input id={`${prefix}NickPerson`} name={`${prefix}NickPerson`} type="text" className={input} /></div>
        <div><label className={lbl} htmlFor={`${prefix}Pesel`}>KESEL</label><input id={`${prefix}Pesel`} name={`${prefix}Pesel`} type="text" className={input} /></div>
        <div><label className={lbl} htmlFor={`${prefix}AddressPerson`}>Adres</label><input id={`${prefix}AddressPerson`} name={`${prefix}AddressPerson`} type="text" className={input} /></div>
      </div>
    </section>
  );
}

const toolbarBtn =
  'rounded-lg border border-koborder bg-koelev2 px-2.5 py-1.5 text-sm font-semibold text-kotext transition hover:border-koaccent';

export default function KdokumentyPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-kotext">kDokumenty</h1>
          <p className="mt-1 text-sm text-kodim">Przygotuj pismo i pobierz je jako PDF.</p>
        </div>
        <button id="kdok-back" type="button" className="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent">
          Strona główna
        </button>
      </div>

      <form id="kdok-form" className="space-y-6">
        <section className="grid gap-4 rounded-2xl border border-koborder bg-koelev p-4 sm:grid-cols-3">
          <div><label className={lbl} htmlFor="docTitle">Tytuł pisma</label><input id="docTitle" name="docTitle" type="text" className={input} /></div>
          <div><label className={lbl} htmlFor="docReference">Sygnatura</label><input id="docReference" name="docReference" type="text" className={input} /></div>
          <div><label className={lbl} htmlFor="docDate">Data</label><input id="docDate" name="docDate" type="date" className={input} /></div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Party prefix="sender" title="Nadawca" />
          <Party prefix="recipient" title="Adresat" />
        </div>

        <section className="rounded-2xl border border-koborder bg-koelev p-4">
          <h2 className="mb-3 text-lg font-bold text-kotext">Treść pisma</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="kdok-toolbar mb-2 flex flex-wrap gap-1.5">
                <button type="button" data-action="bold" className={toolbarBtn} title="Pogrubienie"><strong>B</strong></button>
                <button type="button" data-action="italic" className={toolbarBtn} title="Kursywa"><em>I</em></button>
                <button type="button" data-action="h2" className={toolbarBtn} title="Nagłówek">H2</button>
                <button type="button" data-action="ul" className={toolbarBtn} title="Lista">• Lista</button>
                <button type="button" data-action="ol" className={toolbarBtn} title="Lista numerowana">1. Lista</button>
                <button type="button" data-action="quote" className={toolbarBtn} title="Cytat">❝</button>
                <button type="button" data-action="code" className={toolbarBtn} title="Kod">{'</>'}</button>
                <button type="button" data-action="link" className={toolbarBtn} title="Link">Link</button>
              </div>
              <textarea id="docBody" name="docBody" rows={16} className={`${input} font-mono`} placeholder="Treść pisma (Markdown)…" />
            </div>
            <div>
              <p className={lbl}>Podgląd</p>
              <div id="doc-preview" className="prose-kob min-h-[24rem] rounded-xl border border-koborder bg-koelev2/40 p-4" />
            </div>
          </div>
        </section>

        <p id="kdok-status" className="text-sm text-kodim" aria-live="polite" />

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-xl bg-koaccent px-5 py-2.5 font-semibold text-koaccenttext transition hover:bg-koaccent2">Generuj PDF</button>
          <button id="export-kobdoc" type="button" className="rounded-xl border border-koborder bg-koelev2 px-5 py-2.5 font-semibold text-kotext transition hover:border-koaccent">Eksport (.kobdoc)</button>
          <button id="import-kobdoc" type="button" className="rounded-xl border border-koborder bg-koelev2 px-5 py-2.5 font-semibold text-kotext transition hover:border-koaccent">Import (.kobdoc)</button>
          <button id="reset-form" type="button" className="rounded-xl border border-koborder bg-koelev2 px-5 py-2.5 font-semibold text-kotext transition hover:border-koaccent">Wyczyść</button>
          <input id="kobdoc-import" type="file" accept=".kobdoc,application/json" className="hidden" />
        </div>
      </form>

      <IslandLoader jspdf marked scripts={[{ src: '/kdokumenty.js', type: 'module' }]} />
    </div>
  );
}
