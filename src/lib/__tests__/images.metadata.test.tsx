import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

const { mockWriteMetadata, mockDownload, mockSetProcessing, source, clear } =
  vi.hoisted(() => ({
    mockWriteMetadata: vi.fn(),
    mockDownload: vi.fn(),
    mockSetProcessing: vi.fn(),
    source: { selected: null as { file: File; name: string } | null },
    clear: vi.fn(),
  }))

vi.mock('@uswriting/exiftool', () => ({
  parseMetadata: vi.fn(),
  writeMetadata: mockWriteMetadata,
}))
vi.mock('@/lib/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shared')>()),
  downloadBlob: mockDownload,
}))
vi.mock('@/contexts/ProcessingContext', () => ({
  useProcessing: () => ({
    isProcessing: false,
    setIsProcessing: mockSetProcessing,
  }),
}))

const file = new File(['image with private EXIF'], 'private.jpg', {
  type: 'image/jpeg',
})
const selectedFile = { file, name: file.name }
vi.mock('@/contexts/ImageToolsContext', () => ({
  useImageTools: () => ({
    selectedFile: source.selected,
    metadata: {},
    exifMetadata: { Make: 'Private camera' },
    isExtractingExif: false,
    clearSelectedFile: clear,
  }),
}))

import { Route } from '../../routes/images.metadata'

const MetadataPage = Route.options.component
if (!MetadataPage) throw new Error('Metadata route component is missing')

beforeEach(() => {
  vi.clearAllMocks()
  mockWriteMetadata.mockReset()
  source.selected = selectedFile
  resetWorkspaceState()
})
afterEach(cleanup)

test.each(['failed result', 'WASM rejection'])(
  'never downloads the original image on %s',
  async (failure) => {
    if (failure === 'failed result') {
      mockWriteMetadata.mockResolvedValue({
        success: false,
        error: 'Unsupported file',
      })
    } else {
      mockWriteMetadata.mockRejectedValue(new Error('WASM failed'))
    }
    render(<MetadataPage />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Download Without Metadata' }),
    )

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'No file was downloaded',
      ),
    )
    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockSetProcessing).toHaveBeenLastCalledWith(false)

    // Retry can only download bytes produced by a successful strip operation.
    mockWriteMetadata.mockResolvedValue({
      success: true,
      data: new ArrayBuffer(3),
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Download Without Metadata' }),
    )
    await waitFor(() => expect(mockDownload).toHaveBeenCalledOnce())
    const [blob, filename] = mockDownload.mock.calls[0] as [Blob, string]
    expect(blob).not.toBe(file)
    expect(blob.size).toBe(3)
    expect(filename).toBe('no-metadata_private.jpg')
    expect(screen.queryByRole('alert')).toBeNull()
  },
)

test('previous result actions stay disabled during another metadata removal', async () => {
  mockWriteMetadata.mockResolvedValue({
    success: true,
    data: new ArrayBuffer(3),
  })
  render(<MetadataPage />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  await screen.findByRole('region', { name: 'Result' })

  let finish!: (result: { success: true; data: ArrayBuffer }) => void
  mockWriteMetadata.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  const downloadAgain = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Download again',
  })
  const startAnother = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Start another file',
  })
  expect(downloadAgain.disabled).toBe(true)
  expect(startAnother.disabled).toBe(true)
  fireEvent.click(downloadAgain)
  fireEvent.click(startAnother)
  expect(mockDownload).toHaveBeenCalledTimes(1)
  expect(clear).not.toHaveBeenCalled()

  await act(async () => {
    finish({ success: true, data: new ArrayBuffer(4) })
    await Promise.resolve()
  })
  await waitFor(() => expect(startAnother.disabled).toBe(false))
  expect(mockDownload).toHaveBeenCalledTimes(2)
})

test('replacing a source during metadata removal resets its local progress and discards obsolete output', async () => {
  let finish!: (result: { success: true; data: ArrayBuffer }) => void
  mockWriteMetadata.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const view = render(<MetadataPage />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  await screen.findByRole('button', { name: 'Removing metadata…' })

  source.selected = null
  view.rerender(<MetadataPage />)
  const replacement = new File(['new image'], 'replacement.jpg', {
    type: 'image/jpeg',
  })
  source.selected = { file: replacement, name: replacement.name }
  view.rerender(<MetadataPage />)
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Download Without Metadata',
    }).disabled,
  ).toBe(false)

  let finishReplacement!: (result: { success: true; data: ArrayBuffer }) => void
  mockWriteMetadata.mockReturnValueOnce(
    new Promise((resolve) => {
      finishReplacement = resolve
    }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  await waitFor(() => expect(mockWriteMetadata).toHaveBeenCalledTimes(2))
  await act(async () => {
    finish({ success: true, data: new ArrayBuffer(3) })
    await Promise.resolve()
  })
  expect(mockDownload).not.toHaveBeenCalled()
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Removing metadata…',
    }).disabled,
  ).toBe(true)
  await act(async () => {
    finishReplacement({ success: true, data: new ArrayBuffer(5) })
    await Promise.resolve()
  })
  await screen.findByRole('region', { name: 'Result' })
  expect(mockDownload).toHaveBeenCalledExactlyOnceWith(
    expect.any(Blob),
    'no-metadata_replacement.jpg',
  )
})
