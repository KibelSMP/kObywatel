// Shared "is this running as an installed PWA" check. Mirrors the inline copies
// in components/ServiceWorker.js, components/PwaInstall.js, offline-guard.js and
// settings.js (kept as-is there — different bundling contexts / pre-existing),
// but new island call sites should import this instead of adding another copy.
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
