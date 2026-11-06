import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MediaTool } from '@/components/MediaTool'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { convertAudio, joinVideos } from '@/lib/media'
import { downloadBlob } from '@/lib/shared'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
}))
vi.mock('@/lib/media', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media')>()),
  convertAudio: vi.fn(),
  joinVideos: vi.fn(),
}))
vi.mock('@/lib/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shared')>()),
  downloadBlob: vi.fn(),
}))

beforeEach(() => {
  resetWorkspaceState()
  vi.resetAllMocks()
})
afterEach(cleanup)

test('video join uses the accessible file order and keeps the downloadable result', async () => {
  const first = new File(['first'], 'first.webm', { type: 'video/webm' })
  const second = new File(['second'], 'second.mp4', { type: 'video/mp4' })
  const output = new Blob(['output'], { type: 'video/mp4' })
  vi.mocked(joinVideos).mockResolvedValue(output)
  render(<MediaTool mode="video-join" />, { wrapper: ProcessingProvider })
  fireEvent.change(screen.getByLabelText('Upload files'), {
    target: { files: [first, second] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Move file 2 up' }))
  fireEvent.click(screen.getByRole('button', { name: 'Join videos' }))
  await waitFor(() =>
    expect(joinVideos).toHaveBeenCalledWith(
      [second, first],
      expect.any(AbortSignal),
    ),
  )
  await waitFor(() =>
    expect(downloadBlob).toHaveBeenCalledWith(output, 'joined-video.mp4'),
  )
  expect(screen.getByRole('button', { name: 'Download again' })).toBeTruthy()
})

test('audio cancellation keeps the selected file and never downloads the cancelled result', async () => {
  const source = new File(['audio'], 'voice.m4a', { type: 'audio/mp4' })
  vi.mocked(convertAudio).mockImplementationOnce(
    (_, _format, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        )
      }),
  )
  render(<MediaTool mode="audio-convert" />, { wrapper: ProcessingProvider })
  fireEvent.change(screen.getByLabelText('Upload file'), {
    target: { files: [source] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Convert audio' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel processing' }))
  await waitFor(() =>
    expect(screen.getByText(/Processing cancelled/)).toBeTruthy(),
  )
  expect(downloadBlob).not.toHaveBeenCalled()
  expect(screen.getByText('voice.m4a')).toBeTruthy()
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Convert audio' })
      .disabled,
  ).toBe(false)
})
