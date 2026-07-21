import SiteHeader from '@/components/SiteHeader';

// Shared chrome for every "normal" page (everything except the home page, which
// renders its own hero, and the map, which is full-bleed with its own toolbar).
export default function ShellLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-koborder/60 px-4 py-6 text-center text-sm text-kodim">
        <p>
          kObywatel — portal społeczności{' '}
          <span className="font-medium text-kotext">KibelSMP</span>.{' '}
          <a href="/creators/" className="underline decoration-koborder underline-offset-2 hover:text-kotext">
            Twórcy
          </a>
        </p>
      </footer>
    </div>
  );
}
