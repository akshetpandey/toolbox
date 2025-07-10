import type { parseMetadata } from '@uswriting/exiftool'
import type { WASMagic } from 'wasmagic'
import type { md5 } from 'hash-wasm'
import type { sha1 } from 'hash-wasm'
import type { sha256 } from 'hash-wasm'

let _parseMetadata: typeof parseMetadata | null = null
let _WASMagic: typeof WASMagic | null = null
let _md5: typeof md5 | null = null
let _sha1: typeof sha1 | null = null
let _sha256: typeof sha256 | null = null

// Lazy load EXIF tool
async function loadExifTool(): Promise<typeof parseMetadata> {
  if (!_parseMetadata) {
    console.log('📋 Metadata: Loading exiftool library...')
    const exifModule = await import('@uswriting/exiftool')
    _parseMetadata = exifModule.parseMetadata
    console.log('📋 Metadata: exiftool library loaded successfully')
  }
  return _parseMetadata
}

// Lazy load WASMagic
async function loadWASMagic(): Promise<typeof WASMagic> {
  if (!_WASMagic) {
    console.log('📋 Metadata: Loading wasmagic library...')
    const wasmagicModule = await import('wasmagic')
    _WASMagic = wasmagicModule.WASMagic
    console.log('📋 Metadata: wasmagic library loaded successfully')
  }
  return _WASMagic
}

// Lazy load hash-wasm
async function loadHashWasm(): Promise<{
  md5: typeof md5
  sha1: typeof sha1
  sha256: typeof sha256
}> {
  if (!_md5 || !_sha1 || !_sha256) {
    console.log('📋 Metadata: Loading hash-wasm library...')
    const hashModule = await import('hash-wasm')
    _md5 = hashModule.md5
    _sha1 = hashModule.sha1
    _sha256 = hashModule.sha256
    console.log('📋 Metadata: hash-wasm library loaded successfully')
  }
  return { md5: _md5, sha1: _sha1, sha256: _sha256 }
}

// Interface for EXIF metadata
export type ExifMetadata = Record<string, string | number | boolean | null>

// Interface for file metadata from wasmagic
export interface FileMetadata {
  mimeType: string
  description: string
  extension?: string
  size: number
  name: string
}

// Interface for file hash results
export interface FileHashes {
  md5: string
  sha1: string
  sha256: string
}

// Initialize wasmagic instance
let _magicInstance: WASMagic | null = null

const initMagic = async (): Promise<WASMagic> => {
  if (_magicInstance) return _magicInstance

  console.log('📋 Metadata: Initializing WASMagic instance')

  try {
    const WASMagicClass = await loadWASMagic()

    // WASMagic.create() will automatically look for the WASM file
    // in the same directory as the JS file, or we can provide a custom locateFile function
    _magicInstance = await WASMagicClass.create()
    console.log('📋 Metadata: WASMagic instance created successfully')
    return _magicInstance
  } catch (error) {
    console.error('📋 Metadata: Failed to initialize WASMagic:', error)
    throw error
  }
}

// Extract EXIF metadata from a file
export const extractExifMetadata = async (
  file: File,
  onProgress?: (isLoading: boolean) => void,
): Promise<ExifMetadata> => {
  console.log('📋 Metadata: Starting EXIF metadata extraction for', file.name)
  onProgress?.(true)

  try {
    const parseMetadata = await loadExifTool()

    const exifResult = await parseMetadata(file, {
      args: ['-json', '-n'],
      transform: (data) => JSON.parse(data) as ExifMetadata[],
    })
    console.log('📋 Metadata: EXIF metadata extraction successful', exifResult)

    // Extract data from the result if successful
    const exifData = exifResult.success ? exifResult.data[0] : {}
    return exifData
  } catch (error) {
    console.error('📋 Metadata: Error extracting EXIF metadata:', error)
    return {}
  } finally {
    onProgress?.(false)
  }
}

// Extract file metadata using wasmagic
export const extractFileMetadata = async (
  file: File,
): Promise<FileMetadata> => {
  console.log('📋 Metadata: Starting file metadata extraction for', {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  })

  try {
    const magic = await initMagic()

    // Read the first 8KB of the file for magic byte detection
    const buffer = await file.slice(0, 8192).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    console.log('📋 Metadata: File buffer info', {
      bufferSize: buffer.byteLength,
      firstBytes: Array.from(bytes.slice(0, 16))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' '),
      magicSignature: Array.from(bytes.slice(0, 4))
        .map((b) => String.fromCharCode(b))
        .join(''),
    })

    // Detect using wasmagic
    const mimeType = magic.getMime(bytes)
    const description = magic.detect(bytes)

    console.log('📋 Metadata: WASMagic detection results', {
      originalFileType: file.type,
      detectedMimeType: mimeType,
      detectedDescription: description,
      fallbackMimeType: mimeType ?? 'application/octet-stream',
      fallbackDescription: description ?? 'Unknown file type',
    })

    const finalMimeType = mimeType ?? 'application/octet-stream'
    const finalDescription = description ?? 'Unknown file type'

    console.log('📋 Metadata: File metadata extraction successful', {
      mimeType: finalMimeType,
      description: finalDescription,
      size: file.size,
      name: file.name,
    })

    return {
      mimeType: finalMimeType,
      description: finalDescription,
      size: file.size,
      name: file.name,
    }
  } catch (error) {
    console.error('📋 Metadata: Error extracting file metadata:', error)
    return {
      mimeType: 'application/octet-stream',
      description: 'Unknown file type',
      size: file.size,
      name: file.name,
    }
  }
}

// Calculate file hashes (MD5, SHA1, SHA256)
export const calculateFileHashes = async (
  file: File,
  onProgress?: (progress: number) => void,
): Promise<FileHashes> => {
  console.log('📋 Metadata: Starting hash calculation for', file.name)

  try {
    const { md5, sha1, sha256 } = await loadHashWasm()

    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    onProgress?.(25)

    // Calculate hashes using hash-wasm for better performance and MD5 support
    const [md5Hash, sha1Hash, sha256Hash] = await Promise.all([
      md5(data),
      sha1(data),
      sha256(data),
    ])

    const result = {
      md5: md5Hash,
      sha1: sha1Hash,
      sha256: sha256Hash,
    }

    console.log('📋 Metadata: Hash calculation successful', result)
    onProgress?.(100)

    return result
  } catch (error) {
    console.error('📋 Metadata: Error calculating file hashes:', error)
    return {
      md5: 'Error',
      sha1: 'Error',
      sha256: 'Error',
    }
  }
}

// Format file size helper
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
