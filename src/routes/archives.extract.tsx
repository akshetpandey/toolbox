import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  FileArchive,
  Download,
  File as FileIcon,
  Folder,
} from 'lucide-react'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useArchiveTools } from '@/contexts/ArchiveToolsContext'
import { formatFileSize } from '@/lib/archive'

export const Route = createFileRoute('/archives/extract')({
  component: ExtractPage,
})

function ExtractPage() {
  const { isProcessing, setIsProcessing } = useProcessing()
  const {
    uploadedArchive,
    extractedFiles,
    decompressArchive,
    downloadExtractedFile,
    downloadAllFiles,
    isInitialized,
  } = useArchiveTools()

  const handleExtract = async () => {
    if (!uploadedArchive || !isInitialized) {
      console.warn(
        '🗜️ ExtractTool: No archive selected or processor not initialized',
      )
      return
    }

    setIsProcessing(true)

    try {
      console.log('🗜️ ExtractTool: Starting extraction', {
        archiveName: uploadedArchive.name,
        size: uploadedArchive.size,
      })

      await decompressArchive()

      console.log('🗜️ ExtractTool: Extraction completed successfully')
    } catch (error) {
      console.error('🗜️ ExtractTool: Error during extraction:', error)
      alert('Extraction failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadAll = async () => {
    if (extractedFiles.length === 0) return

    setIsProcessing(true)

    try {
      await downloadAllFiles()
      console.log('🗜️ ExtractTool: All files downloaded successfully')
    } catch (error) {
      console.error('🗜️ ExtractTool: Error downloading all files:', error)
      alert('Failed to download all files. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="glass-card border-0">
        <CardContent className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            {uploadedArchive && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Selected Archive
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(uploadedArchive.size)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {uploadedArchive.name}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button
                onClick={() => void handleExtract()}
                disabled={!uploadedArchive || isProcessing || !isInitialized}
                className="gap-2 bg-green-500 hover:bg-green-600"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileArchive className="h-4 w-4" />
                )}
                {isProcessing ? 'Extracting...' : 'Extract Files'}
              </Button>

              {extractedFiles.length > 0 && (
                <Button
                  onClick={() => void handleDownloadAll()}
                  disabled={isProcessing}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download All as ZIP
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extracted Files Display */}
      {extractedFiles.length > 0 && (
        <Card className="glass-card border-0">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  Extracted Files (
                  {extractedFiles.filter((f) => !f.isDirectory).length} files,{' '}
                  {extractedFiles.filter((f) => f.isDirectory).length} folders)
                </h3>
                <div className="text-sm text-muted-foreground">
                  Total size:{' '}
                  {formatFileSize(
                    extractedFiles.reduce((sum, f) => sum + f.size, 0),
                  )}
                </div>
              </div>

              <div className="max-h-96 overflow-auto border rounded-lg">
                <div className="flex flex-col gap-1 p-2">
                  {extractedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      {file.isDirectory ? (
                        <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      ) : (
                        <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.name}
                        </p>
                        {!file.isDirectory && (
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        )}
                      </div>
                      {!file.isDirectory && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadExtractedFile(file)}
                          className="gap-2 flex-shrink-0"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
