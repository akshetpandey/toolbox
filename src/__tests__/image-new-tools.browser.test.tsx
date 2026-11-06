import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { routeTree } from '@/routeTree.gen'
import '@/styles.css'

async function openTool(path: string) {
  await page.viewport(390, 844)
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
}

afterEach(() => {
  cleanup()
  resetWorkspaceState()
})

test('the browser converts HEIC input with an empty MIME type and displays its preview', async () => {
  await openTool('/images/convert')
  const response = await fetch(
    new URL('../lib/__tests__/fixtures/sample.heic', import.meta.url),
  )
  expect(response.ok).toBe(true)
  const file = new File([await response.arrayBuffer()], 'phone.heic')
  fireEvent.change(screen.getByLabelText('Upload file'), {
    target: { files: [file] },
  })
  const preview = await screen.findByAltText<HTMLImageElement>(
    'phone.heic',
    {},
    { timeout: 15_000 },
  )
  await waitFor(() => expect(preview.naturalWidth).toBe(8))
  expect(
    screen.getByRole<HTMLInputElement>('radio', { name: 'JPG (Compressed)' })
      .checked,
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Convert & download' }))
  expect(await screen.findByText('phone.jpg')).toBeTruthy()
})

test('the batch tool reports individual failures and still exports successful images together', async () => {
  await openTool('/images/batch')
  const response = await fetch(
    new URL('../lib/__tests__/fixtures/sample.png', import.meta.url),
  )
  expect(response.ok).toBe(true)
  const bytes = await response.arrayBuffer()
  fireEvent.change(screen.getByLabelText('Upload files'), {
    target: {
      files: [
        new File([bytes], 'first.png', { type: 'image/png' }),
        new File([bytes], 'second.png', { type: 'image/png' }),
        new File(['broken'], 'broken.png', { type: 'image/png' }),
      ],
    },
  })
  expect(screen.getByText('3 selected files')).toBeTruthy()
  fireEvent.click(
    screen.getByRole('button', { name: 'Process images & download ZIP' }),
  )
  expect(
    await screen.findByText('converted-images.zip', {}, { timeout: 15_000 }),
  ).toBeTruthy()
  expect(screen.getByText('2 of 3 images processed')).toBeTruthy()
  expect(screen.getByText('1 image could not be processed')).toBeTruthy()
})

test('automatic background removal produces a transparent PNG with the bundled model', async () => {
  await openTool('/images/background')
  const response = await fetch(
    new URL('../lib/__tests__/fixtures/sample-real.png', import.meta.url),
  )
  expect(response.ok).toBe(true)
  const file = new File([await response.arrayBuffer()], 'photo.png', {
    type: 'image/png',
  })
  fireEvent.change(screen.getByLabelText('Upload file'), {
    target: { files: [file] },
  })
  await screen.findByAltText('photo.png', {}, { timeout: 15_000 })
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove background & download PNG' }),
  )
  const outcome = await screen.findByText(
    /^(photo-transparent\.png|The background could not be removed\.)/,
    {},
    { timeout: 30_000 },
  )
  expect(outcome.textContent).toBe('photo-transparent.png')
  const output = await screen.findByAltText<HTMLImageElement>(
    'Image with the background removed',
  )
  await output.decode()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')!
  context.drawImage(output, 0, 0, 64, 64)
  const pixels = context.getImageData(0, 0, 64, 64).data
  expect(pixels.some((value, index) => index % 4 === 3 && value < 64)).toBe(
    true,
  )
  expect(pixels.some((value, index) => index % 4 === 3 && value > 192)).toBe(
    true,
  )
})
