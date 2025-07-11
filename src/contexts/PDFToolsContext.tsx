import { createContext, useContext } from 'react'
import type { PDFFile } from '@/lib/pdf'

export interface PDFToolsContextType {
  selectedFiles: PDFFile[]
  isProcessing: boolean
  handleFileSelect: (files: FileList) => void
  removeFile: (id: string) => void
  clearFiles: () => void
  reorderFiles: (activeId: string, overId: string) => void
}

export const PDFToolsContext = createContext<PDFToolsContextType | null>(null)

export const usePDFTools = () => {
  const context = useContext(PDFToolsContext)
  if (!context) {
    throw new Error('usePDFTools must be used within a PDFToolsProvider')
  }
  return context
}
