import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'

const mocks = vi.hoisted(() => ({
  path: '/archives/compress',
  init: vi.fn(),
  compress: vi.fn(),
  decompress: vi.fn(),
  download: vi.fn(),
}))
vi.mock('@/lib/archive', async (original) => ({
  ...(await original<typeof import('@/lib/archive')>()),
  ArchiveProcessor: class {
    init = mocks.init
    compress = mocks.compress
    decompress = mocks.decompress
  },
}))
vi.mock('@/lib/shared', async (original) => ({
  ...(await original<typeof import('@/lib/shared')>()),
  downloadBlob: mocks.download,
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useLocation: () => ({ pathname: mocks.path }),
  useNavigate: () => vi.fn(),
  Outlet: () => {
    const Page = (mocks.path.endsWith('extract') ? ExtractRoute : CompressRoute)
      .options.component!
    return <Page />
  },
}))
import { Route as ArchiveRoute } from '@/routes/archives'
import { Route as CompressRoute } from '@/routes/archives.compress'
import { Route as ExtractRoute } from '@/routes/archives.extract'

function workspace() {
  const ArchiveLayout = ArchiveRoute.options.component!
  return render(
    <ProcessingProvider>
      <ArchiveLayout />
    </ProcessingProvider>,
  )
}
beforeEach(() => {
  resetWorkspaceState()
  vi.clearAllMocks()
  mocks.path = '/archives/compress'
  mocks.init.mockResolvedValue(undefined)
  mocks.compress.mockResolvedValue(new Uint8Array([1, 2, 3]))
  mocks.decompress.mockReturnValue([
    {
      name: '01-invoice-for-a-long-project-name.pdf',
      size: 3,
      data: new Uint8Array([1, 2, 3]),
      isDirectory: false,
    },
    {
      name: '02-project-notes.pdf',
      size: 2,
      data: new Uint8Array([4, 5]),
      isDirectory: false,
    },
  ])
})
afterEach(cleanup)

test('archive creation retains settings, files and result, with no second compression for re-download', async () => {
  const view = workspace()
  fireEvent.change(screen.getByLabelText('Upload files'), {
    target: {
      files: [new File(['A'], 'alpha.txt'), new File(['B'], 'beta.txt')],
    },
  })
  fireEvent.change(screen.getByLabelText('Archive name'), {
    target: { value: 'project-backup' },
  })
  const create = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Create ZIP archive',
  })
  await waitFor(() => expect(create.disabled).toBe(false))
  fireEvent.click(create)
  await screen.findByText('project-backup.zip', { exact: true })
  view.unmount()
  workspace()
  await screen.findByText('project-backup.zip', { exact: true })
  expect(screen.getByLabelText<HTMLInputElement>('Archive name').value).toBe(
    'project-backup',
  )
  expect(screen.getByText('alpha.txt')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(mocks.compress).toHaveBeenCalledOnce()
  expect(mocks.download).toHaveBeenCalledTimes(2)
})

test('extraction shows complete filenames with compact named actions and reuses the all-files ZIP', async () => {
  mocks.path = '/archives/extract'
  workspace()
  const file = new File(['archive'], 'project.zip', { type: 'application/zip' })
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(new ArrayBuffer(4)),
  })
  fireEvent.change(screen.getByLabelText('Upload file'), {
    target: { files: [file] },
  })
  const extract = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Extract files',
  })
  await waitFor(() => expect(extract.disabled).toBe(false))
  fireEvent.click(extract)
  await screen.findByText('01-invoice-for-a-long-project-name.pdf')
  expect(screen.getByText('02-project-notes.pdf')).toBeTruthy()
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Download 01-invoice-for-a-long-project-name.pdf',
    }),
  )
  expect(mocks.download.mock.calls[0][1]).toBe(
    '01-invoice-for-a-long-project-name.pdf',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Download all as ZIP' }))
  await waitFor(() => expect(mocks.compress).toHaveBeenCalledOnce())
  await screen.findByRole('button', { name: 'Download all as ZIP' })
  fireEvent.click(screen.getByRole('button', { name: 'Download all as ZIP' }))
  expect(mocks.compress).toHaveBeenCalledOnce()
  expect(mocks.download).toHaveBeenCalledTimes(3)
})

test('returning during archive creation serializes shared WASM work and ignores the abandoned download', async () => {
  let finish!: (bytes: Uint8Array) => void
  const pending = new Promise<Uint8Array>((resolve) => {
    finish = resolve
  })
  mocks.compress.mockReturnValueOnce(pending)
  const view = workspace()
  fireEvent.change(screen.getByLabelText('Upload files'), {
    target: { files: [new File(['A'], 'alpha.txt')] },
  })
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Create ZIP archive',
      }).disabled,
    ).toBe(false),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Create ZIP archive' }))
  await waitFor(() => expect(mocks.compress).toHaveBeenCalledOnce())
  view.unmount()
  workspace()
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Create ZIP archive',
      }).disabled,
    ).toBe(false),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Create ZIP archive' }))
  expect(mocks.compress).toHaveBeenCalledOnce()
  await act(async () => {
    finish(new Uint8Array([9]))
    await pending
  })
  await screen.findByText('archive.zip', { exact: true })
  expect(mocks.compress).toHaveBeenCalledTimes(2)
  expect(mocks.download).toHaveBeenCalledOnce()
})
