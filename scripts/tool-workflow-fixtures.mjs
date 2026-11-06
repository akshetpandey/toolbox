import { readFile } from 'node:fs/promises'
import SevenZip from '7z-wasm'
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
} from 'docx'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

const fixtures = new URL('../src/lib/__tests__/fixtures/', import.meta.url)
const fixture = async (name, mimeType) => ({
  name: name.split('/').at(-1),
  mimeType,
  buffer: await readFile(new URL(name, fixtures)),
})
const pdfFile = async (name, pdf) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await pdf.save()),
})

const notes = [
  'The team recorded each sample at the collection station before transferring the sealed container.',
  'Review the inventory against the original field notes and flag missing or unreadable labels.',
  'The summary includes verified observations and a separate list of entries that still need review.',
  'Keep the signed copy with the report and send the field team a copy of the updated index.',
]

async function makeReports(photo, page) {
  const report = await PDFDocument.create()
  report.setTitle('Field survey - private working copy')
  const body = await report.embedFont(StandardFonts.Helvetica)
  const heading = await report.embedFont(StandardFonts.HelveticaBold)
  const image = await report.embedJpg(photo.buffer)

  for (let index = 1; index <= 6; index++) {
    const sheet = report.addPage([612, 792])
    sheet.drawRectangle({
      x: 0,
      y: 719,
      width: 612,
      height: 73,
      color: rgb(0.11, 0.2, 0.33),
    })
    sheet.drawText(`Field survey report ${index}`, {
      x: 46,
      y: 745,
      size: 26,
      font: heading,
      color: rgb(1, 1, 1),
    })
    sheet.drawText('Internal reference RIVER-7241', {
      x: 47,
      y: 691,
      size: 14,
      font: heading,
    })
    notes.forEach((note, line) =>
      sheet.drawText(note, { x: 47, y: 659 - line * 21, size: 10, font: body }),
    )
    if (index === 1 || index === 4) {
      const size = image.scaleToFit(510, 460)
      sheet.drawImage(image, { x: (612 - size.width) / 2, y: 100, ...size })
    } else {
      for (let row = 0; row < 18; row++) {
        const y = 520 - row * 24
        if (row % 2 === 0)
          sheet.drawRectangle({
            x: 47,
            y: y - 6,
            width: 518,
            height: 22,
            color: rgb(0.9, 0.94, 0.97),
          })
        sheet.drawText(
          `Station ${index}-${row + 1}        Sample retained        Record checked        Follow-up scheduled`,
          { x: 56, y, size: 11, font: body },
        )
      }
    }
    sheet.drawText(`Survey operations  |  ${index} of 6`, {
      x: 47,
      y: 42,
      size: 9,
      font: body,
    })
    if (index === 4) sheet.setRotation(degrees(90))
  }

  const appendix = await PDFDocument.create()
  for (const title of ['Inventory appendix', 'Equipment checklist']) {
    const sheet = appendix.addPage([595, 842])
    sheet.drawText(title, { x: 50, y: 770, size: 26 })
    notes.forEach((note, index) =>
      sheet.drawText(note, { x: 50, y: 725 - index * 25, size: 10 }),
    )
  }

  const scans = await PDFDocument.create()
  for (const title of ['EQUIPMENT INSPECTION', 'FIELD SAFETY CHECKLIST']) {
    const dataUrl = await page.evaluate(
      ({ title, notes }) => {
        const canvas = document.createElement('canvas')
        canvas.width = 1275
        canvas.height = 1650
        const context = canvas.getContext('2d')
        context.fillStyle = '#f6f4ed'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.translate(85, 130)
        context.rotate(-0.012)
        context.fillStyle = '#222'
        context.font = 'bold 48px serif'
        context.fillText(title, 0, 0)
        context.font = '27px serif'
        context.fillText('Field operations manual - Section 08', 0, 61)
        for (let row = 0; row < 16; row++) {
          const line = notes[row % notes.length]
          context.fillText(line.slice(0, 80), 0, 142 + row * 68)
          context.fillText(line.slice(80).trim(), 0, 174 + row * 68)
        }
        return canvas.toDataURL('image/jpeg', 0.85)
      },
      { title, notes },
    )
    const scan = await scans.embedJpg(dataUrl)
    scans
      .addPage([612, 792])
      .drawImage(scan, { x: 0, y: 0, width: 612, height: 792 })
  }
  return {
    report: await pdfFile('field-survey.pdf', report),
    appendix: await pdfFile('inventory-appendix.pdf', appendix),
    scan: await pdfFile('inspection-scan.pdf', scans),
  }
}

async function makeWordFile(photo) {
  const cell = (text) => new TableCell({ children: [new Paragraph(text)] })
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'Field survey handbook',
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph(
            'An illustrated reference for the team collecting and reviewing the field inventory.',
          ),
          new Paragraph({
            children: [
              new ImageRun({
                type: 'jpg',
                data: photo.buffer,
                transformation: { width: 230, height: 240 },
              }),
            ],
          }),
          ...Array.from({ length: 4 }, (_, index) => [
            new Paragraph({
              text: `Inspection section ${index + 1}`,
              heading: HeadingLevel.HEADING_1,
              pageBreakBefore: true,
            }),
            ...notes.map((note) => new Paragraph(note)),
            new Table({
              rows: [
                new TableRow({
                  children: ['Station', 'Record', 'Status'].map(cell),
                }),
                ...Array.from(
                  { length: 12 },
                  (_, row) =>
                    new TableRow({
                      children: [
                        `Station ${row + 1}`,
                        `Sample ${index + 1}-${row + 1}`,
                        'Verified',
                      ].map(cell),
                    }),
                ),
              ],
            }),
          ]).flat(),
        ],
      },
    ],
  })
  return {
    name: 'field-handbook.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await Packer.toBuffer(document),
  }
}

async function makeLockedArchive(photo, report) {
  const sevenZip = await SevenZip({
    print: () => undefined,
    printErr: () => undefined,
  })
  sevenZip.FS.mkdir('records')
  sevenZip.FS.writeFile('records/apollo.jpg', photo.buffer)
  sevenZip.FS.writeFile('field-survey.pdf', report.buffer)
  const status = sevenZip.callMain([
    'a',
    '-tzip',
    '-mem=AES256',
    '-pfield-team',
    'field-records.zip',
    'records',
    'field-survey.pdf',
  ])
  if (status !== 0 && status !== undefined)
    throw new Error('Could not create the encrypted test archive')
  return {
    name: 'field-records.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(sevenZip.FS.readFile('field-records.zip')),
  }
}

export async function workflowFixtures(page) {
  const [
    photo,
    heic,
    secondImage,
    video,
    portrait,
    audio,
    intro,
    sheet,
    slides,
  ] = await Promise.all([
    fixture('workflows/apollo.jpg', 'image/jpeg'),
    fixture('workflows/apollo.heic', 'image/heic'),
    fixture('sample-real.png', 'image/png'),
    fixture('workflows/forest.mp4', 'video/mp4'),
    fixture('workflows/portrait.mov', 'video/quicktime'),
    fixture('workflows/soundtrack.m4a', 'audio/mp4'),
    fixture('workflows/intro.wav', 'audio/wav'),
    fixture(
      'workflows/inventory.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ),
    fixture(
      'workflows/briefing.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ),
  ])
  const [reports, word] = await Promise.all([
    makeReports(photo, page),
    makeWordFile(photo),
  ])
  const archive = await makeLockedArchive(photo, reports.report)
  return {
    photo,
    heic,
    secondImage,
    video,
    portrait,
    audio,
    intro,
    sheet,
    slides,
    ...reports,
    word,
    archive,
  }
}
