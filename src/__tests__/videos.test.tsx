import { type ComponentType, type ReactNode } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useVideoTools } from '@/contexts/VideoToolsContext'
import type { VideoMetadata } from '@/lib/ffmpeg'

const mocks = vi.hoisted(() => ({
  mount: vi.fn().mockResolvedValue(undefined),
  unmount: vi.fn().mockResolvedValue(undefined),
  metadata: vi.fn<() => Promise<VideoMetadata>>(),
  navigate: vi.fn(),
  init: vi.fn(),
  progress: vi.fn(),
  revokePreview: vi.fn(),
}))

function VideoState() {
  return (
    <div data-testid="metadata">{JSON.stringify(useVideoTools().metadata)}</div>
  )
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: '/videos/metadata' }),
  Outlet: () => <VideoState />,
}))
vi.mock('@/hooks/useInitFFmpeg', () => ({
  useInitFFmpeg: () => ({
    ffmpeg: {},
    isInitialized: true,
    error: null,
    init: mocks.init,
    setProgressCallback: mocks.progress,
  }),
}))
vi.mock('@/lib/ffmpeg', () => ({
  FFmpegProcessor: class {
    mountInputFile = mocks.mount
    unmountInputFile = mocks.unmount
    extractMetadata = mocks.metadata
  },
}))
vi.mock('@/contexts/ProcessingContext', async () => {
  const { useState } = await import('react')
  return {
    useProcessing: () => {
      const [isProcessing, setIsProcessing] = useState(false)
      return { isProcessing, setIsProcessing }
    },
  }
})
vi.mock('@/components/ToolLayout', () => ({
  ToolLayout: ({
    fileUploadComponent,
    toolsComponent,
  }: {
    fileUploadComponent: ReactNode
    toolsComponent: ReactNode
  }) => (
    <>
      {fileUploadComponent}
      {toolsComponent}
    </>
  ),
}))
vi.mock('@/components/ui/responsive-tabs', () => ({
  ResponsiveTabs: () => null,
}))
vi.mock('@/components/FileUpload', () => ({
  FileUpload: ({
    selectedFiles,
    onFileSelect,
    onClearFiles,
  }: {
    selectedFiles: unknown[]
    onFileSelect: (files: FileList) => void
    onClearFiles: () => void
  }) => (
    <>
      <input
        aria-label="video upload"
        type="file"
        onChange={(event) => {
          if (event.target.files) onFileSelect(event.target.files)
        }}
      />
      <button onClick={onClearFiles}>Clear</button>
      <div data-testid="selection">{JSON.stringify(selectedFiles)}</div>
    </>
  ),
}))
import { Route } from '../routes/videos'
const VideoLayout = Route.options.component as ComponentType

function metadata(filename: string): VideoMetadata {
  return {
    format: {
      filename,
      format_name: 'avi',
      format_long_name: 'AVI',
      duration: 5,
      size: 100,
      bit_rate: 160,
      nb_streams: 1,
    },
    video_streams: [],
    audio_streams: [],
    subtitle_streams: [],
    duration: 5,
    width: 1920,
    height: 1080,
    bitrate: '160',
    fps: '30',
    codec: 'mpeg4',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.metadata.mockReset().mockResolvedValue(metadata('clip.AVI'))
  let nextPreview = 0
  const NativeURL = URL
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL = vi.fn(() => `blob:video-${++nextPreview}`)
      static revokeObjectURL = mocks.revokePreview
    },
  )
})
afterEach(async () => {
  cleanup()
  await Promise.resolve()
  vi.unstubAllGlobals()
})

test('loads AVI metadata through FFmpeg without waiting for native video events', async () => {
  render(<VideoLayout />)
  const file = new File(['AVI bytes'], 'clip.AVI', { type: '' })
  fireEvent.change(screen.getByLabelText('video upload'), {
    target: { files: [file] },
  })
  await waitFor(() => expect(mocks.metadata).toHaveBeenCalledOnce())
  expect(mocks.mount).toHaveBeenCalledWith(expect.objectContaining({ file }))
  await waitFor(() =>
    expect(screen.getByTestId('selection').textContent).toContain('1920'),
  )
  expect(screen.getByTestId('selection').textContent).toContain('"duration":5')
  fireEvent.click(screen.getByText('Clear'))
  await waitFor(() => expect(mocks.unmount).toHaveBeenCalledOnce())
  expect(mocks.revokePreview).toHaveBeenCalledWith('blob:video-1')
})

test('serializes replacement metadata and ignores an obsolete selection result', async () => {
  let finishFirst!: (value: VideoMetadata) => void
  mocks.metadata
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finishFirst = resolve
      }),
    )
    .mockResolvedValueOnce(metadata('second.avi'))
  render(<VideoLayout />)
  fireEvent.change(screen.getByLabelText('video upload'), {
    target: { files: [new File(['A'], 'first.avi')] },
  })
  await waitFor(() => expect(mocks.metadata).toHaveBeenCalledOnce())
  fireEvent.change(screen.getByLabelText('video upload'), {
    target: { files: [new File(['B'], 'second.avi')] },
  })
  expect(mocks.mount).toHaveBeenCalledOnce()
  await act(async () => {
    finishFirst(metadata('first.avi'))
    await Promise.resolve()
  })
  await waitFor(() => expect(mocks.metadata).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(screen.getByTestId('metadata').textContent).toContain('second.avi'),
  )
  expect(screen.getByTestId('metadata').textContent).not.toContain('first.avi')
  expect(screen.getByTestId('selection').textContent).toContain('second.avi')
})

test('an empty file selection leaves the layout unchanged', () => {
  render(<VideoLayout />)
  fireEvent.change(screen.getByLabelText('video upload'), {
    target: { files: [] },
  })
  expect(mocks.mount).not.toHaveBeenCalled()
})
