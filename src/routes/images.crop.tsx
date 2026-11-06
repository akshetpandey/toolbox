import { createFileRoute } from '@tanstack/react-router'
import { useRef, type PointerEvent } from 'react'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFileOperation } from '@/contexts/FileOperation'
import { useImageTools } from '@/contexts/ImageToolsContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { imageOutputFilename, isHeifImage } from '@/lib/imageFiles'
import type { ImageTransformOptions } from '@/lib/imagemagick'
import { downloadBlob } from '@/lib/shared'

export const Route = createFileRoute('/images/crop')({
  component: CropImage,
})

const rotations = [0, 90, 180, 270] as const
const cropRatios = [
  { label: 'Square (1:1)', ratio: 1 },
  { label: 'Portrait (4:5)', ratio: 4 / 5 },
  { label: 'Landscape (16:9)', ratio: 16 / 9 },
]
const fields = [
  { key: 'x', label: 'Left (px)' },
  { key: 'y', label: 'Top (px)' },
  { key: 'width', label: 'Crop width (px)' },
  { key: 'height', label: 'Crop height (px)' },
] as const
type CropInput = Record<(typeof fields)[number]['key'], string>

function CropImage() {
  const { selectedFile, imageMagickProcessor, clearSelectedFile } =
    useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(selectedFile?.file)
  const { result, setResult, clearResult } = useToolResult(
    selectedFile?.file,
    'images.crop',
  )
  const [settings, setSettings] = useWorkspaceState('images.crop.settings', {
    crop: null as CropInput | null,
    rotation: 0 as ImageTransformOptions['rotation'],
    flipHorizontal: false,
    flipVertical: false,
  })
  const [error, setError] = useWorkspaceState('images.crop.error', '')
  const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const dimensions = selectedFile?.dimensions
  const cropInput = settings.crop ?? {
    x: '0',
    y: '0',
    width: dimensions?.width.toString() ?? '',
    height: dimensions?.height.toString() ?? '',
  }
  const crop = {
    x: Number(cropInput.x),
    y: Number(cropInput.y),
    width: Number(cropInput.width),
    height: Number(cropInput.height),
  }
  const valid =
    dimensions &&
    fields.every(
      ({ key }) => cropInput[key].trim() && Number.isSafeInteger(crop[key]),
    ) &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.width >= 1 &&
    crop.height >= 1 &&
    crop.x + crop.width <= dimensions.width &&
    crop.y + crop.height <= dimensions.height
  const sideways = settings.rotation === 90 || settings.rotation === 270
  const outputWidth = sideways ? crop.height : crop.width
  const outputHeight = sideways ? crop.width : crop.height

  const update = (changes: Partial<typeof settings>) => {
    setSettings((previous) => ({ ...previous, ...changes }))
    if (result) clearResult()
    if (error) setError('')
  }

  const getPoint = (event: PointerEvent<HTMLDivElement>) => {
    if (!dimensions) return null
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null
    return {
      x: Math.round(
        Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) *
          dimensions.width,
      ),
      y: Math.round(
        Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) *
          dimensions.height,
      ),
    }
  }

  const selectCrop = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || start.pointerId !== event.pointerId) return
    const end = getPoint(event)
    if (!end || start.x === end.x || start.y === end.y) return
    update({
      crop: {
        x: String(Math.min(start.x, end.x)),
        y: String(Math.min(start.y, end.y)),
        width: String(Math.abs(start.x - end.x)),
        height: String(Math.abs(start.y - end.y)),
      },
    })
  }

  const centerCrop = (ratio: number) => {
    if (!dimensions) return
    const width = Math.max(
      1,
      Math.min(dimensions.width, Math.round(dimensions.height * ratio)),
    )
    const height = Math.max(
      1,
      Math.min(dimensions.height, Math.round(dimensions.width / ratio)),
    )
    update({
      crop: {
        x: String(Math.floor((dimensions.width - width) / 2)),
        y: String(Math.floor((dimensions.height - height) / 2)),
        width: String(width),
        height: String(height),
      },
    })
  }

  const save = async () => {
    if (!selectedFile || !valid) return
    const operation = beginOperation()
    setError('')
    try {
      const { blob, width, height } = await imageMagickProcessor.transformImage(
        selectedFile.file,
        {
          crop: settings.crop ? crop : undefined,
          rotation: settings.rotation,
          flipHorizontal: settings.flipHorizontal,
          flipVertical: settings.flipVertical,
        },
      )
      if (!operation.isCurrent()) return
      const filename = imageOutputFilename(`edited_${selectedFile.name}`, blob)
      setResult({ blob, filename, details: [`${width} × ${height} px`] })
      downloadBlob(blob, filename)
    } catch {
      if (operation.isCurrent())
        setError('The image could not be edited. Try a different image.')
    } finally {
      operation.finish()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          {selectedFile && dimensions ? (
            <>
              <p className="text-sm text-muted-foreground">
                Drag over the image to select an area or enter the crop in
                pixels.
              </p>
              <div
                className="relative inline-flex max-w-full touch-none select-none overflow-hidden rounded-md bg-muted/30"
                onPointerDown={(event) => {
                  if (isProcessing || event.button !== 0 || !event.isPrimary)
                    return
                  const point = getPoint(event)
                  if (!point) return
                  drag.current = { ...point, pointerId: event.pointerId }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={selectCrop}
                onPointerUp={(event) => {
                  selectCrop(event)
                  drag.current = null
                }}
                onLostPointerCapture={() => {
                  drag.current = null
                }}
              >
                <img
                  src={selectedFile.preview}
                  alt="Image crop preview"
                  draggable={false}
                  className="pointer-events-none block h-auto max-h-[50vh] w-auto max-w-full"
                />
                {settings.crop && valid && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_#0008]"
                    style={{
                      left: `${(crop.x / dimensions.width) * 100}%`,
                      top: `${(crop.y / dimensions.height) * 100}%`,
                      width: `${(crop.width / dimensions.width) * 100}%`,
                      height: `${(crop.height / dimensions.height) * 100}%`,
                    }}
                  />
                )}
              </div>
              <fieldset className="space-y-4" disabled={isProcessing}>
                <div className="flex flex-wrap gap-2" aria-label="Crop presets">
                  {cropRatios.map(({ label, ratio }) => (
                    <Button
                      key={label}
                      variant="outline"
                      onClick={() => centerCrop(ratio)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {fields.map(({ key, label }) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`crop-${key}`}>{label}</Label>
                      <Input
                        id={`crop-${key}`}
                        type="number"
                        min={key === 'x' || key === 'y' ? '0' : '1'}
                        step="1"
                        value={cropInput[key]}
                        onChange={(event) =>
                          update({
                            crop: { ...cropInput, [key]: event.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                {!valid && (
                  <p className="text-sm text-destructive">
                    Enter whole pixels and keep the crop within the image.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      update({
                        rotation:
                          rotations[
                            (rotations.indexOf(settings.rotation) + 1) %
                              rotations.length
                          ],
                      })
                    }
                  >
                    Rotate 90°
                  </Button>
                  <Button
                    variant="outline"
                    aria-pressed={settings.flipHorizontal}
                    onClick={() =>
                      update({ flipHorizontal: !settings.flipHorizontal })
                    }
                  >
                    Flip horizontally
                  </Button>
                  <Button
                    variant="outline"
                    aria-pressed={settings.flipVertical}
                    onClick={() =>
                      update({ flipVertical: !settings.flipVertical })
                    }
                  >
                    Flip vertically
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update({
                        crop: null,
                        rotation: 0,
                        flipHorizontal: false,
                        flipVertical: false,
                      })
                    }
                  >
                    Reset edits
                  </Button>
                </div>
              </fieldset>
              <p role="status" className="text-sm text-muted-foreground">
                Rotation {settings.rotation}°. Rotate and flip apply after the
                crop.
                {isHeifImage(selectedFile) &&
                  ' HEIC and HEIF are saved as PNG.'}
              </p>
              {valid &&
              (settings.crop ||
                settings.rotation ||
                settings.flipHorizontal ||
                settings.flipVertical) ? (
                <details className="space-y-3 rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Preview edited image ({outputWidth} × {outputHeight} px)
                  </summary>
                  <svg
                    role="img"
                    aria-label="Edited image preview"
                    width={outputWidth}
                    height={outputHeight}
                    viewBox={`0 0 ${outputWidth} ${outputHeight}`}
                    className="block h-auto max-h-64 w-auto max-w-full overflow-hidden rounded-md bg-muted/30"
                  >
                    <g
                      transform={`translate(${outputWidth / 2} ${outputHeight / 2}) scale(${settings.flipHorizontal ? -1 : 1} ${settings.flipVertical ? -1 : 1}) rotate(${settings.rotation})`}
                    >
                      <image
                        href={selectedFile.preview}
                        width={dimensions.width}
                        height={dimensions.height}
                        x={-crop.x - crop.width / 2}
                        y={-crop.y - crop.height / 2}
                      />
                    </g>
                  </svg>
                </details>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose an image to crop, rotate or flip.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            className="w-full sm:w-auto"
            disabled={!valid || isProcessing}
            onClick={() => void save()}
          >
            {isProcessing ? 'Preparing image…' : 'Apply edits & download'}
          </Button>
        </CardContent>
      </Card>
      <ResultCard
        result={result}
        onReset={clearSelectedFile}
        disabled={isProcessing}
      />
    </div>
  )
}
