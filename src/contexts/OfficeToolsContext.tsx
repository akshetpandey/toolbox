import { createContext, useContext } from 'react'
import type { LocalizedMessage } from '@/i18n/messages'
import type { OfficeFile } from '@/lib/pandoc'

export type ConversionStatus = LocalizedMessage | { error: unknown } | null

export interface OfficeToolsContextType {
  selectedFile: OfficeFile | null
  setSelectedFile: (file: OfficeFile | null) => void
  isCurrentFile: (file: OfficeFile) => boolean
  conversionStatus: ConversionStatus
  setConversionStatus: (status: ConversionStatus) => void
  clearSelectedFile: () => void
  chooseAnotherFile: () => void
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
