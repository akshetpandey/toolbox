import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import tailwindcss from '@tailwindcss/vite'
import { ffmpegCorePlugin } from './vite-plugin-ffmpeg-core.ts'
import { pandocWasmPlugin } from './vite-plugin-pandoc-wasm.ts'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // Discover React component-test dependencies before Chromium starts so
    // first-run optimization cannot reload the page during test collection.
    include: [
      '@radix-ui/react-slot',
      '@testing-library/react',
      'class-variance-authority',
      'clsx',
      'lucide-react',
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'tailwind-merge',
    ],
    exclude: [
      '@ffmpeg/core-mt',
      '@ffmpeg/ffmpeg',
      '@ffmpeg/util',
      'pandoc-wasm',
      '7z-wasm',
      '@imagemagick/magick-wasm',
      'libimagequant-wasm',
      '@uswriting/exiftool',
      'hash-wasm',
      '@myriaddreamin/typst.ts',
      '@myriaddreamin/typst-ts-web-compiler',
    ],
  },
  plugins: [ffmpegCorePlugin(), pandocWasmPlugin(), tailwindcss()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    include: ['src/**/*.browser.test.{ts,tsx}'],
    globals: false,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
    // Longer timeouts for WASM loading from local package
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
