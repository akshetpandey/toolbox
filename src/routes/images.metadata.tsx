import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Loader2, Settings, Info } from 'lucide-react'
import { formatFileSize } from '@/lib/imagemagick'
import { useImageTools } from '@/contexts/ImageToolsContext'

export const Route = createFileRoute('/images/metadata')({
  component: MetadataPage,
})

function MetadataPage() {
  const { selectedFile, metadata, exifMetadata, isExtractingExif } =
    useImageTools()

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
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-foreground">EXIF Metadata</h3>
              {isExtractingExif && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
