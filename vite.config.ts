import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  build: {
    target: ['chrome130', 'safari18', 'firefox102'],
    sourcemap: true, // Source map generation must be turned on
    rollupOptions: {
      output: {
        manualChunks: function (id) {
          if (id.includes('node_modules')) {
            if (id.includes('7z-wasm')) {
              return '7z'
            } else if (id.includes('@imagemagick')) {
              return 'imagemagick'
            } else if (id.includes('pdf-lib')) {
              return 'pdf-lib'
            } else if (id.includes('exiftool')) {
              return 'exiftool'
            } else if (id.includes('wasm-pandoc')) {
              return 'wasm-pandoc'
            } else if (id.includes('wasmagic')) {
              return 'wasmagic'
            } else if (id.includes('hash-wasm')) {
              return 'hash-wasm'
            } else if (id.includes('libimagequant-wasm')) {
              return 'libimagequant'
            } else if (id.includes('@bjorn3')) {
              return 'wasi-shim'
            } else if (id.includes('ffmpeg')) {
              return 'ffmpeg'
            }
            return 'vendor'
          } else {
            return 'app'
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: [
      '@ffmpeg/core-mt',
      '@ffmpeg/ffmpeg',
      '@ffmpeg/util',
      '7z-wasm',
      '@imagemagick/magick-wasm',
      'libimagequant-wasm',
      '@bjorn3/browser_wasi_shim',
      '@pdf-lib/fontkit',
      '@uswriting/exiftool',
      'hash-wasm',
      'wasm-pandoc',
      'wasmagic',
    ],
  },
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'happy-human',
      project: 'toolbox-react',
      telemetry: false,
    }),
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
  },
})
