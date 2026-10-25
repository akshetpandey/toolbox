import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import type { PDFMergeOptions, PDFOperationResult } from '@/lib/pdf'

const { merge, download } = vi.hoisted(() => ({
  merge: vi.fn<(options: PDFMergeOptions) => Promise<PDFOperationResult>>(),
  download: vi.fn(),
}))
vi.mock('@/lib/pdf', async (original) => ({
  ...(await original<typeof import('@/lib/pdf')>()),
  mergePDFs: merge,
}))
vi.mock('@/lib/shared', async (original) => ({
  ...(await original<typeof import('@/lib/shared')>()),
  downloadBlob: download,
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useLocation: () => ({ pathname: '/pdfs/merge' }),
  Outlet: () => {
    const Merge = MergeRoute.options.component!
    return <Merge />
  },
}))
import { Route as PDFRoute } from '@/routes/pdfs'
import { Route as MergeRoute } from '@/routes/pdfs.merge'

async function pdf(name: string, pages: number) {
  const document = await PDFDocument.create()
  for (let page = 0; page < pages; page++) document.addPage([72, 72])
  const bytes = pages ? await document.save() : new Uint8Array([0])
  const data = Uint8Array.from(bytes).buffer
  const file = new File([data], name, { type: 'application/pdf' })
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(data),
  })
  return file
}
function workspace() {
  const PDFLayout = PDFRoute.options.component!
  return render(
    <ProcessingProvider>
      <PDFLayout />
    </ProcessingProvider>,
  )
}
function select(...files: File[]) {
  fireEvent.change(screen.getByLabelText('Upload files'), { target: { files } })
}
beforeEach(() => {
  resetWorkspaceState()
  vi.clearAllMocks()
  merge.mockResolvedValue({
    success: true,
    blob: new Blob(['merged PDF'], { type: 'application/pdf' }),
  })
})
afterEach(cleanup)

test('batch selection, Add files, page counts and keyboard alternatives preserve the intended order', async () => {
  workspace()
  expect(screen.getByLabelText<HTMLInputElement>('Upload files').multiple).toBe(
    true,
  )
  select(
    await pdf('01-invoice-for-a-very-long-project-name.pdf', 1),
    await pdf('02-project-notes.pdf', 2),
  )
  await screen.findByText('2 PDFs · 3 pages')
  expect(screen.getByRole('button', { name: 'Add files' })).toBeTruthy()
  const list = screen.getByRole('list', { name: 'PDF merge order' })
  expect(within(list).getAllByRole('listitem')[0].textContent).toContain(
    '01-invoice-for-a-very-long-project-name.pdf',
  )
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Move 01-invoice-for-a-very-long-project-name.pdf up',
    }).disabled,
  ).toBe(true)
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Move 01-invoice-for-a-very-long-project-name.pdf down',
    }),
  )
  expect(within(list).getAllByRole('listitem')[0].textContent).toContain(
    '02-project-notes.pdf',
  )
  expect(
    screen.getByRole('button', {
      name: 'Drag 02-project-notes.pdf to reorder',
    }),
  ).toBeTruthy()
  select(await pdf('03-appendix.pdf', 4))
  await screen.findByText('3 PDFs · 7 pages')
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove 03-appendix.pdf' }),
  )
  await screen.findByText('2 PDFs · 3 pages')
  fireEvent.click(screen.getByRole('button', { name: 'Merge 2 PDFs' }))
  await screen.findByText('merged-document.pdf')
  expect(merge.mock.calls[0][0].files.map((file) => file.name)).toEqual([
    '02-project-notes.pdf',
    '01-invoice-for-a-very-long-project-name.pdf',
  ])
  expect(screen.queryByRole('tab', { name: /Split|Compress/ })).toBeNull()
})

test('merge results and order survive navigation and re-download without reprocessing', async () => {
  const view = workspace()
  select(await pdf('first.pdf', 1), await pdf('second.pdf', 2))
  await screen.findByText('2 PDFs · 3 pages')
  fireEvent.click(screen.getByRole('button', { name: 'Merge 2 PDFs' }))
  await screen.findByText('merged-document.pdf')
  view.unmount()
  workspace()
  await screen.findByText('merged-document.pdf')
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(merge).toHaveBeenCalledOnce()
  expect(download).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Start another file' }))
  await waitFor(() =>
    expect(screen.queryByText('merged-document.pdf')).toBeNull(),
  )
  expect(screen.queryByRole('list', { name: 'PDF merge order' })).toBeNull()
})

test('unreadable PDFs are identified before merge and can be removed', async () => {
  workspace()
  select(await pdf('good.pdf', 1), await pdf('damaged.pdf', 0))
  await screen.findByText('Could not read PDF', { exact: false })
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Merge 2 PDFs' })
      .disabled,
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Remove damaged.pdf' }))
  await screen.findByText('1 PDF · 1 page')
  expect(merge).not.toHaveBeenCalled()
})
