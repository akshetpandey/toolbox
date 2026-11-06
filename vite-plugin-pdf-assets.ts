import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'

export function pdfAssetsPlugin(): Plugin {
  const require = createRequire(import.meta.url)
  const root = 'pdf-engines'
  const pdfjs = dirname(require.resolve('pdfjs-dist/package.json'))
  const tesseract = dirname(require.resolve('tesseract.js/package.json'))
  const core = dirname(require.resolve('tesseract.js-core/package.json'))
  const english = dirname(
    require.resolve('@tesseract.js-data/eng/package.json'),
  )

  const assets = new Map<string, string>()
  const add = (engine: string, filename: string, source: string) => {
    assets.set(`/${root}/${engine}/${filename}`, source)
  }
  add(
    'pdfjs',
    'pdf.worker.min.mjs',
    resolve(pdfjs, 'legacy/build/pdf.worker.min.mjs'),
  )
  add('pdfjs', 'LICENSE', resolve(pdfjs, 'LICENSE'))
  for (const folder of ['cmaps', 'iccs', 'standard_fonts', 'wasm']) {
    const source = resolve(pdfjs, folder)
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith('quickjs')) continue
      add('pdfjs', `${folder}/${entry.name}`, resolve(source, entry.name))
    }
  }

  add('tesseract', 'worker.min.js', resolve(tesseract, 'dist/worker.min.js'))
  add(
    'tesseract',
    'worker.min.js.LICENSE.txt',
    resolve(tesseract, 'dist/worker.min.js.LICENSE.txt'),
  )
  add('tesseract', 'LICENSE', resolve(core, 'LICENSE'))
  for (const variant of ['', '-simd', '-relaxedsimd']) {
    const filename = `tesseract-core${variant}-lstm.wasm.js`
    add('tesseract', filename, resolve(core, filename))
  }
  add(
    'tesseract',
    'eng.traineddata.gz',
    resolve(english, '4.0.0_best_int/eng.traineddata.gz'),
  )

  return {
    name: 'toolbox-pdf-engines',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next()
        const pathname = request.url?.split('?')[0]
        const file = pathname && assets.get(pathname)
        if (!file) return next()
        // These responses bypass Vite's static middleware. The workers need
        // the same isolation headers as the page that creates them.
        for (const [name, value] of Object.entries(
          server.config.server.headers ?? {},
        )) {
          if (value !== undefined) response.setHeader(name, value)
        }
        const data = readFileSync(file)
        response.setHeader('Content-Length', data.length)
        response.setHeader(
          'Content-Type',
          /\.m?js$/.test(file)
            ? 'text/javascript'
            : file.endsWith('.wasm')
              ? 'application/wasm'
              : 'application/octet-stream',
        )
        response.end(request.method === 'HEAD' ? undefined : data)
      })
    },
    generateBundle() {
      for (const [pathname, file] of assets) {
        this.emitFile({
          type: 'asset',
          fileName: pathname.slice(1),
          source: readFileSync(file),
        })
      }
    },
  }
}
