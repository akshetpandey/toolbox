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
  setStatus: (message: string) => void,
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
  status = 'Working on your file…',
  disabled = false,
  onReset,
  run,
  children,
}: {
  file: File | undefined
  sourceKey: string
  name: string
  label: string
  status?: string
  disabled?: boolean
  onReset: () => void
  run: PDFActionTask
  children?: ReactNode
}) {
  const { isProcessing } = useProcessing()
  const start = useFileOperation(file)
  const controller = useRef<AbortController | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const { result, setResult } = useToolResult(sourceKey, name)

  useEffect(() => {
    setError('')
    setMessage('')
    return () => controller.current?.abort()
  }, [file, sourceKey])

  async function process() {
    if (!file || disabled || isProcessing || controller.current) return
    const abort = new AbortController()
    controller.current = abort
    const operation = start()
    setResult(null)
    setMessage(status)
    setError('')
    try {
      const output = await run(abort.signal, (next) => {
        if (operation.isCurrent() && !abort.signal.aborted) setMessage(next)
      })
      if (!operation.isCurrent() || abort.signal.aborted) return
      setResult(output)
      downloadBlob(output.blob, output.filename)
    } catch (cause) {
      if (operation.isCurrent() && !abort.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Your file could not be processed.',
        )
    } finally {
      if (controller.current === abort) controller.current = null
      if (operation.isCurrent()) setMessage('')
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
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              className="w-full sm:w-auto"
              disabled={!file || disabled || isProcessing}
              onClick={() => void process()}
            >
              {message && (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              )}
              {label}
            </Button>
            {message && (
              <Button
                variant="outline"
                onClick={() => {
                  controller.current?.abort()
                  setMessage('Cancelling…')
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          {message && (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
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
  return (
    <div className="space-y-2">
      <Label htmlFor="pdf-page-ranges">Pages</Label>
      <Input
        id="pdf-page-ranges"
        placeholder="All pages"
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
