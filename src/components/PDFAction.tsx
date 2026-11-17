import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { message, renderMessage } from '@/i18n/messages'
import type { MessageText } from '@/i18n/messages'
import { messageFromError } from '@/i18n/MessageError'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useFileOperation } from '@/contexts/FileOperation'
import { useProcessing } from '@/contexts/ProcessingContext'
import { usePDFTools } from '@/contexts/PDFToolsContext'
import {
  ResultCard,
  useToolResult,
  type ToolResult,
} from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label } from '@/components/ui'
import { downloadBlob } from '@/lib/shared'

export type PDFActionTask = (
  signal: AbortSignal,
  setStatus: (message: MessageText) => void,
) => Promise<ToolResult>

export function usePDFSource() {
  const { selectedFiles, pageCounts, clearFiles } = usePDFTools()
  const source = selectedFiles.at(0)
  const file = source?.file
  const count = source ? pageCounts[source.id] : undefined
  return { file, count, clearFiles }
}

export function PDFAction({
  file,
  sourceKey,
  name,
  label,
  status,
  disabled = false,
  onReset,
  run,
  children,
}: {
  file: File | undefined
  sourceKey: string
  name: string
  label: string
  status?: MessageText
  disabled?: boolean
  onReset: () => void
  run: PDFActionTask
  children?: ReactNode
}) {
  const t = useTranslator()
  const { isProcessing } = useProcessing()
  const start = useFileOperation(file)
  const controller = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<MessageText>('')
  const [error, setError] = useState<MessageText>('')
  const { result, setResult } = useToolResult(sourceKey, name)

  useEffect(() => {
    setError('')
    setProgress('')
    return () => controller.current?.abort()
  }, [file, sourceKey])

  async function process() {
    if (!file || disabled || isProcessing || controller.current) return
    const abort = new AbortController()
    controller.current = abort
    const operation = start()
    setResult(null)
    setProgress(status ?? message('pDFActionWorkingOnYourFile'))
    setError('')
    try {
      const output = await run(abort.signal, (next) => {
        if (operation.isCurrent() && !abort.signal.aborted) setProgress(next)
      })
      if (!operation.isCurrent() || abort.signal.aborted) return
      setResult(output)
      downloadBlob(output.blob, output.filename)
    } catch (cause) {
      if (operation.isCurrent() && !abort.signal.aborted)
        setError(
          messageFromError(
            cause,
            message('pDFActionYourFileCouldNotBeProcessed'),
          ),
        )
    } finally {
      if (controller.current === abort) controller.current = null
      if (operation.isCurrent()) setProgress('')
      operation.finish()
    }
  }

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <fieldset className="min-w-0 space-y-4" disabled={isProcessing}>
            {children}
          </fieldset>
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {renderMessage(t, error)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              className="w-full sm:w-auto"
              disabled={!file || disabled || isProcessing}
              onClick={() => void process()}
            >
              {progress && (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              )}
              {label}
            </Button>
            {progress && (
              <Button
                variant="outline"
                onClick={() => {
                  controller.current?.abort()
                  setProgress(message('pDFActionCancelling'))
                }}
              >
                {t('pDFActionCancel')}
              </Button>
            )}
          </div>
          {progress && (
            <p role="status" className="text-sm text-muted-foreground">
              {renderMessage(t, progress)}
            </p>
          )}
        </CardContent>
      </Card>
      <ResultCard result={result} disabled={isProcessing} onReset={onReset} />
    </>
  )
}

export function PDFPageRanges({
  value,
  setValue,
  hint,
}: {
  value: string
  setValue: (value: string) => void
  hint: string
}) {
  const t = useTranslator()
  return (
    <div className="space-y-2">
      <Label htmlFor="pdf-page-ranges">{t('pDFActionPages')}</Label>
      <Input
        id="pdf-page-ranges"
        placeholder={t('pDFActionAllPages')}
        aria-describedby="pdf-page-ranges-hint"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <p id="pdf-page-ranges-hint" className="text-sm text-muted-foreground">
        {hint}
      </p>
    </div>
  )
}
