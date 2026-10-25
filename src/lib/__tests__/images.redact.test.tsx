import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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
vi.mock('@/lib/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shared')>()),
  downloadBlob: mockDownload,
}))
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

beforeEach(() => {
  vi.clearAllMocks()
  resetWorkspaceState()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setupCanvas() {
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
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback) => {
      callback(new Blob(['redacted pixels'], { type: 'image/png' }))
    })
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
  return toBlob
}

test('shows metadata stripping failure without downloading a falsely cleaned redaction', async () => {
  setupCanvas()
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

test('retains redaction work, accessible modes, and generated output across leaving and returning', async () => {
  const toBlob = setupCanvas()
  const first = render(<RedactPage />)
  const canvas = first.container.querySelector('canvas')!
  await waitFor(() => expect(canvas.width).toBe(32))
  fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
  fireEvent.change(screen.getByLabelText('Left'), { target: { value: '6' } })
  fireEvent.click(screen.getByRole('button', { name: 'Pixelate' }))
  expect(
    screen
      .getByRole('button', { name: 'Pixelate' })
      .getAttribute('aria-pressed'),
  ).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Download' }))
  await screen.findByRole('region', { name: 'Result' })
  first.unmount()
  render(<RedactPage />)
  expect(
    screen
      .getByRole('button', { name: 'Pixelate' })
      .getAttribute('aria-pressed'),
  ).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Area 1 · box' }))
  expect(screen.getByLabelText<HTMLInputElement>('Left').value).toBe('6')
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(mockDownload).toHaveBeenCalledTimes(2)
  expect(mockDownload.mock.calls[1]).toEqual(mockDownload.mock.calls[0])
  expect(toBlob).toHaveBeenCalledTimes(1)
})
