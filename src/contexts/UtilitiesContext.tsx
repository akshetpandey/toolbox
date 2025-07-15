import { createContext, useContext } from 'react'
import {
  type ExifMetadata,
  type FileMetadata,
  type FileHashes,
} from '@/lib/metadata'

// Type for uploaded file
export interface UploadedFile {
  file: File
  name: string
  size: number
  type: string
}

export interface UtilitiesContextType {
  selectedFile: UploadedFile | null
  setSelectedFile: (file: UploadedFile | null) => void
  fileMetadata: FileMetadata | null
  setFileMetadata: (metadata: FileMetadata | null) => void
  exifMetadata: ExifMetadata
  setExifMetadata: (metadata: ExifMetadata) => void
  fileHashes: FileHashes | null
  setFileHashes: (hashes: FileHashes | null) => void
  expectedHash: string
  setExpectedHash: (hash: string) => void
  isExtractingExif: boolean
  setIsExtractingExif: (extracting: boolean) => void
  hashProgress: number
  setHashProgress: (progress: number) => void
  handleFileSelect: (files: FileList) => Promise<void>
  handleDrop: (e: React.DragEvent) => Promise<void>
  handleDragOver: (e: React.DragEvent) => void
  clearFile: () => void
  generateHashes: (file: UploadedFile) => Promise<void>
  extractMetadata: (file: UploadedFile) => Promise<void>
}

export const UtilitiesContext = createContext<UtilitiesContextType | undefined>(
  undefined,
)

export const useUtilities = () => {
  const context = useContext(UtilitiesContext)
  if (!context) {
    throw new Error('useUtilities must be used within a UtilitiesProvider')
  }
  return context
}
