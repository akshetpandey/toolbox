// Shared utility functions for file processing tools

/**
 * Format a file size in bytes to a human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format a duration in seconds to a human readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Download a file from a URL
 */
export function downloadFile(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Create a URL for a blob
 */
export function createObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob)
}

/**
 * Revoke a URL for a blob
 */
export function revokeObjectURL(url: string) {
  URL.revokeObjectURL(url)
}

/**
 * Get the extension of a filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop() ?? ''
}

/**
 * Truncate a filename to a maximum length
 */
export function truncateFilename(filename: string, maxLength = 32): string {
  if (filename.length <= maxLength) return filename

  const extension = filename.split('.').pop() ?? ''
  const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.'))

  const availableLength = maxLength - extension.length - 4 // 4 for "..." and "."
  const startLength = Math.ceil(availableLength / 2)
  const endLength = Math.floor(availableLength / 2)

  return `${nameWithoutExt.slice(0, startLength)}...${nameWithoutExt.slice(-endLength)}.${extension}`
}

/**
 * Check if a file is a valid image file
 */
export function isValidImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Check if a file is a valid video file
 */
export function isValidVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

/**
 * Shared image file interface used across image processing tools
 */
export interface ImageFile {
  file: File
  preview: string
  name: string
  size: number
  type: string
  dimensions?: { width: number; height: number }
}
