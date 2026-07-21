import './globals.css';
import Script from 'next/script';
import { appleTouchIcons, appleSplashScreens } from '@/lib/appleAssets';
import ServiceWorker from '@/components/ServiceWorker';
import PwaInstall from '@/components/PwaInstall';

export const metadata = {
  metadataBase: new URL('https://kobywatel-mc.stankiewiczm.eu'),
  title: {
    default: 'kObywatel',
    template: '%s · kObywatel',
  },
  description:
    'Aplikacja dla obywateli - wyszukaj miasta, stacje i skorzystaj z usług publicznych.',
  applicationName: 'kObywatel',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: appleTouchIcons.map((i) => ({ url: i.href, sizes: i.sizes || undefined })),
  },
  openGraph: {
    type: 'website',
    siteName: 'kObywatel',
    title: 'kObywatel',
    description:
      'Aplikacja dla obywateli - wyszukaj miasta, stacje i skorzystaj z usług publicznych.',
    url: '/',
    images: ['/assets/og/OG-Standard-Index.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/assets/og/OG-Twitter-Index.png'],
  },
};

export const viewport = {
  themeColor: '#AC1943',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <head>
        {/* Chrome can fire beforeinstallprompt before React hydrates (e.g. on a
            slower/loaded machine), which drops the event and leaves Chrome's own
            install UI unclaimed — the omnibox icon flashes in then Chrome retracts
            it. Claim the event synchronously, before hydration can lose the race. */}
        <Script id="early-install-prompt" strategy="beforeInteractive">
          {`window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            window.__deferredInstallPrompt = e;
          });`}
        </Script>
        {/* iOS launch/splash screens (media-query driven — not expressible via the
            metadata API, so rendered directly). React hoists these into <head>. */}
        {appleSplashScreens.map((s, i) => (
          <link key={i} rel="apple-touch-startup-image" media={s.media} href={s.href} />
        ))}
      </head>
      <body>
        {children}
        <ServiceWorker />
        <PwaInstall />
        {/* Offline guard: pure-logic verbatim port, runs app-wide. Not present on the
            raw public/ fallback pages (offline/403/500), which Next doesn't wrap. */}
        <Script src="/offline-guard.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
