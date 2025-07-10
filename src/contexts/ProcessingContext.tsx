import { createContext, useContext, useState, type ReactNode } from 'react'

interface ProcessingContextType {
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
  processingMessage?: string
  setProcessingMessage: (message?: string) => void
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(
  undefined,
)

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState<
    string | undefined
  >()

  return (
    <ProcessingContext.Provider
      value={{
        isProcessing,
        setIsProcessing,
        processingMessage,
        setProcessingMessage,
      }}
    >
      {children}
    </ProcessingContext.Provider>
  )
}

export function useProcessing() {
  const context = useContext(ProcessingContext)
  if (context === undefined) {
    throw new Error('useProcessing must be used within a ProcessingProvider')
  }
  return context
}
