import { useCallback, useEffect, useRef } from 'react'
import { useProcessing } from '@/contexts/ProcessingContext'

/** Discard obsolete file output; optionally own the shared processing flag. */
export function useFileOperation(
  source: File | undefined,
  trackProcessing = true,
) {
  const { setIsProcessing } = useProcessing()
  const version = useRef(0)
  const active = useRef(false)

  useEffect(
    () => () => {
      version.current++
      if (active.current) {
        active.current = false
        if (trackProcessing) setIsProcessing(false)
      }
    },
    [source, setIsProcessing, trackProcessing],
  )

  return useCallback(() => {
    const current = ++version.current
    active.current = true
    if (trackProcessing) setIsProcessing(true)
    return {
      isCurrent: () => version.current === current,
      finish: () => {
        if (version.current !== current) return
        active.current = false
        if (trackProcessing) setIsProcessing(false)
      },
    }
  }, [setIsProcessing, trackProcessing])
}
