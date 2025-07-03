import { parseMetadata } from '@uswriting/exiftool'
import { WASMagic } from 'wasmagic'
import { md5, sha1, sha256 } from 'hash-wasm'

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
let magicInstance: unknown = null

const initMagic = async () => {
  if (magicInstance) return magicInstance

  console.log('📋 Metadata: Initializing WASMagic instance')

  try {
    // WASMagic.create() will automatically look for the WASM file
    // in the same directory as the JS file, or we can provide a custom locateFile function
    magicInstance = await WASMagic.create()
    console.log('📋 Metadata: WASMagic instance created successfully')
    return magicInstance
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
    const magic = (await initMagic()) as {
      getMime: (bytes: Uint8Array) => string | null
      detect: (bytes: Uint8Array) => string | null
    }

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
