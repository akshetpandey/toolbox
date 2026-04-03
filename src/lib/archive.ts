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
      _sevenZip = await SevenZip()
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
  ): ExtractedFile[] {
    if (!this.isInitialized) {
      throw new Error('ArchiveProcessor not initialized')
    }
    if (!this.sevenZip) {
      throw new Error('SevenZip module not initialized')
    }

    console.log('🗜️ ArchiveProcessor: Starting decompression', {
      archiveName,
      size: archiveData.length,
    })

    // Check if this is a tar.gz file that needs special handling
    const isTarGz =
      archiveName.toLowerCase().endsWith('.tar.gz') ||
      archiveName.toLowerCase().endsWith('.tgz')

    let archiveToExtract = archiveName

    try {
      // Clean up any existing files first
      try {
        this.sevenZip.FS.unlink(archiveName)
      } catch {
        // File might not exist, that's okay
      }

      // Write archive to virtual file system
      this.sevenZip.FS.writeFile(archiveName, archiveData)

      if (onProgress) {
        onProgress(25)
      }

      // Handle tar.gz files
      if (isTarGz) {
        console.log(
          '🗜️ ArchiveProcessor: Detected tar.gz file, ungzipping first...',
        )

        // First, extract the gzip to get the tar file
        const tarFileName = archiveName.replace(/\.(tar\.gz|tgz)$/i, '.tar')

        try {
          // Extract the gzip to get the tar file
          this.sevenZip.callMain(['x', archiveName, '-y'])

          // Check if the tar file was created
          try {
            this.sevenZip.FS.stat(tarFileName)
            archiveToExtract = tarFileName
            console.log(
              '🗜️ ArchiveProcessor: Successfully ungzipped to',
              tarFileName,
            )
          } catch {
            // If tar file wasn't created, try to find it with a different name
            const files = this.sevenZip.FS.readdir('.')
            const tarFile = files.find((f) => f.endsWith('.tar'))
            if (tarFile) {
              archiveToExtract = tarFile
              console.log('🗜️ ArchiveProcessor: Found tar file:', tarFile)
            } else {
              throw new Error('Failed to extract tar file from gzip archive')
            }
          }
        } catch (error) {
          console.error(
            '🗜️ ArchiveProcessor: Failed to ungzip tar.gz file:',
            error,
          )
          throw new Error(
            'Failed to extract tar.gz archive - gzip extraction failed',
            { cause: error },
          )
        }
      }

      // List contents first to validate archive
      console.log('🗜️ ArchiveProcessor: Listing archive contents...')
      try {
        this.sevenZip.callMain(['l', archiveToExtract])
      } catch (error) {
        console.error(
          '🗜️ ArchiveProcessor: Failed to list archive contents:',
          error,
        )
        throw new Error('Invalid or corrupted archive file', { cause: error })
      }

      if (onProgress) {
        onProgress(50)
      }

      // Create extraction directory
      const extractionDir = 'extracted_files'
      try {
        this.sevenZip.FS.mkdir(extractionDir)
      } catch {
        // Directory might already exist
      }

      // Extract all files to the extraction directory
      console.log('🗜️ ArchiveProcessor: Extracting files...')
      try {
        this.sevenZip.callMain([
          'x',
          archiveToExtract,
          `-o${extractionDir}`,
          '-y',
        ]) // -o to specify output directory, -y to overwrite without prompting
      } catch (error) {
        console.error('🗜️ ArchiveProcessor: Failed to extract files:', error)
        throw new Error('Failed to extract archive files', { cause: error })
      }

      if (onProgress) {
        onProgress(75)
      }

      // Get list of extracted files from the extraction directory
      const extractedFiles: ExtractedFile[] = []
      const listFilesRecursively = (path: string, relativePath = '') => {
        if (!this.sevenZip) {
          return
        }

        let entries: string[]
        try {
          entries = this.sevenZip.FS.readdir(path)
        } catch (error) {
          console.warn(
            '🗜️ ArchiveProcessor: Failed to read directory:',
            path,
            error,
          )
          return
        }

        for (const entry of entries) {
          if (entry === '.' || entry === '..') continue

          const fullPath = `${path}/${entry}`
          const displayPath = relativePath ? `${relativePath}/${entry}` : entry

          try {
            const stat = this.sevenZip.FS.stat(fullPath)

            if (this.sevenZip.FS.isDir(stat.mode)) {
              extractedFiles.push({
                name: displayPath,
                size: 0,
                data: new Uint8Array(),
                isDirectory: true,
              })
              listFilesRecursively(fullPath, displayPath)
            } else {
              const fileData = this.sevenZip.FS.readFile(fullPath)
              extractedFiles.push({
                name: displayPath,
                size: fileData.length,
                data: fileData,
                isDirectory: false,
              })
            }
          } catch (error) {
            console.warn(
              '🗜️ ArchiveProcessor: Failed to process file:',
              fullPath,
              error,
            )
            // Continue processing other files
          }
        }
      }

      listFilesRecursively(extractionDir)

      if (onProgress) {
        onProgress(100)
      }

      // Clean up archive files
      try {
        this.sevenZip.FS.unlink(archiveName)
      } catch {
        // Cleanup errors are not critical
      }

      // Clean up intermediate tar file if it was created during tar.gz extraction
      if (isTarGz && archiveToExtract !== archiveName) {
        try {
          this.sevenZip.FS.unlink(archiveToExtract)
        } catch {
          // Cleanup errors are not critical
        }
      }

      // Clean up extraction directory and its contents
      const cleanupDirectory = (dirPath: string) => {
        if (!this.sevenZip) return

        try {
          const entries = this.sevenZip.FS.readdir(dirPath)
          for (const entry of entries) {
            if (entry === '.' || entry === '..') continue

            const fullPath = `${dirPath}/${entry}`
            try {
              const stat = this.sevenZip.FS.stat(fullPath)
              if (this.sevenZip.FS.isDir(stat.mode)) {
                cleanupDirectory(fullPath)
                this.sevenZip.FS.rmdir(fullPath)
              } else {
                this.sevenZip.FS.unlink(fullPath)
              }
            } catch {
              // File might not exist or already be cleaned up
            }
          }
        } catch {
          // Directory might not exist
        }
      }

      try {
        cleanupDirectory(extractionDir)
        this.sevenZip.FS.rmdir(extractionDir)
      } catch {
        // Cleanup errors are not critical
      }

      console.log('🗜️ ArchiveProcessor: Decompression completed successfully', {
        extractedCount: extractedFiles.length,
      })

      return extractedFiles
    } catch (error) {
      console.error('🗜️ ArchiveProcessor: Decompression failed:', error)

      // Clean up in case of error
      try {
        this.sevenZip?.FS.unlink(archiveName)
      } catch {
        // Cleanup errors are not critical
      }

      // Clean up intermediate tar file if it was created during tar.gz extraction
      if (isTarGz && archiveToExtract !== archiveName) {
        try {
          this.sevenZip?.FS.unlink(archiveToExtract)
        } catch {
          // Cleanup errors are not critical
        }
      }

      // Also clean up extraction directory if it exists
      try {
        const extractionDir = 'extracted_files'
        const cleanupDirectory = (dirPath: string) => {
          if (!this.sevenZip) return

          try {
            const entries = this.sevenZip.FS.readdir(dirPath)
            for (const entry of entries) {
              if (entry === '.' || entry === '..') continue

              const fullPath = `${dirPath}/${entry}`
              try {
                const stat = this.sevenZip.FS.stat(fullPath)
                if (this.sevenZip.FS.isDir(stat.mode)) {
                  cleanupDirectory(fullPath)
                  this.sevenZip.FS.rmdir(fullPath)
                } else {
                  this.sevenZip.FS.unlink(fullPath)
                }
              } catch {
                // File might not exist or already be cleaned up
              }
            }
          } catch {
            // Directory might not exist
          }
        }

        cleanupDirectory(extractionDir)
        this.sevenZip.FS.rmdir(extractionDir)
      } catch {
        // Cleanup errors are not critical
      }

      throw error
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
