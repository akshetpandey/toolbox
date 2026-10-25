import { useFileOperation } from '@/contexts/FileOperation'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Settings, Info, ShieldOff } from 'lucide-react'
import { formatFileSize } from '@/lib/imagemagick'
import { downloadBlob } from '@/lib/shared'
import { stripFileMetadata } from '@/lib/metadata'
import { useImageTools } from '@/contexts/ImageToolsContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useEffect, useState } from 'react'
import { ResultCard, useToolResult } from '@/components/ResultCard'

export const Route = createFileRoute('/images/metadata')({
  component: MetadataPage,
  head: () => ({
    meta: [
      {
        title: 'Image Metadata Viewer - Free Browser-Based EXIF Tool | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based image metadata and EXIF viewer. Extract image metadata and strip metadata for privacy. Process images entirely in your browser.',
      },
      {
        name: 'keywords',
        content:
          'EXIF viewer, image metadata, strip metadata, privacy protection, browser EXIF reader',
      },
      {
        property: 'og:title',
        content: 'Image Metadata Viewer - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based image metadata and EXIF viewer with privacy protection features.',
      },
    ],
  }),
})

function MetadataPage() {
  const {
    selectedFile,
    metadata,
    exifMetadata,
    isExtractingExif,
    clearSelectedFile,
  } = useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(selectedFile?.file)
  const [isStrippingMetadata, setIsStrippingMetadata] = useState(false)
  const [stripError, setStripError] = useState<string | null>(null)
  const { result, setResult } = useToolResult(
    selectedFile?.file,
    'images.metadata',
  )
  const imageMetadata = selectedFile ? metadata[selectedFile.name] : null
  const supportsRemoval =
    selectedFile &&
    ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'].includes(
      selectedFile.file.type,
    )

  useEffect(() => {
    setStripError(null)
  }, [selectedFile])

  const handleStripMetadata = async () => {
    if (!selectedFile) return
    setIsStrippingMetadata(true)
    const operation = beginOperation()
    setStripError(null)
    try {
      const blob = await stripFileMetadata(selectedFile.file)
      if (!operation.isCurrent()) return
      const filename = `no-metadata_${selectedFile.name}`
      setResult({
        blob,
        filename,
        sourceSize: selectedFile.size,
        details: [
          ...(selectedFile.dimensions
            ? [
                `${selectedFile.dimensions.width} × ${selectedFile.dimensions.height} px`,
              ]
            : []),
          'Embedded metadata removed; ICC color profile retained. The source image is unchanged.',
        ],
      })
      downloadBlob(blob, filename)
    } catch {
      if (!operation.isCurrent()) return
      setStripError(
        'Failed to strip metadata. No file was downloaded. Please try again.',
      )
    } finally {
      if (operation.isCurrent()) setIsStrippingMetadata(false)
      operation.finish()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Settings className="size-5 text-primary" />
            Image information
          </h2>
          {imageMetadata ? (
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              {[
                [
                  'Dimensions',
                  `${imageMetadata.width} × ${imageMetadata.height} px`,
                ],
                ['Format', imageMetadata.format],
                ['Color space', imageMetadata.colorspace],
                ['Bit depth', String(imageMetadata.depth)],
                ['Compression', imageMetadata.compression],
                ['File size', formatFileSize(imageMetadata.size)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              {selectedFile
                ? 'Reading image information…'
                : 'Choose an image to view its information.'}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Info className="size-5 text-primary" />
            Embedded metadata
          </h2>
          {isExtractingExif ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Reading image metadata…
            </p>
          ) : selectedFile && Object.keys(exifMetadata).length > 0 ? (
            <dl className="max-h-96 min-w-0 overflow-y-auto divide-y divide-border text-sm">
              {Object.entries(exifMetadata)
                .filter(([, value]) => value !== null && value !== '')
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="grid min-w-0 grid-cols-1 gap-1 py-3 sm:grid-cols-2 sm:gap-4"
                  >
                    <dt className="break-words text-muted-foreground">{key}</dt>
                    <dd className="min-w-0 break-all font-medium">
                      {String(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              {selectedFile
                ? 'No embedded image metadata was found.'
                : 'Choose an image to inspect its embedded metadata.'}
            </p>
          )}
          {selectedFile && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Remove embedded EXIF, GPS, XMP, and other supported metadata
                from a new copy. Color profiles are retained. This does not hide
                visible text, faces, or other image content.
              </p>
              <p className="text-sm text-muted-foreground">
                Available for JPEG, PNG, WebP, and TIFF images.
              </p>
              {supportsRemoval && (
                <Button
                  onClick={() => void handleStripMetadata()}
                  disabled={isStrippingMetadata || isProcessing}
                  className="h-auto min-h-11 w-full whitespace-normal sm:w-auto"
                >
                  {isStrippingMetadata ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldOff className="size-4" />
                  )}
                  {isStrippingMetadata
                    ? 'Removing metadata…'
                    : 'Download Without Metadata'}
                </Button>
              )}
            </div>
          )}
          {stripError && (
            <p role="alert" className="break-words text-sm text-destructive">
              {stripError}
            </p>
          )}
        </CardContent>
      </Card>
      <ResultCard result={result} onReset={clearSelectedFile} />
    </div>
  )
}
