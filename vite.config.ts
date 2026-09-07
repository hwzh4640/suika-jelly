import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves project sites under /<repo>/. Override with VITE_BASE=/ for root hosting.
const base = process.env.VITE_BASE ?? '/suika-jelly/';

export default defineConfig({
  base,
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'apple-touch-icon.png', 'cover.png'],
      manifest: {
        id: base,
        name: 'Suika Jelly',
        short_name: 'Suika Jelly',
        description: 'Drop glossy jelly fruits into a mason jar and merge matching pairs into a watermelon.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffd9bf',
        theme_color: '#ffd9bf',
        categories: ['games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [{ src: 'cover.png', sizes: '1200x630', type: 'image/png', form_factor: 'wide', label: 'Suika Jelly gameplay' }],
      },
      workbox: {
        // Precache the app shell and icons so the game runs fully offline once installed.
        // Splash screens are only fetched by iOS at install time, so they stay network-only.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['splash/**', 'cover.png'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
