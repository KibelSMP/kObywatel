'use client';

// Mounts a legacy imperative "island" script against JSX-rendered markup: exposes
// the globals the ported script expects (window.__db, window.escapeHtml,
// window.markdownit, …) from bundled modules, then appends the island script(s)
// in order. Runs once per page load (the app uses hard navigation, so there is no
// remount within a session — see plan). Scripts are cleaned up on unmount anyway.

import { useEffect } from 'react';

function appendScript({ src, type }) {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    if (type) s.type = type;
    s.src = src;
    s.onload = () => resolve(s);
    s.onerror = () => resolve(s);
    document.body.appendChild(s);
  });
}

export default function IslandLoader({
  scripts = [],
  markdownIt = false,
  utils = false,
  db = false,
  kwiedzaData = false,
  jspdf = false,
  autotable = false,
  marked = false,
  homeLayout = false,
  navLayout = false,
}) {
  useEffect(() => {
    let cancelled = false;
    const appended = [];

    (async () => {
      if (utils) {
        const u = await import('@/lib/utils');
        window.escapeHtml = u.escapeHtml;
        window.productMatchesQuery = u.productMatchesQuery;
        window.productFallbackName = u.productFallbackName;
      }
      if (kwiedzaData) {
        const kd = await import('@/lib/kwiedzaData');
        window.KWiedzaData = { fetchDocs: kd.fetchDocs };
      }
      if (homeLayout) {
        const hl = await import('@/lib/homeLayout');
        window.HomeLayout = {
          STORAGE_KEY: hl.STORAGE_KEY,
          DEFAULT_TILES: hl.DEFAULT_TILES,
          LOCKED: hl.LOCKED,
          defaults: hl.defaults,
          normalize: hl.normalize,
          load: hl.load,
          save: hl.save,
        };
      }
      if (navLayout) {
        const nl = await import('@/lib/navLayout');
        window.NavLayout = {
          STORAGE_KEY: nl.STORAGE_KEY,
          DEFAULT_ITEMS: nl.DEFAULT_ITEMS,
          defaults: nl.defaults,
          normalize: nl.normalize,
          load: nl.load,
          save: nl.save,
        };
      }
      if (markdownIt) {
        const m = await import('markdown-it');
        window.markdownit = m.default;
      }
      if (marked) {
        const mk = await import('marked');
        window.marked = mk.marked || mk.default || mk;
      }
      if (jspdf) {
        const j = await import('jspdf');
        window.jspdf = { jsPDF: j.jsPDF };
        if (autotable) {
          const at = await import('jspdf-autotable');
          if (typeof at.applyPlugin === 'function') at.applyPlugin(j.jsPDF);
        }
      }
      if (db && !window.__db) {
        appended.push(await appendScript({ src: '/db-adapter.js' }));
      }
      for (const sc of scripts) {
        if (cancelled) return;
        appended.push(await appendScript(sc));
      }
    })();

    return () => {
      cancelled = true;
      appended.forEach((s) => s && s.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
