import { open } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

async function isGzipped(filePath: string): Promise<boolean> {
  let file
  try {
    file = await open(filePath, 'r')
    const signature = Buffer.alloc(2)
    await file.read(signature, 0, signature.length, 0)
    return signature[0] === 0x1f && signature[1] === 0x8b
  } catch {
    // Missing assets must reach Vite's normal fallback without gzip headers.
    return false
  } finally {
    await file?.close()
  }
}

/** Match the Worker's gzip handling without running it during Vite preview. */
export function wasmPreviewPlugin(): Plugin {
  return {
    name: 'wasm-preview-headers',
    configurePreviewServer(server) {
      const outDir = resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        let pathname: string
        try {
          pathname = decodeURIComponent(
            new URL(req.url ?? '/', 'http://localhost').pathname,
          )
        } catch {
          return next()
        }
        const base = server.config.base
        if (!pathname.startsWith(base) || !pathname.endsWith('.wasm'))
          return next()
        const filePath = resolve(outDir, pathname.slice(base.length))
        if (!filePath.startsWith(outDir + sep)) return next()

        // Run before Vite's compression/static middleware to avoid recompressing
        // files that scripts/compress-wasm.mjs already gzipped in place.
        void isGzipped(filePath).then((gzipped) => {
          if (gzipped) {
            res.setHeader('Content-Encoding', 'gzip')
            res.setHeader('Content-Type', 'application/wasm')
          }
          next()
        }, next)
      })
    },
  }
}
