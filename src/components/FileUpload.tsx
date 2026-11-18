import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { useRef, useState } from 'react'
import { useHydrated } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Upload, FileImage } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatFileSize } from '@/lib/shared'

interface FileItem {
  name: string
  size?: number
  [key: string]: string | number | boolean | undefined | object
}
interface FileUploadProps {
  selectedFiles: FileItem[]
  onFileSelect: (files: FileList) => void
  onClearFiles: () => void
  acceptedTypes: string
  title: string
  description: string
  supportedFormats: string[]
  emptyStateIcon?: LucideIcon
  selectedFileIcon?: LucideIcon
  children?: React.ReactNode
  multiple?: boolean
  selectedActionLabel?: string
  disabled?: boolean
}

export function FileUpload({
  selectedFiles,
  onFileSelect,
  onClearFiles,
  acceptedTypes,
  title,
  description,
  supportedFormats,
  emptyStateIcon: EmptyIcon = Upload,
  selectedFileIcon: SelectedIcon = FileImage,
  children,
  multiple = false,
  selectedActionLabel,
  disabled: disabledByTool = false,
}: FileUploadProps) {
  const t = useTranslator()
  const hydrated = useHydrated()
  const disabled = !hydrated || disabledByTool
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const selected = selectedFiles.length > 0
  const choose = () => {
    if (!disabled) input.current?.click()
  }
  return (
    <section
      aria-label={
        selected ? t('fileUploadSelectedFiles') : t('fileUploadChooseFiles')
      }
      className={`file-upload min-w-0 rounded-xl border bg-card ${dragging ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        if (!disabled && event.dataTransfer.files.length)
          onFileSelect(event.dataTransfer.files)
      }}
    >
      {selected ? (
        <div className="file-summary min-w-0 p-4">
          {selectedFiles.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <SelectedIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                {t('fileUploadSelectedFilesText', {
                  count: selectedFiles.length,
                })}
              </p>
            </div>
          )}
          {children ?? (
            <ul className="space-y-3">
              {selectedFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="min-w-0">
                  <p className="break-all text-sm font-medium">{file.name}</p>
                  {file.size !== undefined && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatFileSize(file.size, t)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={choose}
              className="flex-1"
            >
              <Upload aria-hidden="true" />
              {selectedActionLabel ?? t('fileUploadChangeFile')}
            </Button>
            <Button variant="ghost" disabled={disabled} onClick={onClearFiles}>
              {t('fileUploadClear')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-primary/25 p-5 text-center sm:p-6">
          <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-accent">
            <EmptyIcon aria-hidden="true" className="size-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <Button
            type="button"
            disabled={disabled}
            onClick={choose}
            className="mt-5"
          >
            <Upload aria-hidden="true" />
            {t(multiple ? 'fileUploadChooseFiles' : 'fileUploadChooseFile')}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {supportedFormats.join(' · ')}
            {hydrated &&
              ' · ' +
                t(
                  multiple
                    ? 'fileUploadOrDropFilesHere'
                    : 'fileUploadOrDropFileHere',
                )}
          </p>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept={acceptedTypes}
        multiple={multiple}
        disabled={disabled}
        aria-label={
          multiple ? t('fileUploadUploadFiles') : t('fileUploadUploadFile')
        }
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length && !disabled)
            onFileSelect(event.target.files)
          event.target.value = ''
        }}
      />
    </section>
  )
}
