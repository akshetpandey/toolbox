// @vitest-environment node

/**
 * E2E test for converting a real DOCX file to PDF via pandoc → typst pipeline.
 * This reproduces the exact browser conversion flow, including media extraction.
 */
import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { convert } from 'pandoc-wasm'
import {
  createTypstCompiler,
  type TypstCompiler,
  CompileFormatEnum,
} from '@myriaddreamin/typst.ts/compiler'
import { withAccessModel } from '@myriaddreamin/typst.ts/options.init'
import type { FsAccessModel } from '@myriaddreamin/typst.ts/internal.types'
import { extractZipEntries } from '../archive'

// ─── Access Model (mirrors production InMemoryAccessModel) ──────────────────

class TestAccessModel implements FsAccessModel {
  private files = new Map<string, Uint8Array>()

  setFiles(files: Record<string, Uint8Array>) {
    this.files.clear()
    for (const [path, data] of Object.entries(files)) {
      this.files.set(path, data)
    }
  }

  clear() {
    this.files.clear()
  }

  getMTime(path: string): Date | undefined {
    return this.files.has(path) ? new Date() : undefined
  }

  isFile(path: string): boolean | undefined {
    return this.files.has(path) ? true : undefined
  }

  getRealPath(path: string): string | undefined {
    return path
  }

  readAll(path: string): Uint8Array | undefined {
    return this.files.get(path)
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

const TYPST_WASM_PATH = resolve(
  __dirname,
  '../../../node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
)
const DOCX_PATH = resolve(__dirname, 'fixtures/DOCX_TestPage.docx')
const PROJECT_ROOT = '/project'

describe('DOCX → PDF full pipeline (e2e)', () => {
  let compiler: TypstCompiler
  const accessModel = new TestAccessModel()

  beforeAll(async () => {
    const wasmBinary = readFileSync(TYPST_WASM_PATH)
    compiler = createTypstCompiler()
    await compiler.init({
      beforeBuild: [withAccessModel(accessModel)],
      getModule: () => wasmBinary,
    })
  }, 30_000)

  test('pandoc extracts media as zip from DOCX', async () => {
    const docxBytes = readFileSync(DOCX_PATH)
    const docxBlob = new Blob([docxBytes])

    const result = await convert(
      {
        from: 'docx',
        to: 'typst',
        standalone: true,
        'input-files': ['DOCX_TestPage.docx'],
        'extract-media': 'media.zip',
      },
      null,
      { 'DOCX_TestPage.docx': docxBlob },
    )

    expect(result.stdout).toBeTruthy()
    // With .zip extension, pandoc bundles extracted images into a zip blob
    expect(result.files?.['media.zip']).toBeDefined()
    const mediaZip = result.files['media.zip'] as Blob
    expect(mediaZip.size).toBeGreaterThan(0)

    // Typst output should reference the extracted images
    expect(result.stdout).toContain('media/image1.png')
  })

  test('7z-wasm extracts images from pandoc media.zip', async () => {
    const docxBytes = readFileSync(DOCX_PATH)
    const docxBlob = new Blob([docxBytes])

    const result = await convert(
      {
        from: 'docx',
        to: 'typst',
        standalone: true,
        'input-files': ['DOCX_TestPage.docx'],
        'extract-media': 'media.zip',
      },
      null,
      { 'DOCX_TestPage.docx': docxBlob },
    )

    const mediaZip = result.files['media.zip'] as Blob
    const zipBytes = new Uint8Array(await mediaZip.arrayBuffer())
    const entries = await extractZipEntries(zipBytes)

    expect(Object.keys(entries).length).toBeGreaterThan(0)
    // DOCX_TestPage.docx contains image1.png
    expect(entries['media/image1.png']).toBeDefined()
    expect(entries['media/image1.png'].length).toBeGreaterThan(100)

    // Verify it's a real PNG (magic bytes: 89 50 4E 47)
    const png = entries['media/image1.png']
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50) // P
    expect(png[2]).toBe(0x4e) // N
    expect(png[3]).toBe(0x47) // G
  })

  test('full pipeline: DOCX with images → PDF', async () => {
    const docxBytes = readFileSync(DOCX_PATH)
    const docxBlob = new Blob([docxBytes])

    // Step 1: pandoc → typst with media extraction
    const pandocResult = await convert(
      {
        from: 'docx',
        to: 'typst',
        standalone: true,
        'input-files': ['DOCX_TestPage.docx'],
        'extract-media': 'media.zip',
      },
      null,
      { 'DOCX_TestPage.docx': docxBlob },
    )

    expect(pandocResult.stdout).toBeTruthy()

    // Step 2: extract images from media.zip using 7z-wasm
    const resourceFiles: Record<string, Uint8Array> = {}
    const mediaZip = pandocResult.files?.['media.zip']
    if (mediaZip instanceof Blob && mediaZip.size > 0) {
      const zipBytes = new Uint8Array(await mediaZip.arrayBuffer())
      const entries = await extractZipEntries(zipBytes)
      for (const [path, data] of Object.entries(entries)) {
        resourceFiles[path] = data
        if (!path.startsWith('./')) {
          resourceFiles[`./${path}`] = data
        }
      }
    }

    expect(Object.keys(resourceFiles).length).toBeGreaterThan(0)

    // Step 3: typst → PDF
    compiler.resetShadow()

    const accessFiles: Record<string, Uint8Array> = {}
    for (const [path, data] of Object.entries(resourceFiles)) {
      const prefixed = `${PROJECT_ROOT}/${path}`
      accessFiles[prefixed] = data
      accessFiles['/' + path] = data
      accessFiles[path] = data
      compiler.mapShadow(prefixed, data)
      compiler.mapShadow('/' + path, data)
      if (!path.startsWith('/')) {
        compiler.mapShadow(path, data)
      }
    }
    accessModel.setFiles(accessFiles)

    const mainPath = `${PROJECT_ROOT}/main.typ`
    compiler.mapShadow(mainPath, new TextEncoder().encode(pandocResult.stdout))

    const result = await compiler.compile({
      mainFilePath: mainPath,
      root: PROJECT_ROOT,
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    })

    accessModel.clear()

    if (!result.result) {
      const messages =
        result.diagnostics?.map((d) => d.message).filter(Boolean) ?? []
      throw new Error(
        `Typst compilation failed: ${messages.join('; ') || 'no output'}`,
      )
    }

    expect(result.result).toBeInstanceOf(Uint8Array)
    expect(result.result.length).toBeGreaterThan(100)

    // Verify PDF header
    const header = new TextDecoder().decode(result.result.slice(0, 5))
    expect(header).toBe('%PDF-')
  })
})
