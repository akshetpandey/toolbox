import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { canvasBlob } from '@/lib/pdf-edit'
import '@/styles.css'

const { recognize } = vi.hoisted(() => ({ recognize: vi.fn() }))
vi.mock('@/lib/ocr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ocr')>()),
  recognizeImageText: recognize,
}))

afterEach(() => {
  cleanup()
  resetWorkspaceState()
  vi.restoreAllMocks()
  recognize.mockReset()
})

async function workspace(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMinMs: 0,
  })
  await router.load()
  render(
    <ThemeProvider>
      <ProcessingProvider>
        <RouterProvider router={router} />
      </ProcessingProvider>
    </ThemeProvider>,
  )
  return router
}

async function imageFile(name: string) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 40
  const context = canvas.getContext('2d')!
  context.fillStyle = '#fff'
  context.fillRect(0, 0, 40, 40)
  return new File([await canvasBlob(canvas, 'image/png')], name, {
    type: 'image/png',
  })
}

test('QR settings and output survive navigation; changing the content invalidates output and reset clears Wi-Fi credentials', async () => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    () => undefined,
  )
  const router = await workspace('/utilities/qr')
  expect(screen.queryByLabelText('Upload file')).toBeNull()
  fireEvent.change(await screen.findByLabelText('Website address'), {
    target: { value: 'https://example.com' },
  })
  await userEvent.click(
    screen.getByRole('button', { name: 'Generate and download QR code' }),
  )
  await screen.findByText('qr-code.png', {}, { timeout: 10_000 })
  await act(() => router.navigate({ to: '/utilities/hash' }))
  await act(() => router.navigate({ to: '/utilities/qr' }))
  expect(
    screen.getByLabelText<HTMLTextAreaElement>('Website address').value,
  ).toBe('https://example.com')
  expect(screen.getByRole('button', { name: 'Download again' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Code type'), {
    target: { value: 'wifi' },
  })
  expect(screen.queryByRole('button', { name: 'Download again' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Network name (SSID)'), {
    target: { value: 'Private network' },
  })
  fireEvent.change(screen.getByLabelText('Network password'), {
    target: { value: 'private-secret' },
  })
  await userEvent.click(
    screen.getByRole('button', { name: 'Generate and download QR code' }),
  )
  await screen.findByText('qr-code.png', {}, { timeout: 10_000 })
  await userEvent.click(
    screen.getByRole('button', { name: 'Start another file' }),
  )
  fireEvent.change(screen.getByLabelText('Code type'), {
    target: { value: 'wifi' },
  })
  expect(
    screen.getByLabelText<HTMLInputElement>('Network password').value,
  ).toBe('')
  expect(
    screen.getByLabelText<HTMLInputElement>('Network name (SSID)').value,
  ).toBe('')
  expect(screen.queryByRole('button', { name: 'Download again' })).toBeNull()
})

test('leaving image OCR cancels the operation and a late completion cannot populate a replacement image', async () => {
  let resolve: (text: string) => void = () => undefined
  const pending = new Promise<string>((complete) => {
    resolve = complete
  })
  recognize.mockReturnValue(pending)
  const router = await workspace('/images/ocr')
  fireEvent.change(await screen.findByLabelText('Upload file'), {
    target: { files: [await imageFile('first.png')] },
  })
  await screen.findByRole('img', { name: 'Image to recognize' })
  await userEvent.click(screen.getByRole('button', { name: 'Recognize text' }))
  await waitFor(() => expect(recognize).toHaveBeenCalledTimes(1))
  const signal = recognize.mock.calls[0][1] as AbortSignal
  await act(() => router.navigate({ to: '/images/resize' }))
  expect(signal.aborted).toBe(true)
  fireEvent.change(screen.getByLabelText('Upload file'), {
    target: { files: [await imageFile('replacement.png')] },
  })
  await screen.findByText('replacement.png')
  act(() => {
    resolve('Text from the old image')
  })
  await act(() => router.navigate({ to: '/images/ocr' }))
  expect(screen.queryByLabelText('Recognized text')).toBeNull()
  expect(screen.queryByText('Text from the old image')).toBeNull()
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Recognize text',
    }).disabled,
  ).toBe(false)
})
