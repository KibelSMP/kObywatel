import SiteHeader from '@/components/SiteHeader';
import TallyEmbed from '@/components/TallyEmbed';

export const metadata = {
  title: 'Zaproponuj punkt',
  description: 'Zaproponuj nowy punkt na mapie kObywatel.',
};

export default function MapAddPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-kotext">Zaproponuj punkt</h1>
        <p className="mb-6 text-kodim">Zgłoś nowe miejsce do dodania na mapie.</p>
        <TallyEmbed
          src="https://tally.so/embed/wM9gV8?alignLeft=0&hideTitle=1&transparentBackground=1&dynamicHeight=1"
          title="Zaproponuj punkt na mapie"
        />
      </main>
    </div>
  );
}
