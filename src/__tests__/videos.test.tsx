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
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
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
  const context = useVideoTools()
  return (
    <>
      <div data-testid="metadata">{JSON.stringify(context.metadata)}</div>
      <div data-testid="stage">
        {context.isPreparing
          ? 'preparing'
          : context.isProcessing
            ? 'processing'
            : 'ready'}
      </div>
      <button onClick={() => void context.getFfmpegProcessor()}>
        Get processor
      </button>
    </>
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
  resetWorkspaceState()
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

test('importing is preparation, never an encoding operation', async () => {
  let finish!: (value: VideoMetadata) => void
  mocks.metadata.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  render(<VideoLayout />)
  fireEvent.change(screen.getByLabelText('video upload'), {
    target: { files: [new File(['video'], 'clip.avi')] },
  })
  await waitFor(() => expect(mocks.metadata).toHaveBeenCalledOnce())
  expect(screen.getByTestId('stage').textContent).toBe('preparing')
  expect(screen.getByRole('status').textContent).toContain(
    'Reading video information',
  )
  expect(screen.queryByText(/Compressing/)).toBeNull()
  await act(async () => {
    finish(metadata('clip.avi'))
    await Promise.resolve()
  })
  await waitFor(() =>
    expect(screen.getByTestId('stage').textContent).toBe('ready'),
  )
})

test('ordinary navigation retains the video, metadata and preview for reuse', async () => {
  const view = render(<VideoLayout />)
  fireEvent.change(screen.getByLabelText('video upload'), {
    target: { files: [new File(['video'], 'clip.avi')] },
  })
  await waitFor(() =>
    expect(screen.getByTestId('selection').textContent).toContain('1920'),
  )
  view.unmount()
  await act(async () => {
    await Promise.resolve()
  })
  expect(mocks.revokePreview).not.toHaveBeenCalled()
  render(<VideoLayout />)
  expect(screen.getByTestId('selection').textContent).toContain('clip.avi')
  expect(screen.getByTestId('metadata').textContent).toContain('1920')
  fireEvent.click(screen.getByText('Get processor'))
  await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByText('Clear'))
  expect(mocks.revokePreview).toHaveBeenCalledWith('blob:video-1')
})

test('returning to a video resumes interrupted preparation without replacing its preview', async () => {
  let finishOld!: (value: VideoMetadata) => void
  mocks.metadata
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finishOld = resolve
      }),
    )
    .mockResolvedValueOnce(metadata('clip.avi'))
  const view = render(<VideoLayout />)
  fireEvent.change(screen.getByLabelText('video upload'), {
    target: { files: [new File(['video'], 'clip.avi')] },
  })
  await waitFor(() => expect(mocks.metadata).toHaveBeenCalledOnce())
  view.unmount()
  render(<VideoLayout />)
  await waitFor(() => expect(mocks.metadata).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(screen.getByTestId('selection').textContent).toContain('1920'),
  )
  expect(mocks.revokePreview).not.toHaveBeenCalled()
  await act(async () => {
    finishOld(metadata('obsolete'))
    await Promise.resolve()
  })
  expect(screen.getByTestId('metadata').textContent).toContain('clip.avi')
  expect(screen.getByTestId('metadata').textContent).not.toContain('obsolete')
})
