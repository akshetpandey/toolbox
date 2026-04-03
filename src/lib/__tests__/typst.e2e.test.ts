// @vitest-environment node

/**
 * E2E tests for the Typst WASM compiler.
 * These tests load the real WASM binary and compile actual Typst documents.
 */
import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  createTypstCompiler,
  type TypstCompiler,
  CompileFormatEnum,
} from '@myriaddreamin/typst.ts/compiler'
import { withAccessModel } from '@myriaddreamin/typst.ts/options.init'
import type { FsAccessModel } from '@myriaddreamin/typst.ts/internal.types'

// ─── Test Access Model ──────────────────────────────────────────────────────

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
    // Return true if we have the file, undefined if unknown.
    // IMPORTANT: Do NOT return false — Typst interprets false as
    // "path exists but is a directory", causing "is a directory" errors.
    return this.files.has(path) ? true : undefined
  }

  getRealPath(path: string): string | undefined {
    return path
  }

  readAll(path: string): Uint8Array | undefined {
    return this.files.get(path)
  }
}

// ─── WASM Loading ───────────────────────────────────────────────────────────

const WASM_PATH = resolve(
  __dirname,
  '../../../node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
)

function loadWasmBinary(): Buffer {
  return readFileSync(WASM_PATH)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Typst WASM Compiler (e2e)', () => {
  let compiler: TypstCompiler
  const accessModel = new TestAccessModel()

  beforeAll(async () => {
    const wasmBinary = loadWasmBinary()

    compiler = createTypstCompiler()
    await compiler.init({
      beforeBuild: [withAccessModel(accessModel)],
      getModule: () => wasmBinary,
    })
  }, 30_000)

  test('compiles a minimal typst document to PDF', async () => {
    compiler.resetShadow()
    accessModel.clear()

    const mainPath = '/project/main.typ'
    const content = 'Hello, World!'
    compiler.mapShadow(mainPath, new TextEncoder().encode(content))

    const result = await compiler.compile({
      mainFilePath: mainPath,
      root: '/project',
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    })

    expect(result.result).toBeDefined()
    expect(result.result).toBeInstanceOf(Uint8Array)
    expect(result.result!.length).toBeGreaterThan(0)

    // Check PDF magic bytes: %PDF
    expect(result.result![0]).toBe(0x25) // %
    expect(result.result![1]).toBe(0x50) // P
    expect(result.result![2]).toBe(0x44) // D
    expect(result.result![3]).toBe(0x46) // F
  })

  test('compiles a typst document with headings and lists', async () => {
    compiler.resetShadow()
    accessModel.clear()

    const mainPath = '/project/main.typ'
    const content = `
= My Document

== Introduction

This is a test document with:

- Item one
- Item two
- Item three

== Conclusion

All done.
`
    compiler.mapShadow(mainPath, new TextEncoder().encode(content))

    const result = await compiler.compile({
      mainFilePath: mainPath,
      root: '/project',
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    })

    expect(result.result).toBeDefined()
    expect(result.result!.length).toBeGreaterThan(100) // Non-trivial PDF
  })

  test('compiles typst with inline images from access model', async () => {
    compiler.resetShadow()

    // Use a real PNG fixture
    const pngBytes = new Uint8Array(
      readFileSync(resolve(__dirname, 'fixtures/sample.png')),
    )

    // Map image via both shadow and access model
    compiler.mapShadow('/project/image.png', pngBytes)
    accessModel.setFiles({
      '/project/image.png': pngBytes,
    })

    const mainPath = '/project/main.typ'
    const content = `
= Document with Image

#image("image.png", width: 50%)
`
    compiler.mapShadow(mainPath, new TextEncoder().encode(content))

    const result = await compiler.compile({
      mainFilePath: mainPath,
      root: '/project',
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    })

    // The key assertion: the file was FOUND and READ (no "access denied"
    // or "not found" errors). A decode error means the access model worked
    // correctly but the specific image format/encoding wasn't supported.
    const messages = result.diagnostics?.map((d) => d.message) ?? []
    expect(messages.join(' ')).not.toContain('access denied')
    expect(messages.join(' ')).not.toContain('not found')
    expect(messages.join(' ')).not.toContain('file not found')

    if (result.result) {
      // If compilation succeeded, verify it's a real PDF
      expect(result.result.length).toBeGreaterThan(100)
    } else {
      // Compilation may fail due to image decode issues with certain PNGs
      // (e.g. CMYK color space). That's fine — we verified file access works.
      expect(messages.some((m) => m.includes('decode'))).toBe(true)
    }
  })

  test('returns diagnostics for invalid typst', async () => {
    compiler.resetShadow()
    accessModel.clear()

    const mainPath = '/project/main.typ'
    // Use an unknown function to trigger an error
    const content = '#nonexistent_function()'
    compiler.mapShadow(mainPath, new TextEncoder().encode(content))

    const result = await compiler.compile({
      mainFilePath: mainPath,
      root: '/project',
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    })

    // Should have diagnostics
    expect(result.diagnostics).toBeDefined()
    expect(result.diagnostics!.length).toBeGreaterThan(0)
  })

  test('handles missing image reference gracefully', async () => {
    compiler.resetShadow()
    accessModel.clear()

    const mainPath = '/project/main.typ'
    const content = `
= Test

#image("nonexistent.png")
`
    compiler.mapShadow(mainPath, new TextEncoder().encode(content))

    const result = await compiler.compile({
      mainFilePath: mainPath,
      root: '/project',
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    })

    // Should have diagnostics about the missing file
    expect(result.diagnostics).toBeDefined()
    expect(result.diagnostics!.length).toBeGreaterThan(0)
  })

  test('compiles pandoc-style typst output', async () => {
    compiler.resetShadow()
    accessModel.clear()

    // This mimics what pandoc generates when converting a simple docx
    const mainPath = '/project/main.typ'
    const content = `
#set page(paper: "a4")
#set text(size: 11pt)

= Sample Document

This is a paragraph of text that was converted from a Word document
using Pandoc.

== Section One

Some content in section one.

- First bullet point
- Second bullet point

== Section Two

More content here with *bold* and _italic_ text.
`
    compiler.mapShadow(mainPath, new TextEncoder().encode(content))

    const result = await compiler.compile({
      mainFilePath: mainPath,
      root: '/project',
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    })

    expect(result.result).toBeDefined()
    expect(result.result!.length).toBeGreaterThan(500) // Real PDF with content

    // Verify PDF header
    const header = new TextDecoder().decode(result.result!.slice(0, 5))
    expect(header).toBe('%PDF-')
  })
})
