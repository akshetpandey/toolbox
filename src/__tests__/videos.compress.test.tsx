import type { ComponentType } from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  useVideoTools,
  type VideoToolsContextType,
} from '@/contexts/VideoToolsContext'
import { downloadFile } from '@/lib/shared'
import { Route } from '../routes/videos.compress'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}))
vi.mock('@/contexts/VideoToolsContext', () => ({ useVideoTools: vi.fn() }))
vi.mock('@/lib/shared', () => ({ downloadFile: vi.fn() }))
const VideoCompress = Route.options.component as ComponentType

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('downloads compressed WebM input with an MP4 filename', async () => {
  const compressed = new Blob(['MP4 output'], { type: 'video/mp4' })
  const file = new File(['WebM input'], 'source.webm', { type: 'video/webm' })
  const inputFile = {
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    preview: '',
  }
  const compressVideo = vi.fn().mockResolvedValue(compressed)
  const processor = { inputFile, compressVideo }
  vi.mocked(useVideoTools).mockReturnValue({
    selectedFile: inputFile,
    isProcessing: false,
    progress: 0,
    estimatedTimeRemaining: null,
    elapsedTime: null,
    showSlowProcessingWarning: false,
    setIsProcessing: vi.fn(),
    setProgress: vi.fn(),
    setProgressStartTime: vi.fn(),
    setEstimatedTimeRemaining: vi.fn(),
    setElapsedTime: vi.fn(),
    setShowSlowProcessingWarning: vi.fn(),
    setCurrentAbortController: vi.fn(),
    getFfmpegProcessor: vi.fn().mockResolvedValue(processor),
    cancelProcessing: vi.fn(),
  } as unknown as VideoToolsContextType)
  const createObjectURL = vi.fn().mockReturnValue('blob:compressed-mp4')
  const NativeURL = URL
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL = createObjectURL
    },
  )
  render(<VideoCompress />)
  expect(
    screen.getByText('Downloads as MP4 with H.264 video and AAC audio.'),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Compress Video' }))
  await waitFor(() =>
    expect(downloadFile).toHaveBeenCalledWith(
      'blob:compressed-mp4',
      'source_compressed.mp4',
    ),
  )
  expect(createObjectURL).toHaveBeenCalledWith(compressed)
})
