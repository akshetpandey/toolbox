// Shared utility functions for file processing tools

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const downloadFile = (url: string, filename: string) => {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export const createObjectURL = (blob: Blob): string => {
  return URL.createObjectURL(blob)
}

export const revokeObjectURL = (url: string) => {
  URL.revokeObjectURL(url)
}

export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop() ?? ''
}

// Common file type validation
export const isValidImageFile = (file: File): boolean => {
  return file.type.startsWith('image/')
}

export const isValidVideoFile = (file: File): boolean => {
  return file.type.startsWith('video/')
}

// Progress simulation utility
export const simulateProgress = (
  setProgress: (value: number | ((prev: number) => number)) => void,
  onComplete: () => void,
  duration = 2000,
) => {
  const interval = setInterval(() => {
    setProgress((prev: number) => {
      if (prev >= 90) {
        clearInterval(interval)
        return 90
      }
      return prev + 10
    })
  }, duration / 10)

  return () => {
    clearInterval(interval)
    setProgress(100)
    setTimeout(onComplete, 500)
  }
}
