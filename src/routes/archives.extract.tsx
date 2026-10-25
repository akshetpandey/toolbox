import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  head: () => ({
    meta: [
      {
        title:
          'Archive Extractor - Free Browser-Based File Extraction | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based archive extraction tool. Extract files from ZIP, 7Z, TAR, RAR, and GZIP archives entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'extract ZIP files, 7Z extractor, RAR extractor, TAR extractor, browser archive manager, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Archive Extractor - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based archive extraction. Extract files from multiple archive formats.',
      },
    ],
  }),
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
    isInitializing,
    initializationError,
    initializeProcessor,
    setUploadedArchive,
  } = useArchiveTools()
  const [error, setError] = useState('')
  const [activity, setActivity] = useState('')
  const version = useRef(0)
  const busy = useRef(false)
  useEffect(() => {
    setError('')
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
      if (action === 'extract') await decompressArchive()
      else await downloadAllFiles()
    } catch (cause) {
      if (version.current === request)
        setError(
          cause instanceof Error ? cause.message : 'Archive operation failed',
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
            <h2 className="text-lg font-semibold">Open an archive</h2>
            <p className="text-sm text-muted-foreground">
              Choose a ZIP, 7Z, TAR, GZIP, or RAR file. Then download the files
              you need.
            </p>
          </div>
          {initializationError && (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                Archive tools could not be loaded. Check your connection and try
                again.
              </p>
              <Button
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
              className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <p>
                This archive could not be opened or downloaded. Choose another
                copy and make sure it is not password-protected.
              </p>
              <Button
                variant="outline"
                onClick={() => setUploadedArchive(null)}
              >
                Choose another archive
              </Button>
              <details>
                <summary className="cursor-pointer font-medium">
                  Technical details
                </summary>
                <p className="mt-2 [overflow-wrap:anywhere]">{error}</p>
              </details>
            </div>
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
              {activity === 'extract' ? 'Extracting files…' : 'Extract files'}
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
                  ? 'Preparing ZIP…'
                  : 'Download all as ZIP'}
              </Button>
            )}
          </div>
          {(isInitializing || activity) && (
            <p role="status" className="text-sm text-muted-foreground">
              {isInitializing
                ? 'Preparing archive tools…'
                : activity === 'extract'
                  ? 'Reading files from the archive…'
                  : 'Preparing your download…'}
            </p>
          )}
        </CardContent>
      </Card>
      {extractedFiles.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Extracted files</h2>
              <p role="status" className="text-sm text-muted-foreground">
                {fileCount} {fileCount === 1 ? 'file' : 'files'}
                {folderCount > 0 &&
                  ` · ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`}{' '}
                ·{' '}
                {formatFileSize(
                  extractedFiles.reduce((sum, file) => sum + file.size, 0),
                )}
              </p>
            </div>
            <ul
              aria-label="Extracted files"
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
                      {file.isDirectory ? 'Folder' : formatFileSize(file.size)}
                    </p>
                    {!file.isDirectory && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0"
                        aria-label={`Download ${file.name}`}
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
