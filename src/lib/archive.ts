import type { SevenZipModule } from '7z-wasm'

// Promise singleton to prevent duplicate WASM init from concurrent calls
let _sevenZip: SevenZipModule | null = null
let _sevenZipPromise: Promise<SevenZipModule> | null = null

async function loadSevenZip(): Promise<SevenZipModule> {
  if (_sevenZip) return _sevenZip

  _sevenZipPromise ??= (async () => {
    console.log('🗜️ ArchiveProcessor: Loading 7z-wasm library...')
    try {
      const { default: SevenZip } = await import('7z-wasm')
      // Emscripten treats null as end-of-input. Never open a password prompt.
      _sevenZip = await SevenZip({ stdin: () => null as unknown as number })
      console.log('🗜️ ArchiveProcessor: 7z-wasm library loaded successfully')
      return _sevenZip
    } catch (error) {
      _sevenZipPromise = null
      throw error
    }
  })()

  return _sevenZipPromise
}

export interface ArchiveFile {
  file: File
  name: string
  size: number
  type: string
  preview?: string
}

export interface ExtractedFile {
  name: string
  size: number
  data: Uint8Array
  isDirectory: boolean
}

export type CompressionFormat = '7z' | 'zip' | 'tar' | 'gzip'

let archiveOperationId = 0

function runSevenZip(sevenZip: SevenZipModule, args: string[]) {
  // The runtime can return an exit code or throw a WASM exception pointer.
  let status: unknown
  try {
    status = sevenZip.callMain(args)
  } catch (error) {
    status = error
  }
  if (status !== undefined && status !== 0) {
    throw new Error('7-Zip could not process this archive', {
      cause: status,
    })
  }
}

function removeArchiveDirectory(fs: SevenZipModule['FS'], directory: string) {
  for (const entry of fs.readdir(directory)) {
    if (entry === '.' || entry === '..') continue
    const path = `${directory}/${entry}`
    if (fs.isDir(fs.lstat(path).mode)) removeArchiveDirectory(fs, path)
    else fs.unlink(path)
  }
  fs.rmdir(directory)
}

export class ArchiveProcessor {
  private sevenZip: SevenZipModule | null = null
  private isInitialized = false

  async init() {
    if (!this.isInitialized) {
      console.log('🗜️ ArchiveProcessor: Initializing 7z-wasm...')
      this.sevenZip = await loadSevenZip()
      this.isInitialized = true
      console.log('🗜️ ArchiveProcessor: 7z-wasm initialized successfully')
    }
  }

  async compress(
    files: ArchiveFile[],
    format: CompressionFormat = '7z',
    archiveName = 'archive',
    onProgress?: (progress: number) => void,
  ): Promise<Uint8Array> {
    const sevenZip = this.sevenZip
    if (!this.isInitialized || !sevenZip) {
      throw new Error('ArchiveProcessor not initialized')
    }

    const { FS } = sevenZip
    const directory = `/toolbox-create-${++archiveOperationId}`
    const source = `${directory}/source`
    const basename = archiveName.replaceAll(/[\\/]/gu, '_')
    const output = `${directory}/${basename}.${this.getExtension(format)}`
    const entries = new Set<string>()
    const folders = new Set<string>()
    const inputs: string[] = []

    FS.mkdir(directory)
    try {
      FS.mkdir(source)
      for (const [index, file] of files.entries()) {
        const parts = file.name.replaceAll('\\', '/').split('/')
        if (parts.some((part) => !part || part === '.' || part === '..')) {
          throw new Error('Choose files with valid archive paths.')
        }
        let folder = source
        for (const part of parts.slice(0, -1)) {
          folder = `${folder}/${part}`
          if (!folders.has(folder)) {
            FS.mkdir(folder)
            folders.add(folder)
          }
        }

        const original = parts.join('/')
        const dot = original.lastIndexOf('.')
        const split =
          dot > original.lastIndexOf('/') + 1 ? dot : original.length
        let entry = original
        let copy = 2
        while (entries.has(entry.toLowerCase())) {
          entry = `${original.slice(0, split)} (${copy++})${original.slice(split)}`
        }
        entries.add(entry.toLowerCase())
        inputs.push(entry)
        FS.writeFile(
          `${source}/${entry}`,
          new Uint8Array(await file.file.arrayBuffer()),
        )
        onProgress?.(Math.round(((index + 1) / files.length) * 50))
      }

      // Only change the working directory during the synchronous command.
      // Use literal paths so names containing switches or wildcards are safe.
      const cwd = FS.cwd()
      FS.chdir(source)
      try {
        if (format === 'gzip') {
          const tar = `${directory}/${basename}.tar`
          runSevenZip(sevenZip, ['a', '-ttar', '-spd', '--', tar, ...inputs])
          runSevenZip(sevenZip, ['a', '-tgzip', '-spd', '--', output, tar])
        } else {
          runSevenZip(sevenZip, [
            'a',
            `-t${format}`,
            '-spd',
            '--',
            output,
            ...inputs,
          ])
        }
      } finally {
        FS.chdir(cwd)
      }
      onProgress?.(100)
      return FS.readFile(output)
    } finally {
      removeArchiveDirectory(FS, directory)
    }
  }

  decompress(
    archiveData: Uint8Array,
    archiveName: string,
    onProgress?: (progress: number) => void,
    password = '',
  ): ExtractedFile[] {
    const sevenZip = this.sevenZip
    if (!this.isInitialized || !sevenZip) {
      throw new Error('ArchiveProcessor not initialized')
    }

    const { FS } = sevenZip
    const directory = `/toolbox-extract-${++archiveOperationId}`
    const source = `${directory}/source`
    const output = `${directory}/output`
    const basename = archiveName.split(/[\\/]/u).pop()
    if (!basename || basename === '.' || basename === '..') {
      throw new Error('Choose an archive with a valid file name')
    }
    const passwordArgs = password ? [`-p${password}`] : []
    let input = `${source}/${basename}`

    FS.mkdir(directory)
    try {
      FS.mkdir(source)
      FS.writeFile(input, archiveData)
      onProgress?.(25)

      if (/\.(tar\.gz|tgz)$/iu.test(basename)) {
        const tarDirectory = `${directory}/tar`
        FS.mkdir(tarDirectory)
        runSevenZip(sevenZip, ['x', `-o${tarDirectory}`, '-y', '--', input])
        const tar = FS.readdir(tarDirectory).find((name) =>
          name.toLowerCase().endsWith('.tar'),
        )
        if (!tar)
          throw new Error('This GZIP archive does not contain a TAR file')
        input = `${tarDirectory}/${tar}`
      }

      runSevenZip(sevenZip, ['l', ...passwordArgs, '--', input])
      onProgress?.(50)
      FS.mkdir(output)
      runSevenZip(sevenZip, [
        'x',
        ...passwordArgs,
        `-o${output}`,
        '-y',
        '--',
        input,
      ])
      onProgress?.(75)

      const extracted: ExtractedFile[] = []
      const collectFiles = (path: string, relativePath = '') => {
        for (const entry of FS.readdir(path)) {
          if (entry === '.' || entry === '..') continue
          const fullPath = `${path}/${entry}`
          const name = relativePath ? `${relativePath}/${entry}` : entry
          const { mode } = FS.lstat(fullPath)

          if (FS.isDir(mode)) {
            extracted.push({
              name,
              size: 0,
              data: new Uint8Array(),
              isDirectory: true,
            })
            collectFiles(fullPath, name)
          } else if (FS.isFile(mode)) {
            const data = FS.readFile(fullPath)
            extracted.push({
              name,
              size: data.length,
              data,
              isDirectory: false,
            })
          }
        }
      }

      collectFiles(output)
      onProgress?.(100)
      return extracted
    } finally {
      removeArchiveDirectory(FS, directory)
    }
  }

  private getExtension(format: CompressionFormat): string {
    switch (format) {
      case '7z':
        return '7z'
      case 'zip':
        return 'zip'
      case 'tar':
        return 'tar'
      case 'gzip':
        return 'tar.gz'
      default:
        return '7z'
    }
  }
}

/**
 * Extract files from a ZIP blob using 7z-wasm.
 * Returns a map of file paths to their binary data.
 * Used by the pandoc→typst pipeline to extract embedded media from DOCX files.
 */
export async function extractZipEntries(
  zipData: Uint8Array,
): Promise<Record<string, Uint8Array>> {
  const sevenZip = await loadSevenZip()

  const zipName = '_media_extract.zip'
  const extractDir = '_media_extracted'

  try {
    // Write the zip to the virtual filesystem
    sevenZip.FS.writeFile(zipName, zipData)

    // Create extraction directory
    try {
      sevenZip.FS.mkdir(extractDir)
    } catch {
      // Directory might already exist
    }

    // Extract
    sevenZip.callMain(['x', zipName, `-o${extractDir}`, '-y'])

    // Collect extracted files recursively
    const result: Record<string, Uint8Array> = {}

    const collectFiles = (dirPath: string, relativePath: string) => {
      let entries: string[]
      try {
        entries = sevenZip.FS.readdir(dirPath)
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry === '.' || entry === '..') continue
        const fullPath = `${dirPath}/${entry}`
        const relPath = relativePath ? `${relativePath}/${entry}` : entry
        try {
          const stat = sevenZip.FS.stat(fullPath)
          if (sevenZip.FS.isDir(stat.mode)) {
            collectFiles(fullPath, relPath)
          } else {
            result[relPath] = sevenZip.FS.readFile(fullPath)
          }
        } catch {
          // Skip files that can't be read
        }
      }
    }

    collectFiles(extractDir, '')
    return result
  } finally {
    // Cleanup
    const cleanup = (dirPath: string) => {
      try {
        const entries = sevenZip.FS.readdir(dirPath)
        for (const entry of entries) {
          if (entry === '.' || entry === '..') continue
          const fullPath = `${dirPath}/${entry}`
          try {
            const stat = sevenZip.FS.stat(fullPath)
            if (sevenZip.FS.isDir(stat.mode)) {
              cleanup(fullPath)
              sevenZip.FS.rmdir(fullPath)
            } else {
              sevenZip.FS.unlink(fullPath)
            }
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch {
        // Ignore
      }
    }

    try {
      sevenZip.FS.unlink(zipName)
    } catch {
      // Ignore
    }
    try {
      cleanup(extractDir)
      sevenZip.FS.rmdir(extractDir)
    } catch {
      // Ignore
    }
  }
}

// Utility functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function downloadFile(
  data: Uint8Array,
  filename: string,
  mimeType = 'application/octet-stream',
) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
