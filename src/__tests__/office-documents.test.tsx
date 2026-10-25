import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ProcessingProvider, useProcessing } from '@/contexts/ProcessingContext'
import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { StrictMode } from 'react'
import type { ConversionResult } from '@/lib/pandoc'

const { convertOfficeToPDF, downloadBlob } = vi.hoisted(() => ({
  convertOfficeToPDF: vi.fn<(file: File) => Promise<ConversionResult>>(),
  downloadBlob: vi.fn<(blob: Blob, filename: string) => void>(),
}))

vi.mock('@/lib/pandoc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pandoc')>()),
  convertOfficeToPDF,
}))

vi.mock('@/lib/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shared')>()),
  downloadBlob,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useLocation: () => ({ pathname: '/office-documents/convert' }),
  useNavigate: () => vi.fn(),
  Outlet: () => {
    const Convert = ConvertRoute.options.component!
    return <Convert />
  },
}))

import { Route as OfficeRoute } from '@/routes/office-documents'
import { Route as ConvertRoute } from '@/routes/office-documents.convert'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function selectFile(name: string) {
  fireEvent.change(
    document.querySelector<HTMLInputElement>('input[type=file]')!,
    {
      target: {
        files: [
          new File([name], name, {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
        ],
      },
    },
  )
}

function success(): ConversionResult {
  return {
    success: true,
    output: new Blob(['%PDF'], { type: 'application/pdf' }),
  }
}

let view: ReturnType<typeof render>

function AnotherJob() {
  const { isProcessing, setIsProcessing } = useProcessing()
  return (
    <>
      <button onClick={() => setIsProcessing(true)}>Start another job</button>
      <output aria-label="Processing">{String(isProcessing)}</output>
    </>
  )
}

beforeEach(() => {
  resetWorkspaceState()
  vi.clearAllMocks()
  convertOfficeToPDF.mockReset().mockResolvedValue(success())
  const OfficeLayout = OfficeRoute.options.component!
  view = render(
    <ProcessingProvider>
      <OfficeLayout />
    </ProcessingProvider>,
  )
})

afterEach(cleanup)

describe('office document replacement', () => {
  test('a new document clears the previous success and converts automatically', async () => {
    selectFile('first.docx')
    await screen.findByText(/first.docx converted to PDF/)
    selectFile('second.docx')
    expect(screen.queryByText(/first.docx converted to PDF/)).toBeNull()
    await screen.findByText(/second.docx converted to PDF/)

    expect(convertOfficeToPDF.mock.calls.map(([file]) => file.name)).toEqual([
      'first.docx',
      'second.docx',
    ])
    expect(downloadBlob.mock.calls.map(([, filename]) => filename)).toEqual([
      'first.pdf',
      'second.pdf',
    ])
  })

  test.each(['success', 'error'] as const)(
    'ignores old %s when a different document is selected during conversion',
    async (result) => {
      const first = deferred<ConversionResult>()
      const second = deferred<ConversionResult>()
      convertOfficeToPDF
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
      selectFile('first.docx')
      await screen.findByText('Converting first.docx...')
      selectFile('second.docx')

      // Keep WASM conversions serialized, even while the chosen document changes.
      expect(convertOfficeToPDF).toHaveBeenCalledTimes(1)
      await act(async () => {
        if (result === 'success') first.resolve(success())
        else first.reject(new Error('First conversion failed'))
        await first.promise.catch(() => undefined)
      })
      await screen.findByText('Converting second.docx...')
      expect(downloadBlob).not.toHaveBeenCalled()
      expect(screen.queryByText(/first.docx converted/)).toBeNull()
      expect(screen.queryByText(/First conversion failed/)).toBeNull()

      await act(async () => {
        second.resolve(success())
        await second.promise
      })
      await screen.findByText(/second.docx converted to PDF/)
      expect(downloadBlob).toHaveBeenCalledTimes(1)
      expect(downloadBlob.mock.calls[0][1]).toBe('second.pdf')
    },
  )

  test('clearing a document during conversion prevents a late download or success status', async () => {
    const first = deferred<ConversionResult>()
    convertOfficeToPDF.mockReturnValueOnce(first.promise)
    selectFile('first.docx')
    await screen.findByText('Converting first.docx...')
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await act(async () => {
      first.resolve(success())
      await first.promise
    })

    expect(screen.getByText('Drop an office file here')).toBeTruthy()
    expect(screen.queryByText(/first.docx converted/)).toBeNull()
    expect(downloadBlob).not.toHaveBeenCalled()

    selectFile('second.docx')
    await screen.findByText(/second.docx converted to PDF/)
    expect(downloadBlob.mock.calls[0][1]).toBe('second.pdf')
  })

  test('a conversion completing after navigation cannot release a different job’s processing state', async () => {
    const first = deferred<ConversionResult>()
    convertOfficeToPDF.mockReturnValueOnce(first.promise)
    selectFile('first.docx')
    await screen.findByText('Converting first.docx...')
    view.rerender(
      <ProcessingProvider>
        <AnotherJob />
      </ProcessingProvider>,
    )
    expect(screen.getByLabelText('Processing').textContent).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Start another job' }))
    await act(async () => {
      first.resolve(success())
      await first.promise
    })

    expect(screen.getByLabelText('Processing').textContent).toBe('true')
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})

test('a ready PDF can be downloaded again without another conversion', async () => {
  selectFile('report.docx')
  await screen.findByText('report.pdf')
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(convertOfficeToPDF).toHaveBeenCalledOnce()
  expect(downloadBlob).toHaveBeenCalledTimes(2)
  expect(downloadBlob.mock.calls[1][1]).toBe('report.pdf')
})

test('a damaged document gets plain recovery and optional diagnostics', async () => {
  convertOfficeToPDF.mockResolvedValueOnce({
    success: false,
    error: 'ZIP: end of central directory signature missing',
  })
  selectFile('damaged.docx')
  await screen.findByText('This document could not be opened')
  const details = screen.getByText('Technical details').closest('details')
  expect(details?.open).toBe(false)
  expect(details?.textContent).toContain('end of central directory')
  expect(downloadBlob).not.toHaveBeenCalled()
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!
  const click = vi.spyOn(input, 'click').mockImplementation(() => undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Choose another file' }))
  expect(click).toHaveBeenCalledOnce()
  click.mockRestore()
  selectFile('repaired.docx')
  await screen.findByText('repaired.pdf')
  expect(screen.queryByRole('alert')).toBeNull()
})

test('selection and generated PDF survive leaving and returning to the workspace', async () => {
  selectFile('retained.docx')
  await screen.findByText('retained.pdf')
  view.unmount()
  const OfficeLayout = OfficeRoute.options.component!
  render(
    <ProcessingProvider>
      <OfficeLayout />
    </ProcessingProvider>,
  )
  await screen.findByText('retained.pdf')
  expect(convertOfficeToPDF).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Download again' }))
  expect(downloadBlob).toHaveBeenCalledTimes(2)
})

test('returning to an in-progress document in Strict Mode reuses its pending conversion', async () => {
  const pending = deferred<ConversionResult>()
  convertOfficeToPDF.mockReturnValueOnce(pending.promise)
  selectFile('pending.docx')
  await screen.findByText('Converting pending.docx...')
  view.unmount()
  const OfficeLayout = OfficeRoute.options.component!
  render(
    <StrictMode>
      <ProcessingProvider>
        <OfficeLayout />
      </ProcessingProvider>
    </StrictMode>,
  )
  await screen.findByText('Converting pending.docx...')
  expect(convertOfficeToPDF).toHaveBeenCalledOnce()
  await act(async () => {
    pending.resolve(success())
    await pending.promise
  })
  await screen.findByText('pending.pdf')
  expect(convertOfficeToPDF).toHaveBeenCalledOnce()
  expect(downloadBlob).toHaveBeenCalledOnce()
})
