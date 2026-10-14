/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.png'],
      manifest: {
        name: 'Corn Utopia',
        short_name: 'Corn Utopia',
        description: 'Chomp cobs, scoop kernels, grow big. (M0 gray-box prototype)',
        display: 'standalone',
        background_color: '#9fd36b',
        theme_color: '#9fd36b',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
