import TallyEmbed from '@/components/TallyEmbed';

export const metadata = {
  title: 'Zgłoszenia',
  description:
    'Masz pomysł na usprawnienie kObywatela lub zauważyłeś błąd? Podziel się swoimi uwagami!',
  openGraph: {
    title: 'Zgłoszenia · kObywatel',
    description:
      'Masz pomysł na usprawnienie kObywatela lub zauważyłeś błąd? Podziel się swoimi uwagami!',
    url: '/report',
    images: ['/assets/og/OG-Standard-Zgloszenia.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-Zgloszenia.png'] },
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-kotext">Zgłoszenia</h1>
      <p className="mb-6 text-kodim">
        Masz pomysł na usprawnienie kObywatela lub zauważyłeś błąd? Podziel się swoimi uwagami.
      </p>
      <TallyEmbed
        src="https://tally.so/embed/3XKgkL?alignLeft=0&hideTitle=1&transparentBackground=1&dynamicHeight=1"
        title="Prośby i zgłoszenia"
      />
    </div>
  );
}
