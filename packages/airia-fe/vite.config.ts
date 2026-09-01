import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'AIrIA',
        short_name: 'AIrIA',
        description: 'Your personal AI that gets smarter over time',
        theme_color: '#0D0B07',
        background_color: '#0D0B07',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only precache small assets. WebLLM (~6MB) and Ollama traffic are excluded.
        globPatterns: ['**/*.{css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 500 * 1024,  // 500 KB — keeps SW lean
        runtimeCaching: [
          {
            // Small JS chunks — cache on first fetch
            urlPattern: /\/assets\/index-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'js-chunks', expiration: { maxEntries: 10 } },
          },
          {
            urlPattern: /^http:\/\/localhost:11434\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    'import.meta.env.VITE_AIRIA_TIER': JSON.stringify(process.env.VITE_AIRIA_TIER ?? ''),
    '__VITE_AIRIA_TIER__': JSON.stringify(process.env.VITE_AIRIA_TIER ?? ''),
    '__VITE_DEV_TRAINING__': JSON.stringify(process.env.VITE_DEV_TRAINING ?? ''),
  },
})
