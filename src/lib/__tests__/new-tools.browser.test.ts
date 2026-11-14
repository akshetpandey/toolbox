import { expect, test } from 'vitest'
import jsQR from 'jsqr'
import { PDFDict, PDFDocument, PDFName, degrees } from 'pdf-lib'
import { generateQRCode, qrPayload, type QRSettings } from '../qr'
import { editPDF, readPDFForm, type PDFMark } from '../pdf-editor'
import { openBrowserPDF, renderPDFPage } from '../pdf-render'
import { savePDF } from '../pdf-edit'

const signal = new AbortController().signal
const settings: QRSettings = {
  type: 'text',
  content: 'Local QR: café / 東京',
  ssid: '',
  password: '',
  security: 'WPA',
  hidden: false,
  format: 'png',
}

test.each(['png', 'svg'] as const)(
  'downloads a decodable %s QR code with the exact Unicode payload',
  async (format) => {
    const blob = await generateQRCode({ ...settings, format })
    const url = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const decoded = jsQR(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
      )
      expect(decoded?.data).toBe(settings.content)
      expect(canvas.width).toBe(1024)
      canvas.width = 0
    } finally {
      URL.revokeObjectURL(url)
    }
  },
)

test('encodes Wi-Fi delimiters literally and rejects invalid website addresses', async () => {
  expect(
    qrPayload({
      ...settings,
      type: 'wifi',
      ssid: 'Cafe;\\network',
      password: 'pass:word,"',
      hidden: true,
    }),
  ).toBe('WIFI:T:WPA;S:Cafe\\;\\\\network;P:pass\\:word\\,\\";H:true;;')
  expect(
    qrPayload({
      ...settings,
      type: 'wifi',
      ssid: 'Open',
      security: 'nopass',
      password: 'old secret',
    }),
  ).not.toContain('old secret')
  await expect(
    generateQRCode({
      ...settings,
      type: 'url',
      content: 'javascript:alert(1)',
    }),
  ).rejects.toThrow('full website address')
  await expect(
    generateQRCode({ ...settings, content: 'x'.repeat(5000) }),
  ).rejects.toThrow('shorter text')
})

async function formPDF() {
  const document = await PDFDocument.create()
  const page = document.addPage([400, 500])
  page.drawText('Original document', { x: 30, y: 450 })
  const form = document.getForm()
  const text = form.createTextField('Name')
  text.setMaxLength(40)
  text.addToPage(page, { x: 30, y: 380, width: 320, height: 32 })
  const check = form.createCheckBox('Consent')
  check.addToPage(page, { x: 30, y: 330, width: 20, height: 20 })
  const choices = form.createDropdown('Department')
  choices.addOptions(['Research', 'Operations'])
  choices.addToPage(page, { x: 30, y: 280, width: 200, height: 32 })
  const fixed = form.createTextField('Reference')
  fixed.setText('KEEP-123')
  fixed.enableReadOnly()
  fixed.addToPage(page, { x: 30, y: 220, width: 200, height: 32 })
  return savePDF(document)
}

const mark: PDFMark = {
  id: 'annotation',
  type: 'text',
  text: 'Reviewed Ω',
  page: 1,
  x: 0.1,
  y: 0.8,
  width: 0.7,
  height: 0.1,
  fontSize: 16,
}

test('fills real form fields, preserves original text and read-only fields, and optionally flattens appearances', async () => {
  const input = await formPDF()
  const { fields } = await readPDFForm(input)
  expect(fields.find((field) => field.name === 'Reference')?.readOnly).toBe(
    true,
  )
  expect(fields.find((field) => field.name === 'Department')?.options).toEqual([
    'Research',
    'Operations',
  ])
  const changes = { Name: 'Márta Ω Ж', Consent: true, Department: 'Research' }
  const output = await editPDF(input, changes, [mark], false, signal)
  const form = (await PDFDocument.load(await output.arrayBuffer())).getForm()
  expect(form.getTextField('Name').getText()).toBe('Márta Ω Ж')
  expect(form.getCheckBox('Consent').isChecked()).toBe(true)
  expect(form.getDropdown('Department').getSelected()).toEqual(['Research'])
  expect(form.getTextField('Reference').getText()).toBe('KEEP-123')
  await expect(
    editPDF(input, { Reference: 'changed' }, [], false, signal),
  ).rejects.toThrow('read-only')
  const flattened = await editPDF(input, changes, [mark], true, signal)
  expect(
    (await PDFDocument.load(await flattened.arrayBuffer()))
      .getForm()
      .getFields(),
  ).toEqual([])
  const pdf = await openBrowserPDF(flattened)
  try {
    const { items } = await (await pdf.getPage(1)).getTextContent()
    const text = items
      .flatMap((item) => ('str' in item ? [item.str] : []))
      .join(' ')
    expect(text).toContain('Original document')
    expect(text).toContain('Reviewed Ω')
    expect(text).toContain('Márta Ω Ж')
    expect(text).toContain('KEEP-123')
  } finally {
    await pdf.loadingTask.destroy()
  }
})

test.each([0, 90, 180, 270])(
  'positions marks in the displayed crop box on a %s-degree page',
  async (rotation) => {
    const document = await PDFDocument.create()
    const page = document.addPage([300, 400])
    page.setCropBox(50, 70, 200, 250)
    page.setRotation(degrees(rotation))
    const output = await editPDF(
      await savePDF(document),
      {},
      [
        {
          ...mark,
          type: 'highlight',
          x: 0.15,
          y: 0.2,
          width: 0.2,
          height: 0.1,
        },
      ],
      false,
      signal,
    )
    const pdf = await openBrowserPDF(output)
    try {
      const { canvas } = await renderPDFPage(await pdf.getPage(1), 1)
      const pixels = canvas
        .getContext('2d')!
        .getImageData(
          Math.floor(canvas.width * 0.25),
          Math.floor(canvas.height * 0.25),
          1,
          1,
        ).data
      expect(pixels[0]).toBe(255)
      expect(pixels[2]).toBeLessThan(200)
      expect(pixels[3]).toBe(255)
      canvas.width = 0
    } finally {
      await pdf.loadingTask.destroy()
    }
  },
)

test('rejects XFA forms instead of silently deleting their data', async () => {
  const document = await PDFDocument.create()
  document.addPage()
  document.getForm()
  document.catalog
    .lookup(PDFName.of('AcroForm'), PDFDict)
    .set(PDFName.of('XFA'), document.context.obj('xfa data'))
  const input = await savePDF(document)
  await expect(readPDFForm(input)).rejects.toThrow('XFA')
  await expect(editPDF(input, {}, [], false, signal)).rejects.toThrow('XFA')
})
