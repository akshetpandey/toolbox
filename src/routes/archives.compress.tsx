import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
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
import { ResultCard } from '@/components/ResultCard'
import { Loader2, Package } from 'lucide-react'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useArchiveTools } from '@/contexts/ArchiveToolsContext'
import { type CompressionFormat, formatFileSize } from '@/lib/archive'

export const Route = createFileRoute('/archives/compress')({
  component: CompressPage,
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
    isInitializing,
    initializationError,
    initializeProcessor,
    compressionResult,
    clearFiles,
  } = useArchiveTools()
  const [error, setError] = useState('')
  const operation = useRef(0)
  const busy = useRef(false)
  useEffect(
    () => () => {
      operation.current++
      if (busy.current) {
        busy.current = false
        setIsProcessing(false)
      }
    },
    [setIsProcessing],
  )
  useEffect(() => {
    setError('')
  }, [selectedFiles])
  const extension = compressionFormat === 'gzip' ? 'tar.gz' : compressionFormat
  const filename = `${archiveName.trim() || 'archive'}.${extension}`
  const handleCompress = async () => {
    if (
      !selectedFiles.length ||
      !isInitialized ||
      !archiveName.trim() ||
      isProcessing
    )
      return
    const request = ++operation.current
    busy.current = true
    setIsProcessing(true)
    setError('')
    try {
      await compressFiles()
    } catch (cause) {
      if (operation.current === request)
        setError(
          cause instanceof Error ? cause.message : 'Archive creation failed',
        )
    } finally {
      if (operation.current === request) {
        busy.current = false
        setIsProcessing(false)
      }
    }
  }
  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="p-4 sm:p-6">
          <form
            aria-label="Create archive"
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCompress()
            }}
          >
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                Pack files into one archive
              </h2>
              <p className="text-sm text-muted-foreground">
                ZIP works with most devices. Choose another format if you need
                it.
              </p>
            </div>
            <fieldset
              disabled={isProcessing}
              className="grid min-w-0 gap-4 sm:grid-cols-2"
            >
              <div className="min-w-0 space-y-2">
                <Label htmlFor="archive-name">Archive name</Label>
                <Input
                  id="archive-name"
                  required
                  value={archiveName}
                  onChange={(event) => setArchiveName(event.target.value)}
                  placeholder="archive"
                  aria-describedby="archive-output"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="compression-format">Archive format</Label>
                <Select
                  value={compressionFormat}
                  onValueChange={(value) =>
                    setCompressionFormat(value as CompressionFormat)
                  }
                  disabled={isProcessing}
                >
                  <SelectTrigger id="compression-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zip">ZIP — widely supported</SelectItem>
                    <SelectItem value="7z">7Z — smaller archives</SelectItem>
                    <SelectItem value="tar">TAR — bundle files</SelectItem>
                    <SelectItem value="gzip">
                      TAR.GZ — compressed bundle
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
            <div className="space-y-1 rounded-lg bg-muted/40 p-4 text-sm">
              <p className="font-medium">
                {selectedFiles.length}{' '}
                {selectedFiles.length === 1 ? 'file' : 'files'} ·{' '}
                {formatFileSize(
                  selectedFiles.reduce((sum, file) => sum + file.size, 0),
                )}
              </p>
              <p
                id="archive-output"
                className="text-muted-foreground [overflow-wrap:anywhere]"
              >
                Output: {filename}
              </p>
            </div>
            {initializationError && (
              <div role="alert" className="space-y-2 text-sm">
                <p>
                  Archive tools could not be loaded. Check your connection and
                  try again.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void initializeProcessor()}
                >
                  Try loading again
                </Button>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
              >
                <p>
                  This archive could not be created. Try fewer files or another
                  format.
                </p>
                <details>
                  <summary className="cursor-pointer font-medium">
                    Technical details
                  </summary>
                  <p className="mt-2 [overflow-wrap:anywhere]">{error}</p>
                </details>
              </div>
            )}
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={
                !selectedFiles.length ||
                isProcessing ||
                !isInitialized ||
                !archiveName.trim()
              }
            >
              {isProcessing || isInitializing ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Package aria-hidden="true" className="size-4" />
              )}
              {isProcessing
                ? 'Creating archive…'
                : `Create ${extension.toUpperCase()} archive`}
            </Button>
            {isInitializing && (
              <p role="status" className="text-sm text-muted-foreground">
                Preparing archive tools…
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <ResultCard result={compressionResult} onReset={clearFiles} />
    </div>
  )
}
