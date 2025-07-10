import { useState, useCallback } from 'react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

interface UseInitFFmpegReturn {
  ffmpeg: FFmpeg | null
  isInitialized: boolean
  isInitializing: boolean
  error: string | null
  init: () => Promise<FFmpeg | null>
  setProgressCallback: (callback: (progress: number) => void) => void
}

let initializationPromise: Promise<void> | null = null
let ffmpegInstance: FFmpeg | null = null
let isInitialized = false
let progressCallback: ((progress: number) => void) | null = null

// Lazy load FFmpeg modules
async function loadFFmpegModules() {
  console.log('🎬 FFmpeg: Loading FFmpeg modules...')
  const [ffmpegModule, utilModule] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ])
  console.log('🎬 FFmpeg: Modules loaded successfully')
  return {
    FFmpeg: ffmpegModule.FFmpeg,
    toBlobURL: utilModule.toBlobURL,
  }
}

export function useInitFFmpeg(): UseInitFFmpegReturn {
  const setProgressCallback = useCallback(
    (callback: (progress: number) => void) => {
      progressCallback = callback
    },
    [],
  )

  const [state, setState] = useState<UseInitFFmpegReturn>({
    ffmpeg: null,
    isInitialized: false,
    isInitializing: false,
    error: null,
    init: () => Promise.resolve(null),
    setProgressCallback,
  })

  const init = useCallback(async (): Promise<FFmpeg | null> => {
    // If already initialized, return immediately
    if (isInitialized && ffmpegInstance) {
      setState((prev) => ({
        ...prev,
        ffmpeg: ffmpegInstance,
        isInitialized: true,
        isInitializing: false,
        error: null,
        setProgressCallback,
      }))
      return ffmpegInstance
    }

    // If initialization is already in progress, wait for it
    if (initializationPromise) {
      setState((prev) => ({ ...prev, isInitializing: true }))
      try {
        await initializationPromise
        setState((prev) => ({
          ...prev,
          ffmpeg: ffmpegInstance,
          isInitialized: true,
          isInitializing: false,
          error: null,
          setProgressCallback,
        }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isInitialized: false,
          isInitializing: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to initialize FFmpeg',
          setProgressCallback,
        }))
      }
      return ffmpegInstance
    }

    // Start initialization
    setState((prev) => ({ ...prev, isInitializing: true, error: null }))

    initializationPromise = (async () => {
      try {
        const { FFmpeg, toBlobURL } = await loadFFmpegModules()

        ffmpegInstance = new FFmpeg()

        // Set up logging
        ffmpegInstance.on('log', ({ message }) => {
          console.log('FFmpeg:', message)
        })
        ffmpegInstance.on('progress', (event) => {
          console.log('FFmpeg progress:', event)
          // Use the actual progress value from FFmpeg (0-1 float)
          if (progressCallback && event.progress !== undefined) {
            progressCallback(event.progress)
          }
        })

        const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm'
        await ffmpegInstance.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            'text/javascript',
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            'application/wasm',
          ),
          workerURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.worker.js`,
            'text/javascript',
          ),
        })

        isInitialized = true
      } catch (err) {
        console.error('Failed to initialize FFmpeg:', err)
        throw err
      }
    })()

    try {
      await initializationPromise
      setState((prev) => ({
        ...prev,
        ffmpeg: ffmpegInstance,
        isInitialized: true,
        isInitializing: false,
        error: null,
        setProgressCallback,
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
            : 'Failed to initialize FFmpeg',
        setProgressCallback,
      }))
    }
    return ffmpegInstance
  }, [setProgressCallback])

  return {
    ffmpeg: state.ffmpeg,
    isInitialized: state.isInitialized,
    isInitializing: state.isInitializing,
    error: state.error,
    init,
    setProgressCallback,
  }
}
