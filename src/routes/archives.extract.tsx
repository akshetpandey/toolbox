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
  Loader2,
  FileArchive,
  Folder,
  File as FileIcon,
  Download,
} from 'lucide-react'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useArchiveTools } from '@/contexts/ArchiveToolsContext'
import { formatFileSize } from '@/lib/archive'

export const Route = createFileRoute('/archives/extract')({
  component: ExtractPage,
})

function ExtractPage() {
  const t = useTranslator()
  const { isProcessing, setIsProcessing } = useProcessing()
  const {
    uploadedArchive,
    extractedFiles,
    decompressArchive,
    downloadExtractedFile,
    downloadAllFiles,
    isInitialized,
    isInitializing,
    initializationError,
    initializeProcessor,
    setUploadedArchive,
  } = useArchiveTools()
  const [error, setError] = useState<MessageText>('')
  const [activity, setActivity] = useState('')
  const [password, setPassword] = useState('')
  const version = useRef(0)
  const busy = useRef(false)
  useEffect(() => {
    setError('')
    setPassword('')
  }, [uploadedArchive])
  useEffect(
    () => () => {
      version.current++
      if (busy.current) {
        busy.current = false
        setIsProcessing(false)
      }
    },
    [setIsProcessing],
  )
  const run = async (action: 'extract' | 'download') => {
    if (
      !isInitialized ||
      isProcessing ||
      busy.current ||
      (action === 'extract'
        ? !uploadedArchive
        : !extractedFiles.some((file) => !file.isDirectory))
    )
      return
    const request = ++version.current
    busy.current = true
    setIsProcessing(true)
    setActivity(action)
    setError('')
    try {
      if (action === 'extract') {
        await decompressArchive(password)
        if (version.current === request) setPassword('')
      } else await downloadAllFiles()
    } catch (cause) {
      if (version.current === request)
        setError(
          messageFromError(
            cause,
            message('archivesExtractArchiveOperationFailed'),
          ),
        )
    } finally {
      if (version.current === request) {
        busy.current = false
        setIsProcessing(false)
        setActivity('')
      }
    }
  }
  const fileCount = extractedFiles.filter((file) => !file.isDirectory).length
  const folderCount = extractedFiles.length - fileCount
  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              {t('archivesExtractOpenAnArchive')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('archivesExtractChooseAZIP7ZTARGZIP')}
            </p>
          </div>
          {initializationError && (
            <div role="alert" className="space-y-2 text-sm">
              <p>{t('archivesExtractArchiveToolsCouldNotBeLoaded')}</p>
              <Button
                variant="outline"
                onClick={() => void initializeProcessor()}
              >
                {t('archivesExtractTryLoadingAgain')}
              </Button>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <p>{t('archivesExtractThisArchiveCouldNotBeOpened')}</p>
              <Button
                variant="outline"
                onClick={() => setUploadedArchive(null)}
              >
                {t('archivesExtractChooseAnotherArchive')}
              </Button>
              <details>
                <summary className="cursor-pointer font-medium">
                  {t('archivesExtractTechnicalDetails')}
                </summary>
                <p className="mt-2 [overflow-wrap:anywhere]">
                  {renderMessage(t, error)}
                </p>
              </details>
            </div>
          )}
          {uploadedArchive && (
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">
                {t('archivesExtractPasswordProtectedArchive')}
              </summary>
              <div className="space-y-2 pb-2">
                <Label htmlFor="archive-password">
                  {t('archivesExtractArchivePassword')}
                </Label>
                <Input
                  id="archive-password"
                  type="password"
                  autoComplete="off"
                  disabled={isProcessing}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </details>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              onClick={() => void run('extract')}
              disabled={!uploadedArchive || isProcessing || !isInitialized}
            >
              {activity === 'extract' ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <FileArchive aria-hidden="true" className="size-4" />
              )}
              {activity === 'extract'
                ? t('archivesExtractExtractingFiles')
                : t('archivesExtractExtractFiles')}
            </Button>
            {fileCount > 0 && (
              <Button
                onClick={() => void run('download')}
                disabled={isProcessing}
                variant="outline"
              >
                {activity === 'download' ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Download aria-hidden="true" className="size-4" />
                )}
                {activity === 'download'
                  ? t('archivesExtractPreparingZIP')
                  : t('archivesExtractDownloadAllAsZIP')}
              </Button>
            )}
          </div>
          {(isInitializing || activity) && (
            <p role="status" className="text-sm text-muted-foreground">
              {isInitializing
                ? t('archivesExtractPreparingArchiveTools')
                : activity === 'extract'
                  ? t('archivesExtractReadingFilesFromTheArchive')
                  : t('archivesExtractPreparingYourDownload')}
            </p>
          )}
        </CardContent>
      </Card>
      {extractedFiles.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                {t('archivesExtractExtractedFiles')}
              </h2>
              <p role="status" className="text-sm text-muted-foreground">
                {t('archiveFileCount', {}, fileCount)}
                {folderCount > 0 &&
                  ' · ' + t('archiveFolderCount', {}, folderCount)}{' '}
                ·{' '}
                {formatFileSize(
                  extractedFiles.reduce((sum, file) => sum + file.size, 0),
                  t,
                )}
              </p>
            </div>
            <ul
              aria-label={t('archivesExtractExtractedFiles')}
              className="max-h-[36rem] space-y-2 overflow-y-auto"
            >
              {extractedFiles.map((file, index) => (
                <li
                  key={`${index}-${file.name}`}
                  className="min-w-0 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {file.isDirectory ? (
                      <Folder
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                    ) : (
                      <FileIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                    )}
                    <p className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                      {file.name}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 pl-6">
                    <p className="text-sm text-muted-foreground">
                      {file.isDirectory
                        ? t('archivesExtractFolder')
                        : formatFileSize(file.size, t)}
                    </p>
                    {!file.isDirectory && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0"
                        aria-label={t('archivesExtractDownload', {
                          filename: file.name,
                        })}
                        disabled={isProcessing}
                        onClick={() => downloadExtractedFile(file)}
                      >
                        <Download aria-hidden="true" className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
