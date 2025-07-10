import { useState, useCallback } from 'react'
import wasmLocation from '@imagemagick/magick-wasm/magick.wasm?url'

interface UseInitImageMagickReturn {
  isInitialized: boolean
  isInitializing: boolean
  error: string | null
  init: () => Promise<void>
}

let initializationPromise: Promise<void> | null = null
let isInitialized = false

export function useInitImageMagick(): UseInitImageMagickReturn {
  const [state, setState] = useState<UseInitImageMagickReturn>({
    isInitialized: false,
    isInitializing: false,
    error: null,
    init: () => Promise.resolve(),
  })

  const init = useCallback(async () => {
    // If already initialized, return immediately
    if (isInitialized) {
      setState((prev) => ({
        ...prev,
        isInitialized: true,
        isInitializing: false,
        error: null,
      }))
      return
    }

    // If initialization is already in progress, wait for it
    if (initializationPromise) {
      setState((prev) => ({ ...prev, isInitializing: true }))
      try {
        await initializationPromise
        setState((prev) => ({
          ...prev,
          isInitialized: true,
          isInitializing: false,
          error: null,
        }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isInitialized: false,
          isInitializing: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to initialize ImageMagick',
        }))
      }
      return
    }

    // Start initialization
    setState((prev) => ({ ...prev, isInitializing: true, error: null }))

    const { initializeImageMagick } = await import('@imagemagick/magick-wasm')
    initializationPromise = initializeImageMagick(wasmLocation)

    try {
      await initializationPromise
      isInitialized = true
      setState((prev) => ({
        ...prev,
        isInitialized: true,
        isInitializing: false,
        error: null,
      }))
    } catch (error) {
      initializationPromise = null
      setState((prev) => ({
        ...prev,
        isInitialized: false,
        isInitializing: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initialize ImageMagick',
      }))
    }
  }, [])

  return {
    isInitialized: state.isInitialized,
    isInitializing: state.isInitializing,
    error: state.error,
    init,
  }
}
