// @vitest-environment node

/**
 * E2E tests for 7z-wasm archive operations.
 * These tests use the real 7z-wasm library to compress and decompress archives.
 */
import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { SevenZipModule } from '7z-wasm'

const fixturesDir = resolve(__dirname, 'fixtures')

// ─── 7z-wasm loader ────────────────────────────────────────────────────────

let sevenZip: SevenZipModule

beforeAll(async () => {
  const { default: SevenZip } = await import('7z-wasm')
  sevenZip = await SevenZip()
}, 30_000)

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeTestFile(name: string, data: Uint8Array) {
  sevenZip.FS.writeFile(name, data)
}

function readArchiveFile(name: string): Uint8Array {
  return sevenZip.FS.readFile(name)
}

function cleanup(...names: string[]) {
  for (const name of names) {
    try {
      sevenZip.FS.unlink(name)
    } catch {
      // ignore
    }
  }
}

function cleanupDir(dirPath: string) {
  try {
    const entries = sevenZip.FS.readdir(dirPath)
    for (const entry of entries) {
      if (entry === '.' || entry === '..') continue
      const fullPath = `${dirPath}/${entry}`
      try {
        const stat = sevenZip.FS.stat(fullPath)
        if (sevenZip.FS.isDir(stat.mode)) {
          cleanupDir(fullPath)
          sevenZip.FS.rmdir(fullPath)
        } else {
          sevenZip.FS.unlink(fullPath)
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('7z-wasm archive operations (e2e)', () => {
  const sampleTxt = readFileSync(resolve(fixturesDir, 'sample.txt'))
  const samplePng = readFileSync(resolve(fixturesDir, 'sample.png'))

  describe('ZIP format', () => {
    test('compresses files to ZIP and decompresses', () => {
      // Compress
      writeTestFile('input.txt', new Uint8Array(sampleTxt))
      writeTestFile('input.png', new Uint8Array(samplePng))

      sevenZip.callMain(['a', '-tzip', 'output.zip', 'input.txt', 'input.png'])
      const zipData = readArchiveFile('output.zip')

      expect(zipData.length).toBeGreaterThan(0)
      // ZIP magic bytes: PK (0x50 0x4B)
      expect(zipData[0]).toBe(0x50)
      expect(zipData[1]).toBe(0x4b)

      // Decompress
      try {
        sevenZip.FS.mkdir('zip_out')
      } catch {
        // exists
      }
      sevenZip.callMain(['x', 'output.zip', '-ozip_out', '-y'])

      const extractedTxt = sevenZip.FS.readFile('zip_out/input.txt')
      const extractedPng = sevenZip.FS.readFile('zip_out/input.png')

      expect(extractedTxt).toEqual(new Uint8Array(sampleTxt))
      expect(extractedPng).toEqual(new Uint8Array(samplePng))

      // Cleanup
      cleanupDir('zip_out')
      try {
        sevenZip.FS.rmdir('zip_out')
      } catch {
        // ignore
      }
      cleanup('input.txt', 'input.png', 'output.zip')
    })

    test('decompresses an existing ZIP file', () => {
      const zipData = readFileSync(resolve(fixturesDir, 'sample.zip'))
      writeTestFile('fixture.zip', new Uint8Array(zipData))

      try {
        sevenZip.FS.mkdir('fixture_out')
      } catch {
        // exists
      }
      sevenZip.callMain(['x', 'fixture.zip', '-ofixture_out', '-y'])

      const extracted = sevenZip.FS.readFile('fixture_out/sample.txt')
      expect(extracted).toEqual(new Uint8Array(sampleTxt))

      cleanupDir('fixture_out')
      try {
        sevenZip.FS.rmdir('fixture_out')
      } catch {
        // ignore
      }
      cleanup('fixture.zip')
    })
  })

  describe('7z format', () => {
    test('compresses files to 7z and decompresses', () => {
      writeTestFile('input7.txt', new Uint8Array(sampleTxt))

      sevenZip.callMain(['a', '-t7z', 'output.7z', 'input7.txt'])
      const szData = readArchiveFile('output.7z')

      expect(szData.length).toBeGreaterThan(0)
      // 7z magic bytes: 7z (0x37 0x7A 0xBC 0xAF)
      expect(szData[0]).toBe(0x37)
      expect(szData[1]).toBe(0x7a)
      expect(szData[2]).toBe(0xbc)
      expect(szData[3]).toBe(0xaf)

      // Decompress
      try {
        sevenZip.FS.mkdir('sz_out')
      } catch {
        // exists
      }
      sevenZip.callMain(['x', 'output.7z', '-osz_out', '-y'])

      const extracted = sevenZip.FS.readFile('sz_out/input7.txt')
      expect(extracted).toEqual(new Uint8Array(sampleTxt))

      cleanupDir('sz_out')
      try {
        sevenZip.FS.rmdir('sz_out')
      } catch {
        // ignore
      }
      cleanup('input7.txt', 'output.7z')
    })
  })

  describe('TAR format', () => {
    test('compresses files to TAR and decompresses', () => {
      writeTestFile('input_tar.txt', new Uint8Array(sampleTxt))

      sevenZip.callMain(['a', '-ttar', 'output.tar', 'input_tar.txt'])
      const tarData = readArchiveFile('output.tar')

      expect(tarData.length).toBeGreaterThan(0)

      // Decompress
      try {
        sevenZip.FS.mkdir('tar_out')
      } catch {
        // exists
      }
      sevenZip.callMain(['x', 'output.tar', '-otar_out', '-y'])

      const extracted = sevenZip.FS.readFile('tar_out/input_tar.txt')
      expect(extracted).toEqual(new Uint8Array(sampleTxt))

      cleanupDir('tar_out')
      try {
        sevenZip.FS.rmdir('tar_out')
      } catch {
        // ignore
      }
      cleanup('input_tar.txt', 'output.tar')
    })
  })

  describe('GZIP (tar.gz) format', () => {
    test('compresses to tar then gzips, and decompresses', () => {
      writeTestFile('input_gz.txt', new Uint8Array(sampleTxt))

      // Create tar first
      sevenZip.callMain(['a', '-ttar', 'output_gz.tar', 'input_gz.txt'])
      // Then gzip
      sevenZip.callMain(['a', '-tgzip', 'output_gz.tar.gz', 'output_gz.tar'])
      const gzData = readArchiveFile('output_gz.tar.gz')

      expect(gzData.length).toBeGreaterThan(0)
      // Gzip magic bytes: 0x1F 0x8B
      expect(gzData[0]).toBe(0x1f)
      expect(gzData[1]).toBe(0x8b)

      // Decompress gzip first
      sevenZip.callMain(['x', 'output_gz.tar.gz', '-y'])
      // Then extract tar
      try {
        sevenZip.FS.mkdir('gz_out')
      } catch {
        // exists
      }
      sevenZip.callMain(['x', 'output_gz.tar', '-ogz_out', '-y'])

      const extracted = sevenZip.FS.readFile('gz_out/input_gz.txt')
      expect(extracted).toEqual(new Uint8Array(sampleTxt))

      cleanupDir('gz_out')
      try {
        sevenZip.FS.rmdir('gz_out')
      } catch {
        // ignore
      }
      cleanup('input_gz.txt', 'output_gz.tar', 'output_gz.tar.gz')
    })
  })

  describe('multiple files and directories', () => {
    test('compresses multiple files into a single archive', () => {
      writeTestFile('multi_a.txt', new Uint8Array(sampleTxt))
      writeTestFile('multi_b.png', new Uint8Array(samplePng))

      sevenZip.callMain([
        'a',
        '-tzip',
        'multi.zip',
        'multi_a.txt',
        'multi_b.png',
      ])
      const zipData = readArchiveFile('multi.zip')
      expect(zipData.length).toBeGreaterThan(0)

      // Decompress and verify both files
      try {
        sevenZip.FS.mkdir('multi_out')
      } catch {
        // exists
      }
      sevenZip.callMain(['x', 'multi.zip', '-omulti_out', '-y'])

      const aTxt = sevenZip.FS.readFile('multi_out/multi_a.txt')
      const bPng = sevenZip.FS.readFile('multi_out/multi_b.png')
      expect(aTxt).toEqual(new Uint8Array(sampleTxt))
      expect(bPng).toEqual(new Uint8Array(samplePng))

      cleanupDir('multi_out')
      try {
        sevenZip.FS.rmdir('multi_out')
      } catch {
        // ignore
      }
      cleanup('multi_a.txt', 'multi_b.png', 'multi.zip')
    })
  })
})

describe('extractZipEntries (e2e)', () => {
  test('extracts files from a ZIP using 7z-wasm', async () => {
    const { extractZipEntries } = await import('../archive')
    const zipData = readFileSync(resolve(fixturesDir, 'sample.zip'))
    const entries = await extractZipEntries(new Uint8Array(zipData))

    expect(entries['sample.txt']).toBeDefined()
    const sampleTxt = readFileSync(resolve(fixturesDir, 'sample.txt'))
    expect(entries['sample.txt']).toEqual(new Uint8Array(sampleTxt))
  })

  test('extracts nested files from a ZIP', async () => {
    const { extractZipEntries } = await import('../archive')

    // First create a zip with nested structure using 7z-wasm
    const { default: SevenZip } = await import('7z-wasm')
    const sz = await SevenZip()

    const content = new TextEncoder().encode('nested file content')
    try {
      sz.FS.mkdir('subdir')
    } catch {
      // exists
    }
    sz.FS.writeFile('subdir/nested.txt', content)
    sz.FS.writeFile('root.txt', content)
    sz.callMain(['a', '-tzip', 'nested.zip', 'subdir/nested.txt', 'root.txt'])
    const zipData = sz.FS.readFile('nested.zip')

    const entries = await extractZipEntries(zipData)

    expect(entries['root.txt']).toBeDefined()
    expect(entries['subdir/nested.txt']).toBeDefined()
    expect(new TextDecoder().decode(entries['root.txt'])).toBe(
      'nested file content',
    )
    expect(new TextDecoder().decode(entries['subdir/nested.txt'])).toBe(
      'nested file content',
    )

    // Cleanup
    try {
      sz.FS.unlink('subdir/nested.txt')
      sz.FS.rmdir('subdir')
      sz.FS.unlink('root.txt')
      sz.FS.unlink('nested.zip')
    } catch {
      // ignore
    }
  })
})
