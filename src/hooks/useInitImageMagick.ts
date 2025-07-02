import { useState, useEffect } from 'react'
import { initializeImageMagick } from '@imagemagick/magick-wasm'

interface UseInitImageMagickReturn {
  isInitialized: boolean
  isInitializing: boolean
  error: string | null
}

let initializationPromise: Promise<void> | null = null
let isInitialized = false

const wasmLocation = new URL('@imagemagick/magick-wasm/magick.wasm', import.meta.url);
export function useInitImageMagick(): UseInitImageMagickReturn {
  const [state, setState] = useState<UseInitImageMagickReturn>({
    isInitialized: false,
    isInitializing: false,
    error: null,
  })

  useEffect(() => {
    const initImageMagick = async () => {
      // If already initialized, return immediately
      if (isInitialized) {
        setState({
          isInitialized: true,
          isInitializing: false,
          error: null,
        })
        return
      }

      // If initialization is already in progress, wait for it
      if (initializationPromise) {
        setState(prev => ({ ...prev, isInitializing: true }))
        try {
          await initializationPromise
          setState({
            isInitialized: true,
            isInitializing: false,
            error: null,
          })
        } catch (error) {
          setState({
            isInitialized: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : 'Failed to initialize ImageMagick',
          })
        }
        return
      }

      // Start initialization
      setState(prev => ({ ...prev, isInitializing: true }))
      
      initializationPromise = initializeImageMagick(wasmLocation)
      
      try {
        await initializationPromise
        isInitialized = true
        setState({
          isInitialized: true,
          isInitializing: false,
          error: null,
        })
      } catch (error) {
        initializationPromise = null
        setState({
          isInitialized: false,
          isInitializing: false,
          error: error instanceof Error ? error.message : 'Failed to initialize ImageMagick',
        })
      }
    }

    initImageMagick()
  }, [])

  return state
} 