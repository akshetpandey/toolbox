import { createContext, useContext } from 'react'
import type { OfficeFile } from '@/lib/pandoc'

export interface OfficeToolsContextType {
  selectedFile: OfficeFile | null
  setSelectedFile: (file: OfficeFile | null) => void
  conversionStatus: string
  setConversionStatus: (status: string) => void
  clearSelectedFile: () => void
}

export const OfficeToolsContext = createContext<OfficeToolsContextType | null>(
  null,
)

export function useOfficeTools() {
  const context = useContext(OfficeToolsContext)
  if (!context) {
    throw new Error('useOfficeTools must be used within a OfficeToolsProvider')
  }
  return context
}
