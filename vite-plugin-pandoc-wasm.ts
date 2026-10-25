import type { Plugin } from 'vite'

/** Pandoc instantiates WASI itself and expects its WASM import to return a URL. */
export function pandocWasmPlugin(): Plugin {
  return {
    name: 'pandoc-wasm-url',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (source === './pandoc.wasm' && importer?.includes('/pandoc-wasm/')) {
        // Vite 8.3 treats bare WASM imports as ES modules. Keep Pandoc's
        // binary as an asset so its own browser WASI shim can load it.
        return this.resolve(`${source}?url`, importer, { skipSelf: true })
      }
    },
  }
}
