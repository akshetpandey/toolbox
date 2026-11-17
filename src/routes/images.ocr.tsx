import { errorMessage } from '@/i18n/MessageError'
import { message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui'
import { useFileOperation } from '@/contexts/FileOperation'
import { useImageTools } from '@/contexts/ImageToolsContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { downloadBlob } from '@/lib/shared'

export const Route = createFileRoute('/images/ocr')({ component: ImageOCRPage })

function ImageOCRPage() {
  const t = useTranslator()
  const { selectedFile, clearSelectedFile } = useImageTools()
  const { isProcessing } = useProcessing()
  const begin = useFileOperation(selectedFile?.file)
  const [text, setText] = useWorkspaceState<string | null>(
    'images.ocr.text',
    null,
  )
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const controller = useRef<AbortController | null>(null)
  const sourceKey = useMemo(
    () => ({ file: selectedFile?.file, text }),
    [selectedFile?.file, text],
  )
  const { result, setResult } = useToolResult(sourceKey, 'images.ocr')

  useEffect(() => {
    setError('')
    setStatus('')
    setCopyStatus('')
    return () => controller.current?.abort()
  }, [selectedFile?.file])

  async function recognize() {
    if (!selectedFile || isProcessing || controller.current) return
    const operation = begin()
    const abort = new AbortController()
    controller.current = abort
    setError('')
    setCopyStatus('')
    setText(null)
    setStatus(t('imagesOcrLoadingTextRecognition'))
    try {
      const { recognizeImageText } = await import('@/lib/ocr')
      const recognized = await recognizeImageText(
        selectedFile.preview,
        abort.signal,
        (message) => {
          if (operation.isCurrent()) setStatus(message)
        },
      )
      if (!operation.isCurrent() || abort.signal.aborted) return
      if (!recognized) throw new Error(t('imagesOcrNoTextWasFoundTryA'))
      setText(recognized)
    } catch (cause) {
      if (operation.isCurrent() && !abort.signal.aborted)
        setError(
          errorMessage(
            t,
            cause,
            t('imagesOcrTextRecognitionFailedTryAnotherImage'),
          ),
        )
    } finally {
      if (controller.current === abort) controller.current = null
      if (operation.isCurrent()) setStatus('')
      operation.finish()
    }
  }

  function download() {
    if (!selectedFile || !text?.trim() || isProcessing) return
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const filename = `${selectedFile.name.replace(/\.[^.]+$/, '')}-text.txt`
    setResult({
      blob,
      filename,
      details: [message('imagesOcrRecognizedTextReviewForAccuracy')],
    })
    downloadBlob(blob, filename)
  }

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">
            {t('imagesOcrRecognizeTextInAnImage')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('imagesOcrExtractPrintedEnglishTextFromA')}
          </p>
          {selectedFile && (
            <img
              src={selectedFile.preview}
              alt={t('imagesOcrImageToRecognize')}
              className="max-h-72 max-w-full rounded border object-contain"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!selectedFile || isProcessing}
              onClick={() => void recognize()}
            >
              {t('imagesOcrRecognizeText')}
            </Button>
            {status && (
              <Button
                variant="outline"
                onClick={() => {
                  controller.current?.abort()
                  setStatus(t('imagesOcrCancelling'))
                }}
              >
                {t('imagesOcrCancel')}
              </Button>
            )}
          </div>
          {status && (
            <p role="status" className="text-sm text-muted-foreground">
              {status}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {text !== null && (
            <div className="space-y-3">
              <Label htmlFor="ocr-text">{t('imagesOcrRecognizedText')}</Label>
              <textarea
                id="ocr-text"
                rows={12}
                disabled={isProcessing}
                className="w-full rounded-md border bg-background p-3 text-base"
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  setCopyStatus('')
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={isProcessing || !text?.trim()}
                  onClick={download}
                >
                  {t('imagesOcrDownloadText')}
                </Button>
                <Button
                  variant="outline"
                  disabled={isProcessing || !text?.trim()}
                  onClick={() => {
                    void (
                      navigator.clipboard
                        ? navigator.clipboard.writeText(text)
                        : Promise.reject(new Error('Clipboard unavailable'))
                    ).then(
                      () => setCopyStatus(t('imagesOcrTextCopied')),
                      () =>
                        setCopyStatus(t('imagesOcrCopyFailedSelectTheTextAnd')),
                    )
                  }}
                >
                  {t('imagesOcrCopyText')}
                </Button>
              </div>
              {copyStatus && (
                <p role="status" className="text-sm text-muted-foreground">
                  {copyStatus}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <ResultCard
        result={result}
        disabled={isProcessing}
        onReset={clearSelectedFile}
      />
    </>
  )
}
