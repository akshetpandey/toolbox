import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import '@/styles.css'

async function openApp(path = '/') {
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
  await waitFor(() => expect(screen.getByRole('main')).toBeTruthy())
  return router
}
afterEach(() => {
  cleanup()
  resetWorkspaceState()
})

// Exercise the actual route tree, production CSS, and shared controls at every
// breakpoint from the design review instead of mirroring Tailwind class names.
test.each([
  [375, 667],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 1000],
])('workspace and navigation stay usable at %s × %s', async (width, height) => {
  await page.viewport(width, height)
  const router = await openApp()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
    'Private file tools',
  )
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
  const search = screen.getByRole('searchbox')
  fireEvent.change(search, { target: { value: 'shrink photo' } })
  expect(screen.getByRole('status').textContent).toContain('1 tool found')
  expect(
    screen
      .getByRole('region', { name: 'Search results' })
      .querySelectorAll('a'),
  ).toHaveLength(1)
  const routes = [
    ['/images/resize', 'Resize image'],
    ['/videos/trim', 'Trim video'],
    ['/pdfs/merge', 'Merge PDFs'],
    ['/office-documents/convert', 'Convert document to PDF'],
    ['/archives/extract', 'Extract archive'],
    ['/utilities/hash', 'File hashes'],
  ]
  for (const [to, title] of routes) {
    await act(() => router.navigate({ to }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title),
    )
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
    for (const button of screen.getAllByRole('button')) {
      const rect = button.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      expect(
        rect.left,
        `${title}: ${button.textContent} left`,
      ).toBeGreaterThanOrEqual(0)
      expect(
        rect.right,
        `${title}: ${button.textContent} right`,
      ).toBeLessThanOrEqual(width)
      expect(
        rect.height,
        `${title}: ${button.textContent} touch height`,
      ).toBeGreaterThanOrEqual(44)
    }
    expect(document.querySelectorAll('a button')).toHaveLength(0)
  }
  if (width < 1280) {
    const tools = screen.getByRole('button', { name: 'Tools' })
    await userEvent.click(tools)
    const dialog = screen.getByRole('dialog', { name: 'Choose a tool' })
    expect(dialog.getBoundingClientRect().right).toBeLessThanOrEqual(width)
    expect(tools.getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(tools)
    await userEvent.click(tools)
    await userEvent.click(screen.getByRole('link', { name: 'Images' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'Resize image',
      ),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  }
})

test('a populated phone workspace stays compact and survives Home and Back', async () => {
  await page.viewport(375, 812)
  const router = await openApp('/images/resize')
  const response = await fetch(
    new URL('../lib/__tests__/fixtures/sample-real.png', import.meta.url),
  )
  const file = new File([await response.arrayBuffer()], 'photo.png', {
    type: 'image/png',
  })
  fireEvent.change(screen.getByLabelText('Upload file'), {
    target: { files: [file] },
  })
  await waitFor(
    () =>
      expect(screen.getByLabelText<HTMLInputElement>('Width (px)').value).toBe(
        '350',
      ),
    { timeout: 10000 },
  )
  expect(screen.getByLabelText<HTMLInputElement>('Height (px)').value).toBe(
    '208',
  )
  const thumbnail = screen
    .getByRole('img', { name: 'photo.png' })
    .getBoundingClientRect()
  expect(thumbnail.width).toBe(64)
  expect(thumbnail.height).toBe(64)
  expect(
    screen
      .getByRole('region', { name: 'Selected files' })
      .getBoundingClientRect().height,
  ).toBeLessThan(190)
  fireEvent.change(screen.getByLabelText('Width (px)'), {
    target: { value: '700' },
  })
  await act(() => router.navigate({ to: '/' }))
  act(() => router.history.back())
  await waitFor(() =>
    expect(screen.getByLabelText<HTMLInputElement>('Width (px)').value).toBe(
      '700',
    ),
  )
  expect(screen.getByLabelText<HTMLInputElement>('Height (px)').value).toBe(
    '416',
  )
  expect(screen.getByRole('img', { name: 'photo.png' })).toBeTruthy()
  expect(document.documentElement.scrollWidth).toBe(375)
})
