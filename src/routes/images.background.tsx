import { renderMessage, message } from '@/i18n/messages'
import type { MessageText } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFileOperation } from '@/contexts/FileOperation'
import { useImageTools } from '@/contexts/ImageToolsContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { downloadBlob } from '@/lib/shared'

export const Route = createFileRoute('/images/background')({
  component: RemoveImageBackground,
})

function RemoveImageBackground() {
  const t = useTranslator()
  const { selectedFile, clearSelectedFile, imageMagickProcessor } =
    useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(selectedFile?.file)
  const [mode, setMode] = useWorkspaceState<'auto' | 'color'>(
    'images.background.mode',
    'auto',
  )
  const [color, setColor] = useWorkspaceState(
    'images.background.color',
    '#ffffff',
  )
  const [tolerance, setTolerance] = useWorkspaceState(
    'images.background.tolerance',
    12,
  )
  const [error, setError] = useWorkspaceState<MessageText>(
    'images.background.error',
    '',
  )
  const { result, setResult, clearResult } = useToolResult(
    selectedFile?.file,
    'images.background',
  )
  const preview = useRef<HTMLImageElement>(null)
  const [outputPreview, setOutputPreview] = useState<{
    blob: Blob
    url: string
  } | null>(null)
  useEffect(() => {
    if (!result) {
      setOutputPreview(null)
      return
    }
    const url = URL.createObjectURL(result.blob)
    setOutputPreview({ blob: result.blob, url })
    return () => URL.revokeObjectURL(url)
  }, [result])

  const changeColor = (value: string) => {
    setColor(value)
    setError('')
    clearResult()
  }

  const sampleColor = (event: MouseEvent<HTMLButtonElement>) => {
    const image = preview.current
    if (!image?.naturalWidth || !image.naturalHeight) return
    const bounds = image.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    // Keyboard activation samples the center. The native color picker is also available.
    const x = event.detail ? (event.clientX - bounds.left) / bounds.width : 0.5
    const y = event.detail ? (event.clientY - bounds.top) / bounds.height : 0.5
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')
    if (!context) return
    try {
      context.drawImage(
        image,
        Math.max(
          0,
          Math.min(image.naturalWidth - 1, Math.floor(x * image.naturalWidth)),
        ),
        Math.max(
          0,
          Math.min(
            image.naturalHeight - 1,
            Math.floor(y * image.naturalHeight),
          ),
        ),
        1,
        1,
        0,
        0,
        1,
        1,
      )
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
      if (alpha === 0) return
      changeColor(
        `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
      )
    } catch {
      setError(message('imagesBackgroundThePreviewColorCouldNotBe'))
    }
  }

  const removeBackground = async () => {
    if (!selectedFile) return
    const operation = beginOperation()
    setError('')
    clearResult()
    try {
      let blob: Blob
      if (mode === 'auto') {
        const { removeImageBackground } = await import('@/lib/imageBackground')
        if (!operation.isCurrent()) return
        blob = await removeImageBackground(selectedFile.preview)
      } else {
        blob = await imageMagickProcessor.removeBackgroundColor(
          selectedFile.file,
          color,
          tolerance,
        )
      }
      if (!operation.isCurrent()) return
      const filename = `${selectedFile.name.replace(/\.[^.]+$/, '')}-transparent.png`
      setResult({
        blob,
        filename,
        details: [message('imagesBackgroundTransparentPNG')],
      })
      downloadBlob(blob, filename)
    } catch (failure) {
      if (operation.isCurrent()) {
        console.error('Image background removal failed', failure)
        setError(
          mode === 'auto'
            ? message('imagesBackgroundTheBackgroundCouldNotBeRemoved')
            : message('imagesBackgroundTheColorCouldNotBeRemoved'),
        )
      }
    } finally {
      operation.finish()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="background-mode">
              {t('imagesBackgroundRemovalMethod')}
            </Label>
            <select
              id="background-mode"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
              value={mode}
              disabled={isProcessing}
              onChange={(event) => {
                setMode(event.target.value === 'color' ? 'color' : 'auto')
                clearResult()
                setError('')
              }}
            >
              <option value="auto">{t('imagesBackgroundDetectSubject')}</option>
              <option value="color">{t('imagesBackgroundSolidColor')}</option>
            </select>
            <p className="text-sm text-muted-foreground">
              {mode === 'auto'
                ? t('imagesBackgroundKeepTheMainSubjectInA')
                : t('imagesBackgroundMakeEveryPixelThatMatchesThe')}{' '}
              {t('imagesBackgroundAnimatedImagesExportTheirFirstFrame')}
            </p>
          </div>
          {mode === 'color' && selectedFile && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('imagesBackgroundSelectASpotInTheImage')}
              </p>
              <button
                type="button"
                aria-label={t('imagesBackgroundSampleAColorFromTheImage')}
                disabled={isProcessing}
                className="grid min-h-11 min-w-11 max-w-full cursor-crosshair place-items-center rounded-md bg-muted/30"
                onClick={sampleColor}
              >
                <img
                  ref={preview}
                  src={selectedFile.preview}
                  alt={t('imagesBackgroundBackgroundColorPreview')}
                  className="block max-h-[45vh] max-w-full rounded-md"
                />
              </button>
            </div>
          )}
          {mode === 'color' && (
            <fieldset className="space-y-4" disabled={isProcessing}>
              <div className="flex min-h-11 items-center gap-3">
                <Label htmlFor="background-color">
                  {t('imagesBackgroundColorToRemove')}
                </Label>
                <input
                  id="background-color"
                  type="color"
                  value={color}
                  onChange={(event) => changeColor(event.target.value)}
                  className="h-10 w-14 cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="background-tolerance">
                  {t('imagesBackgroundColorTolerance', { percent: tolerance })}
                </Label>
                <Input
                  id="background-tolerance"
                  type="range"
                  min="0"
                  max="60"
                  value={tolerance}
                  onChange={(event) => {
                    setTolerance(Number(event.target.value))
                    clearResult()
                    setError('')
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  {t('imagesBackgroundIncreaseToleranceToIncludeMoreShades')}
                </p>
              </div>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {renderMessage(t, error)}
            </p>
          )}
          <Button
            className="w-full sm:w-auto"
            disabled={!selectedFile || isProcessing}
            onClick={() => void removeBackground()}
          >
            {isProcessing
              ? t('imagesBackgroundRemovingBackground')
              : t('imagesBackgroundRemoveBackgroundDownloadPNG')}
          </Button>
        </CardContent>
      </Card>
      {result && outputPreview?.blob === result.blob && (
        <section
          aria-label={t('imagesBackgroundBackgroundRemovalPreview')}
          className="rounded-xl border bg-card p-4"
        >
          <img
            src={outputPreview.url}
            alt={t('imagesBackgroundImageWithTheBackgroundRemoved')}
            className="block max-h-80 max-w-full rounded-md bg-muted/60"
          />
        </section>
      )}
      <ResultCard
        result={result}
        onReset={clearSelectedFile}
        disabled={isProcessing}
      />
    </div>
  )
}
