'use client';

// Install-prompt banner — faithful port of the legacy public/pwa-install.js
// detection logic (iOS / Safari-Mac / Chromium branches, 180-day dismissal TTL,
// ≤485px compact mode), reskinned with Tailwind. Renders nothing until the
// detection decides the banner should show.

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY_HIDE = 'pwaBanner:hide';
const STORAGE_KEY_TS = 'pwaBanner:hideTs';
const HIDE_TTL_DAYS = 180;
const days = (n) => n * 24 * 60 * 60 * 1000;

function isStandalone() {
  const iosStandalone = window.navigator.standalone === true;
  const displayMode = window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayMode;
}

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isSafariMac() {
  const ua = navigator.userAgent;
  const isMac = /Macintosh|Mac OS X/.test(ua) && !(navigator.maxTouchPoints > 1);
  const isSafari = /Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR)\//.test(ua);
  return isMac && isSafari;
}

function isSupportedBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  const isChromium = /chrome|chromium|crios|edg\//.test(ua);
  const isAndroid = /android/.test(ua);
  const isFirefoxAndroid = /firefox/.test(ua) && /android/.test(ua);
  if (isIOS()) return true;
  if (isSafariMac()) return true;
  if (isFirefoxAndroid) return true;
  if (isChromium && isAndroid) return true;
  const hasSW = 'serviceWorker' in navigator;
  return (
    hasSW &&
    ('onbeforeinstallprompt' in window || window.matchMedia('(display-mode: browser)').matches)
  );
}

function shouldHide() {
  try {
    const hide = localStorage.getItem(STORAGE_KEY_HIDE);
    const ts = parseInt(localStorage.getItem(STORAGE_KEY_TS) || '0', 10);
    if (hide === '1' && ts && Date.now() - ts < days(HIDE_TTL_DAYS)) return true;
  } catch (_) {}
  return false;
}

function persistHide() {
  try {
    localStorage.setItem(STORAGE_KEY_HIDE, '1');
    localStorage.setItem(STORAGE_KEY_TS, String(Date.now()));
  } catch (_) {}
}

const DEFAULT_DESC = 'Dodaj aplikację do ekranu głównego dla pełnego doświadczenia.';
const IOS_DESC =
  'Aby zainstalować na iPhonie lub iPadzie otwórz menu „Udostępnij” → „Dodaj do ekranu początkowego”.';
const SAFARI_MAC_DESC = 'Aby zainstalować na Maku przez Safari otwórz menu „Plik” → „Dodaj do Docka”.';

export default function PwaInstall() {
  const [visible, setVisible] = useState(false);
  const [compact, setCompact] = useState(false);
  const [mode, setMode] = useState(null); // 'ios' | 'safari-mac' | 'prompt'
  const [noMore, setNoMore] = useState(false);
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    if (isStandalone() || !isSupportedBrowser() || shouldHide()) return;

    const applyCompact = () => {
      const ww = Math.min(window.innerWidth || 0, document.documentElement.clientWidth || 0);
      setCompact(ww <= 485);
    };
    applyCompact();
    window.addEventListener('resize', applyCompact, { passive: true });

    let onBip;
    if (isIOS()) {
      setMode('ios');
      setVisible(true);
    } else if (isSafariMac()) {
      setMode('safari-mac');
      setVisible(true);
    } else {
      setMode('prompt');
      onBip = (e) => {
        e.preventDefault();
        setDeferred(e);
        setVisible(true);
      };
      // beforeinstallprompt can fire before this effect runs (React hydration
      // is slower than Chrome's installability check on a loaded/throttled
      // machine); the early inline script in app/layout.js catches it and
      // stashes it here so the race never drops the event.
      if (window.__deferredInstallPrompt) {
        onBip(window.__deferredInstallPrompt);
        window.__deferredInstallPrompt = null;
      }
      window.addEventListener('beforeinstallprompt', onBip);
    }

    return () => {
      window.removeEventListener('resize', applyCompact);
      if (onBip) window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      persistHide();
    }
    setDeferred(null);
  }, [deferred]);

  const onClose = useCallback(() => {
    setVisible(false);
    if (noMore) persistHide();
  }, [noMore]);

  if (!visible) return null;

  const desc = mode === 'ios' ? IOS_DESC : mode === 'safari-mac' ? SAFARI_MAC_DESC : DEFAULT_DESC;
  const showInstallBtn = mode === 'prompt';

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Zainstaluj aplikację"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-koborder bg-koelev/95 p-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:left-auto sm:w-[28rem]"
    >
      <img
        className="hidden h-12 w-12 shrink-0 rounded-xl sm:block"
        src="/assets/AppImages/android/android-launchericon-144-144.png"
        alt=""
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-kotext">Zainstaluj kObywatel</p>
        <p className="mt-0.5 text-sm text-kodim">{desc}</p>
        {!showInstallBtn ? null : (
          <label className="mt-2 flex items-center gap-2 text-xs text-kodim">
            <input
              type="checkbox"
              checked={noMore}
              onChange={(e) => setNoMore(e.target.checked)}
              className="accent-koaccent"
            />
            Nie pokazuj ponownie
          </label>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showInstallBtn && (
          <button
            type="button"
            onClick={onInstall}
            className="rounded-xl bg-koaccent px-3 py-2 text-sm font-semibold text-koaccenttext transition hover:bg-koaccent2"
          >
            {compact ? 'Instaluj' : 'Zainstaluj'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          title="Zamknij"
          aria-label="Zamknij"
          className="grid h-9 w-9 place-items-center rounded-xl text-kodim transition hover:bg-koelev2 hover:text-kotext"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
