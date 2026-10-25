import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useOfficeTools } from '@/contexts/OfficeToolsContext'
import { FileText, Loader2 } from 'lucide-react'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { convertOfficeToPDF, getOutputFilename } from '@/lib/pandoc'
import { downloadBlob } from '@/lib/shared'

// The WASM pipeline shares compiler state. Reuse a pending conversion when a
// retained workspace remounts, and serialize work for different documents.
const pendingConversions = new WeakMap<
  File,
  ReturnType<typeof convertOfficeToPDF>
>()
let conversionQueue = Promise.resolve()

function convertDocument(file: File) {
  const pending = pendingConversions.get(file)
  if (pending) return pending
  const conversion = conversionQueue.then(() => convertOfficeToPDF(file))
  conversionQueue = conversion.then(
    () => undefined,
    () => undefined,
  )
  pendingConversions.set(file, conversion)
  void conversion.then(
    () => pendingConversions.delete(file),
    () => pendingConversions.delete(file),
  )
  return conversion
}

export const Route = createFileRoute('/office-documents/convert')({
  component: ConvertTool,
  head: () => ({
    meta: [
      {
        title:
          'Office to PDF Converter - Free Browser-Based Document Conversion | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based office document to PDF converter. Convert Word, PowerPoint, and Excel files to PDF format entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'Word to PDF converter, PowerPoint to PDF, Excel to PDF, document converter, browser PDF creator',
      },
      {
        property: 'og:title',
        content: 'Office to PDF Converter - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based office document to PDF converter with complete privacy.',
      },
    ],
  }),
})

function ConvertTool() {
  const { isProcessing, setIsProcessing } = useProcessing()
  const {
    selectedFile,
    conversionStatus,
    setConversionStatus,
    isCurrentFile,
    clearSelectedFile,
    chooseAnotherFile,
  } = useOfficeTools()
  const { result, setResult } = useToolResult(
    selectedFile?.file,
    'office.convert',
  )
  const conversionInProgress = useRef(false)
  const conversionVersion = useRef(0)

  useEffect(
    () => () => {
      conversionVersion.current++
      if (conversionInProgress.current) {
        conversionInProgress.current = false
        setIsProcessing(false)
        setConversionStatus('')
      }
    },
    [setIsProcessing, setConversionStatus],
  )

  const handleConvertToPDF = useCallback(async () => {
    if (!selectedFile || conversionInProgress.current) return

    const version = ++conversionVersion.current
    conversionInProgress.current = true
    setIsProcessing(true)
    setConversionStatus(`Converting ${selectedFile.name}...`)

    try {
      const result = await convertDocument(selectedFile.file)
      if (conversionVersion.current !== version || !isCurrentFile(selectedFile))
        return

      if (result.success && result.output instanceof Blob) {
        const outputName = getOutputFilename(selectedFile.name, 'pdf')
        setResult({
          blob: result.output,
          filename: outputName,
          details: ['PDF document'],
        })
        downloadBlob(result.output, outputName)
        setConversionStatus(`${selectedFile.name} converted to PDF`)
      } else {
        throw new Error(
          result.error ?? `Failed to convert ${selectedFile.name}`,
        )
      }
    } catch (error) {
      if (conversionVersion.current !== version || !isCurrentFile(selectedFile))
        return
      console.error('Conversion error:', error)
      setConversionStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      if (conversionVersion.current === version) {
        conversionInProgress.current = false
        setIsProcessing(false)
      }
    }
  }, [
    selectedFile,
    setIsProcessing,
    setConversionStatus,
    isCurrentFile,
    setResult,
  ])

  // Auto-trigger conversion when file is selected
  useEffect(() => {
    if (selectedFile && !isProcessing && !conversionStatus && !result) {
      void handleConvertToPDF()
    }
  }, [selectedFile, isProcessing, conversionStatus, handleConvertToPDF, result])

  const error = conversionStatus.startsWith('❌ Error: ')
    ? conversionStatus.slice('❌ Error: '.length)
    : ''

  return (
    <div className="space-y-4">
      {!result && (
        <Card className="shadow-none">
          <CardContent className="space-y-4 p-4 sm:p-6">
            {error ? (
              <div role="alert" className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">
                    This document could not be opened
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    It may be damaged or use an unsupported format. Open it in
                    the app that created it, save a new copy, then choose that
                    file.
                  </p>
                </div>
                <Button onClick={chooseAnotherFile} disabled={isProcessing}>
                  Choose another file
                </Button>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">
                    Technical details
                  </summary>
                  <p className="mt-2 text-muted-foreground [overflow-wrap:anywhere]">
                    {error}
                  </p>
                </details>
              </div>
            ) : selectedFile ? (
              <div role="status" className="flex items-start gap-3">
                <Loader2
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 animate-spin text-primary"
                />
                <div className="min-w-0 space-y-2">
                  <p className="font-medium [overflow-wrap:anywhere]">
                    {conversionStatus || 'Preparing conversion…'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your document is being converted in this browser. Larger
                    documents can take a little longer.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <FileText
                  aria-hidden="true"
                  className="size-6 text-muted-foreground"
                />
                <h2 className="text-lg font-semibold">
                  A PDF copy of your document
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose a Word, PowerPoint, or Excel document. Conversion
                  starts automatically and keeps your original file unchanged.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {result && conversionStatus && (
        <p
          role="status"
          className="text-sm text-muted-foreground [overflow-wrap:anywhere]"
        >
          {conversionStatus}
        </p>
      )}
      <ResultCard result={result} onReset={clearSelectedFile} />
    </div>
  )
}
