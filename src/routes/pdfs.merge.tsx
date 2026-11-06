import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { usePDFTools } from '@/contexts/PDFToolsContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { Loader2, Merge } from 'lucide-react'
import { mergePDFs } from '@/lib/pdf'
import { downloadBlob } from '@/lib/shared'

export const Route = createFileRoute('/pdfs/merge')({
  component: PDFMergeRoute,
})

function PDFMergeRoute() {
  const { selectedFiles, pageCounts, clearFiles } = usePDFTools()
  const { isProcessing, setIsProcessing } = useProcessing()
  const sourceKey = selectedFiles.map((file) => file.id).join('|')
  const currentSource = useRef(sourceKey)
  currentSource.current = sourceKey
  const { result, setResult } = useToolResult(sourceKey, 'pdfs.merge')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const operation = useRef(0)
  const busy = useRef(false)
  const pagesReady = selectedFiles.every(
    (file) => typeof pageCounts[file.id] === 'number',
  )
  const invalidPDF = selectedFiles.some((file) => pageCounts[file.id] === null)
  const totalPages = selectedFiles.reduce(
    (sum, file) => sum + (pageCounts[file.id] ?? 0),
    0,
  )

  useEffect(() => {
    setError('')
  }, [sourceKey])
  useEffect(
    () => () => {
      operation.current++
      if (busy.current) {
        busy.current = false
        setIsProcessing(false)
      }
    },
    [setIsProcessing],
  )

  const handleMergePDFs = async () => {
    if (selectedFiles.length < 2 || !pagesReady || busy.current) return
    const version = ++operation.current
    busy.current = true
    setIsProcessing(true)
    setError('')
    setProgress('Preparing your PDFs…')
    try {
      const merged = await mergePDFs({
        files: selectedFiles,
        onFileProcessed: (index) => {
          if (operation.current === version)
            setProgress(`Merged ${index + 1} of ${selectedFiles.length} PDFs…`)
        },
      })
      if (operation.current !== version || currentSource.current !== sourceKey)
        return
      if (!merged.success || !merged.blob)
        throw new Error(merged.error ?? 'PDF merge failed')
      setResult({
        blob: merged.blob,
        filename: 'merged-document.pdf',
        details: [`${totalPages} pages from ${selectedFiles.length} PDFs`],
      })
      downloadBlob(merged.blob, 'merged-document.pdf')
    } catch (cause) {
      if (operation.current === version && currentSource.current === sourceKey)
        setError(cause instanceof Error ? cause.message : 'Unknown PDF error')
    } finally {
      if (operation.current === version) {
        busy.current = false
        setIsProcessing(false)
        setProgress('')
      }
    }
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Combine your documents</h2>
            <p className="text-sm text-muted-foreground">
              Files are combined in the order shown. Add PDFs and use the arrows
              or drag handles to change their order.
            </p>
          </div>
          {selectedFiles.length > 0 ? (
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="font-medium">
                {selectedFiles.length}{' '}
                {selectedFiles.length === 1 ? 'PDF' : 'PDFs'}
                {pagesReady &&
                  ` · ${totalPages} ${totalPages === 1 ? 'page' : 'pages'}`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pagesReady
                  ? 'Output: merged-document.pdf'
                  : 'Reading PDF page counts…'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose at least two PDF files to get started.
            </p>
          )}
          {invalidPDF && (
            <p role="alert" className="text-sm text-destructive">
              A PDF could not be opened. Remove it and choose a valid copy of
              the document.
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <p>
                These PDFs could not be combined. Try another copy of the files,
                and make sure they are not password-protected.
              </p>
              <details>
                <summary className="cursor-pointer font-medium">
                  Technical details
                </summary>
                <p className="mt-2 [overflow-wrap:anywhere]">{error}</p>
              </details>
              <Button variant="outline" onClick={clearFiles}>
                Choose other PDFs
              </Button>
            </div>
          )}
          <Button
            className="w-full sm:w-auto"
            onClick={() => void handleMergePDFs()}
            disabled={isProcessing || selectedFiles.length < 2 || !pagesReady}
          >
            {busy.current ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Merge aria-hidden="true" className="size-4" />
            )}
            {busy.current
              ? 'Merging PDFs…'
              : `Merge ${selectedFiles.length >= 2 ? selectedFiles.length : ''} PDFs`}
          </Button>
          {progress && (
            <p role="status" className="text-sm text-muted-foreground">
              {progress}
            </p>
          )}
        </CardContent>
      </Card>
      <ResultCard result={result} onReset={clearFiles} />
    </div>
  )
}
