import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { ffmpegCorePlugin } from './vite-plugin-ffmpeg-core'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/core-mt', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  plugins: [ffmpegCorePlugin()],
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
