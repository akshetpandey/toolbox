/**
 * Vite plugin that serves @ffmpeg/core-mt files from node_modules
 * as raw static assets (no Vite transformation).
 *
 * In dev/test: middleware intercepts /ffmpeg-core/* requests and serves from node_modules.
 * In production build: files are emitted to the output as assets.
 *
 * This replaces loading from unpkg CDN, ensuring the app works offline
 * and tests catch WASM package upgrade breakages.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'
import type { Plugin, Connect } from 'vite'

const FFMPEG_FILES: Record<string, string> = {
  'ffmpeg-core.js': 'text/javascript',
  'ffmpeg-core.wasm': 'application/wasm',
  'ffmpeg-core.worker.js': 'text/javascript',
}

function resolveFFmpegDir(): string {
  // Use createRequire to resolve through pnpm's module structure
  const require = createRequire(import.meta.url)
  const coreEntry = require.resolve('@ffmpeg/core-mt')
  // coreEntry points to dist/umd/ffmpeg-core.js or dist/esm/ffmpeg-core.js
  // Go up to package root and use esm dist
  const pkgDir = coreEntry.replace(/[/\\]dist[/\\].*$/, '')
  return resolve(pkgDir, 'dist/esm')
}

export function ffmpegCorePlugin(): Plugin {
  const ffmpegDir = resolveFFmpegDir()

  return {
    name: 'ffmpeg-core-serve',

    configureServer(server) {
      const handler: Connect.NextHandleFunction = (req, res, next) => {
        const match = req.url?.match(/^\/ffmpeg-core\/(.+?)(?:\?.*)?$/)
        if (match && match[1] in FFMPEG_FILES) {
          const fileName = match[1]
          const filePath = resolve(ffmpegDir, fileName)
          const data = readFileSync(filePath)
          res.setHeader('Content-Type', FFMPEG_FILES[fileName])
          res.setHeader('Content-Length', data.length.toString())
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          res.end(data)
          return
        }
        next()
      }
      server.middlewares.use(handler)
    },

    generateBundle() {
      for (const [name] of Object.entries(FFMPEG_FILES)) {
        this.emitFile({
          type: 'asset',
          fileName: `ffmpeg-core/${name}`,
          source: readFileSync(resolve(ffmpegDir, name)),
        })
      }
    },
  }
}
