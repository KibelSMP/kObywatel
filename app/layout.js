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
        {/* kLink "in-game" skin toggle. The mod injects `window.__klink =
            { embedded: true }` before page scripts when kObywatel is opened
            inside its embedded Chromium browser (see tmp/integracja-kobywatel.md).
            Stamp <html data-klink="embedded"> synchronously, before first paint,
            so the Minecraft-GUI skin in globals.css/map.css applies with no
            flash of the normal look. `?klinkskin=1` forces it on for local
            preview outside the game (persisted); `?klinkskin=0` clears it. */}
        <Script id="klink-embedded-skin" strategy="beforeInteractive">
          {`(function () {
            try {
              var s = location.search || '';
              if (s.indexOf('klinkskin=0') > -1) { try { localStorage.removeItem('klink-skin'); } catch (e) {} }
              var forced = s.indexOf('klinkskin=1') > -1;
              if (forced) { try { localStorage.setItem('klink-skin', '1'); } catch (e) {} }
              var stored = false;
              try { stored = localStorage.getItem('klink-skin') === '1'; } catch (e) {}
              if ((window.__klink && window.__klink.embedded) || forced || stored) {
                document.documentElement.setAttribute('data-klink', 'embedded');
              }
            } catch (e) {}
          })();`}
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
