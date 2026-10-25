import type { ComponentType } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  useVideoTools,
  type VideoToolsContextType,
} from '@/contexts/VideoToolsContext'
import { downloadBlob } from '@/lib/shared'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { Route as CompressRoute } from '../routes/videos.compress'
import { Route as TrimRoute } from '../routes/videos.trim'
import { Route as ConvertRoute } from '../routes/videos.convert'
import { Route as ExtractRoute } from '../routes/videos.extract'
import { Route as MetadataRoute } from '../routes/videos.metadata'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}))
vi.mock('@/contexts/VideoToolsContext', () => ({ useVideoTools: vi.fn() }))
vi.mock('@/lib/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shared')>()),
  downloadBlob: vi.fn(),
}))
const VideoCompress = CompressRoute.options.component as ComponentType
const VideoTrim = TrimRoute.options.component as ComponentType
const VideoConvert = ConvertRoute.options.component as ComponentType
const VideoExtract = ExtractRoute.options.component as ComponentType
const VideoMetadata = MetadataRoute.options.component as ComponentType

function context(duration = 3) {
  const file = new File([new Uint8Array(100)], 'source.webm', {
    type: 'video/webm',
  })
  const selectedFile = {
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    preview: 'blob:source',
    duration,
    dimensions: { width: 640, height: 360 },
  }
  const processor = {
    inputFile: selectedFile,
    compressVideo: vi
      .fn()
      .mockResolvedValue(
        new Blob([new Uint8Array(200)], { type: 'video/mp4' }),
      ),
    trimVideo: vi
      .fn()
      .mockResolvedValue(new Blob(['clip'], { type: 'video/webm' })),
    convertVideo: vi
      .fn()
      .mockResolvedValue(new Blob(['converted'], { type: 'video/webm' })),
    extractAudio: vi
      .fn()
      .mockResolvedValue(new Blob(['audio'], { type: 'audio/mp3' })),
    stripMetadata: vi
      .fn()
      .mockResolvedValue(new Blob(['clean video'], { type: 'video/webm' })),
  }
  const value = {
    selectedFile,
    metadata: {},
    ffmpegProcessor: processor,
    isPreparing: false,
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
    clearSelectedFile: vi.fn(),
  } as unknown as VideoToolsContextType
  vi.mocked(useVideoTools).mockReturnValue(value)
  return { value, processor }
}

beforeEach(() => {
  resetWorkspaceState()
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
})

test('compression retains a downloadable MP4 result and honestly reports a larger output', async () => {
  const { processor } = context()
  const view = render(<VideoCompress />)
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Compress video' }),
  )
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce())
  const blob = (await processor.compressVideo.mock.results[0].value) as Blob
  expect(downloadBlob).toHaveBeenCalledWith(blob, 'source_compressed.mp4')
  expect(screen.getByRole('region', { name: 'Result' }).textContent).toContain(
    '100.0% larger',
  )
  expect(
    screen.getByText(/The output is larger than the original/),
  ).toBeTruthy()
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Download again' }),
  )
  expect(downloadBlob).toHaveBeenCalledTimes(2)
  expect(processor.compressVideo).toHaveBeenCalledOnce()
  view.unmount()
  render(<VideoCompress />)
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Download again' }),
  ).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Result' }).textContent).toContain(
    'source_compressed.mp4',
  )
})

test('quality goals and advanced values agree and survive navigation', () => {
  context()
  const view = render(<VideoCompress />)
  expect(
    screen.getByRole<HTMLInputElement>('radio', { name: /Balanced/ }).checked,
  ).toBe(true)
  fireEvent.click(screen.getByRole('radio', { name: /Smaller file/ }))
  fireEvent.click(screen.getByText('Advanced settings'))
  expect(screen.getByLabelText<HTMLInputElement>('Quality (CRF)').value).toBe(
    '32',
  )
  view.unmount()
  render(<VideoCompress />)
  expect(
    screen.getByRole<HTMLInputElement>('radio', { name: /Smaller file/ })
      .checked,
  ).toBe(true)
})

test('preparation does not claim compression has begun', () => {
  const { value } = context()
  vi.mocked(useVideoTools).mockReturnValue({ ...value, isPreparing: true })
  render(<VideoCompress />)
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Compress video' })
      .disabled,
  ).toBe(true)
  expect(screen.queryByLabelText('Compressing video')).toBeNull()
  expect(screen.queryByText('0.0%')).toBeNull()
})

test('errors show a recoverable message and do not download a file', async () => {
  const { processor } = context()
  processor.compressVideo.mockRejectedValueOnce(new Error('Encoder failed'))
  render(<VideoCompress />)
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Compress video' }),
  )
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Try another quality setting',
    ),
  )
  expect(downloadBlob).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Technical details'))
  expect(screen.getByText('Encoder failed')).toBeTruthy()
})

test('short clips start valid and every quick selection stays within their duration', () => {
  context(3.25)
  render(<VideoTrim />)
  expect(screen.getByLabelText<HTMLInputElement>('Start (seconds)').value).toBe(
    '0',
  )
  expect(screen.getByLabelText<HTMLInputElement>('End (seconds)').value).toBe(
    '3.25',
  )
  expect(screen.queryByRole('alert')).toBeNull()
  for (const name of [
    'First 30 s',
    'First minute',
    'Last 30 s',
    'Entire video',
  ]) {
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name }))
    expect(screen.getByLabelText<HTMLInputElement>('End (seconds)').value).toBe(
      '3.25',
    )
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Create clip' })
        .disabled,
    ).toBe(false)
  }
})

test('switching to a shorter video resets a stale trim range before validation', () => {
  context(120)
  const view = render(<VideoTrim />)
  fireEvent.change(screen.getByLabelText<HTMLInputElement>('Start (seconds)'), {
    target: { value: '90' },
  })
  context(0.5)
  view.rerender(<VideoTrim />)
  expect(screen.getByLabelText<HTMLInputElement>('Start (seconds)').value).toBe(
    '0',
  )
  expect(screen.getByLabelText<HTMLInputElement>('End (seconds)').value).toBe(
    '0.5',
  )
  expect(screen.queryByRole('alert')).toBeNull()
})

test('timeline controls set a precise range and its result can be downloaded again', async () => {
  const { processor } = context(3)
  render(<VideoTrim />)
  fireEvent.change(screen.getByLabelText('Clip start'), {
    target: { value: '0.25' },
  })
  fireEvent.change(screen.getByLabelText('Clip end'), {
    target: { value: '1.5' },
  })
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Create clip' }),
  )
  await waitFor(() =>
    expect(processor.trimVideo).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: '0.25', endTime: '1.5' }),
    ),
  )
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Download again' }),
    ).toBeTruthy(),
  )
  expect(screen.getByRole('region', { name: 'Result' }).textContent).toContain(
    '1.25 s clip',
  )
})

test('changing format selects compatible codecs and retains a conversion result', async () => {
  const { processor } = context()
  render(<VideoConvert />)
  fireEvent.change(screen.getByLabelText('Output format'), {
    target: { value: 'webm' },
  })
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Convert to WEBM' }),
  )
  await waitFor(() =>
    expect(processor.convertVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFormat: 'webm',
        videoCodec: 'libvpx',
        audioCodec: 'libopus',
      }),
    ),
  )
  await waitFor(() =>
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'source.webm'),
  )
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Download again' }),
  ).toBeTruthy()
})

test('audio extraction offers supported formats and a persistent result', async () => {
  const { processor } = context()
  render(<VideoExtract />)
  expect(screen.queryByRole('option', { name: /FLAC/ })).toBeNull()
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Extract audio' }),
  )
  await waitFor(() =>
    expect(processor.extractAudio).toHaveBeenCalledWith(
      expect.objectContaining({ audioFormat: 'mp3' }),
    ),
  )
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Download again' }),
    ).toBeTruthy(),
  )
})

test('video metadata removal leaves a result without changing the source', async () => {
  const { value, processor } = context()
  vi.mocked(useVideoTools).mockReturnValue({
    ...value,
    metadata: {
      [value.selectedFile!.name]: {
        format: {
          format_name: 'webm',
          duration: 3,
          size: 100,
          bit_rate: 1,
          nb_streams: 1,
        },
        video_streams: [],
        audio_streams: [],
        subtitle_streams: [],
      },
    },
  } as unknown as VideoToolsContextType)
  render(<VideoMetadata />)
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Remove metadata' }),
  )
  await waitFor(() => expect(processor.stripMetadata).toHaveBeenCalledOnce())
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Download again' }),
    ).toBeTruthy(),
  )
  expect(downloadBlob).toHaveBeenCalledWith(
    expect.any(Blob),
    'no-metadata_source.webm',
  )
})

test('replacing a same-name source clears output and restores sensible settings', async () => {
  context()
  const view = render(<VideoCompress />)
  fireEvent.click(screen.getByRole('radio', { name: /Smaller file/ }))
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Compress video' }),
  )
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Download again' }),
    ).toBeTruthy(),
  )
  context()
  view.rerender(<VideoCompress />)
  expect(screen.queryByRole('button', { name: 'Download again' })).toBeNull()
  expect(
    screen.getByRole<HTMLInputElement>('radio', { name: /Balanced/ }).checked,
  ).toBe(true)
})

test('leaving during encoding aborts ownership and suppresses late download or busy release', async () => {
  const { value, processor } = context()
  let finish!: (blob: Blob) => void
  let signal: AbortSignal | undefined
  processor.compressVideo.mockImplementationOnce(
    (options: { signal: AbortSignal }) => {
      signal = options.signal
      return new Promise<Blob>((resolve) => {
        finish = resolve
      })
    },
  )
  const view = render(<VideoCompress />)
  fireEvent.click(screen.getByRole('button', { name: 'Compress video' }))
  await waitFor(() => expect(processor.compressVideo).toHaveBeenCalledOnce())
  view.unmount()
  expect(signal?.aborted).toBe(true)
  const releasedBefore = vi
    .mocked(value.setIsProcessing)
    .mock.calls.filter(([busy]) => !busy).length
  value.setIsProcessing(true) // Another category now owns the global busy state.
  await act(async () => {
    finish(new Blob(['late result']))
    await Promise.resolve()
  })
  expect(downloadBlob).not.toHaveBeenCalled()
  expect(
    vi.mocked(value.setIsProcessing).mock.calls.filter(([busy]) => !busy),
  ).toHaveLength(releasedBefore)
  render(<VideoCompress />)
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
})

test('source replacement invalidates an outstanding encoding result', async () => {
  const { processor } = context()
  let finish!: (blob: Blob) => void
  processor.compressVideo.mockReturnValueOnce(
    new Promise<Blob>((resolve) => {
      finish = resolve
    }),
  )
  const view = render(<VideoCompress />)
  fireEvent.click(screen.getByRole('button', { name: 'Compress video' }))
  await waitFor(() => expect(processor.compressVideo).toHaveBeenCalledOnce())
  context()
  view.rerender(<VideoCompress />)
  await act(async () => {
    finish(new Blob(['obsolete']))
    await Promise.resolve()
  })
  expect(downloadBlob).not.toHaveBeenCalled()
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
})
