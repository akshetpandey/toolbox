import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Package } from 'lucide-react'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useArchiveTools } from '@/contexts/ArchiveToolsContext'
import { type CompressionFormat } from '@/lib/archive'

export const Route = createFileRoute('/archives/compress')({
  component: CompressPage,
  head: () => ({
    meta: [
      {
        title:
          'File Compressor - Free Browser-Based Archive Creation | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based file compression tool. Create ZIP, 7Z, TAR, and GZIP archives from multiple files. Process files entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'create ZIP archive, compress files, 7Z creator, TAR compressor, browser file archiver, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'File Compressor - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based file compression. Create archives in multiple formats with complete privacy.',
      },
    ],
  }),
})

function CompressPage() {
  const { isProcessing, setIsProcessing } = useProcessing()
  const {
    selectedFiles,
    compressionFormat,
    setCompressionFormat,
    archiveName,
    setArchiveName,
    compressFiles,
    isInitialized,
  } = useArchiveTools()

  const handleCompress = async () => {
    if (selectedFiles.length === 0 || !isInitialized) {
      console.warn(
        '🗜️ CompressTool: No files selected or processor not initialized',
      )
      return
    }

    setIsProcessing(true)

    try {
      console.log('🗜️ CompressTool: Starting compression', {
        fileCount: selectedFiles.length,
        format: compressionFormat,
        archiveName,
      })

      await compressFiles()

      console.log('🗜️ CompressTool: Compression completed successfully')
    } catch (error) {
      console.error('🗜️ CompressTool: Error during compression:', error)
      alert('Compression failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <Label htmlFor="archive-name">Archive Name</Label>
              <Input
                id="archive-name"
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                placeholder="Enter archive name"
                className="mt-1"
                disabled={isProcessing}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="compression-format">Compression Format</Label>
              <Select
                value={compressionFormat}
                onValueChange={(value) =>
                  setCompressionFormat(value as CompressionFormat)
                }
                disabled={isProcessing}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7z">7Z</SelectItem>
                  <SelectItem value="zip">ZIP</SelectItem>
                  <SelectItem value="tar">TAR</SelectItem>
                  <SelectItem value="gzip">GZIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {selectedFiles.length} file
                  {selectedFiles.length > 1 ? 's' : ''} selected
                </span>
                <span className="text-xs text-muted-foreground">
                  Total size:{' '}
                  {selectedFiles.reduce((sum, file) => sum + file.size, 0)}{' '}
                  bytes
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Will create: {archiveName}.
                {compressionFormat === 'gzip' ? 'tar.gz' : compressionFormat}
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              onClick={() => void handleCompress()}
              disabled={
                selectedFiles.length === 0 || isProcessing || !isInitialized
              }
              className="gap-2 bg-blue-500 hover:bg-blue-600"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              {isProcessing ? 'Compressing...' : 'Compress Files'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
