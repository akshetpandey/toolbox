import { useFileOperation } from '@/contexts/FileOperation'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUtilities } from '@/contexts/UtilitiesContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { formatFileSize, stripFileMetadata } from '@/lib/metadata'
import { downloadBlob } from '@/lib/shared'
import { Info, FileText, Loader2, ShieldOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ResultCard, useToolResult } from '@/components/ResultCard'

export const Route = createFileRoute('/utilities/metadata')({
  component: MetadataExtractionPage,
  head: () => ({
    meta: [
      {
        title:
          'File Metadata Tool - Free Browser-Based Metadata Viewer | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based file metadata viewer and stripper. View file information and strip metadata for privacy protection entirely in your browser.',
      },
      {
        name: 'keywords',
        content:
          'file metadata viewer, strip metadata, privacy protection, file information, browser metadata tool',
      },
      {
        property: 'og:title',
        content: 'File Metadata Tool - Free Browser-Based Viewer',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based metadata viewer with privacy protection features.',
      },
    ],
  }),
})

function MetadataExtractionPage() {
  const {
    selectedFile,
    fileMetadata,
    exifMetadata,
    isExtractingExif,
    clearFile,
  } = useUtilities()
  const { isProcessing } = useProcessing()
  // Replacement starts its own analysis; keep stripping progress local.
  const beginOperation = useFileOperation(selectedFile?.file, false)
  const [isStrippingMetadata, setIsStrippingMetadata] = useState(false)
  const [stripError, setStripError] = useState<string | null>(null)
  const { result, setResult } = useToolResult(
    selectedFile?.file,
    'utilities.metadata',
  )
  const isImage = selectedFile?.type.startsWith('image/')
  const supportsRemoval =
    selectedFile &&
    ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'].includes(
      selectedFile.type,
    )
  useEffect(() => {
    setStripError(null)
    setIsStrippingMetadata(false)
  }, [selectedFile])

  const handleStripMetadata = async () => {
    if (!selectedFile || !supportsRemoval) return
    const operation = beginOperation()
    setIsStrippingMetadata(true)
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
          'Embedded image metadata removed; color profile retained. Source file unchanged.',
        ],
      })
      downloadBlob(blob, filename)
    } catch {
      if (!operation.isCurrent()) return
      setStripError(
        'Metadata could not be removed. No file was downloaded. Try another image or try again.',
      )
    } finally {
      if (operation.isCurrent()) setIsStrippingMetadata(false)
      operation.finish()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="size-5 text-primary" />
            File information
          </h2>
          {selectedFile ? (
            fileMetadata ? (
              <dl className="grid min-w-0 grid-cols-1 gap-4 text-sm">
                {[
                  ['MIME type', fileMetadata.mimeType],
                  ['Description', fileMetadata.description],
                  ['Size', formatFileSize(fileMetadata.size)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                {isProcessing
                  ? 'Extracting metadata...'
                  : 'File information is not available. Choose another file to try again.'}
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a file to extract metadata automatically
            </p>
          )}
          {selectedFile && !isImage && (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              This file type has no image EXIF metadata. Metadata removal here
              is available for JPEG, PNG, WebP, and TIFF images.
            </p>
          )}
        </CardContent>
      </Card>
      {isImage && (
        <Card>
          <CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Info className="size-5 text-primary" />
              Image EXIF metadata
            </h2>
            {isExtractingExif ? (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
                Extracting EXIF metadata...
              </p>
            ) : Object.keys(exifMetadata).length > 0 ? (
              <dl className="max-h-96 min-w-0 divide-y divide-border overflow-y-auto text-sm">
                {Object.entries(exifMetadata)
                  .filter(([, value]) => value !== null && value !== '')
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="grid min-w-0 grid-cols-1 gap-1 py-3 sm:grid-cols-2 sm:gap-4"
                    >
                      <dt className="break-words text-muted-foreground">
                        {key}:
                      </dt>
                      <dd className="min-w-0 break-all font-medium">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No EXIF metadata found
              </p>
            )}
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Create a copy with embedded EXIF, GPS, XMP, and other supported
                metadata removed. Color profiles are retained; visible file
                content is unchanged. Available for JPEG, PNG, WebP, and TIFF.
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
            {stripError && (
              <p role="alert" className="text-sm text-destructive">
                {stripError}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <ResultCard result={result} onReset={clearFile} />
    </div>
  )
}
