import type { Plugin } from 'vite'
import { toolPaths } from './src/lib/toolPaths.ts'

interface Engine {
  packages: string[]
  /** Asset basenames whose URLs are imported by app code rather than the engine. */
  assets?: string[]
  /** URLs used by engines that resolve their own sidecars. */
  static?: string[]
}

const engines = {
  magick: {
    packages: ['@imagemagick/magick-wasm'],
    assets: ['magick.wasm'],
  },
  png: { packages: ['libimagequant-wasm'] },
  subject: {
    packages: ['onnxruntime-web', 'onnxruntime-common'],
    assets: ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'],
    static: ['models/u2netp.onnx'],
  },
  exif: { packages: ['@uswriting/exiftool'], static: ['zeroperl.wasm'] },
  media: {
    packages: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    static: [
      'ffmpeg-core/ffmpeg-core.js',
      'ffmpeg-core/ffmpeg-core.wasm',
      'ffmpeg-core/ffmpeg-core.worker.js',
    ],
  },
  editPDF: { packages: ['pdf-lib'] },
  renderPDF: {
    packages: ['pdfjs-dist'],
    static: ['pdf-engines/pdfjs/pdf.worker.min.mjs'],
  },
  ocr: {
    packages: ['tesseract.js'],
    // Tesseract selects its core variant at runtime. Hint the common assets.
    static: [
      'pdf-engines/tesseract/worker.min.js',
      'pdf-engines/tesseract/eng.traineddata.gz',
    ],
  },
  word: { packages: ['docx'] },
  archive: { packages: ['7z-wasm'], assets: ['7zz.wasm'] },
  zip: { packages: ['fflate'] },
  office: {
    packages: [
      'pandoc-wasm',
      '@bjorn3/browser_wasi_shim',
      '@myriaddreamin/typst.ts',
      '@myriaddreamin/typst-ts-web-compiler',
    ],
    assets: ['pandoc.wasm', 'typst_ts_web_compiler_bg.wasm'],
  },
  hash: { packages: ['hash-wasm'] },
  mime: { packages: ['wasmagic'], static: ['libmagic-wrapper.wasm'] },
} satisfies Record<string, Engine>

const toolEngines = {
  imageResize: ['magick'],
  imageCompress: ['magick', 'png'],
  imageConvert: ['magick'],
  imageRedact: ['exif'],
  imageMetadata: ['magick', 'exif'],
  imageCrop: ['magick'],
  imageBatch: ['magick', 'zip'],
  imageBackground: ['subject', 'magick'],
  videoCompress: ['media'],
  videoConvert: ['media'],
  videoTrim: ['media'],
  videoExtract: ['media'],
  videoMetadata: ['media'],
  videoJoin: ['media'],
  audioConvert: ['media'],
  audioTrim: ['media'],
  audioJoin: ['media'],
  pdfMerge: ['editPDF'],
  pdfCompress: ['editPDF'],
  pdfSplit: ['editPDF', 'zip'],
  pdfOrganize: ['editPDF', 'renderPDF'],
  pdfFromImages: ['editPDF'],
  pdfToImages: ['editPDF', 'renderPDF', 'zip'],
  pdfOCR: ['editPDF', 'renderPDF', 'ocr'],
  pdfRedact: ['editPDF', 'renderPDF'],
  pdfSign: ['editPDF'],
  pdfWatermark: ['editPDF'],
  pdfToWord: ['editPDF', 'renderPDF', 'word'],
  documentConvert: ['office', 'archive', 'zip'],
  archiveCompress: ['archive'],
  archiveExtract: ['archive'],
  fileHash: ['hash'],
  fileMetadata: ['mime', 'exif'],
} satisfies Record<keyof typeof toolPaths, (keyof typeof engines)[]>

/** Record the actual hashed assets so runtime hints never import an engine. */
export function toolPrefetchPlugin(): Plugin {
  return {
    name: 'toolbox-engine-prefetch',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const entries = Object.values(bundle)
        const appShell = new Set<string>()
        const addShellChunk = (file: string) => {
          const chunk = bundle[file]
          if (appShell.has(file) || chunk?.type !== 'chunk') return
          appShell.add(file)
          for (const dep of chunk.imports) addShellChunk(dep)
        }
        for (const entry of entries) {
          if (entry.type === 'chunk' && entry.isEntry)
            addShellChunk(entry.fileName)
        }
        const assetsByEngine = new Map<string, Set<string>>()
        for (const [key, engine] of Object.entries<Engine>(engines)) {
          const files = new Set(engine.static)
          const addChunk = (file: string) => {
            const chunk = bundle[file]
            if (
              appShell.has(file) ||
              files.has(file) ||
              chunk?.type !== 'chunk'
            )
              return
            files.add(file)
            for (const dep of chunk.imports) addChunk(dep)
            for (const asset of chunk.viteMetadata?.importedAssets ?? [])
              files.add(asset)
          }
          for (const entry of entries) {
            if (entry.type === 'chunk') {
              if (
                entry.moduleIds.some((id) =>
                  engine.packages.some((pkg) =>
                    id.includes(`/node_modules/${pkg}/`),
                  ),
                )
              )
                addChunk(entry.fileName)
            } else if (
              engine.assets?.some((name) => entry.names.includes(name))
            ) {
              files.add(entry.fileName)
            }
          }
          assetsByEngine.set(key, files)
        }
        const manifest = Object.fromEntries(
          Object.entries(toolEngines).map(([tool, keys]) => [
            toolPaths[tool as keyof typeof toolPaths],
            [
              ...new Set(
                keys.flatMap((key) => [...(assetsByEngine.get(key) ?? [])]),
              ),
            ].sort(),
          ]),
        )
        this.emitFile({
          type: 'asset',
          fileName: 'tool-engine-prefetch.json',
          source: JSON.stringify(manifest),
        })
      },
    },
  }
}
