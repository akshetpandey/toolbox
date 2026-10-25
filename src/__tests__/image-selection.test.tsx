import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { useImageTools } from '@/contexts/ImageToolsContext'

const { revoke } = vi.hoisted(() => ({ revoke: vi.fn() }))
vi.mock('@/hooks/useInitImageMagick', () => ({
  useInitImageMagick: () => ({
    isInitialized: true,
    isInitializing: false,
    error: null,
    init: vi.fn(),
  }),
}))
vi.mock('@/contexts/ProcessingContext', () => ({
  useProcessing: () => ({ isProcessing: false }),
}))
vi.mock('@/lib/imagemagick', () => ({
  ImageMagickProcessor: class {
    extractMetadata() {
      return Promise.resolve({
        width: 350,
        height: 208,
        format: 'PNG',
        size: 5,
      })
    }
  },
  formatFileSize: (size: number) => `${size} bytes`,
}))
vi.mock('@/lib/metadata', () => ({
  extractExifMetadata: () => Promise.resolve({ Camera: 'Retained camera' }),
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useLocation: () => ({ pathname: '/images/resize' }),
  useNavigate: () => vi.fn(),
  Outlet: () => <SelectedImage />,
}))

import { Route } from '@/routes/images'
const Images = Route.options.component!

function SelectedImage() {
  const { selectedFile, exifMetadata } = useImageTools()
  return (
    <output aria-label="Restored image">
      {selectedFile
        ? `${selectedFile.name}: ${selectedFile.dimensions?.width} × ${selectedFile.dimensions?.height} · ${String(exifMetadata.Camera ?? '')}`
        : 'No image'}
    </output>
  )
}

beforeEach(() => {
  resetWorkspaceState()
  vi.clearAllMocks()
  const NativeURL = URL
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL = () => 'blob:retained-preview'
      static revokeObjectURL = revoke
    },
  )
  vi.stubGlobal(
    'Image',
    class {
      width = 350
      height = 208
      onload: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('selected image and metadata survive Home/Back without revoking the retained preview', async () => {
  const view = render(<Images />)
  fireEvent.change(screen.getByLabelText('Upload file'), {
    target: {
      files: [new File(['image'], 'retained.png', { type: 'image/png' })],
    },
  })
  await waitFor(() =>
    expect(screen.getByLabelText('Restored image').textContent).toContain(
      'Retained camera',
    ),
  )
  view.unmount()
  render(<Images />)
  expect(screen.getByLabelText('Restored image').textContent).toBe(
    'retained.png: 350 × 208 · Retained camera',
  )
  expect(screen.getByAltText<HTMLImageElement>('retained.png').src).toBe(
    'blob:retained-preview',
  )
  expect(revoke).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByLabelText('Restored image').textContent).toBe('No image')
  expect(revoke).toHaveBeenCalledWith('blob:retained-preview')
})
