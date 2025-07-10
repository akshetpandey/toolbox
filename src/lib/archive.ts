import type { SevenZipModule } from '7z-wasm'

let _sevenZip: SevenZipModule | null = null

async function loadSevenZip(): Promise<SevenZipModule> {
  if (_sevenZip) {
    return _sevenZip
  }
  console.log('🗜️ ArchiveProcessor: Loading 7z-wasm library...')
  const { default: SevenZip } = await import('7z-wasm')
  _sevenZip = await SevenZip()
  console.log('🗜️ ArchiveProcessor: 7z-wasm library loaded successfully')
  return _sevenZip
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

      // List contents first to validate archive
      console.log('🗜️ ArchiveProcessor: Listing archive contents...')
      try {
        this.sevenZip.callMain(['l', archiveName])
      } catch (error) {
        console.error(
          '🗜️ ArchiveProcessor: Failed to list archive contents:',
          error,
        )
        throw new Error('Invalid or corrupted archive file')
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
        this.sevenZip.callMain(['x', archiveName, `-o${extractionDir}`, '-y']) // -o to specify output directory, -y to overwrite without prompting
      } catch (error) {
        console.error('🗜️ ArchiveProcessor: Failed to extract files:', error)
        throw new Error('Failed to extract archive files')
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

        let entries: string[] = []
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

      // Clean up archive file
      try {
        this.sevenZip.FS.unlink(archiveName)
      } catch {
        // Cleanup errors are not critical
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
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
