import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { strFromU8, unzipSync } from 'fflate'
import { PDFDocument, PDFName } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const button = (page, name) => page.getByRole('button', { name, exact: true })
const field = (page, name) => page.getByLabel(name, { exact: true })
const select = (page, name, value) => field(page, name).selectOption(value)
const fill = (page, name, value) => field(page, name).fill(value)
const click = (page, name) => button(page, name).click()
const upload = (page, ...files) =>
  page.getByLabel(/^Upload files?$/).setInputFiles(files)
const visible = (page, text) =>
  page.getByText(text, { exact: true }).first().waitFor()

async function download(page, action) {
  const alert = page.getByRole('alert').first()
  const [file] = await Promise.all([
    Promise.race([
      page.waitForEvent('download', { timeout: 60_000 }),
      alert.waitFor({ timeout: 60_000 }).then(async () => {
        throw new Error(await alert.innerText())
      }),
    ]),
    action(),
  ])
  assert.equal(await file.failure(), null)
  const bytes = await readFile(await file.path())
  assert(bytes.length > 0, 'Downloaded file is empty')
  await file.delete()
  return { name: file.suggestedFilename(), bytes }
}

const run = (page, name) => download(page, () => click(page, name))

async function imageInfo(page, bytes, type) {
  return page.evaluate(
    async ({ payload, type }) => {
      const image = await createImageBitmap(
        new Blob([Uint8Array.fromBase64(payload)], { type }),
      )
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 96
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, 96, 96)
      const pixels = context.getImageData(0, 0, 96, 96).data
      const center = [...context.getImageData(48, 48, 1, 1).data]
      const width = image.width
      const height = image.height
      image.close()
      return {
        width,
        height,
        center,
        transparent: pixels.some(
          (value, index) => index % 4 === 3 && value < 64,
        ),
        opaque: pixels.some((value, index) => index % 4 === 3 && value > 192),
      }
    },
    { payload: Buffer.from(bytes).toString('base64'), type },
  )
}

async function videoInfo(page, bytes) {
  return page.evaluate(async (payload) => {
    const url = URL.createObjectURL(
      new Blob([Uint8Array.fromBase64(payload)], { type: 'video/mp4' }),
    )
    const video = document.createElement('video')
    try {
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve
        video.onerror = () =>
          reject(new Error('The downloaded video could not be decoded'))
        video.src = url
      })
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      }
    } finally {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
    }
  }, bytes.toString('base64'))
}

async function audioDuration(page, bytes) {
  const decoded = await page.evaluate(async (payload) => {
    const context = new OfflineAudioContext(1, 1, 44100)
    const audio = await context.decodeAudioData(
      Uint8Array.fromBase64(payload).buffer,
    )
    return {
      duration: audio.duration,
      hasSound: audio.getChannelData(0).some((value) => Math.abs(value) > 0.02),
    }
  }, bytes.toString('base64'))
  assert(decoded.hasSound, 'The exported audio is silent')
  return decoded.duration
}

async function pdfText(bytes, indexes) {
  const task = getDocument({ data: Uint8Array.from(bytes), verbosity: 0 })
  try {
    const document = await task.promise
    const pages =
      indexes ??
      Array.from({ length: document.numPages }, (_, index) => index + 1)
    return await Promise.all(
      pages.map(async (index) => {
        const { items } = await (await document.getPage(index)).getTextContent()
        return items
          .flatMap((item) => ('str' in item ? [item.str] : []))
          .join(' ')
          .replace(/\s+/g, ' ')
      }),
    )
  } finally {
    await task.destroy()
  }
}

const pdfPages = async (bytes) => (await PDFDocument.load(bytes)).getPages()
const imageTag = 'NASA / Neil Armstrong'
const videoTag = 'TOOLBOX_PRIVATE_FIXTURE'
const between = (value, min, max) =>
  assert(value >= min && value <= max, `${value} is outside ${min}–${max}`)

// A container can have the expected duration while its video track starts late.
// Read the video track's duration independently of the longer audio track.
function mp4VideoDuration(bytes) {
  function boxes({ start, end }) {
    const result = []
    for (let offset = start; offset + 8 <= end;) {
      const size = bytes.readUInt32BE(offset) || end - offset
      assert(size >= 8 && offset + size <= end, 'Invalid MP4 box')
      result.push({
        type: bytes.toString('ascii', offset + 4, offset + 8),
        start: offset + 8,
        end: offset + size,
      })
      offset += size
    }
    return result
  }
  const child = (box, type) => boxes(box).find((entry) => entry.type === type)
  const movie = child({ start: 0, end: bytes.length }, 'moov')
  const media = boxes(movie)
    .filter(({ type }) => type === 'trak')
    .map((track) => child(track, 'mdia'))
    .find((track) => {
      const { start } = child(track, 'hdlr')
      return bytes.toString('ascii', start + 8, start + 12) === 'vide'
    })
  const { start } = child(media, 'mdhd')
  return bytes[start] === 1
    ? Number(bytes.readBigUInt64BE(start + 24)) / bytes.readUInt32BE(start + 20)
    : bytes.readUInt32BE(start + 16) / bytes.readUInt32BE(start + 12)
}

export const workflows = {
  '/images/resize': async (page, f) => {
    await upload(page, f.photo)
    await fill(page, 'Width (px)', '1280')
    const { bytes } = await run(page, 'Resize & download')
    const { width, height } = await imageInfo(page, bytes, 'image/jpeg')
    assert.equal(width, 1280)
    between(height, 1337, 1340)
  },
  '/images/compress': async (page, f) => {
    await upload(page, f.photo)
    await click(page, 'Set a file size limit')
    await fill(page, 'Maximum file size (KB)', '350')
    await field(page, 'Allow smaller dimensions if needed').check()
    const { bytes } = await run(page, 'Compress & download')
    assert(bytes.length <= 350_000)
    assert((await imageInfo(page, bytes, 'image/jpeg')).width > 1000)
  },
  '/images/convert': async (page, f) => {
    await upload(page, { ...f.heic, mimeType: '' })
    await page.getByRole('img', { name: f.heic.name }).waitFor()
    const { name, bytes } = await run(page, 'Convert & download')
    assert.equal(name, 'apollo.jpg')
    assert.equal((await imageInfo(page, bytes, 'image/jpeg')).height, 3200)
  },
  '/images/crop': async (page, f, capture) => {
    await upload(page, f.photo)
    await click(page, 'Square (1:1)')
    await click(page, 'Rotate 90°')
    await click(page, 'Flip horizontally')
    await page.getByText(/^Preview edited image \(/).click()
    const preview = page.getByRole('img', { name: 'Edited image preview' })
    await preview.waitFor()
    await capture('edit', preview)
    const { bytes } = await run(page, 'Apply edits & download')
    const image = await imageInfo(page, bytes, 'image/jpeg')
    assert.equal(image.width, image.height)
    assert(image.width > 3000)
  },
  '/images/batch': async (page, f) => {
    await upload(page, f.photo, f.heic, f.secondImage)
    await select(page, 'Output format', 'webp')
    const { bytes } = await run(page, 'Process images & download ZIP')
    const files = unzipSync(bytes)
    assert.equal(Object.keys(files).length, 3)
    for (const image of Object.values(files))
      assert((await imageInfo(page, image, 'image/webp')).width > 100)
  },
  '/images/background': async (page, f) => {
    await upload(page, f.photo)
    const { bytes } = await run(page, 'Remove background & download PNG')
    const { opaque, transparent, height } = await imageInfo(
      page,
      bytes,
      'image/png',
    )
    assert(
      opaque && transparent,
      'Expected a visible subject and transparent background',
    )
    assert.equal(height, 3200)
  },
  '/images/redact': async (page, f, capture) => {
    await upload(page, f.photo)
    await page.getByLabel('Image redaction canvas').waitFor()
    await click(page, 'Add area')
    await capture('edit', page.getByLabel('Image redaction canvas'))
    const { bytes } = await run(page, 'Download Without Metadata')
    const { center, height } = await imageInfo(page, bytes, 'image/png')
    assert.deepEqual(center, [0, 0, 0, 255])
    assert.equal(height, 3200)
    assert(!bytes.includes(imageTag))
  },
  '/images/metadata': async (page, f) => {
    await upload(page, f.photo)
    await visible(page, imageTag)
    const { bytes } = await run(page, 'Download Without Metadata')
    assert(f.photo.buffer.includes(imageTag) && !bytes.includes(imageTag))
    assert.equal((await imageInfo(page, bytes, 'image/jpeg')).height, 3200)
  },
  '/videos/compress': async (page, f) => {
    await upload(page, f.video)
    await select(page, 'Compress by', 'size')
    await fill(page, 'Maximum size (MB)', '1.7')
    const { bytes } = await run(page, 'Compress video')
    assert(bytes.length <= 1_700_000)
    between((await videoInfo(page, bytes)).duration, 8.9, 9.2)
  },
  '/videos/convert': async (page, f) => {
    await upload(page, f.portrait)
    const { bytes } = await run(page, 'Convert to MP4')
    const result = await videoInfo(page, bytes)
    assert.deepEqual([result.width, result.height], [540, 960])
    between(result.duration, 4.9, 5.1)
  },
  '/videos/trim': async (page, f) => {
    await upload(page, f.video)
    await fill(page, 'Start (seconds)', '2.25')
    await fill(page, 'End (seconds)', '5.75')
    const { bytes } = await run(page, 'Create clip')
    between((await videoInfo(page, bytes)).duration, 3.4, 3.65)
    between(mp4VideoDuration(bytes), 3.4, 3.65)
  },
  '/videos/join': async (page, f) => {
    await upload(page, f.video, f.portrait)
    const { bytes } = await run(page, 'Join videos')
    between((await videoInfo(page, bytes)).duration, 13.8, 14.3)
    between(await audioDuration(page, bytes), 13.8, 14.3)
  },
  '/videos/extract': async (page, f) => {
    await upload(page, f.video)
    const { bytes } = await run(page, 'Extract audio')
    between(await audioDuration(page, bytes), 8.9, 9.2)
  },
  '/videos/metadata': async (page, f) => {
    await upload(page, f.video)
    const { bytes } = await run(page, 'Remove metadata')
    assert(f.video.buffer.includes(videoTag) && !bytes.includes(videoTag))
    assert.equal((await videoInfo(page, bytes)).width, 1920)
  },
  '/audio/convert': async (page, f) => {
    await upload(page, f.audio)
    const { name, bytes } = await run(page, 'Convert audio')
    assert.equal(name, 'soundtrack.mp3')
    between(await audioDuration(page, bytes), 8.9, 9.2)
  },
  '/audio/trim': async (page, f) => {
    await upload(page, f.audio)
    await fill(page, 'Start (seconds)', '1.2')
    await fill(page, 'End (seconds)', '5.1')
    const { bytes } = await run(page, 'Create audio clip')
    between(await audioDuration(page, bytes), 3.8, 4.02)
  },
  '/audio/join': async (page, f) => {
    await upload(page, f.intro, f.audio)
    await select(page, 'Output format', 'wav')
    const { bytes } = await run(page, 'Join audio')
    between(await audioDuration(page, bytes), 13.8, 14.3)
  },
  '/pdfs/merge': async (page, f) => {
    await upload(page, f.appendix, f.report)
    const { bytes } = await run(page, 'Merge 2 PDFs')
    assert.equal((await pdfPages(bytes)).length, 8)
    assert.match(
      (await pdfText(bytes, [1, 3])).join(' / '),
      /Inventory appendix.*Field survey report 1/,
    )
  },
  '/pdfs/compress': async (page, f) => {
    await upload(page, f.report)
    await select(page, 'Quality', 'small')
    const { bytes } = await run(page, 'Compress and download')
    assert(
      bytes.length < f.report.buffer.length * 0.9,
      'Image-heavy PDF did not shrink',
    )
    assert.equal((await pdfPages(bytes)).length, 6)
    assert.match((await pdfText(bytes, [6]))[0], /Field survey report 6/)
  },
  '/pdfs/split': async (page, f) => {
    await upload(page, f.report)
    await fill(page, 'Pages', '2-3, 6')
    await field(page, 'Save each range as a separate PDF').check()
    const { bytes } = await run(page, 'Split and download ZIP')
    const parts = Object.values(unzipSync(bytes))
    assert.equal(parts.length, 2)
    assert.equal((await pdfPages(parts[0])).length, 2)
    assert.match((await pdfText(parts[1]))[0], /Field survey report 6/)
  },
  '/pdfs/organize': async (page, f) => {
    await upload(page, f.report)
    await click(page, 'Move page 2 up')
    await click(page, 'Rotate page 2 clockwise')
    await click(page, 'Remove page 6')
    const { bytes } = await run(page, 'Save organized PDF')
    const pages = await pdfPages(bytes)
    assert.equal(pages.length, 5)
    assert.equal(pages[0].getRotation().angle, 90)
    assert.match((await pdfText(bytes, [1]))[0], /Field survey report 2/)
  },
  '/pdfs/from-images': async (page, f) => {
    await upload(page, f.photo, f.secondImage)
    await select(page, 'Page size', 'a4')
    const { bytes } = await run(page, 'Create PDF and download')
    const pages = await pdfPages(bytes)
    assert.equal(pages.length, 2)
    assert(pages[0].getHeight() > pages[0].getWidth())
    assert(pages[1].getWidth() > pages[1].getHeight())
  },
  '/pdfs/to-images': async (page, f) => {
    await upload(page, f.report)
    await fill(page, 'Pages', '1, 4')
    await select(page, 'Image format', 'png')
    await select(page, 'Resolution', '2')
    const { bytes } = await run(page, 'Export pages')
    const images = Object.values(unzipSync(bytes))
    assert.equal(images.length, 2)
    const sizes = await Promise.all(
      images.map((image) => imageInfo(page, image, 'image/png')),
    )
    assert.deepEqual(
      sizes.map(({ width, height }) => [width, height]),
      [
        [1224, 1584],
        [1584, 1224],
      ],
    )
  },
  '/pdfs/ocr': async (page, f) => {
    await upload(page, f.scan)
    const { bytes } = await run(page, 'Make searchable and download')
    const text = await pdfText(bytes)
    assert.equal(text.length, 2)
    assert.match(text[0], /EQUIPMENT\s+INSPECTION/i)
    assert.match(text[1], /FIELD\s+SAFETY\s+CHECKLIST/i)
  },
  '/pdfs/redact': async (page, f, capture) => {
    await upload(page, f.report)
    await page.getByText('Enter an exact area', { exact: true }).click()
    await fill(page, 'Left %', '5')
    await fill(page, 'Top %', '10')
    await fill(page, 'Width %', '65')
    await fill(page, 'Height %', '5')
    await click(page, 'Add redaction area')
    await capture(
      'edit',
      page.getByRole('img', { name: 'Preview of PDF page 1' }),
    )
    const { bytes } = await run(page, 'Redact and download')
    const document = await PDFDocument.load(bytes)
    assert.equal(document.getPageCount(), 6)
    assert.equal(document.getTitle(), undefined)
    assert((await pdfText(bytes)).every((text) => text === ''))
  },
  '/pdfs/sign': async (page, f) => {
    await upload(page, f.report)
    await fill(page, 'Signature name', 'Jordan Rivera')
    await fill(page, 'Page', '4')
    const { bytes } = await run(page, 'Add signature and download')
    const pages = await pdfPages(bytes)
    assert.equal(pages.length, 6)
    assert(
      pages[3].node.Resources().lookup(PDFName.of('XObject')).keys().length > 1,
    )
    assert.match((await pdfText(bytes, [4]))[0], /Field survey report 4/)
  },
  '/pdfs/watermark': async (page, f) => {
    await upload(page, f.report)
    await fill(page, 'Watermark text', 'For review')
    const { bytes } = await run(page, 'Add watermark and download')
    const pages = await pdfPages(bytes)
    assert.equal(pages.length, 6)
    assert(
      pages.every(
        (sheet) =>
          sheet.node.Resources().lookup(PDFName.of('XObject')).keys().length >
          0,
      ),
    )
    assert.match((await pdfText(bytes, [6]))[0], /Field survey report 6/)
  },
  '/pdfs/to-word': async (page, f) => {
    await upload(page, f.report)
    const { bytes } = await run(page, 'Export to Word')
    const xml = strFromU8(unzipSync(bytes)['word/document.xml'])
    assert.match(xml, /Field survey report 1/)
    assert.match(xml, /Field survey report 6/)
  },
  '/office-documents/convert': async (page, f) => {
    for (const [file, text] of [
      [f.sheet, /Field inventory/],
      [f.slides, /Field survey overview/],
      [f.word, /Field survey handbook/],
    ]) {
      const { bytes } = await download(page, () => upload(page, file))
      assert.match((await pdfText(bytes)).join(' '), text)
    }
  },
  '/archives/compress': async (page, f) => {
    await upload(
      page,
      f.photo,
      f.report,
      { ...f.appendix, name: f.report.name },
      { ...f.archive, name: 'archive.zip' },
    )
    const { bytes } = await run(page, 'Create ZIP archive')
    const contents = unzipSync(bytes)
    assert.equal(Object.keys(contents).length, 4)
    for (const file of [f.photo, f.report])
      assert(Buffer.from(contents[file.name]).equals(file.buffer))
    assert(
      Buffer.from(contents['field-survey (2).pdf']).equals(f.appendix.buffer),
    )
    assert(Buffer.from(contents['archive.zip']).equals(f.archive.buffer))
  },
  '/archives/extract': async (page, f) => {
    await upload(page, f.archive)
    await page.getByText('Password-protected archive', { exact: true }).click()
    await fill(page, 'Archive password', 'wrong-password')
    await click(page, 'Extract files')
    await page
      .getByRole('alert')
      .filter({ hasText: 'Check the password' })
      .waitFor()
    await fill(page, 'Archive password', 'field-team')
    await click(page, 'Extract files')
    const { bytes } = await run(page, 'Download all as ZIP')
    const files = unzipSync(bytes)
    assert(Buffer.from(files['records/apollo.jpg']).equals(f.photo.buffer))
    assert(Buffer.from(files[f.report.name]).equals(f.report.buffer))
  },
  '/utilities/hash': async (page, f) => {
    await upload(page, f.video)
    const hash = (algorithm) =>
      createHash(algorithm).update(f.video.buffer).digest('hex')
    for (const algorithm of ['md5', 'sha1', 'sha256'])
      await visible(page, hash(algorithm))
    await fill(page, 'Expected hash (optional)', hash('sha256'))
    await visible(page, 'Matches SHA256')
  },
  '/utilities/metadata': async (page, f) => {
    await upload(page, f.report)
    await visible(page, 'application/pdf')
    await upload(page, f.photo)
    await visible(page, 'image/jpeg')
    const { bytes } = await run(page, 'Download Without Metadata')
    assert(f.photo.buffer.includes(imageTag) && !bytes.includes(imageTag))
    assert.equal((await imageInfo(page, bytes, 'image/jpeg')).height, 3200)
  },
}
