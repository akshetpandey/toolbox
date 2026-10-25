import { afterEach, expect, test, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

const { mockStripMetadata, mockDownload, mockSetProcessing } = vi.hoisted(
  () => ({
    mockStripMetadata: vi.fn(),
    mockDownload: vi.fn(),
    mockSetProcessing: vi.fn(),
  }),
)

vi.mock('@/lib/metadata', () => ({ stripFileMetadata: mockStripMetadata }))
vi.mock('@/lib/shared', () => ({ downloadBlob: mockDownload }))
vi.mock('emoji-picker-react', () => ({ default: () => null }))
vi.mock('@/contexts/ProcessingContext', () => ({
  useProcessing: () => ({
    isProcessing: false,
    setIsProcessing: mockSetProcessing,
  }),
}))

const selectedFile = {
  file: new File(['private image'], 'private.png', { type: 'image/png' }),
  name: 'private.png',
  type: 'image/png',
  preview: 'blob:private-image',
  dimensions: { width: 32, height: 32 },
}
vi.mock('@/contexts/ImageToolsContext', () => ({
  useImageTools: () => ({ selectedFile }),
}))

import { Route } from '../../routes/images.redact'

const RedactPage = Route.options.component
if (!RedactPage) throw new Error('Redaction route component is missing')

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('shows metadata stripping failure without downloading a falsely cleaned redaction', async () => {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    setLineDash: vi.fn(),
    strokeRect: vi.fn(),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(
    HTMLCanvasElement.prototype,
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, 32, 32))
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => {
      callback(new Blob(['redacted pixels'], { type: 'image/png' }))
    },
  )
  vi.stubGlobal(
    'Image',
    class {
      width = 32
      height = 32
      onload: (() => void) | null = null
      set src(_source: string) {
        queueMicrotask(() => this.onload?.())
      }
    },
  )
  mockStripMetadata.mockRejectedValue(new Error('ExifTool failed'))

  const { container } = render(<RedactPage />)
  const canvas = container.querySelector('canvas')
  if (!canvas) throw new Error('Redaction canvas is missing')
  await waitFor(() => expect(canvas.width).toBe(32))
  fireEvent.mouseDown(canvas, { clientX: 4, clientY: 4 })
  fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 })
  fireEvent.mouseUp(canvas)
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'No file was downloaded',
    ),
  )
  expect(mockStripMetadata).toHaveBeenCalledOnce()
  expect(mockDownload).not.toHaveBeenCalled()
  expect(mockSetProcessing).toHaveBeenLastCalledWith(false)
})
