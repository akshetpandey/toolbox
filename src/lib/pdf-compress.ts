import { canvasBlob, loadEditablePDF, savePDF } from './pdf-edit'

export type PDFCompressionMode = 'lossless' | 'balanced' | 'small'

export async function compressPDF(
  file: Blob,
  mode: PDFCompressionMode,
  signal: AbortSignal,
) {
  const { PDFName, PDFNumber, PDFRawStream } = await import('pdf-lib')
  const document = await loadEditablePDF(file)
  if (mode !== 'lossless') {
    for (const [ref, object] of document.context.enumerateIndirectObjects()) {
      signal.throwIfAborted()
      if (!(object instanceof PDFRawStream)) continue
      const dict = object.dict
      const contents = object.getContents()
      const width = dict.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber()
      const height = dict
        .lookupMaybe(PDFName.of('Height'), PDFNumber)
        ?.asNumber()
      // Restrict this to simple JPEG images. Keeping the original dictionary
      // preserves every reference to this image and all text and vector streams.
      if (
        dict.get(PDFName.of('Subtype')) !== PDFName.of('Image') ||
        dict.get(PDFName.of('Filter')) !== PDFName.of('DCTDecode') ||
        dict.get(PDFName.of('ColorSpace')) !== PDFName.of('DeviceRGB') ||
        dict
          .lookupMaybe(PDFName.of('BitsPerComponent'), PDFNumber)
          ?.asNumber() !== 8 ||
        [
          'Decode',
          'DecodeParms',
          'ImageMask',
          'Mask',
          'SMask',
          'SMaskInData',
          'Alternates',
        ].some((key) => dict.has(PDFName.of(key))) ||
        !width ||
        !height ||
        width * height > 16_000_000 ||
        contents.byteLength < 16_384
      )
        continue

      let bitmap: ImageBitmap | undefined
      const canvas = window.document.createElement('canvas')
      try {
        bitmap = await createImageBitmap(
          new Blob([new Uint8Array(contents)], { type: 'image/jpeg' }),
          { imageOrientation: 'none', colorSpaceConversion: 'none' },
        )
        if (bitmap.width !== width || bitmap.height !== height) continue
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) continue
        context.drawImage(bitmap, 0, 0)
        const encoded = await canvasBlob(
          canvas,
          'image/jpeg',
          mode === 'balanced' ? 0.76 : 0.52,
        )
        if (encoded.size < contents.byteLength)
          document.context.assign(
            ref,
            PDFRawStream.of(dict, new Uint8Array(await encoded.arrayBuffer())),
          )
      } catch {
        // Unsupported embedded JPEGs remain byte-for-byte intact.
      } finally {
        bitmap?.close()
        canvas.width = 0
      }
    }
  }
  signal.throwIfAborted()
  const compressed = await savePDF(document)
  return compressed.size < file.size ? compressed : file
}
