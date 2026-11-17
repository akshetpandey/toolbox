import { renderMessage } from '@/i18n/messages'
import type { LocalizedMessage } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { useCallback, useEffect, useRef } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadBlob, formatFileSize } from '@/lib/shared'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'

export interface ToolResult {
  blob: Blob
  filename: string
  sourceSize?: number
  details?: (string | LocalizedMessage)[]
}

export function useToolResult(sourceKey: unknown, workspaceKey = 'current') {
  const current = useRef({ sourceKey, mounted: true })
  current.current.sourceKey = sourceKey
  useEffect(() => {
    current.current.mounted = true
    return () => {
      current.current.mounted = false
    }
  }, [])
  const [state, setState] = useWorkspaceState<{
    sourceKey: unknown
    result: ToolResult | null
  }>(`result.${workspaceKey}`, { sourceKey, result: null })
  useEffect(() => {
    if (state.sourceKey !== sourceKey) setState({ sourceKey, result: null })
  }, [sourceKey, state.sourceKey, setState])
  const setResult = useCallback(
    (result: ToolResult | null) => {
      if (current.current.mounted && current.current.sourceKey === sourceKey)
        setState({ sourceKey, result })
    },
    [sourceKey, setState],
  )
  const clearResult = useCallback(() => setResult(null), [setResult])
  return {
    result: state.sourceKey === sourceKey ? state.result : null,
    setResult,
    clearResult,
  }
}

export function ResultCard({
  result,
  onReset,
  disabled = false,
}: {
  result: ToolResult | null
  onReset?: () => void
  disabled?: boolean
}) {
  const t = useTranslator()
  if (!result) return null
  const { blob, filename, sourceSize, details } = result
  const difference =
    sourceSize && sourceSize > 0
      ? ((blob.size - sourceSize) / sourceSize) * 100
      : null
  return (
    <section
      aria-label={t('resultCardResult')}
      className="result-card rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div role="status" aria-live="polite" className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CheckCircle2 aria-hidden="true" className="size-5 text-primary" />
          {t('resultCardYourFileIsReady')}
        </h2>
        <p className="font-medium break-all">{filename}</p>
        <p className="text-sm text-muted-foreground">
          {formatFileSize(blob.size, t)}
          {' · '}
          {filename.split('.').pop()?.toUpperCase() ?? blob.type}
          {sourceSize !== undefined && (
            <>
              {' ' + t('resultCardOriginal') + ' '}
              {formatFileSize(sourceSize, t)}
            </>
          )}
          {difference !== null && (
            <>
              {' '}
              ·{' '}
              {difference === 0
                ? t('resultCardSameSizeAsOriginal')
                : t(
                    difference > 0
                      ? 'resultCardPercentLarger'
                      : 'resultCardPercentSmaller',
                    { percent: Math.abs(difference).toFixed(1) },
                  )}
            </>
          )}
        </p>
        {difference !== null && difference > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('resultCardTheOutputIsLargerThanThe')}
          </p>
        )}
        {details?.map((detail, index) => (
          <p key={index} className="text-sm text-muted-foreground break-words">
            {renderMessage(t, detail)}
          </p>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={disabled}
          onClick={() => downloadBlob(blob, filename)}
        >
          <Download aria-hidden="true" />
          {t('resultCardDownloadAgain')}
        </Button>
        {onReset && (
          <Button variant="outline" disabled={disabled} onClick={onReset}>
            {t('resultCardStartAnotherFile')}
          </Button>
        )}
      </div>
    </section>
  )
}
