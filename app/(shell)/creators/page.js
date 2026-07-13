export const metadata = {
  title: 'Twórcy',
  description: 'Poznaj twórców aplikacji kObywatel.',
  openGraph: {
    title: 'Twórcy · kObywatel',
    description: 'Poznaj twórców aplikacji kObywatel.',
    url: '/creators',
    images: ['/assets/og/OG-Standard-Tworcy.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-Tworcy.png'] },
};

const TEAM = [
  {
    name: 'Miersetnik',
    roles: ['WebDev', 'UI/UX', 'Grafiki'],
    bio: 'Pomysłodawca i fundator. Odpowiada za stworzenie aplikacji od podstaw.',
  },
  {
    name: 'NKacz',
    roles: ['Mapy'],
    bio: 'Udostępnia pliki graficzne map oraz bazy danych stacji i linii.',
  },
  {
    name: 'Ketrab',
    roles: ['Dane'],
    bio: 'Pomysłodawca modułu kHandel. Tworzy dla niego bazę danych.',
  },
];

export default function CreatorsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <section className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-kotext">Twórcy projektu</h1>
        <p className="text-kodim">
          Na tej stronie znajdziesz osoby, które projektują, rozwijają i utrzymują kObywatel.
        </p>
      </section>

      <section aria-labelledby="team-heading">
        <h2 id="team-heading" className="sr-only">
          Zespół
        </h2>
        <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((person) => (
            <li
              key={person.name}
              className="rounded-2xl border border-koborder bg-koelev p-5 shadow-sm"
            >
              <h3 className="text-xl font-semibold text-kotext">{person.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {person.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-koaccent/15 px-2.5 py-0.5 text-xs font-medium text-koaccent2"
                  >
                    {role}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-kodim">{person.bio}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-center text-sm text-kodim">
        Aplikacja dedykowana graczom KibelSMP. Ikona aplikacji inspirowana logiem serwera.
      </p>
    </div>
  );
}
