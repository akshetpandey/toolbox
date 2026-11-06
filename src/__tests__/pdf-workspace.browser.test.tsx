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
import { PDFDocument } from 'pdf-lib'
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
