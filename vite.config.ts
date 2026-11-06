import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { ffmpegCorePlugin } from './vite-plugin-ffmpeg-core.ts'
import { pandocWasmPlugin } from './vite-plugin-pandoc-wasm.ts'
import { wasmPreviewPlugin } from './vite-plugin-wasm-preview.ts'
import { seoPagesPlugin } from './vite-plugin-seo-pages.ts'
import { pdfAssetsPlugin } from './vite-plugin-pdf-assets.ts'
import { toolPrefetchPlugin } from './vite-plugin-tool-prefetch.ts'

export default defineConfig({
  build: {
    target: ['chrome135', 'safari26', 'firefox140'],
    sourcemap: true,
    modulePreload: { polyfill: false },
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
      'pdfjs-dist',
      'tesseract.js',
      'tesseract.js-core',
      'onnxruntime-web/wasm',
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
    pandocWasmPlugin(),
    pdfAssetsPlugin(),
    toolPrefetchPlugin(),
    wasmPreviewPlugin(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    seoPagesPlugin(),
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
