import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { ffmpegCorePlugin } from './vite-plugin-ffmpeg-core'

export default defineConfig({
  build: {
    target: ['chrome135', 'safari26', 'firefox140'],
    sourcemap: true,
    minify: false, // Keep readable output for debugging user-reported issues
    modulePreload: false, // Disable entirely — modern browsers handle module loading; avoids __vitePreload helper polluting chunks
    rolldownOptions: {
      output: {
        manualChunks: function (id) {
          if (id.includes('node_modules')) {
            // Heavy WASM packages are dynamically imported in their
            // respective lib files — don't assign them to a named chunk
            // so the bundler creates separate lazy chunks automatically.
            const wasmPackages = [
              '7z-wasm',
              '@imagemagick',
              'libimagequant-wasm',
              'pdf-lib',
              '@uswriting/exiftool',
              'pandoc-wasm',
              '@myriaddreamin',
              'typst',
              'wasmagic',
              'hash-wasm',
              '@bjorn3',
              '@ffmpeg',
            ]
            if (wasmPackages.some((pkg) => id.includes(pkg))) {
              return undefined // let bundler handle naturally
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
      '@pdf-lib/fontkit',
      '@uswriting/exiftool',
      'hash-wasm',
      'pandoc-wasm',
      '@myriaddreamin/typst.ts',
      '@myriaddreamin/typst-ts-web-compiler',
    ],
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    ffmpegCorePlugin(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: false }),
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
