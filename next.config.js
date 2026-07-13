/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pure static site — no serverless functions, matches the previous GitHub Pages
  // deployment model and keeps us clear of Vercel Hobby function limits.
  output: 'export',
  // Emit `out/<route>/index.html` for every route so physical paths keep the same
  // directory+index.html shape the app already had (e.g. /map/index.html), which the
  // service worker's precache/NAV_FALLBACKS logic depends on.
  trailingSlash: true,
  // The app never used next/image; keep plain <img> everywhere and skip the optimizer
  // (which needs a server and is unsupported under static export).
  images: { unoptimized: true },
  reactStrictMode: true,
};

module.exports = nextConfig;
