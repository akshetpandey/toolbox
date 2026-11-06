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

test('client navigation replaces the canonical URL and indexing directives', async () => {
  const router = await openApp()
  const canonical = () =>
    document.head.querySelectorAll('link[rel="canonical"]')
  const robots = () => document.head.querySelector('meta[name="robots"]')
  expect(canonical()).toHaveLength(1)
  expect(canonical()[0].getAttribute('href')).toBe('https://toolbox.computer/')

  await act(() => router.navigate({ to: '/pdfs/split' }))
  expect(document.title).toBe('Split PDFs (Coming Soon) | Toolbox')
  expect(canonical()).toHaveLength(0)
  expect(robots()?.getAttribute('content')).toBe('noindex')

  await act(() => router.navigate({ to: '/pdfs/merge' }))
  expect(document.title).toBe('Merge PDFs into One File | Toolbox')
  expect(canonical()).toHaveLength(1)
  expect(canonical()[0].getAttribute('href')).toBe(
    'https://toolbox.computer/pdfs/merge',
  )
  expect(robots()).toBeNull()
})

// Exercise the actual route tree, production CSS, and shared controls at every
// breakpoint from the design review instead of mirroring Tailwind class names.
test.each([
  [375, 667],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 900],
  [1440, 1000],
  [1920, 1080],
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
      .querySelectorAll('a.tool-card'),
  ).toHaveLength(1)
  for (const [query, destination] of [
    ['JPG to PNG', '/images/convert'],
    ['SHA-256', '/utilities/hash'],
    ['compres imgae', '/images/compress'],
  ]) {
    fireEvent.change(search, { target: { value: query } })
    const results = screen
      .getByRole('region', { name: 'Search results' })
      .querySelectorAll('a.tool-card')
    expect(results).toHaveLength(1)
    expect(results[0].getAttribute('href')).toBe(destination)
    const request = screen.getByRole('link', { name: 'Request a tool' })
    const issue = new URL(request.getAttribute('href')!)
    expect(issue.origin + issue.pathname).toBe(
      'https://github.com/akshetpandey/toolbox/issues/new',
    )
    expect(issue.searchParams.get('title')).toBe(`Tool request: ${query}`)
    expect(request.getAttribute('target')).toBe('_blank')
    expect(request.getAttribute('rel')).toContain('noopener')
    expect(request.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
  }
  fireEvent.change(search, { target: { value: 'OCR PDF' } })
  expect(screen.getByRole('status').textContent).toContain('0 tools found')
  expect(screen.getByRole('heading', { name: 'No tools found' })).toBeTruthy()
  expect(
    new URL(
      screen
        .getByRole('link', { name: 'Request a tool' })
        .getAttribute('href')!,
    ).searchParams.get('body'),
  ).toContain('OCR PDF')
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(document.activeElement).toBe(search)
  expect((search as HTMLInputElement).value).toBe('')
  expect(screen.queryByRole('link', { name: 'Request a tool' })).toBeNull()
  expect(
    screen.getByRole('region', { name: 'Popular tools' }).querySelectorAll('a'),
  ).toHaveLength(6)
  const routes = [
    ['/images/resize', 'Resize image'],
    ['/images/redact', 'Redact image'],
    ['/images/convert', 'Convert image'],
    ['/images/compress', 'Compress image'],
    ['/images/metadata', 'Image metadata'],
    ['/videos/compress', 'Compress video'],
    ['/videos/convert', 'Convert video'],
    ['/videos/trim', 'Trim video'],
    ['/videos/extract', 'Extract audio'],
    ['/videos/metadata', 'Video metadata'],
    ['/pdfs/merge', 'Merge PDFs'],
    ['/office-documents/convert', 'Convert document to PDF'],
    ['/archives/extract', 'Extract archive'],
    ['/archives/compress', 'Create archive'],
    ['/utilities/hash', 'File hashes'],
    ['/utilities/metadata', 'File metadata'],
  ]
  for (const [to, title] of routes) {
    await act(() => router.navigate({ to }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title),
    )
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
    const upload = screen.getByRole('region', { name: 'Choose files' })
    const card = document.querySelector<HTMLElement>(
      '[data-slot="tool-controls"] [data-slot="card"]',
    )
    expect(card, `${title}: settings card`).not.toBeNull()
    const uploadBounds = upload.getBoundingClientRect()
    const cardBounds = card!.getBoundingClientRect()
    const cardStyle = getComputedStyle(card!)
    expect(
      parseFloat(cardStyle.borderTopWidth),
      `${title}: card border`,
    ).toBeGreaterThan(0)
    expect(cardStyle.backgroundColor, `${title}: card surface`).toBe(
      getComputedStyle(upload).backgroundColor,
    )
    if (width >= 1280) {
      expect(cardBounds.top, `${title}: aligned card tops`).toBeCloseTo(
        uploadBounds.top,
        0,
      )
      expect(cardBounds.left, `${title}: side-by-side columns`).toBeGreaterThan(
        uploadBounds.right,
      )
      expect(screen.queryByRole('combobox', { name: 'Tool' })).toBeNull()
    } else {
      expect(
        cardBounds.top,
        `${title}: stacked mobile cards`,
      ).toBeGreaterThanOrEqual(uploadBounds.bottom)
      expect(cardBounds.left, `${title}: consistent mobile edge`).toBeCloseTo(
        uploadBounds.left,
        0,
      )
    }
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

test.each([375, 1440])(
  'populated redaction shares the image workspace at %s px',
  async (width) => {
    await page.viewport(width, 1000)
    const router = await openApp('/images/redact')
    expect(
      screen.getByRole('heading', { name: 'Redaction settings' }),
    ).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Add area' })
        .disabled,
    ).toBe(true)
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
        expect(
          screen.getByLabelText<HTMLCanvasElement>('Image redaction canvas')
            .width,
        ).toBe(350),
      { timeout: 10000 },
    )
    const upload = screen
      .getByRole('region', { name: 'Selected files' })
      .getBoundingClientRect()
    const canvas = screen
      .getByLabelText('Image redaction canvas')
      .getBoundingClientRect()
    const card = document
      .querySelector('[data-slot="tool-controls"] [data-slot="card"]')!
      .getBoundingClientRect()
    expect(screen.getByRole('img', { name: 'photo.png' })).toBeTruthy()
    expect(canvas.width).toBeLessThanOrEqual(card.width)
    if (width >= 1280) {
      expect(card.top).toBeCloseTo(upload.top, 0)
      expect(card.left).toBeGreaterThan(upload.right)
    } else {
      expect(card.top).toBeGreaterThanOrEqual(upload.bottom)
    }
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }))
    expect(screen.getByRole('group', { name: 'Redaction areas' })).toBeTruthy()
    if (width >= 1280) {
      expect(
        screen.getByRole('button', { name: 'Download' }).getBoundingClientRect()
          .bottom,
      ).toBeLessThanOrEqual(1000)
    }
    await act(() => router.navigate({ to: '/images/resize' }))
    const resizeUpload = screen
      .getByRole('region', { name: 'Selected files' })
      .getBoundingClientRect()
    expect(resizeUpload.width).toBeCloseTo(upload.width, 0)
    await act(() => router.navigate({ to: '/images/redact' }))
    expect(screen.getByRole('button', { name: 'Area 1 · box' })).toBeTruthy()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
  },
)

test.each([375, 1440])(
  'prepared video keeps its settings card aligned at %s px',
  async (width) => {
    await page.viewport(width, 1000)
    await openApp('/videos/compress')
    const response = await fetch(
      new URL('../lib/__tests__/fixtures/sample.webm', import.meta.url),
    )
    const file = new File([await response.arrayBuffer()], 'clip.webm', {
      type: 'video/webm',
    })
    fireEvent.change(screen.getByLabelText('Upload file'), {
      target: { files: [file] },
    })
    await screen.findByText(
      'Ready to process. Your video stays on this device.',
      {},
      { timeout: 20000 },
    )
    const upload = screen
      .getByRole('region', { name: 'Selected files' })
      .getBoundingClientRect()
    const card = screen
      .getByRole('heading', { name: 'Compression settings' })
      .closest('[data-slot="card"]')!
      .getBoundingClientRect()
    if (width >= 1280) expect(card.top).toBeCloseTo(upload.top, 0)
    else expect(card.top).toBeGreaterThanOrEqual(upload.bottom)
    await userEvent.click(screen.getByRole('radio', { name: /Smaller file/ }))
    await userEvent.click(
      screen.getByText('Advanced settings', { exact: true }),
    )
    expect(screen.getByLabelText<HTMLInputElement>('Quality (CRF)').value).toBe(
      '32',
    )
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
  },
)

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
