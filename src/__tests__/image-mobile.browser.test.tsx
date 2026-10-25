import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import type { ImageFile } from '@/lib/shared'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import '@/styles.css'

const { source, download, processing } = vi.hoisted(() => ({
  source: { selected: null as ImageFile | null },
  download: vi.fn(),
  processing: vi.fn(),
}))
vi.mock('@/contexts/ImageToolsContext', () => ({
  useImageTools: () => ({
    selectedFile: source.selected,
    metadata: {
      'private.png': {
        width: 350,
        height: 208,
        size: 100,
        format: 'PNG',
        colorspace: 'sRGB',
        depth: 8,
        compression: 'Zip',
      },
    },
    exifMetadata: {
      'A very long EXIF field name without a short abbreviation':
        'A long metadata value '.repeat(12),
    },
    isExtractingExif: false,
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
vi.mock('@/lib/metadata', () => ({
  stripFileMetadata: () =>
    Promise.resolve(new Blob(['clean'], { type: 'image/png' })),
}))
vi.mock('emoji-picker-react', () => ({ default: () => null }))

import { Route as RedactRoute } from '@/routes/images.redact'
import { Route as MetadataRoute } from '@/routes/images.metadata'

beforeEach(() => {
  resetWorkspaceState()
  vi.clearAllMocks()
  const canvas = document.createElement('canvas')
  canvas.width = 350
  canvas.height = 208
  canvas.getContext('2d')!.fillStyle = '#ffffff'
  canvas.getContext('2d')!.fillRect(0, 0, 350, 208)
  const file = new File(['image'], 'private.png', { type: 'image/png' })
  source.selected = {
    file,
    name: file.name,
    size: 100,
    type: file.type,
    preview: canvas.toDataURL(),
    dimensions: { width: 350, height: 208 },
  }
})
afterEach(() => {
  cleanup()
  resetWorkspaceState()
})

test.each([375, 390])(
  'populated redaction controls and export actions fit a %s px phone',
  async (width) => {
    await page.viewport(width, 844)
    const Redact = RedactRoute.options.component!
    const view = render(
      <div className="min-w-0 p-4">
        <Redact />
      </div>,
    )
    const canvas = view.container.querySelector('canvas')!
    await waitFor(() => expect(canvas.width).toBe(350))
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }))
    screen.getByRole('button', { name: 'Pixelate' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(
      screen
        .getByRole('button', { name: 'Pixelate' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Choose redaction emoji' }),
    )
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
    for (const button of screen.getAllByRole('button')) {
      const bounds = button.getBoundingClientRect()
      expect(bounds.left, button.textContent ?? '').toBeGreaterThanOrEqual(0)
      expect(bounds.right, button.textContent ?? '').toBeLessThanOrEqual(width)
      expect(bounds.height, button.textContent ?? '').toBeGreaterThanOrEqual(44)
    }
    expect(
      screen.getByRole('button', { name: 'Download Without Metadata' }),
    ).toBeTruthy()
  },
)

test.each([375, 1440])(
  'editing masks invalidates the old export and includes new redactions at %s px',
  async (width) => {
    await page.viewport(width, 844)
    const Redact = RedactRoute.options.component!
    const view = render(
      <div className="min-w-0 p-4">
        <Redact />
      </div>,
    )
    await waitFor(() =>
      expect(view.container.querySelector('canvas')!.width).toBe(350),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }))
    for (const [field, value] of [
      ['Left', '10'],
      ['Top', '10'],
      ['Width', '30'],
      ['Height', '30'],
    ]) {
      await userEvent.fill(screen.getByLabelText(field), value)
    }
    await userEvent.click(screen.getByRole('button', { name: 'Download' }))
    await screen.findByRole('region', { name: 'Result' })
    const originalOutput = download.mock.calls[0][0] as Blob

    await userEvent.click(screen.getByRole('button', { name: 'Add area' }))
    for (const [field, value] of [
      ['Left', '100'],
      ['Top', '10'],
      ['Width', '30'],
      ['Height', '30'],
    ]) {
      await userEvent.fill(screen.getByLabelText(field), value)
    }
    expect(screen.queryByRole('button', { name: 'Download again' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Download' }))
    await screen.findByRole('region', { name: 'Result' })
    const currentOutput = download.mock.calls[1][0] as Blob
    const canvas = document.createElement('canvas')
    canvas.width = 350
    canvas.height = 208
    const ctx = canvas.getContext('2d')!
    for (const [blob, expectedPixel] of [
      [originalOutput, 255],
      [currentOutput, 0],
    ] as const) {
      const image = await createImageBitmap(blob)
      ctx.clearRect(0, 0, 350, 208)
      ctx.drawImage(image, 0, 0)
      image.close()
      expect([...ctx.getImageData(115, 25, 1, 1).data]).toEqual([
        expectedPixel,
        expectedPixel,
        expectedPixel,
        255,
      ])
      expect([...ctx.getImageData(25, 25, 1, 1).data]).toEqual([0, 0, 0, 255])
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
  },
)

test.each([375, 390])(
  'populated metadata and retained output fit a %s px phone',
  async (width) => {
    await page.viewport(width, 844)
    const Metadata = MetadataRoute.options.component!
    render(
      <div className="min-w-0 p-4">
        <Metadata />
      </div>,
    )
    const action = screen.getByRole('button', {
      name: 'Download Without Metadata',
    })
    await userEvent.click(action)
    await screen.findByRole('region', { name: 'Result' })
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
    for (const button of screen.getAllByRole('button')) {
      const bounds = button.getBoundingClientRect()
      expect(bounds.left, button.textContent ?? '').toBeGreaterThanOrEqual(0)
      expect(bounds.right, button.textContent ?? '').toBeLessThanOrEqual(width)
      expect(bounds.height, button.textContent ?? '').toBeGreaterThanOrEqual(44)
    }
    await userEvent.click(
      screen.getByRole('button', { name: 'Download again' }),
    )
    expect(download).toHaveBeenCalledTimes(2)
  },
)
