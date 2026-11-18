import { renderMessage, message } from '@/i18n/messages'
import type { MessageText } from '@/i18n/messages'
import { useLocale } from '@/i18n/LocaleContext'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  FileAudio,
  FileVideo,
  Merge,
  Music2,
  Scissors,
  Settings,
  X,
} from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { ToolLayout } from '@/components/ToolLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import {
  convertAudio,
  joinAudio,
  joinVideos,
  MediaInputError,
  type AudioFormat,
} from '@/lib/media'
import { downloadBlob, formatFileSize } from '@/lib/shared'
import { getVideoTabs } from '@/lib/videoToolsUtils'

const audioExtensions = /\.(m4a|wav|mp3|aac|flac|ogg|opus)$/i
const videoExtensions = /\.(mp4|webm|avi|mov|mkv)$/i
const maxJoinFiles = 20

type Mode = 'audio-convert' | 'audio-trim' | 'audio-join' | 'video-join'
interface SelectedFile {
  id: string
  file: File
}

function AudioPreview({ file }: { file: File }) {
  const t = useTranslator()
  const { language } = useLocale()
  const [url, setURL] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [duration, setDuration] = useState<number>()
  useEffect(() => {
    const objectURL = URL.createObjectURL(file)
    setURL(objectURL)
    return () => URL.revokeObjectURL(objectURL)
  }, [file])
  if (failed)
    return (
      <p className="text-sm text-muted-foreground">
        {t('mediaToolPreviewIsUnavailableYouCanStill')}
      </p>
    )
  return (
    <div className="space-y-1">
      <audio
        className="w-full"
        controls
        preload="metadata"
        src={url}
        aria-label={t('mediaToolPreviewAudio')}
        onError={() => setFailed(true)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />
      {duration && Number.isFinite(duration) ? (
        <p className="text-sm text-muted-foreground">
          {t('mediaToolOriginalLength', {
            duration: duration.toLocaleString(language, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
              useGrouping: false,
            }),
          })}
        </p>
      ) : null}
    </div>
  )
}

export function MediaTool({ mode }: { mode: Mode }) {
  const t = useTranslator()
  const audioTabs = [
    { value: 'convert', label: t('mediaToolConvert'), icon: Settings },
    { value: 'trim', label: t('mediaToolTrim'), icon: Scissors },
    { value: 'join', label: t('mediaToolJoin'), icon: Merge },
  ]
  const video = mode === 'video-join'
  const joining = video || mode === 'audio-join'
  const trimming = mode === 'audio-trim'
  const tool = joining ? 'join' : trimming ? 'trim' : 'convert'
  const category = video ? 'videos' : 'audio'
  const key = `${category}.${tool}`
  const media = video ? 'video' : 'audio'
  const title = video
    ? t('mediaToolJoinVideos')
    : t(
        joining
          ? 'toolsAudioJoinName'
          : trimming
            ? 'toolsAudioTrimName'
            : 'toolsAudioConvertName',
      )
  const Icon = video ? FileVideo : FileAudio
  const navigate = useNavigate()
  const { isProcessing, setIsProcessing } = useProcessing()
  const [files, setFiles] = useWorkspaceState<SelectedFile[]>(
    joining ? `${key}.files` : 'audio.source',
    [],
  )
  const [settings, setSettings] = useWorkspaceState<{
    format: AudioFormat
    start: string
    end: string
  }>(`${key}.settings`, { format: 'mp3', start: '0', end: '' })
  const { result, setResult, clearResult } = useToolResult(files, key)
  const [error, setError] = useState<MessageText>()
  const [cancelled, setCancelled] = useState(false)
  const operation = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      const controller = operation.current
      if (!controller) return
      operation.current = null
      controller.abort()
      setIsProcessing(false)
    },
    [files, setIsProcessing],
  )

  const start = Number(settings.start)
  const end = settings.end ? Number(settings.end) : undefined
  const invalidRange =
    trimming &&
    (!settings.start ||
      !Number.isFinite(start) ||
      start < 0 ||
      (end !== undefined && (!Number.isFinite(end) || end <= start)))

  const updateFiles = (next: SelectedFile[]) => {
    setFiles(next)
    setError(undefined)
    setCancelled(false)
    if (joining) invalidateWorkspaceState([`result.${key}`])
    else {
      invalidateWorkspaceState([
        'result.audio.convert',
        'result.audio.trim',
        'audio.convert.settings',
        'audio.trim.settings',
      ])
    }
  }
  const selectFiles = (selection: FileList) => {
    const accepted = joining
      ? Array.from(selection)
      : Array.from(selection).slice(0, 1)
    const pattern = video ? videoExtensions : audioExtensions
    if (
      accepted.some(
        (file) =>
          file.size === 0 ||
          (!file.type.startsWith(`${media}/`) && !pattern.test(file.name)),
      )
    ) {
      setError(
        message(
          video
            ? 'mediaToolChooseSupportedVideo'
            : 'mediaToolChooseSupportedAudio',
        ),
      )
      return
    }
    const current = joining ? files : []
    if (current.length + accepted.length > maxJoinFiles) {
      setError(message('mediaToolChooseUpToFilesAtA', { maxJoinFiles }))
      return
    }
    updateFiles([
      ...current,
      ...accepted.map((file) => ({ id: crypto.randomUUID(), file })),
    ])
  }
  const moveFile = (index: number, offset: number) => {
    const next = [...files]
    const [entry] = next.splice(index, 1)
    next.splice(index + offset, 0, entry)
    updateFiles(next)
  }
  const updateSettings = (changes: Partial<typeof settings>) => {
    setSettings({ ...settings, ...changes })
    clearResult()
    setError(undefined)
    setCancelled(false)
  }
  const ready = files.length >= (joining ? 2 : 1) && !invalidRange

  const process = async () => {
    if (!ready || isProcessing || operation.current) return
    const controller = new AbortController()
    operation.current = controller
    const { signal } = controller
    setIsProcessing(true)
    setError(undefined)
    setCancelled(false)
    clearResult()
    try {
      const sources = files.map(({ file }) => file)
      const blob = video
        ? await joinVideos(sources, signal)
        : joining
          ? await joinAudio(sources, settings.format, signal)
          : await convertAudio(
              sources[0],
              settings.format,
              signal,
              trimming ? { start, end } : undefined,
            )
      if (operation.current !== controller || signal.aborted) return
      const extension = video ? 'mp4' : settings.format
      const name = sources[0].name.replace(/\.[^/.]+$/, '')
      const sameFormat = sources[0].name.toLowerCase().endsWith(`.${extension}`)
      const suffix = trimming ? '_clip' : sameFormat ? '_converted' : ''
      const filename = joining
        ? `joined-${media}.${extension}`
        : `${name}${suffix}.${extension}`
      setResult({
        blob,
        filename,
        details: joining
          ? [message('mediaToolFilesJoined', { count: sources.length })]
          : undefined,
      })
      downloadBlob(blob, filename)
    } catch (cause) {
      if (operation.current !== controller) return
      if (signal.aborted) setCancelled(true)
      else if (cause instanceof MediaInputError)
        setError(message(cause.key, cause.values))
      else
        setError(
          joining
            ? message('mediaToolTheseFilesCouldNotBeJoined')
            : message('mediaToolThisAudioFileCouldNotBe'),
        )
    } finally {
      if (operation.current === controller) {
        operation.current = null
        setIsProcessing(false)
      }
    }
  }
  return (
    <ToolLayout
      title={title}
      icon={video ? FileVideo : Music2}
      iconColor={video ? 'text-violet-600' : 'text-rose-600'}
      iconBgColor=""
      fileUploadComponent={
        <FileUpload
          selectedFiles={files.map(({ file }) => ({
            name: file.name,
            size: file.size,
          }))}
          onFileSelect={selectFiles}
          onClearFiles={() => updateFiles([])}
          acceptedTypes={
            video
              ? 'video/*,.mp4,.webm,.avi,.mov,.mkv'
              : 'audio/*,.m4a,.wav,.mp3,.aac,.flac,.ogg,.opus'
          }
          title={
            joining
              ? t(
                  video
                    ? 'mediaToolChooseVideoFiles'
                    : 'mediaToolChooseAudioFiles',
                )
              : t('mediaToolChooseAnAudioFile')
          }
          description={
            joining
              ? t('mediaToolAddFilesInTheOrderYou')
              : t('mediaToolYourAudioStaysOnThisDevice')
          }
          supportedFormats={
            video
              ? ['MP4', 'WebM', 'MOV', 'MKV', 'AVI']
              : ['M4A', 'WAV', 'MP3', 'AAC', 'FLAC', 'OGG']
          }
          emptyStateIcon={Icon}
          selectedFileIcon={Icon}
          selectedActionLabel={
            joining ? t('mediaToolAddFiles') : t('mediaToolChangeFile')
          }
          disabled={isProcessing}
          multiple={joining}
        >
          {joining ? (
            <ol className="space-y-3" aria-label={t('mediaToolPlaybackOrder')}>
              {files.map(({ id, file }, index) => (
                <li key={id} className="rounded-md border p-2">
                  <p className="break-all text-sm font-medium">
                    {index + 1}. {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size, t)}
                  </p>
                  <div className="mt-1 flex flex-wrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={t('mediaToolMoveFileUp', {
                        number: index + 1,
                      })}
                      disabled={isProcessing || index === 0}
                      onClick={() => moveFile(index, -1)}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={t('mediaToolMoveFileDown', {
                        number: index + 1,
                      })}
                      disabled={isProcessing || index === files.length - 1}
                      onClick={() => moveFile(index, 1)}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={t('mediaToolRemoveFile', {
                        number: index + 1,
                      })}
                      disabled={isProcessing}
                      onClick={() =>
                        updateFiles(files.filter((entry) => entry.id !== id))
                      }
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          ) : undefined}
        </FileUpload>
      }
      navigationComponent={
        <ResponsiveTabs
          tabs={video ? getVideoTabs(t) : audioTabs}
          currentTab={tool}
          onTabChange={(value) =>
            void navigate({ to: `/${category}/${value}` })
          }
          isProcessing={isProcessing}
        />
      }
    >
      <Card className="shadow-none">
        <CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">
            {trimming
              ? t('mediaToolClipSettings')
              : t('mediaToolExportSettings')}
          </h2>
          {joining && (
            <p className="text-sm text-muted-foreground">
              {video
                ? t('mediaToolJoinAtLeastTwoClipsInto')
                : t('mediaToolJoinAtLeastTwoAudioFiles')}
            </p>
          )}
          {trimming && (
            <>
              {files[0] && (
                <AudioPreview key={files[0].id} file={files[0].file} />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="audio-clip-start">
                    {t('mediaToolStartSeconds')}
                  </Label>
                  <Input
                    id="audio-clip-start"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={settings.start}
                    disabled={isProcessing}
                    onChange={(event) =>
                      updateSettings({ start: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audio-clip-end">
                    {t('mediaToolEndSeconds')}
                  </Label>
                  <Input
                    id="audio-clip-end"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder={t('mediaToolEndOfFile')}
                    value={settings.end}
                    disabled={isProcessing}
                    onChange={(event) =>
                      updateSettings({ end: event.target.value })
                    }
                  />
                </div>
              </div>
              {invalidRange && (
                <p className="text-sm text-destructive" role="alert">
                  {t('mediaToolEnterAStartAtOrAfter')}
                </p>
              )}
            </>
          )}
          {!video && (
            <div className="space-y-2">
              <Label htmlFor="audio-output-format">
                {t('mediaToolOutputFormat')}
              </Label>
              <select
                id="audio-output-format"
                className="h-11 w-full rounded-md border bg-background px-3 text-base"
                value={settings.format}
                disabled={isProcessing}
                onChange={(event) =>
                  updateSettings({ format: event.target.value as AudioFormat })
                }
              >
                <option value="mp3">
                  {t('mediaToolMP3WorksAlmostEverywhere')}
                </option>
                <option value="m4a">{t('mediaToolM4ACompactAACAudio')}</option>
                <option value="wav">{t('mediaToolWAVUncompressed')}</option>
              </select>
            </div>
          )}
          {isProcessing && operation.current && (
            <div className="space-y-3 rounded-lg border p-4">
              <p role="status" className="text-sm font-medium">
                {joining
                  ? t('mediaToolJoiningFilesInYourBrowser')
                  : t('mediaToolProcessingAudioInYourBrowser')}
              </p>
              <progress
                className="h-2 w-full accent-primary"
                aria-label={t('mediaToolProcessingFiles')}
              />
              <Button
                variant="outline"
                onClick={() => operation.current?.abort()}
              >
                {t('mediaToolCancelProcessing')}
              </Button>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              {renderMessage(t, error)}
            </p>
          )}
          {cancelled && (
            <p role="status" className="text-sm text-muted-foreground">
              {t('mediaToolProcessingCancelledYouCanTryAgain')}
            </p>
          )}
          <Button
            className="min-h-11 w-full sm:w-auto sm:self-end"
            disabled={isProcessing || !ready}
            onClick={() => void process()}
          >
            {trimming ? t('mediaToolCreateAudioClip') : title}
          </Button>
        </CardContent>
      </Card>
      <ResultCard
        result={result}
        disabled={isProcessing}
        onReset={() => updateFiles([])}
      />
    </ToolLayout>
  )
}
