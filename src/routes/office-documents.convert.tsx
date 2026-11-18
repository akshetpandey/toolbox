import { errorMessage, MessageError } from '@/i18n/MessageError'
import { message, renderMessage } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
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
})

function ConvertTool() {
  const t = useTranslator()
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
        setConversionStatus(null)
      }
    },
    [setIsProcessing, setConversionStatus],
  )

  const handleConvertToPDF = useCallback(async () => {
    if (!selectedFile || conversionInProgress.current) return

    const version = ++conversionVersion.current
    conversionInProgress.current = true
    setIsProcessing(true)
    setConversionStatus(
      message('officeDocumentsConvertConverting', {
        filename: selectedFile.name,
      }),
    )

    try {
      const result = await convertDocument(selectedFile.file)
      if (conversionVersion.current !== version || !isCurrentFile(selectedFile))
        return

      if (result.success && result.output instanceof Blob) {
        const outputName = getOutputFilename(selectedFile.name, 'pdf')
        setResult({
          blob: result.output,
          filename: outputName,
          details: [message('officeDocumentsConvertPDFDocument')],
        })
        downloadBlob(result.output, outputName)
        setConversionStatus(
          message('officeDocumentsConvertConvertedToPDF', {
            filename: selectedFile.name,
          }),
        )
      } else {
        if (result.error) throw new Error(result.error)
        throw new MessageError('officeDocumentsConvertFailedToConvert', {
          filename: selectedFile.name,
        })
      }
    } catch (error) {
      if (conversionVersion.current !== version || !isCurrentFile(selectedFile))
        return
      console.error('Conversion error:', error)
      setConversionStatus({ error })
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

  const error =
    conversionStatus && 'error' in conversionStatus
      ? errorMessage(
          t,
          conversionStatus.error,
          t('officeDocumentsConvertUnknownError'),
        )
      : ''
  const statusText =
    conversionStatus && 'key' in conversionStatus
      ? renderMessage(t, conversionStatus)
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
                    {t('officeDocumentsConvertThisDocumentCouldNotBeOpened')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('officeDocumentsConvertItMayBeDamagedOrUse')}
                  </p>
                </div>
                <Button onClick={chooseAnotherFile} disabled={isProcessing}>
                  {t('officeDocumentsConvertChooseAnotherFile')}
                </Button>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">
                    {t('officeDocumentsConvertTechnicalDetails')}
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
                    {statusText ||
                      t('officeDocumentsConvertPreparingConversion')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('officeDocumentsConvertYourDocumentIsBeingConvertedIn')}
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
                  {t('officeDocumentsConvertAPDFCopyOfYourDocument')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('officeDocumentsConvertChooseAWordPowerPointOrExcel')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {result && statusText && (
        <p
          role="status"
          className="text-sm text-muted-foreground [overflow-wrap:anywhere]"
        >
          {statusText}
        </p>
      )}
      <ResultCard result={result} onReset={clearSelectedFile} />
    </div>
  )
}
