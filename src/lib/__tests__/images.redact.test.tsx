import {
  invalidateWorkspaceState,
  resetWorkspaceState,
} from '@/hooks/useWorkspaceState'
import type { ImageFile } from '@/lib/shared'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

const {
  mockStripMetadata,
  mockDownload,
  mockSetProcessing,
  mockClear,
  source,
} = vi.hoisted(() => ({
  mockStripMetadata: vi.fn(),
  mockDownload: vi.fn(),
  mockSetProcessing: vi.fn(),
  mockClear: vi.fn(),
  source: { selected: null as ImageFile | null },
}))

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
  size: 13,
  type: 'image/png',
  preview: 'blob:private-image',
  dimensions: { width: 32, height: 32 },
}
vi.mock('@/contexts/ImageToolsContext', () => ({
  useImageTools: () => ({
    selectedFile: source.selected,
    clearSelectedFile: mockClear,
  }),
}))

import { Route } from '../../routes/images.redact'

const RedactPage = Route.options.component
if (!RedactPage) throw new Error('Redaction route component is missing')

beforeEach(() => {
  vi.clearAllMocks()
  resetWorkspaceState()
  source.selected = selectedFile
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

test.each(['replace', 'clear'])(
  'Undo and Clear All keep working after a source %s invalidates the mounted workspace',
  async (action) => {
    setupCanvas()
    const view = render(<RedactPage />)
    await waitFor(() =>
      expect(view.container.querySelector('canvas')!.width).toBe(32),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    await screen.findByRole('region', { name: 'Result' })
    const replacement = new File(['new image'], 'replacement.png', {
      type: 'image/png',
    })
    const next = {
      ...selectedFile,
      file: replacement,
      name: replacement.name,
      preview: 'blob:replacement',
    }
    act(() => {
      source.selected = action === 'clear' ? null : next
      invalidateWorkspaceState(['images.', 'result.images.'])
      view.rerender(<RedactPage />)
    })
    if (action === 'clear') {
      source.selected = next
      view.rerender(<RedactPage />)
    }
    await waitFor(() =>
      expect(view.container.querySelector('canvas')!.width).toBe(32),
    )
    expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByRole('button', { name: 'Area 1 · box' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))
    expect(screen.queryByRole('button', { name: 'Area 1 · box' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.queryByRole('button', { name: 'Area 1 · box' })).toBeNull()
  },
)

test.each([
  'add',
  'bounds',
  'drag',
  'resize',
  'touch drag',
  'touch resize',
  'draw',
  'touch draw',
  'undo',
  'keyboard undo',
  'clear',
  'delete',
])('invalidates a previous export after a redaction %s edit', async (edit) => {
  setupCanvas()
  const view = render(<RedactPage />)
  const canvas = view.container.querySelector('canvas')!
  await waitFor(() => expect(canvas.width).toBe(32))
  fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
  for (const [field, value] of [
    ['Left', '4'],
    ['Top', '4'],
    ['Width', '24'],
    ['Height', '24'],
  ]) {
    fireEvent.change(screen.getByLabelText(field), {
      target: {
        value:
          edit.includes('draw') && (field === 'Width' || field === 'Height')
            ? '10'
            : value,
      },
    })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Download' }))
  await screen.findByRole('region', { name: 'Result' })

  if (edit === 'add')
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
  else if (edit === 'bounds')
    fireEvent.change(screen.getByLabelText('Left'), { target: { value: '6' } })
  else if (edit === 'undo')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  else if (edit === 'clear')
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))
  else if (edit === 'delete') fireEvent.keyDown(window, { key: 'Delete' })
  else if (edit === 'keyboard undo')
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  else {
    const start = edit.includes('draw') ? 20 : edit.includes('resize') ? 4 : 16
    const end = edit.includes('draw') ? 30 : edit.includes('resize') ? 2 : 20
    if (edit.includes('draw')) fireEvent.keyDown(window, { key: 'Escape' })
    if (edit.startsWith('touch')) {
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: start, clientY: start }],
      })
      fireEvent.touchMove(canvas, { touches: [{ clientX: end, clientY: end }] })
      fireEvent.touchEnd(canvas, { touches: [] })
    } else {
      fireEvent.mouseDown(canvas, { clientX: start, clientY: start })
      fireEvent.mouseMove(canvas, { clientX: end, clientY: end })
      fireEvent.mouseUp(canvas)
    }
  }
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Download again' })).toBeNull()
  expect(mockDownload).toHaveBeenCalledTimes(1)
})

test('does not download an outdated mask snapshot if edits change during canvas encoding', async () => {
  const toBlob = setupCanvas()
  const view = render(<RedactPage />)
  await waitFor(() =>
    expect(view.container.querySelector('canvas')!.width).toBe(32),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
  let finishEncoding!: BlobCallback
  toBlob.mockImplementationOnce((callback) => {
    finishEncoding = callback
  })
  fireEvent.click(screen.getByRole('button', { name: 'Download' }))
  fireEvent.change(screen.getByLabelText('Left'), { target: { value: '0' } })
  await act(async () => {
    finishEncoding(new Blob(['old masks'], { type: 'image/png' }))
    await Promise.resolve()
  })

  expect(mockDownload).not.toHaveBeenCalled()
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain(
    'Your redactions changed',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Download' }))
  await screen.findByRole('region', { name: 'Result' })
  expect(mockDownload).toHaveBeenCalledTimes(1)
})

test('does not publish old redactions after a pending metadata-removal export is edited', async () => {
  setupCanvas()
  const view = render(<RedactPage />)
  await waitFor(() =>
    expect(view.container.querySelector('canvas')!.width).toBe(32),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add area' }))
  fireEvent.click(screen.getByRole('button', { name: 'Download' }))
  await screen.findByRole('region', { name: 'Result' })
  let finishStripping!: (blob: Blob) => void
  mockStripMetadata.mockReturnValueOnce(
    new Promise((resolve) => {
      finishStripping = resolve
    }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  await waitFor(() => expect(mockStripMetadata).toHaveBeenCalledOnce())
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Download again' })
      .disabled,
  ).toBe(true)
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Start another file',
    }).disabled,
  ).toBe(true)
  fireEvent.change(screen.getByLabelText('Left'), { target: { value: '0' } })
  await act(async () => {
    finishStripping(new Blob(['old masks, no EXIF'], { type: 'image/png' }))
    await Promise.resolve()
  })

  expect(mockDownload).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain(
    'Your redactions changed',
  )
  mockStripMetadata.mockResolvedValueOnce(
    new Blob(['current masks, no EXIF'], { type: 'image/png' }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  await screen.findByRole('region', { name: 'Result' })
  expect(mockDownload).toHaveBeenCalledTimes(2)
})
