import { renderMessage, message } from '@/i18n/messages'
import type { MessageText } from '@/i18n/messages'
import { MessageError, messageFromError } from '@/i18n/MessageError'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type MouseEvent } from 'react'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { canvasBlob, pdfBaseName } from '@/lib/pdf-edit'
import {
  editPDF,
  readPDFForm,
  type PDFFieldValue,
  type PDFMark,
} from '@/lib/pdf-editor'
import { openBrowserPDF, renderPDFPage } from '@/lib/pdf-render'

export const Route = createFileRoute('/pdfs/edit')({ component: PDFEditorPage })

const markLabels = {
  text: 'pdfsEditText',
  check: 'pdfsEditCheckmark',
  highlight: 'pdfsEditHighlight',
  box: 'pdfsEditRectangleOutline',
} as const

const defaultMark = {
  type: 'text' as PDFMark['type'],
  text: '',
  x: '10',
  y: '10',
  width: '40',
  height: '5',
  fontSize: '16',
}
const selectClass = 'min-h-11 w-full rounded-md border bg-background px-3'

function PDFEditorPage() {
  const t = useTranslator()
  const { file, count, clearFiles } = usePDFSource()
  const { isProcessing } = useProcessing()
  const [values, setValues] = useWorkspaceState<Record<string, PDFFieldValue>>(
    'pdfs.edit.editor.values',
    {},
  )
  const [marks, setMarks] = useWorkspaceState<PDFMark[]>(
    'pdfs.edit.editor.marks',
    [],
  )
  const [flatten, setFlatten] = useWorkspaceState(
    'pdfs.edit.editor.flatten',
    false,
  )
  const [page, setPage] = useWorkspaceState('pdfs.edit.editor.page', 1)
  const [draft, setDraft] = useWorkspaceState(
    'pdfs.edit.editor.draft',
    defaultMark,
  )
  const [model, setModel] = useState<{
    file: File
    data: Awaited<ReturnType<typeof readPDFForm>>
  } | null>(null)
  const [loadError, setLoadError] = useState<MessageText>('')
  const [markError, setMarkError] = useState<MessageText>('')
  const [previewError, setPreviewError] = useState<MessageText>('')
  const [preview, setPreview] = useState<{
    file: File
    key: string
    url: string
  } | null>(null)
  const sourceKey = JSON.stringify([values, marks, flatten])
  const previewKey = `${sourceKey}:${page}`
  const currentModel = model && model.file === file ? model.data : null

  useEffect(() => {
    setModel(null)
    setLoadError('')
    setMarkError('')
    if (!file) return
    let active = true
    void readPDFForm(file).then(
      (data) => {
        if (active) setModel({ file, data })
      },
      (cause: unknown) => {
        if (active)
          setLoadError(
            messageFromError(cause, message('pdfsEditThisPDFCouldNotBeOpened')),
          )
      },
    )
    return () => {
      active = false
    }
  }, [file])

  useEffect(() => {
    setPreviewError('')
    if (!file || !currentModel || !count || page < 1 || page > count) return
    const abort = new AbortController()
    let url: string | undefined
    const timeout = window.setTimeout(() => {
      void (async () => {
        const edited =
          Object.keys(values).length || marks.length || flatten
            ? await editPDF(file, values, marks, flatten, abort.signal)
            : file
        abort.signal.throwIfAborted()
        const document = await openBrowserPDF(edited)
        try {
          abort.signal.throwIfAborted()
          const { canvas } = await renderPDFPage(
            await document.getPage(page),
            1.5,
            abort.signal,
            1800,
          )
          try {
            const image = await canvasBlob(canvas, 'image/png')
            abort.signal.throwIfAborted()
            url = URL.createObjectURL(image)
            setPreview({ file, key: previewKey, url })
          } finally {
            canvas.width = 0
          }
        } finally {
          await document.loadingTask.destroy()
        }
      })().catch((cause: unknown) => {
        if (!abort.signal.aborted)
          setPreviewError(
            messageFromError(
              cause,
              message('pdfsEditThePagePreviewCouldNotBe'),
            ),
          )
      })
    }, 200)
    return () => {
      abort.abort()
      window.clearTimeout(timeout)
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, currentModel, count, page, values, marks, flatten, previewKey])

  function positionMark(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.detail
      ? ((event.clientX - bounds.left) / bounds.width) * 100
      : 50
    const y = event.detail
      ? ((event.clientY - bounds.top) / bounds.height) * 100
      : 50
    setDraft((previous) => ({
      ...previous,
      x: Math.max(0, Math.min(100 - Number(previous.width), x)).toFixed(1),
      y: Math.max(0, Math.min(100 - Number(previous.height), y)).toFixed(1),
    }))
    setMarkError('')
  }

  function addMark() {
    const geometry = {
      x: Number(draft.x) / 100,
      y: Number(draft.y) / 100,
      width: Number(draft.width) / 100,
      height: Number(draft.height) / 100,
      fontSize: Number(draft.fontSize),
    }
    if (!file || !count || page < 1 || page > count) return
    if (
      (draft.type === 'text' && !draft.text.trim()) ||
      !Object.values(geometry).every(Number.isFinite) ||
      geometry.x < 0 ||
      geometry.y < 0 ||
      geometry.width <= 0 ||
      geometry.height <= 0 ||
      geometry.x + geometry.width > 1.000001 ||
      geometry.y + geometry.height > 1.000001 ||
      geometry.fontSize < 6 ||
      geometry.fontSize > 96
    ) {
      setMarkError(message('pdfsEditEnterTextIfNeededKeepThe'))
      return
    }
    setMarks((previous) => [
      ...previous,
      {
        ...geometry,
        id: crypto.randomUUID(),
        page,
        type: draft.type,
        text: draft.text,
      },
    ])
    setMarkError('')
  }

  return (
    <PDFAction
      file={file}
      name="pdfs.edit.editor"
      sourceKey={sourceKey}
      label={t('pdfsEditSaveAndDownloadPDF')}
      onReset={clearFiles}
      disabled={!currentModel || Boolean(loadError)}
      run={async (signal) => {
        if (!file) throw new MessageError('pdfsEditChooseAPDFFirst')
        return {
          blob: await editPDF(file, values, marks, flatten, signal),
          filename: `${pdfBaseName(file.name)}-edited.pdf`,
          details: [
            flatten
              ? message('pdfsEditFormFieldsFlattened')
              : message('pdfsEditFormFieldsKeptFillable'),
            message('pdfsEditAdded', { count: marks.length }, marks.length),
          ],
        }
      }}
    >
      <h2 className="text-lg font-semibold">
        {t('pdfsEditFillFormsAndAddTextOr')}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t('pdfsEditFillStandardPDFFormFieldsOr')}
      </p>
      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          {renderMessage(t, loadError)}
        </p>
      )}
      {file && !currentModel && !loadError && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('pdfsEditReadingFormFields')}
        </p>
      )}
      {currentModel && (
        <>
          <section
            aria-label={t('pdfsEditPDFFormFields')}
            className="space-y-4"
          >
            <h3 className="font-medium">{t('pdfsEditFormFields')}</h3>
            {!currentModel.fields.length && (
              <p className="text-sm text-muted-foreground">
                {t('pdfsEditNoFillableFieldsFoundUseThe')}
              </p>
            )}
            {currentModel.fields.map((field, index) => {
              const value = Object.hasOwn(values, field.name)
                ? values[field.name]
                : field.value
              const id = `pdf-field-${index}`
              const setValue = (next: PDFFieldValue) =>
                setValues((previous) => ({ ...previous, [field.name]: next }))
              return (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={id}>
                    {field.name}
                    {field.readOnly ? ' ' + t('pdfsEditReadOnly') : ''}
                  </Label>
                  {field.type === 'checkbox' ? (
                    <input
                      id={id}
                      type="checkbox"
                      className="ml-3 size-5 align-middle"
                      disabled={field.readOnly}
                      checked={value === true}
                      onChange={(event) => setValue(event.target.checked)}
                    />
                  ) : field.type === 'text' ? (
                    field.multiline ? (
                      <textarea
                        id={id}
                        rows={3}
                        className="w-full rounded-md border bg-background p-3 text-base"
                        disabled={field.readOnly}
                        maxLength={field.maxLength}
                        value={String(value)}
                        onChange={(event) => setValue(event.target.value)}
                      />
                    ) : (
                      <Input
                        id={id}
                        type={field.password ? 'password' : 'text'}
                        autoComplete="off"
                        disabled={field.readOnly}
                        maxLength={field.maxLength}
                        value={String(value)}
                        onChange={(event) => setValue(event.target.value)}
                      />
                    )
                  ) : (
                    <select
                      id={id}
                      className={selectClass}
                      disabled={field.readOnly}
                      multiple={field.multiple}
                      value={
                        field.multiple
                          ? Array.isArray(value)
                            ? value
                            : [String(value)]
                          : Array.isArray(value)
                            ? (value[0] ?? '')
                            : String(value)
                      }
                      onChange={(event) =>
                        setValue(
                          field.multiple
                            ? Array.from(
                                event.target.selectedOptions,
                                (option) => option.value,
                              )
                            : event.target.value,
                        )
                      }
                    >
                      {!field.multiple && (
                        <option value="">{t('pdfsEditChooseAnOption')}</option>
                      )}
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
            {currentModel.unsupported > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('pdfsEditOtherFormFieldsCannotBeEdited', {
                  count: currentModel.unsupported,
                })}
              </p>
            )}
            {currentModel.fields.length > 0 && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={flatten}
                  disabled={currentModel.unsupported > 0}
                  onChange={(event) => setFlatten(event.target.checked)}
                />
                {t('pdfsEditFlattenFormFieldsInTheSaved')}
              </label>
            )}
          </section>
          <section
            aria-label={t('pdfsEditAddPDFContent')}
            className="space-y-4 border-t pt-4"
          >
            <h3 className="font-medium">{t('pdfsEditAddTextOrAMark')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editor-page">{t('pdfsEditPage')}</Label>
                <select
                  id="editor-page"
                  className={selectClass}
                  value={page}
                  onChange={(event) => setPage(Number(event.target.value))}
                >
                  {Array.from({ length: count ?? 0 }, (_, index) => (
                    <option key={index} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editor-mark">{t('pdfsEditMarkType')}</Label>
                <select
                  id="editor-mark"
                  className={selectClass}
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      type: event.target.value as PDFMark['type'],
                      width: event.target.value === 'check' ? '4' : '40',
                      height: event.target.value === 'box' ? '10' : '5',
                    }))
                  }
                >
                  {Object.entries(markLabels).map(([type, label]) => (
                    <option key={type} value={type}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {draft.type === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="editor-text">{t('pdfsEditTextToAdd')}</Label>
                <Input
                  id="editor-text"
                  maxLength={200}
                  value={draft.text}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      text: event.target.value,
                    }))
                  }
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['x', t('pdfsEditLeft')],
                  ['y', t('pdfsEditTop')],
                  ['width', t('pdfsEditWidth')],
                  ['height', t('pdfsEditHeight')],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`editor-${key}`}>{label}</Label>
                  <Input
                    id={`editor-${key}`}
                    type="number"
                    min={key === 'x' || key === 'y' ? 0 : 0.1}
                    max={100}
                    step="0.1"
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            {draft.type === 'text' && (
              <div className="max-w-40 space-y-2">
                <Label htmlFor="editor-size">{t('pdfsEditTextSizePt')}</Label>
                <Input
                  id="editor-size"
                  type="number"
                  min={6}
                  max={96}
                  value={draft.fontSize}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      fontSize: event.target.value,
                    }))
                  }
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('pdfsEditClickThePreviewToSetThe')}
            </p>
            <Button variant="outline" onClick={addMark}>
              {t('pdfsEditAddToPage')}
            </Button>
            {markError && (
              <p role="alert" className="text-sm text-destructive">
                {renderMessage(t, markError)}
              </p>
            )}
            {marks.length > 0 && (
              <ul aria-label={t('pdfsEditAddedPDFMarks')} className="space-y-2">
                {marks.map((mark, index) => (
                  <li
                    key={mark.id}
                    className="flex items-center justify-between gap-3 rounded border p-2 text-sm"
                  >
                    <span className="min-w-0 break-words">
                      {t('pdfsEditMarkSummary', {
                        page: mark.page,
                        mark:
                          mark.type === 'text'
                            ? mark.text
                            : t(markLabels[mark.type]),
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      disabled={isProcessing}
                      aria-label={t('pdfsEditRemoveMark', {
                        number: index + 1,
                      })}
                      onClick={() =>
                        setMarks((previous) =>
                          previous.filter((entry) => entry.id !== mark.id),
                        )
                      }
                    >
                      {t('pdfsEditRemove')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label={t('pdfsEditPDFPreview')} className="space-y-2">
            <h3 className="font-medium">
              {t('pdfsEditPreviewOfPage') + ' '}
              {page}
            </h3>
            {preview && preview.file === file && preview.key === previewKey ? (
              <button
                type="button"
                disabled={isProcessing}
                aria-label={t('pdfsEditPositionNextMarkOnPage')}
                onClick={positionMark}
                className="block max-w-full cursor-crosshair rounded border bg-white focus-visible:outline-2 focus-visible:outline-ring"
              >
                <img
                  src={preview.url}
                  alt={t('pdfsEditPreviewOfPDFPage', { page })}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              </button>
            ) : (
              !previewError && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t('pdfsEditUpdatingPreview')}
                </p>
              )
            )}
            {previewError && (
              <p role="alert" className="text-sm text-destructive">
                {renderMessage(t, previewError)}
              </p>
            )}
          </section>
          <Button
            variant="outline"
            onClick={() => {
              setValues({})
              setMarks([])
              setFlatten(false)
              setDraft(defaultMark)
              setMarkError('')
            }}
          >
            {t('pdfsEditResetEdits')}
          </Button>
        </>
      )}
    </PDFAction>
  )
}
