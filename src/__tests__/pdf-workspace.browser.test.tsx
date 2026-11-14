import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { PDFDict, PDFDocument, PDFName, degrees } from 'pdf-lib'
import { routeTree } from '@/routeTree.gen'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import '@/styles.css'

afterEach(() => {
  cleanup()
  resetWorkspaceState()
  vi.restoreAllMocks()
})

test('a typed signature is embedded on the chosen rotated page while other pages stay unchanged', async () => {
  const document = await PDFDocument.create()
  for (let index = 0; index < 3; index++) document.addPage([300, 200])
  const canvas = window.document.createElement('canvas')
  canvas.width = canvas.height = 8
  canvas.getContext('2d')!.fillRect(0, 0, 8, 8)
  const image = await document.embedPng(canvas.toDataURL())
  document.getPage(1).drawImage(image, { x: 20, y: 20, width: 8, height: 8 })
  document.getPage(1).setRotation(degrees(90))
  const file = new File(
    [Uint8Array.from(await document.save())],
    'signature.pdf',
    { type: 'application/pdf' },
  )
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/pdfs/sign'] }),
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
  fireEvent.change(await screen.findByLabelText('Upload file'), {
    target: { files: [file] },
  })
  await screen.findByText('signature.pdf')
  await userEvent.fill(screen.getByLabelText('Signature name'), 'Jordan Rivera')
  await userEvent.fill(screen.getByLabelText('Page', { exact: true }), '2')
  const outputs: Blob[] = []
  const createObjectURL = URL.createObjectURL.bind(URL)
  vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
    if (value instanceof Blob) outputs.push(value)
    return createObjectURL(value)
  })
  await userEvent.click(
    screen.getByRole('button', { name: 'Add signature and download' }),
  )
  await screen.findByText('Typed signature on page 2')
  expect(outputs).toHaveLength(1)
  const signed = await PDFDocument.load(await outputs[0].arrayBuffer())
  expect(
    signed
      .getPages()
      .map(
        (page) =>
          page.node
            .Resources()
            ?.lookupMaybe(PDFName.of('XObject'), PDFDict)
            ?.keys().length ?? 0,
      ),
  ).toEqual([0, 2, 0])
})

test('real browser Files expose page counts, keyboard ordering, and a reusable three-page merge result', async () => {
  const files: File[] = []
  for (const [name, count] of [
    ['invoice.pdf', 1],
    ['project-notes.pdf', 2],
  ] as const) {
    const pdf = await PDFDocument.create()
    for (let page = 0; page < count; page++) pdf.addPage([72, 72])
    files.push(
      new File([Uint8Array.from(await pdf.save())], name, {
        type: 'application/pdf',
      }),
    )
  }
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/pdfs/merge'] }),
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
  const input = await screen.findByLabelText<HTMLInputElement>('Upload files')
  expect(input.multiple).toBe(true)
  fireEvent.change(input, { target: { files } })
  await screen.findByText('2 PDFs · 3 pages')
  expect(screen.queryByText('Could not read PDF')).toBeNull()

  screen.getByRole('button', { name: 'Move project-notes.pdf up' }).focus()
  await userEvent.keyboard('{Enter}')
  const order = screen.getByRole('list', { name: 'PDF merge order' })
  expect(within(order).getAllByRole('listitem')[0].textContent).toContain(
    'project-notes.pdf',
  )

  const outputs: Blob[] = []
  const createObjectURL = URL.createObjectURL.bind(URL)
  vi.spyOn(URL, 'createObjectURL').mockImplementation((object) => {
    if (object instanceof Blob) outputs.push(object)
    return createObjectURL(object)
  })
  await userEvent.click(screen.getByRole('button', { name: 'Merge 2 PDFs' }))
  await screen.findByText('merged-document.pdf')
  await waitFor(() => expect(outputs).toHaveLength(1))
  const output = outputs[0]
  const merged = await PDFDocument.load(await output.arrayBuffer())
  expect(merged.getPageCount()).toBe(3)
  await userEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(outputs).toHaveLength(2)
  expect(outputs[1]).toBe(output)
})

test('PDF editing keeps one shared source and clears obsolete exports when the source is replaced', async () => {
  async function createPDF(pages: number) {
    const document = await PDFDocument.create()
    for (let index = 0; index < pages; index++) document.addPage([72, 72])
    return new File([Uint8Array.from(await document.save())], 'document.pdf', {
      type: 'application/pdf',
    })
  }

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/pdfs/split'] }),
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
  const input = await screen.findByLabelText<HTMLInputElement>('Upload file')
  expect(input.multiple).toBe(false)
  fireEvent.change(input, { target: { files: [await createPDF(2)] } })
  await screen.findByText('Your document has 2 pages.')
  fireEvent.change(screen.getByLabelText('Pages'), { target: { value: '2' } })
  await userEvent.click(
    screen.getByRole('button', { name: 'Extract and download PDF' }),
  )
  await screen.findByText('document-pages.pdf')

  await act(() => router.navigate({ to: '/pdfs/compress' }))
  expect(screen.getByText('document.pdf')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Upload file'), {
    target: { files: [await createPDF(1)] },
  })
  await act(() => router.navigate({ to: '/pdfs/split' }))
  await screen.findByText('Your document has 1 page.')
  expect(screen.getByLabelText<HTMLInputElement>('Pages').value).toBe('')
  expect(screen.queryByText('document-pages.pdf')).toBeNull()
})
