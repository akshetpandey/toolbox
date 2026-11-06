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

let extractionId = 0

function runSevenZip(sevenZip: SevenZipModule, args: string[]) {
  // The runtime can return an exit code or throw a WASM exception pointer.
  let status: unknown
  try {
    status = sevenZip.callMain(args)
  } catch (error) {
    status = error
  }
  if (status !== undefined && status !== 0) {
    throw new Error('7-Zip could not open or extract this archive', {
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
    if (!this.isInitialized) {
      throw new Error('ArchiveProcessor not initialized')
    }
    if (!this.sevenZip) {
      throw new Error('SevenZip module not initialized')
    }

    console.log(`🗜️ ArchiveProcessor: Starting compression to ${format}`, {
      fileCount: files.length,
      archiveName,
    })

    const extension = this.getExtension(format)
    const fullArchiveName = `${archiveName}.${extension}`

    try {
      // Write input files to the virtual file system
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileData = new Uint8Array(await file.file.arrayBuffer())

        // Create directory structure if needed
        const parts = file.name.split('/')
        if (parts.length > 1) {
          let currentPath = ''
          for (let j = 0; j < parts.length - 1; j++) {
            currentPath += parts[j]
            try {
              this.sevenZip.FS.mkdir(currentPath)
            } catch {
              // Directory might already exist
            }
            currentPath += '/'
          }
        }

        this.sevenZip.FS.writeFile(file.name, fileData)

        if (onProgress) {
          onProgress(Math.round(((i + 1) / files.length) * 50)) // 50% for writing files
        }
      }

      // Create the archive
      if (format === 'gzip') {
        // For gzip, create a tar archive first, then compress it
        const tarName = `${archiveName}.tar`
        const tarArgs = ['a', '-ttar', tarName, ...files.map((f) => f.name)]
        console.log(
          '🗜️ ArchiveProcessor: Creating TAR archive first for gzip',
          tarArgs,
        )
        this.sevenZip.callMain(tarArgs)

        // Now compress the tar file with gzip
        const gzipArgs = ['a', '-tgzip', fullArchiveName, tarName]
        console.log('🗜️ ArchiveProcessor: Compressing TAR with gzip', gzipArgs)
        this.sevenZip.callMain(gzipArgs)

        // Clean up the intermediate tar file
        try {
          this.sevenZip.FS.unlink(tarName)
        } catch {
          // File might not exist
        }
      } else {
        const compressionArgs = this.getCompressionArgs(
          format,
          fullArchiveName,
          files,
        )
        console.log(
          '🗜️ ArchiveProcessor: Running compression command',
          compressionArgs,
        )

        this.sevenZip.callMain(compressionArgs)
      }

      if (onProgress) {
        onProgress(100)
      }

      // Read the created archive
      const archiveData = this.sevenZip.FS.readFile(fullArchiveName)

      // Clean up input files
      files.forEach((file) => {
        if (!this.sevenZip) {
          return
        }
        try {
          this.sevenZip.FS.unlink(file.name)
        } catch {
          // File might not exist
        }
      })

      // Clean up archive file
      try {
        this.sevenZip.FS.unlink(fullArchiveName)
      } catch {
        // File might not exist
      }

      console.log('🗜️ ArchiveProcessor: Compression completed successfully', {
        originalSize: files.reduce((sum, file) => sum + file.size, 0),
        compressedSize: archiveData.length,
      })

      return archiveData
    } catch (error) {
      console.error('🗜️ ArchiveProcessor: Compression failed:', error)
      throw error
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
    const directory = `/toolbox-extract-${++extractionId}`
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

  private getCompressionArgs(
    format: CompressionFormat,
    archiveName: string,
    files: ArchiveFile[],
  ): string[] {
    const fileNames = files.map((f) => f.name)

    switch (format) {
      case '7z':
        return ['a', '-t7z', archiveName, ...fileNames]
      case 'zip':
        return ['a', '-tzip', archiveName, ...fileNames]
      case 'tar':
        return ['a', '-ttar', archiveName, ...fileNames]
      case 'gzip':
        // For gzip, use the gzip format type
        // This creates a tar.gz file
        return ['a', '-tgzip', archiveName, ...fileNames]
      default:
        return ['a', '-t7z', archiveName, ...fileNames]
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
