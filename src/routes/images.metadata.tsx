import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Loader2, Settings, Info, Download, ShieldOff } from 'lucide-react'
import { formatFileSize } from '@/lib/imagemagick'
import { downloadBlob } from '@/lib/shared'
import { stripFileMetadata } from '@/lib/metadata'
import { useImageTools } from '@/contexts/ImageToolsContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useState } from 'react'

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
  const { selectedFile, metadata, exifMetadata, isExtractingExif } =
    useImageTools()
  const { isProcessing, setIsProcessing } = useProcessing()
  const [isStrippingMetadata, setIsStrippingMetadata] = useState(false)

  const handleStripMetadata = async () => {
    if (!selectedFile) return

    try {
      setIsStrippingMetadata(true)
      setIsProcessing(true)

      console.log(
        '🖼️ MetadataPage: Starting metadata stripping for',
        selectedFile.name,
      )

      const blob = await stripFileMetadata(selectedFile.file)
      const filename = `no-metadata_${selectedFile.name}`

      downloadBlob(blob, filename)

      console.log('🖼️ MetadataPage: Metadata stripping completed successfully')
    } catch (error) {
      console.error('🖼️ MetadataPage: Error stripping metadata:', error)
      alert('Failed to strip metadata. Please try again.')
    } finally {
      setIsStrippingMetadata(false)
      setIsProcessing(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {/* ImageMagick Metadata Section */}
        <Card className="glass-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-foreground">Metadata</h3>
            </div>
            {selectedFile && metadata[selectedFile.name] ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dimensions:</span>
                  <span className="font-medium">
                    {metadata[selectedFile.name].width} ×{' '}
                    {metadata[selectedFile.name].height}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span className="font-medium">
                    {metadata[selectedFile.name].format}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Colorspace:</span>
                  <span className="font-medium">
                    {metadata[selectedFile.name].colorspace}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bit Depth:</span>
                  <span className="font-medium">
                    {metadata[selectedFile.name].depth}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compression:</span>
                  <span className="font-medium">
                    {metadata[selectedFile.name].compression}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-medium">
                    {formatFileSize(metadata[selectedFile.name].size)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">
                    Select an image to view ImageMagick metadata
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* EXIF Metadata Section */}
        <Card className="glass-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-foreground">EXIF Metadata</h3>
                {isExtractingExif && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
              </div>
              {selectedFile && Object.keys(exifMetadata).length > 0 && (
                <Button
                  onClick={() => void handleStripMetadata()}
                  disabled={isStrippingMetadata || isProcessing}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isStrippingMetadata ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldOff className="h-4 w-4" />
                  )}
                  <Download className="h-4 w-4" />
                  {isStrippingMetadata
                    ? 'Stripping...'
                    : 'Download Without Metadata'}
                </Button>
              )}
            </div>
            {isExtractingExif ? (
              <div className="flex items-center justify-center h-24">
                <div className="text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm">Extracting EXIF metadata...</p>
                </div>
              </div>
            ) : selectedFile && exifMetadata ? (
              <div className="flex flex-col gap-2">
                {Object.keys(exifMetadata).length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 text-sm bg-muted/50 p-4 rounded-lg max-h-64 overflow-y-auto">
                    {Object.entries(exifMetadata)
                      .filter(
                        ([, value]) =>
                          value !== null && value !== undefined && value !== '',
                      )
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between py-1 border-b border-border/20 last:border-0"
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground font-medium truncate pr-2 md:cursor-default cursor-help">
                                {key}:
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="md:hidden">
                              <p>{key}</p>
                            </TooltipContent>
                          </Tooltip>
                          <span className="font-medium text-right">
                            {typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24">
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">No EXIF metadata found</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">
                    Select an image to view EXIF metadata
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
