import type { MessageText } from '@/i18n/messages'
import { message, renderMessage } from '@/i18n/messages'
import { messageFromError } from '@/i18n/MessageError'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
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
  const t = useTranslator()
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
  const [error, setError] = useState<MessageText>('')
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
          messageFromError(
            cause,
            message('archivesCompressArchiveCreationFailed'),
          ),
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
            aria-label={t('archivesCompressCreateArchive')}
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCompress()
            }}
          >
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                {t('archivesCompressPackFilesIntoOneArchive')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('archivesCompressZIPWorksWithMostDevicesChoose')}
              </p>
            </div>
            <fieldset
              disabled={isProcessing}
              className="grid min-w-0 gap-4 sm:grid-cols-2"
            >
              <div className="min-w-0 space-y-2">
                <Label htmlFor="archive-name">
                  {t('archivesCompressArchiveName')}
                </Label>
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
                <Label htmlFor="compression-format">
                  {t('archivesCompressArchiveFormat')}
                </Label>
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
                    <SelectItem value="zip">
                      {t('archivesCompressZIPWidelySupported')}
                    </SelectItem>
                    <SelectItem value="7z">
                      {t('archivesCompress7ZSmallerArchives')}
                    </SelectItem>
                    <SelectItem value="tar">
                      {t('archivesCompressTARBundleFiles')}
                    </SelectItem>
                    <SelectItem value="gzip">
                      {t('archivesCompressTARGZCompressedBundle')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
            <div className="space-y-1 rounded-lg bg-muted/40 p-4 text-sm">
              <p className="font-medium">
                {t('archiveFileCount', {}, selectedFiles.length)} ·{' '}
                {formatFileSize(
                  selectedFiles.reduce((sum, file) => sum + file.size, 0),
                  t,
                )}
              </p>
              <p
                id="archive-output"
                className="text-muted-foreground [overflow-wrap:anywhere]"
              >
                {t('archivesCompressOutput') + ' '}
                {filename}
              </p>
            </div>
            {initializationError && (
              <div role="alert" className="space-y-2 text-sm">
                <p>{t('archivesCompressArchiveToolsCouldNotBeLoaded')}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void initializeProcessor()}
                >
                  {t('archivesCompressTryLoadingAgain')}
                </Button>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
              >
                <p>{t('archivesCompressThisArchiveCouldNotBeCreated')}</p>
                <details>
                  <summary className="cursor-pointer font-medium">
                    {t('archivesCompressTechnicalDetails')}
                  </summary>
                  <p className="mt-2 [overflow-wrap:anywhere]">
                    {renderMessage(t, error)}
                  </p>
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
                ? t('archivesCompressCreatingArchive')
                : t('archivesCompressCreateArchiveText', {
                    extension: extension.toUpperCase(),
                  })}
            </Button>
            {isInitializing && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('archivesCompressPreparingArchiveTools')}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <ResultCard result={compressionResult} onReset={clearFiles} />
    </div>
  )
}
