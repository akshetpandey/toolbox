import { createContext, useContext } from 'react'
import type { ImageMetadata, ImageMagickProcessor } from '@/lib/imagemagick'
import type { ImageFile } from '@/lib/shared'
import type { ExifMetadata } from '@/lib/metadata'

export interface ImageToolsContextType {
  selectedFile: ImageFile | null
  metadata: Record<string, ImageMetadata>
  exifMetadata: ExifMetadata
  isExtractingExif: boolean
  imageMagickProcessor: ImageMagickProcessor
  isProcessing: boolean
  handleFileSelect: (files: FileList) => Promise<void>
  clearSelectedFile: () => void
}

export const ImageToolsContext = createContext<ImageToolsContextType | null>(
  null,
)

export function useImageTools() {
  const context = useContext(ImageToolsContext)
  if (!context) {
    throw new Error('useImageTools must be used within an ImageToolsProvider')
  }
  return context
}
