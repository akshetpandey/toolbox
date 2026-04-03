// @vitest-environment node

/**
 * E2E integration tests for the pandoc → typst → PDF pipeline.
 * These tests exercise the full conversion chain with real WASM modules.
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

// ─── Shared Access Model ────────────────────────────────────────────────────

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

// ─── WASM Setup ─────────────────────────────────────────────────────────────

const TYPST_WASM_PATH = resolve(
  __dirname,
  '../../../node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
)

const PROJECT_ROOT = '/project'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Pandoc → Typst → PDF pipeline (e2e)', () => {
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

  /**
   * Helper: run the full pandoc → typst → PDF pipeline on markdown input.
   */
  async function convertMarkdownToPDF(markdown: string): Promise<Uint8Array> {
    // Step 1: Pandoc — markdown → typst
    const pandocResult = await convert(
      {
        from: 'markdown',
        to: 'typst',
        standalone: true,
        'input-files': ['input.md'],
      },
      null,
      { 'input.md': new Blob([markdown]) },
    )

    if (!pandocResult.stdout) {
      throw new Error(
        'Pandoc produced no output' +
          (pandocResult.stderr ? `: ${pandocResult.stderr}` : ''),
      )
    }

    // Step 2: Collect resource files from pandoc
    const resourceFiles: Record<string, Uint8Array> = {}
    if (pandocResult.mediaFiles) {
      for (const [path, blob] of Object.entries(pandocResult.mediaFiles)) {
        const buf = await blob.arrayBuffer()
        resourceFiles[path] = new Uint8Array(buf)
      }
    }

    // Step 3: Typst — compile to PDF
    compiler.resetShadow()

    const accessFiles: Record<string, Uint8Array> = {}
    for (const [path, data] of Object.entries(resourceFiles)) {
      const prefixed = `${PROJECT_ROOT}/${path}`
      accessFiles[prefixed] = data
      accessFiles['/' + path] = data
      compiler.mapShadow(prefixed, data)
      compiler.mapShadow('/' + path, data)
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

    return result.result
  }

  test('converts simple markdown to PDF', async () => {
    const pdf = await convertMarkdownToPDF(
      '# Hello World\n\nThis is a simple test.',
    )

    expect(pdf).toBeInstanceOf(Uint8Array)
    expect(pdf.length).toBeGreaterThan(100)

    // Verify PDF header
    const header = new TextDecoder().decode(pdf.slice(0, 5))
    expect(header).toBe('%PDF-')
  })

  test('converts markdown with formatting to PDF', async () => {
    const pdf = await convertMarkdownToPDF(`
# My Document

## Introduction

This document has **bold**, *italic*, and \`code\` formatting.

## Lists

- Item one
- Item two
- Item three

## Numbered

1. First thing
2. Second thing
3. Third thing
`)

    expect(pdf).toBeInstanceOf(Uint8Array)
    expect(pdf.length).toBeGreaterThan(500)
  })

  test('converts markdown with table to PDF', async () => {
    const pdf = await convertMarkdownToPDF(`
# Table Example

| Name  | Age | City     |
|-------|-----|----------|
| Alice | 30  | New York |
| Bob   | 25  | London   |
`)

    expect(pdf).toBeInstanceOf(Uint8Array)
    expect(pdf.length).toBeGreaterThan(100)
  })

  test('converts markdown with blockquote to PDF', async () => {
    const pdf = await convertMarkdownToPDF(`
# Quotes

> This is a blockquote.
> It can span multiple lines.

Normal text follows.
`)

    expect(pdf).toBeInstanceOf(Uint8Array)
    expect(pdf.length).toBeGreaterThan(100)
  })

  test('handles empty document', async () => {
    const pdf = await convertMarkdownToPDF('')

    // Even an empty document should produce a valid PDF (with just a blank page)
    expect(pdf).toBeInstanceOf(Uint8Array)
    expect(pdf.length).toBeGreaterThan(0)
  })

  test('pandoc typst output is valid typst markup', async () => {
    const pandocResult = await convert(
      { from: 'markdown', to: 'typst', standalone: true },
      '# Test\n\nParagraph with **bold** text.',
      {},
    )

    expect(pandocResult.stdout).toBeTruthy()

    // Should contain typst-specific constructs
    const typst = pandocResult.stdout
    expect(typst).toContain('Test')
    expect(typst).toContain('bold')
    // Standalone typst should have some page/document setup
    expect(typst.length).toBeGreaterThan(20)

    // Verify this compiles without errors
    compiler.resetShadow()
    accessModel.clear()

    const mainPath = `${PROJECT_ROOT}/main.typ`
    compiler.mapShadow(mainPath, new TextEncoder().encode(typst))

    const result = await compiler.compile({
      mainFilePath: mainPath,
      root: PROJECT_ROOT,
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    })

    // Should succeed without errors
    const errors = result.diagnostics?.filter((d) => d.severity === 'error')
    expect(errors ?? []).toHaveLength(0)
    expect(result.result).toBeDefined()
  })
})
