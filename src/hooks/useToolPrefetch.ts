import { useEffect } from 'react'
import { toolPaths } from '@/lib/toolPaths'

const toolPages = new Set<string>(Object.values(toolPaths))
type EngineManifest = Record<string, string[] | undefined>
let manifest: Promise<EngineManifest> | undefined

function getManifest(base: URL) {
  manifest ??= fetch(new URL('tool-engine-prefetch.json', base))
    .then(async (response) => {
      if (!response.ok) throw new Error('Engine hints are unavailable')
      return (await response.json()) as EngineManifest
    })
    .catch((error: unknown) => {
      manifest = undefined
      throw error
    })
  return manifest
}

export function useToolPrefetch(pathname: string) {
  useEffect(() => {
    const path = pathname.replace(/\/$/u, '')
    if (!import.meta.env.PROD || !toolPages.has(path)) return

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection
    if (
      connection?.saveData ||
      window.matchMedia('(prefers-reduced-data: reduce)').matches ||
      !document.createElement('link').relList.supports('prefetch')
    )
      return

    const base = new URL(import.meta.env.BASE_URL, location.origin)
    const hints: HTMLLinkElement[] = []
    let active = true
    let afterPaint = 0
    const frame = requestAnimationFrame(() => {
      afterPaint = requestAnimationFrame(() => {
        void getManifest(base)
          .then((assets) => {
            if (!active) return
            for (const asset of assets[path] ?? []) {
              const url = new URL(asset, base)
              if (performance.getEntriesByName(url.href).length > 0) continue
              const hint = document.createElement('link')
              hint.rel = 'prefetch'
              hint.fetchPriority = 'low'
              hint.href = url.href
              document.head.append(hint)
              hints.push(hint)
            }
          })
          .catch(() => {
            // Optional hint; the ordinary lazy import still works.
          })
      })
    })
    return () => {
      active = false
      cancelAnimationFrame(frame)
      cancelAnimationFrame(afterPaint)
      for (const hint of hints) hint.remove()
    }
  }, [pathname])
}
