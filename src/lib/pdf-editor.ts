import type { PDFDocument, PDFPage } from 'pdf-lib'
import { loadEditablePDF, savePDF } from './pdf-edit'

export type PDFFieldValue = string | boolean | string[]
export interface PDFFormField {
  name: string
  type: 'text' | 'checkbox' | 'choice'
  value: PDFFieldValue
  readOnly: boolean
  multiline?: boolean
  password?: boolean
  maxLength?: number
  options?: string[]
  multiple?: boolean
}
export interface PDFMark {
  id: string
  page: number
  type: 'text' | 'check' | 'highlight' | 'box'
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

async function editableForm(document: PDFDocument) {
  const { PDFDict, PDFName } = await import('pdf-lib')
  if (
    document.catalog
      .lookupMaybe(PDFName.of('AcroForm'), PDFDict)
      ?.has(PDFName.of('XFA'))
  )
    throw new Error(
      'This PDF uses XFA forms, which this editor cannot fill. Choose a standard PDF form or a regular PDF.',
    )
  return document.getForm()
}

export async function readPDFForm(file: Blob) {
  const {
    PDFTextField,
    PDFCheckBox,
    PDFDropdown,
    PDFOptionList,
    PDFRadioGroup,
  } = await import('pdf-lib')
  const document = await loadEditablePDF(file)
  const form = await editableForm(document)
  const fields: PDFFormField[] = []
  let unsupported = 0
  for (const field of form.getFields()) {
    const base = { name: field.getName(), readOnly: field.isReadOnly() }
    if (field instanceof PDFTextField)
      fields.push({
        ...base,
        type: 'text',
        value: field.getText() ?? '',
        multiline: field.isMultiline(),
        password: field.isPassword(),
        maxLength: field.getMaxLength(),
      })
    else if (field instanceof PDFCheckBox)
      fields.push({ ...base, type: 'checkbox', value: field.isChecked() })
    else if (field instanceof PDFDropdown || field instanceof PDFOptionList)
      fields.push({
        ...base,
        type: 'choice',
        value: field.getSelected(),
        options: field.getOptions(),
        multiple: field.isMultiselect(),
      })
    else if (field instanceof PDFRadioGroup)
      fields.push({
        ...base,
        type: 'choice',
        value: field.getSelected() ?? '',
        options: field.getOptions(),
      })
    else unsupported++
  }
  return { fields, unsupported }
}

let fontBytes: Promise<ArrayBuffer> | undefined
function loadEditorFont() {
  fontBytes ??= fetch(
    '/pdf-engines/pdfjs/standard_fonts/LiberationSans-Regular.ttf',
  )
    .then((response) => {
      if (!response.ok)
        throw new Error('The PDF font could not be loaded. Try again.')
      return response.arrayBuffer()
    })
    .catch((error: unknown) => {
      fontBytes = undefined
      throw error
    })
  return fontBytes
}

/** Map coordinates in the displayed crop box back to the PDF's unrotated page. */
function displayPosition(page: PDFPage, left: number, bottom: number) {
  const crop = page.getCropBox()
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  let x = left
  let y = bottom
  if (rotation === 90) {
    x = crop.width - bottom
    y = left
  } else if (rotation === 180) {
    x = crop.width - left
    y = crop.height - bottom
  } else if (rotation === 270) {
    x = bottom
    y = crop.height - left
  }
  return { x: crop.x + x, y: crop.y + y, rotation }
}

export async function editPDF(
  file: Blob,
  values: Record<string, PDFFieldValue>,
  marks: PDFMark[],
  flatten: boolean,
  signal: AbortSignal,
) {
  signal.throwIfAborted()
  const {
    PDFTextField,
    PDFCheckBox,
    PDFDropdown,
    PDFOptionList,
    PDFRadioGroup,
    degrees,
    rgb,
  } = await import('pdf-lib')
  const document = await loadEditablePDF(file)
  const form = await editableForm(document)
  const changes = Object.entries(values)
  const needsFont =
    changes.length > 0 || marks.some((mark) => mark.type === 'text')
  let font
  if (needsFont) {
    const [{ default: fontkit }, bytes] = await Promise.all([
      import('@pdf-lib/fontkit'),
      loadEditorFont(),
    ])
    signal.throwIfAborted()
    document.registerFontkit(fontkit)
    font = await document.embedFont(bytes, { subset: true })
    const supported = new Set(font.getCharacterSet())
    const strings = [
      ...changes.flatMap(([, value]) =>
        typeof value === 'string' ? [value] : Array.isArray(value) ? value : [],
      ),
      ...marks.filter((mark) => mark.type === 'text').map((mark) => mark.text),
    ]
    if (
      strings.some((text) =>
        [...text].some(
          (character) =>
            !supported.has(character.codePointAt(0)!) &&
            !['\r', '\n'].includes(character),
        ),
      )
    )
      throw new Error(
        'One of the characters is unavailable in this PDF font. Use Latin, Greek, or Cyrillic text.',
      )
  }
  for (const [name, value] of changes) {
    const field = form.getField(name)
    if (field.isReadOnly()) throw new Error(`The field “${name}” is read-only.`)
    if (field instanceof PDFTextField && typeof value === 'string')
      field.setText(value)
    else if (field instanceof PDFCheckBox && typeof value === 'boolean') {
      if (value) field.check()
      else field.uncheck()
    } else if (
      field instanceof PDFDropdown ||
      field instanceof PDFOptionList ||
      field instanceof PDFRadioGroup
    ) {
      const selected = Array.isArray(value)
        ? value
        : typeof value === 'string' && value
          ? [value]
          : []
      if (selected.some((option) => !field.getOptions().includes(option)))
        throw new Error(`Choose an available option for “${name}”.`)
      if (!selected.length) field.clear()
      else if (field instanceof PDFRadioGroup) field.select(selected[0])
      else field.select(selected)
    } else throw new Error(`The field “${name}” cannot be filled.`)
  }
  if (changes.length) form.updateFieldAppearances(font)
  if (flatten) form.flatten()

  for (const mark of marks) {
    signal.throwIfAborted()
    const page = document.getPages()[mark.page - 1]
    if (
      !page ||
      !Number.isInteger(mark.page) ||
      ![mark.x, mark.y, mark.width, mark.height, mark.fontSize].every(
        Number.isFinite,
      ) ||
      mark.x < 0 ||
      mark.y < 0 ||
      mark.width <= 0 ||
      mark.height <= 0 ||
      mark.x + mark.width > 1.000001 ||
      mark.y + mark.height > 1.000001 ||
      mark.fontSize < 6 ||
      mark.fontSize > 96
    )
      throw new Error(
        'Keep each added mark inside its page and choose a text size from 6 to 96.',
      )
    const crop = page.getCropBox()
    const sideways = page.getRotation().angle % 180 !== 0
    const displayWidth = sideways ? crop.height : crop.width
    const displayHeight = sideways ? crop.width : crop.height
    const width = mark.width * displayWidth
    const height = mark.height * displayHeight
    const left = mark.x * displayWidth
    const bottom = displayHeight - (mark.y + mark.height) * displayHeight
    const { x, y, rotation } = displayPosition(page, left, bottom)
    if (mark.type === 'text') {
      const text = mark.text.trim().replace(/[\r\n]+/g, ' ')
      if (!text || !font) throw new Error('Enter the text to add.')
      const size = Math.min(
        mark.fontSize,
        height / 1.2,
        width / font.widthOfTextAtSize(text, 1),
      )
      if (size < 4)
        throw new Error(
          'The added text is too long for its box. Increase its width or shorten the text.',
        )
      const position = displayPosition(page, left, bottom + height - size)
      page.drawText(text, {
        x: position.x,
        y: position.y,
        size,
        font,
        rotate: degrees(rotation),
        color: rgb(0, 0, 0),
      })
    } else if (mark.type === 'check') {
      const points = [
        [0.1, 0.5],
        [0.4, 0.15],
        [0.9, 0.9],
      ].map(([px, py]) =>
        displayPosition(page, left + px * width, bottom + py * height),
      )
      for (let index = 1; index < points.length; index++)
        page.drawLine({
          start: points[index - 1],
          end: points[index],
          thickness: Math.max(1, Math.min(width, height) / 10),
          color: rgb(0, 0, 0),
        })
    } else
      page.drawRectangle({
        x,
        y,
        width,
        height,
        rotate: degrees(rotation),
        ...(mark.type === 'highlight'
          ? { color: rgb(1, 0.85, 0), opacity: 0.35 }
          : { borderColor: rgb(0, 0, 0), borderWidth: 1.5 }),
      })
  }
  signal.throwIfAborted()
  return savePDF(document)
}
