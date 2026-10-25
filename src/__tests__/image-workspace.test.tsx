import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ImageFile } from '@/lib/shared'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'

const { source, resize, convert, compress, download, processing } = vi.hoisted(
  () => ({
    source: { selected: null as ImageFile | null },
    resize: vi.fn<() => Promise<Blob>>(),
    convert: vi.fn<() => Promise<Blob>>(),
    compress: vi.fn<() => Promise<Blob>>(),
    download: vi.fn<(blob: Blob, filename: string) => void>(),
    processing: vi.fn<(value: boolean) => void>(),
  }),
)

vi.mock('@/contexts/ImageToolsContext', () => ({
  useImageTools: () => ({
    selectedFile: source.selected,
    imageMagickProcessor: {
      resizeImage: resize,
      convertImage: convert,
      compressImage: compress,
    },
    clearSelectedFile: vi.fn(),
  }),
}))
vi.mock('@/contexts/ProcessingContext', () => ({
  useProcessing: () => ({ isProcessing: false, setIsProcessing: processing }),
}))
vi.mock('@/lib/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shared')>()),
  downloadBlob: download,
}))

import { Route as ResizeRoute } from '@/routes/images.resize'
import { Route as ConvertRoute } from '@/routes/images.convert'
import { Route as CompressRoute } from '@/routes/images.compress'

const Resize = ResizeRoute.options.component!
const Convert = ConvertRoute.options.component!
const Compress = CompressRoute.options.component!

beforeEach(() => {
  resetWorkspaceState()
  vi.clearAllMocks()
  const file = new File([new Uint8Array(100)], 'source.photo.png', {
    type: 'image/png',
  })
  source.selected = {
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    preview: 'blob:source',
    dimensions: { width: 350, height: 208 },
  }
  resize.mockResolvedValue(new Blob(['resized'], { type: 'image/png' }))
  convert.mockResolvedValue(new Blob(['converted'], { type: 'image/webp' }))
  compress.mockResolvedValue(
    new Blob([new Uint8Array(150)], { type: 'image/png' }),
  )
})
afterEach(cleanup)

test('resize starts with actual dimensions, offers valid presets, and retains output for another download', async () => {
  render(<Resize />)
  expect(screen.getByLabelText<HTMLInputElement>('Width (px)').value).toBe(
    '350',
  )
  expect(screen.getByLabelText<HTMLInputElement>('Height (px)').value).toBe(
    '208',
  )
  fireEvent.click(screen.getByRole('button', { name: '50%' }))
  expect(screen.getByLabelText<HTMLInputElement>('Width (px)').value).toBe(
    '175',
  )
  expect(screen.getByLabelText<HTMLInputElement>('Height (px)').value).toBe(
    '104',
  )
  fireEvent.change(screen.getByLabelText('Width (px)'), {
    target: { value: '700' },
  })
  expect(screen.getByLabelText<HTMLInputElement>('Height (px)').value).toBe(
    '416',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Resize & download' }))
  await screen.findByRole('region', { name: 'Result' })
  expect(screen.getByText('700 × 416 px')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(resize).toHaveBeenCalledTimes(1)
  expect(download).toHaveBeenCalledTimes(2)
  expect(download.mock.calls[1]).toEqual(download.mock.calls[0])
})

test('resize edits and generated result survive ordinary route unmounts', async () => {
  render(<Resize />)
  fireEvent.change(screen.getByLabelText('Width (px)'), {
    target: { value: '700' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Resize & download' }))
  await screen.findByRole('region', { name: 'Result' })
  cleanup()
  render(<Resize />)
  expect(screen.getByLabelText<HTMLInputElement>('Width (px)').value).toBe(
    '700',
  )
  expect(screen.getByLabelText<HTMLInputElement>('Height (px)').value).toBe(
    '416',
  )
  expect(screen.getByRole('button', { name: 'Download again' })).toBeTruthy()
  expect(resize).toHaveBeenCalledTimes(1)
})

test('a different source resets resize dimensions and hides the previous output', async () => {
  const view = render(<Resize />)
  fireEvent.click(screen.getByRole('button', { name: 'Resize & download' }))
  await screen.findByRole('region', { name: 'Result' })
  const file = new File(['new'], 'second.png', { type: 'image/png' })
  source.selected = {
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    preview: 'blob:second',
    dimensions: { width: 640, height: 480 },
  }
  view.rerender(<Resize />)
  expect(screen.getByLabelText<HTMLInputElement>('Width (px)').value).toBe(
    '640',
  )
  expect(screen.getByLabelText<HTMLInputElement>('Height (px)').value).toBe(
    '480',
  )
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
})

test('conversion retains the full base filename and can download again without processing', async () => {
  render(<Convert />)
  fireEvent.click(screen.getByRole('button', { name: 'Convert & download' }))
  await screen.findByText('source.photo.webp')
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(convert).toHaveBeenCalledTimes(1)
  expect(download.mock.calls[1][1]).toBe('source.photo.webp')
  expect(screen.getByText('350 × 208 px')).toBeTruthy()
})

test('compression reports a larger output honestly and retains the actual generated bytes', async () => {
  render(<Compress />)
  fireEvent.click(screen.getByRole('button', { name: 'Compress & download' }))
  await screen.findByRole('region', { name: 'Result' })
  expect(screen.getByText(/50.0% larger/)).toBeTruthy()
  expect(
    screen.getByText(/The output is larger than the original/),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(compress).toHaveBeenCalledTimes(1)
  expect(download.mock.calls[1][0].size).toBe(150)
})

test('an obsolete image operation cannot download or unlock another category after navigation', async () => {
  let resolve!: (value: Blob) => void
  const pending = new Promise<Blob>((done) => {
    resolve = done
  })
  resize.mockReturnValueOnce(pending)
  const view = render(<Resize />)
  fireEvent.click(screen.getByRole('button', { name: 'Resize & download' }))
  expect(processing).toHaveBeenLastCalledWith(true)
  view.unmount()
  expect(processing).toHaveBeenLastCalledWith(false)
  processing(true)
  await act(async () => {
    resolve(new Blob(['obsolete'], { type: 'image/png' }))
    await pending
  })
  expect(download).not.toHaveBeenCalled()
  expect(processing).toHaveBeenLastCalledWith(true)
  render(<Resize />)
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
})
