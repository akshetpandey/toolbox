import { expect, test } from 'vitest'
import { LibImageQuantProcessor } from '../libimagequant'
import type { ImageFile } from '../shared'

async function fixtureImage(): Promise<ImageFile> {
  const response = await fetch(
    new URL('./fixtures/sample-real.png', import.meta.url),
  )
  if (!response.ok)
    throw new Error(`Could not load PNG fixture: ${response.status}`)
  const file = new File([await response.blob()], 'sample-real.png', {
    type: 'image/png',
  })
  return {
    file,
    name: file.name,
    type: file.type,
    size: file.size,
    preview: '',
  }
}

async function expectIndexedPng(blob: Blob, width: number, height: number) {
  expect(blob.type).toBe('image/png')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(bytes[25]).toBe(3) // PNG IHDR: indexed color.
  const image = await createImageBitmap(blob)
  try {
    expect([image.width, image.height]).toEqual([width, height])
  } finally {
    image.close()
  }
}

test('the lazy browser worker produces decodable indexed PNGs across qualities and disposal', async () => {
  const processor = new LibImageQuantProcessor()
  try {
    const image = await fixtureImage()
    for (const quality of [85, 60]) {
      await expectIndexedPng(
        await processor.compressPNG(image, quality),
        350,
        208,
      )
    }
    processor.dispose()
    await expectIndexedPng(await processor.compressPNG(image, 95), 350, 208)
  } finally {
    processor.dispose()
  }
})

test('PNG compression preserves transparent and opaque pixels', async () => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 8
  const context = canvas.getContext('2d')!
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 4, 8)
  const input = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('PNG encoding failed')),
      'image/png',
    )
  })
  const file = new File([input], 'transparent.png', { type: 'image/png' })
  const processor = new LibImageQuantProcessor()
  try {
    const output = await processor.compressPNG(
      {
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        preview: '',
      },
      100,
    )
    await expectIndexedPng(output, 8, 8)
    const image = await createImageBitmap(output)
    try {
      context.clearRect(0, 0, 8, 8)
      context.drawImage(image, 0, 0)
      expect([...context.getImageData(1, 1, 1, 1).data]).toEqual([
        255, 0, 0, 255,
      ])
      expect(context.getImageData(6, 1, 1, 1).data[3]).toBe(0)
    } finally {
      image.close()
    }
  } finally {
    processor.dispose()
  }
})

test('a rejected PNG does not prevent the worker from processing the next file', async () => {
  const file = new File(['not a PNG'], 'broken.png', { type: 'image/png' })
  const processor = new LibImageQuantProcessor()
  try {
    await expect(
      processor.compressPNG(
        {
          file,
          name: file.name,
          type: file.type,
          size: file.size,
          preview: '',
        },
        85,
      ),
    ).rejects.toThrow()
    await expectIndexedPng(
      await processor.compressPNG(await fixtureImage(), 85),
      350,
      208,
    )
  } finally {
    processor.dispose()
  }
})
