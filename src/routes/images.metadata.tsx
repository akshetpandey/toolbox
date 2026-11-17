import { message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
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
})

function MetadataPage() {
  const t = useTranslator()
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
    setIsStrippingMetadata(false)
  }, [selectedFile?.file])

  const handleStripMetadata = async () => {
    if (!selectedFile || isProcessing || isStrippingMetadata) return
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
          message('imagesMetadataEmbeddedMetadataRemovedICCColorProfile'),
        ],
      })
      downloadBlob(blob, filename)
    } catch {
      if (!operation.isCurrent()) return
      setStripError(t('imagesMetadataFailedToStripMetadataNoFile'))
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
            {t('imagesMetadataImageInformation')}
          </h2>
          {imageMetadata ? (
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              {[
                [
                  t('imagesMetadataDimensions'),
                  `${imageMetadata.width} × ${imageMetadata.height} px`,
                ],
                [t('imagesMetadataFormat'), imageMetadata.format],
                [t('imagesMetadataColorSpace'), imageMetadata.colorspace],
                [t('imagesMetadataBitDepth'), String(imageMetadata.depth)],
                [t('imagesMetadataCompression'), imageMetadata.compression],
                [
                  t('imagesMetadataFileSize'),
                  formatFileSize(imageMetadata.size, t),
                ],
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
                ? t('imagesMetadataReadingImageInformation')
                : t('imagesMetadataChooseAnImageToViewIts')}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Info className="size-5 text-primary" />
            {t('imagesMetadataEmbeddedMetadata')}
          </h2>
          {isExtractingExif ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              {t('imagesMetadataReadingImageMetadata')}
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
                ? t('imagesMetadataNoEmbeddedImageMetadataWasFound')
                : t('imagesMetadataChooseAnImageToInspectIts')}
            </p>
          )}
          {selectedFile && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('imagesMetadataRemoveEmbeddedEXIFGPSXMPAnd')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('imagesMetadataAvailableForJPEGPNGWebPAnd')}
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
                    ? t('imagesMetadataRemovingMetadata')
                    : t('imagesMetadataDownloadWithoutMetadata')}
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
      <ResultCard
        result={result}
        onReset={clearSelectedFile}
        disabled={isProcessing || isStrippingMetadata}
      />
    </div>
  )
}
