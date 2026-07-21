'use client';

// Shared app header/nav used across all "shell" pages. Plain <a> links (hard
// navigation) — the app has no SPA behavior and the imperative islands depend on
// a fresh document per route. Responsive: inline links on desktop, a disclosure
// menu on mobile.

import { useEffect, useState } from 'react';
import Icon from './Icon';
import { CHANGE_EVENT, DEFAULT_ITEMS, load, resolve } from '@/lib/navLayout';

export default function SiteHeader({ extra, compact = false }) {
  const [open, setOpen] = useState(false);
  // SSR/static export always renders the default order; personalization from
  // /settings/ is applied after mount (localStorage isn't available at build time).
  const [navItems, setNavItems] = useState(DEFAULT_ITEMS);

  useEffect(() => {
    const refresh = () => setNavItems(resolve(load()));
    refresh();
    // Settings lives behind the same shared header, so an edit there must be
    // reflected here live, not just after a hard navigation.
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => window.removeEventListener(CHANGE_EVENT, refresh);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-koborder/70 bg-kobg/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label="Strona główna">
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-lg" />
          <span className={`text-lg font-bold tracking-tight text-kotext ${compact ? 'hidden sm:inline' : ''}`}>kObywatel</span>
        </a>

        {/* Extra controls (e.g. the map's theme/mode toggles) — unlike nav links and
            Settings, these stay visible at every breakpoint instead of collapsing into
            the mobile menu, since they're frequently-used page controls, not app nav.
            Rendered before <nav>, right after the logo, with no auto-margin of its own:
            {extra} only exists on pages that pass it (currently just /map/), so the
            "push everything right" margin must live on <nav> — which always renders —
            not here, or every other page loses right-alignment entirely. */}
        {extra && <div className="ml-3 flex items-center gap-1.5">{extra}</div>}

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Nawigacja główna">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-kodim transition hover:bg-koelev2 hover:text-kotext"
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Desktop only — on mobile, Settings lives inside the hamburger menu below. */}
        <a
          href="/settings/"
          className="hidden h-10 w-10 place-items-center rounded-lg text-kodim transition hover:bg-koelev2 hover:text-kotext lg:ml-2 lg:grid"
          aria-label="Ustawienia"
          title="Ustawienia"
        >
          <Icon name="settings" size={22} />
        </a>

        <button
          type="button"
          className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-kodim transition hover:bg-koelev2 hover:text-kotext lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? 'close' : 'menu'} size={22} />
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-koborder/70 bg-kobg/95 px-4 py-2 lg:hidden"
          aria-label="Nawigacja mobilna"
        >
          <ul className="grid gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-kotext transition hover:bg-koelev2"
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Settings is app-level, not a content link — set apart from the nav list above. */}
          <div className="my-2 border-t border-koborder/70" />
          <a
            href="/settings/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-kotext transition hover:bg-koelev2"
          >
            <Icon name="settings" size={20} />
            Ustawienia
          </a>
        </nav>
      )}
    </header>
  );
}
