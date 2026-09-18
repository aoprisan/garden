import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Defaults to the site root for local dev/preview. On GitHub Pages the app is
// served from a repo subpath (https://<user>.github.io/garden/), so the deploy
// workflow sets VITE_BASE=/garden/; the SW and manifest paths derive from this.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // A new build waits rather than seizing control mid-walk — the in-app
      // Update prompt (<PwaPrompts>) lets the player reload on their terms.
      registerType: 'prompt',
      injectRegister: null,
      // public/manifest.webmanifest is hand-authored and authoritative.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gd-font-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'gd-font-files',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5175,
    // docs/plants.csv is imported as text (game/config.ts) — it's the game's
    // data, loaded at runtime so it can be swapped live.
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
