import IslandLoader from '@/components/IslandLoader';

export const metadata = {
  title: 'Rejestracja firmy · kFirma',
  description: 'Wypełnij formularz i wygeneruj plik .kobcomreg do rejestracji firmy.',
};

const inputClass =
  'w-full rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm text-kotext outline-none ring-koaccent/40 placeholder:text-kodim/70 focus:border-koaccent focus:ring-2';
const labelClass = 'mb-1 block text-sm font-medium text-kotext';

function Field({ label, children, htmlFor }) {
  return (
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function KfirmaRegisterPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-kotext">Rejestracja firmy</h1>
          <p className="mt-1 text-sm text-kodim">
            Wypełnij dane i pobierz plik <code className="rounded bg-koelev2 px-1">.kobcomreg</code>.
          </p>
        </div>
        <button
          id="kfreg-back"
          type="button"
          className="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent"
        >
          Wróć do listy
        </button>
      </div>

      <form id="kfreg-form" className="space-y-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nazwa firmy" htmlFor="kfreg-name">
            <input id="kfreg-name" name="name" type="text" className={inputClass} placeholder="Nazwa" />
          </Field>
          <Field label="Rodzaj działalności" htmlFor="kfreg-btype">
            <select id="kfreg-btype" name="businessType" className={inputClass} defaultValue="">
              <option value="" disabled>
                Wybierz rodzaj działalności
              </option>
            </select>
          </Field>
          <Field label="KESEL osoby rejestrującej" htmlFor="kfreg-registrar">
            <input id="kfreg-registrar" name="registrar" type="number" className={inputClass} placeholder="np. 12345" />
          </Field>
          <Field label="Wymiar" htmlFor="kfreg-dimension">
            <select id="kfreg-dimension" name="dimension" className={inputClass} defaultValue="Overworld">
              <option value="Overworld">Overworld</option>
              <option value="Nether">Nether</option>
              <option value="The End">The End</option>
            </select>
          </Field>
          <Field label="Województwo" htmlFor="kfreg-voiv">
            <input id="kfreg-voiv" name="voiv" type="text" className={inputClass} placeholder="Województwo" />
          </Field>
          <Field label="Miasto" htmlFor="kfreg-city">
            <input id="kfreg-city" name="city" type="text" className={inputClass} placeholder="Miasto" />
          </Field>
          <Field label="Ulica" htmlFor="kfreg-street">
            <input id="kfreg-street" name="street" type="text" className={inputClass} placeholder="Ulica" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Koordynata X" htmlFor="kfreg-x">
              <input id="kfreg-x" name="x" type="number" className={inputClass} placeholder="X" />
            </Field>
            <Field label="Koordynata Z" htmlFor="kfreg-z">
              <input id="kfreg-z" name="z" type="number" className={inputClass} placeholder="Z" />
            </Field>
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Symbole działalności</legend>
          <div id="kfreg-symbols" className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-koborder bg-koelev p-3 sm:grid-cols-2">
            <div className="text-sm text-kodim">Ładowanie symboli…</div>
          </div>
        </fieldset>

        <div className="space-y-2 rounded-xl border border-koborder bg-koelev p-4">
          <label className="flex items-start gap-2 text-sm text-kotext">
            <input name="declaration" type="checkbox" className="mt-0.5 accent-koaccent" />
            Oświadczam, że jestem uprawniony/a do zarejestrowania tej firmy.
          </label>
          <label className="flex items-start gap-2 text-sm text-kotext">
            <input name="documentsDeclaration" type="checkbox" className="mt-0.5 accent-koaccent" />
            Zobowiązuję się respektować dokumenty z kDokumenty oraz dokumenty (np. faktury) z kSeF.
          </label>
        </div>

        <p id="kfreg-status" className="text-sm text-kodim" aria-live="polite" />

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-xl bg-koaccent px-5 py-2.5 font-semibold text-koaccenttext transition hover:bg-koaccent2">
            Wygeneruj plik
          </button>
          <button id="kfreg-reset" type="button" className="rounded-xl border border-koborder bg-koelev2 px-5 py-2.5 font-semibold text-kotext transition hover:border-koaccent">
            Wyczyść
          </button>
          <button id="kfreg-ai-btn" type="button" className="rounded-xl border border-koaccent/60 bg-koaccent/10 px-5 py-2.5 font-semibold text-koaccent2 transition hover:bg-koaccent/20">
            Wypełnij z pomocą AI
          </button>
        </div>
      </form>

      {/* Success overlay */}
      <div id="kfreg-overlay" className="fixed inset-0 z-[70] hidden items-center justify-center p-4" aria-hidden="true">
        <div className="kfreg-overlay-backdrop absolute inset-0 bg-black/60" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-koborder bg-koelev p-6 text-center shadow-2xl">
          <h3 className="text-lg font-bold text-kotext">Plik wygenerowany</h3>
          <p className="mt-2 text-sm text-kodim">
            Plik <code className="rounded bg-koelev2 px-1">.kobcomreg</code> został pobrany. Prześlij go zgodnie z instrukcjami rejestracji.
          </p>
          <button id="kfreg-overlay-close" type="button" className="mt-4 rounded-xl bg-koaccent px-5 py-2 font-semibold text-koaccenttext transition hover:bg-koaccent2">
            Zamknij
          </button>
        </div>
      </div>

      {/* AI-prompt overlay */}
      <div id="kfreg-ai-overlay" className="fixed inset-0 z-[70] hidden items-center justify-center p-4" aria-hidden="true">
        <div className="kfreg-overlay-backdrop absolute inset-0 bg-black/60" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-koborder bg-koelev p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-kotext">Wypełnij z pomocą AI</h3>
          <p className="mt-2 text-sm text-kodim">
            Otworzymy czat AI (DuckDuckGo) z gotowym poleceniem. Asystent zada pytania i na końcu wygeneruje link,
            który automatycznie wypełni ten formularz.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button id="kfreg-ai-cancel" type="button" className="rounded-xl border border-koborder bg-koelev2 px-4 py-2 text-sm font-semibold text-kotext transition hover:border-koaccent">
              Anuluj
            </button>
            <button id="kfreg-ai-open" type="button" className="rounded-xl bg-koaccent px-4 py-2 text-sm font-semibold text-koaccenttext transition hover:bg-koaccent2">
              Otwórz czat AI
            </button>
          </div>
        </div>
      </div>

      <IslandLoader db utils scripts={[{ src: '/kfirma-register.js', type: 'module' }]} />
    </div>
  );
}
