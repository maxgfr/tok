/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Project pages live under https://maxgfr.github.io/tok/, so every asset URL
// must be prefixed. Routing is hash-based, which keeps deep links working
// without a 404 fallback.
const BASE = '/tok/'

// The privacy promise, enforced by the browser rather than asserted in a README.
// `connect-src 'self'` is what makes it real: even a dependency that decided to
// phone home would be blocked. Injected at build time only — the dev server
// needs a websocket for HMR, and production is the artifact that has to hold.
// 'wasm-unsafe-eval' lets the vision worker compile its self-hosted wasm;
// media-src blob: lets Replay play recordings straight from OPFS.
const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const contentSecurityPolicy = (): Plugin => ({
  name: 'tok:csp',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) =>
      html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      ),
  },
})

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'tok — rally & score counter',
        short_name: 'tok',
        description:
          'Counts every hit of a rally from sound, motion and camera, keeps match score and records your sessions. Everything stays on your device.',
        lang: 'en',
        dir: 'ltr',
        theme_color: '#0d1210',
        background_color: '#0d1210',
        display: 'standalone',
        orientation: 'any',
        start_url: `${BASE}`,
        scope: `${BASE}`,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The vision model and its wasm runtime (public/models) are several MB
        // and only needed by people who turn the camera on — they are cached on
        // first use instead of being forced on every install.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,woff2,webmanifest}'],
        globIgnores: ['models/**'],
        navigateFallback: `${BASE}index.html`,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${BASE}models/`),
            handler: 'CacheFirst',
            options: { cacheName: 'tok-models' },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    cssMinify: 'lightningcss',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
