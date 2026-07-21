'use client';

// Registers the service worker on every route (v1 only did so on the home page,
// so users landing directly on /map or /khandel never got offline support).
// Preserves the standalone-only PRECACHE_PWA_ASSETS trigger, and wires up the
// previously-dead SKIP_WAITING message with a real "new version" update banner.

import { useEffect, useState } from 'react';

export default function ServiceWorker() {
  const [waiting, setWaiting] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reg;
    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        reg = registration;

        // Full offline set only in the installed PWA (standalone display mode).
        const standalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true;
        if (standalone) {
          navigator.serviceWorker.ready
            .then((r) => {
              if (r.active) r.active.postMessage({ type: 'PRECACHE_PWA_ASSETS' });
            })
            .catch(() => {});
        }

        // A waiting worker already present = update ready.
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaiting(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(registration.waiting || installing);
            }
          });
        });
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-3 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-koborder bg-koelev/95 p-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <p className="min-w-0 flex-1 text-sm text-kotext">
        Dostępna jest nowa wersja aplikacji.
      </p>
      <button
        type="button"
        onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
        className="shrink-0 rounded-xl bg-koaccent px-3 py-2 text-sm font-semibold text-koaccenttext transition hover:bg-koaccent2"
      >
        Odśwież
      </button>
    </div>
  );
}
