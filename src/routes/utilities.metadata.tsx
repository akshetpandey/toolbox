import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { useUtilities } from '@/contexts/UtilitiesContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { formatFileSize } from '@/lib/metadata'
import { Info, FileText, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/utilities/metadata')({
  component: MetadataExtractionPage,
})

function MetadataExtractionPage() {
  const { selectedFile, fileMetadata, exifMetadata, isExtractingExif } =
    useUtilities()
  const { isProcessing } = useProcessing()

  return (
    <div className="flex flex-col gap-4">
      {/* File Metadata Section */}
      <Card className="glass-card border-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-foreground">File Metadata</h3>
          </div>

          {selectedFile && (
            <div className="flex flex-col gap-4">
              {/* Loading state */}
              {isProcessing && !fileMetadata && (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-sm">Extracting metadata...</p>
                  </div>
                </div>
              )}

              {fileMetadata && (
                <div className="grid grid-cols-1 gap-3 text-sm bg-muted/50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MIME Type:</span>
                    <span className="font-medium">{fileMetadata.mimeType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description:</span>
                    <span className="font-medium">
                      {fileMetadata.description}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span className="font-medium">
                      {formatFileSize(fileMetadata.size)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!selectedFile && (
            <div className="flex items-center justify-center h-24">
              <div className="text-center text-muted-foreground">
                <p className="text-sm">
                  Select a file to extract metadata automatically
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
          ) : selectedFile?.type.startsWith('image/') &&
            Object.keys(exifMetadata).length > 0 ? (
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
                    <span className="text-muted-foreground font-medium truncate pr-2">
                      {key}:
                    </span>
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
                <p className="text-sm">
                  {selectedFile?.type.startsWith('image/')
                    ? 'No EXIF metadata found'
                    : 'Select an image file to view EXIF metadata'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
