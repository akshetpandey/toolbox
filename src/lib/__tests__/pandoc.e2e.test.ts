// @vitest-environment node

/**
 * E2E tests for pandoc-wasm.
 * These tests use the real pandoc WASM binary to convert documents.
 */
import { describe, test, expect } from 'vitest'
import { convert } from 'pandoc-wasm'

// ─── Basic format conversions ───────────────────────────────────────────────

describe('pandoc-wasm convert (e2e)', () => {
  test('converts markdown to HTML', async () => {
    const result = await convert(
      { from: 'markdown', to: 'html' },
      '# Hello World\n\nThis is a **test**.',
      {},
    )

    expect(result.stdout).toContain('<h1')
    expect(result.stdout).toContain('Hello World')
    expect(result.stdout).toContain('<strong>test</strong>')
  })

  test('converts markdown to typst', async () => {
    const result = await convert(
      { from: 'markdown', to: 'typst', standalone: true },
      '# Hello World\n\nThis is a **test** paragraph.',
      {},
    )

    expect(result.stdout).toBeTruthy()
    // Typst headings use = prefix
    expect(result.stdout).toContain('Hello World')
    // Typst bold uses #strong[]
    expect(result.stdout).toContain('strong')
  })

  test('converts markdown with lists to typst', async () => {
    const markdown = `# My List

- Item one
- Item two
- Item three

1. First
2. Second
`
    const result = await convert(
      { from: 'markdown', to: 'typst', standalone: true },
      markdown,
      {},
    )

    expect(result.stdout).toBeTruthy()
    expect(result.stdout).toContain('Item one')
    expect(result.stdout).toContain('Item two')
  })

  test('uses input-files option for file-based conversion', async () => {
    // Create a simple text file and convert via input-files
    const result = await convert(
      {
        from: 'markdown',
        to: 'html',
        'input-files': ['test.md'],
      },
      null,
      {
        'test.md': new Blob(['# From File\n\nFile content here.']),
      },
    )

    expect(result.stdout).toContain('From File')
    expect(result.stdout).toContain('File content here')
  })

  test('converts markdown to latex', async () => {
    const result = await convert(
      { from: 'markdown', to: 'latex', standalone: true },
      '# Title\n\nSome text.',
      {},
    )

    expect(result.stdout).toContain('\\begin{document}')
    expect(result.stdout).toContain('Title')
  })

  test('returns stderr for warnings', async () => {
    // Convert something that may produce warnings
    const result = await convert(
      { from: 'markdown', to: 'html' },
      'Simple text',
      {},
    )

    // Should succeed even if there are warnings
    expect(result.stdout).toBeTruthy()
    expect(typeof result.stderr).toBe('string')
  })
})

// ─── File-based conversions (simulating office documents) ───────────────────

describe('pandoc-wasm file conversions (e2e)', () => {
  test('converts a docx-like file with input-files', async () => {
    // We can't easily create a real docx in a test, but we can test
    // the input-files mechanism with markdown files stored as blobs
    const markdownBlob = new Blob([
      '# Test Document\n\nThis tests the input-files pipeline.',
    ])

    const result = await convert(
      {
        from: 'markdown',
        to: 'typst',
        standalone: true,
        'input-files': ['document.md'],
      },
      null,
      { 'document.md': markdownBlob },
    )

    expect(result.stdout).toBeTruthy()
    expect(result.stdout).toContain('Test Document')
  })

  test('handles multiple input files', async () => {
    const file1 = new Blob(['# Part One\n\nFirst part.'])
    const file2 = new Blob(['# Part Two\n\nSecond part.'])

    const result = await convert(
      {
        from: 'markdown',
        to: 'html',
        'input-files': ['part1.md', 'part2.md'],
      },
      null,
      {
        'part1.md': file1,
        'part2.md': file2,
      },
    )

    expect(result.stdout).toContain('Part One')
    expect(result.stdout).toContain('Part Two')
  })

  test('converts with standalone option producing full document', async () => {
    const result = await convert(
      { from: 'markdown', to: 'html', standalone: true },
      '# Standalone Test',
      {},
    )

    expect(result.stdout).toContain('<!DOCTYPE html>')
    expect(result.stdout).toContain('Standalone Test')
  })

  test('converts with table-of-contents option', async () => {
    const result = await convert(
      {
        from: 'markdown',
        to: 'html',
        standalone: true,
        'table-of-contents': true,
      },
      '# Chapter 1\n\nText.\n\n# Chapter 2\n\nMore text.',
      {},
    )

    expect(result.stdout).toContain('Chapter 1')
    expect(result.stdout).toContain('Chapter 2')
  })
})
