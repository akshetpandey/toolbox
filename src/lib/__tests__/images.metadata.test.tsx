import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

const { mockWriteMetadata, mockDownload, mockSetProcessing } = vi.hoisted(
  () => ({
    mockWriteMetadata: vi.fn(),
    mockDownload: vi.fn(),
    mockSetProcessing: vi.fn(),
  }),
)

vi.mock('@uswriting/exiftool', () => ({
  parseMetadata: vi.fn(),
  writeMetadata: mockWriteMetadata,
}))
vi.mock('@/lib/shared', () => ({ downloadBlob: mockDownload }))
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
    selectedFile,
    metadata: {},
    exifMetadata: { Make: 'Private camera' },
    isExtractingExif: false,
  }),
}))

import { Route } from '../../routes/images.metadata'

const MetadataPage = Route.options.component
if (!MetadataPage) throw new Error('Metadata route component is missing')

beforeEach(() => vi.clearAllMocks())
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
