import { resetWorkspaceState } from '@/hooks/useWorkspaceState'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ExifMetadata, FileHashes, FileMetadata } from '@/lib/metadata'
import { ProcessingProvider, useProcessing } from '@/contexts/ProcessingContext'
import { useUtilities } from '@/contexts/UtilitiesContext'

const {
  calculateFileHashes,
  extractFileMetadata,
  extractExifMetadata,
  stripFileMetadata,
  download,
} = vi.hoisted(() => ({
  calculateFileHashes:
    vi.fn<
      (
        file: File,
        onProgress?: (progress: number) => void,
      ) => Promise<FileHashes>
    >(),
  stripFileMetadata: vi.fn<(file: File) => Promise<Blob>>(),
  download: vi.fn<(blob: Blob, filename: string) => void>(),
  extractFileMetadata: vi.fn<(file: File) => Promise<FileMetadata>>(),
  extractExifMetadata:
    vi.fn<
      (
        file: File,
        onExtracting?: (extracting: boolean) => void,
      ) => Promise<ExifMetadata>
    >(),
}))

vi.mock('@/lib/metadata', () => ({
  calculateFileHashes,
  extractFileMetadata,
  extractExifMetadata,
  formatFileSize: (size: number) => `${size} Bytes`,
  stripFileMetadata,
}))

vi.mock('@/lib/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shared')>()),
  downloadBlob: download,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useLocation: () => ({ pathname: '/utilities/hash' }),
  useNavigate: () => vi.fn(),
  Outlet: () => <Results />,
}))

import { Route as UtilitiesRoute } from '@/routes/utilities'
import { Route as HashRoute } from '@/routes/utilities.hash'
import { Route as MetadataRoute } from '@/routes/utilities.metadata'

function Results() {
  const Hash = HashRoute.options.component!
  const Metadata = MetadataRoute.options.component!
  const { isProcessing } = useProcessing()
  const {
    fileHashes,
    fileMetadata,
    exifMetadata,
    isExtractingExif,
    hashProgress,
  } = useUtilities()
  return (
    <>
      <output aria-label="Processing">{String(isProcessing)}</output>
      <output aria-label="Stored results">
        {JSON.stringify({
          fileHashes,
          fileMetadata,
          exifMetadata,
          isExtractingExif,
          hashProgress,
        })}
      </output>
      <Hash />
      <Metadata />
    </>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function hashes(name: string): FileHashes {
  return { md5: `${name}-md5`, sha1: `${name}-sha1`, sha256: `${name}-sha256` }
}

function metadata(name: string): FileMetadata {
  return {
    name,
    mimeType: `image/${name}`,
    description: `${name} metadata`,
    size: 1,
  }
}

function selectFile(name: string, type = 'text/plain') {
  fireEvent.change(
    document.querySelector<HTMLInputElement>('input[type=file]')!,
    {
      target: { files: [new File([name], name, { type })] },
    },
  )
}

beforeEach(() => {
  resetWorkspaceState()
  vi.resetAllMocks()
  calculateFileHashes.mockImplementation((file) =>
    Promise.resolve(hashes(file.name)),
  )
  extractFileMetadata.mockImplementation((file) =>
    Promise.resolve(metadata(file.name)),
  )
  extractExifMetadata.mockResolvedValue({})
  stripFileMetadata.mockResolvedValue(
    new Blob(['clean'], { type: 'image/jpeg' }),
  )
  const UtilitiesLayout = UtilitiesRoute.options.component!
  render(
    <ProcessingProvider>
      <UtilitiesLayout />
    </ProcessingProvider>,
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('utility file selection', () => {
  test('old hashes and progress cannot overwrite a replacement or finish its busy state', async () => {
    const first = deferred<FileHashes>()
    const second = deferred<FileHashes>()
    calculateFileHashes
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    selectFile('first.txt')
    selectFile('second.txt')
    act(() => {
      calculateFileHashes.mock.calls[1][1]?.(25)
      calculateFileHashes.mock.calls[0][1]?.(90)
    })
    expect(screen.getByText('25%')).toBeTruthy()
    expect(screen.queryByText('90%')).toBeNull()

    await act(async () => {
      first.resolve(hashes('first'))
      await first.promise
    })
    expect(screen.getByLabelText('Processing').textContent).toBe('true')
    expect(screen.getByText('25%')).toBeTruthy()
    expect(screen.queryByText('first-md5')).toBeNull()
    expect(extractFileMetadata).not.toHaveBeenCalled()

    await act(async () => {
      second.resolve(hashes('second'))
      await second.promise
    })
    expect(screen.getByText('second-md5')).toBeTruthy()
    expect(screen.getByLabelText('Processing').textContent).toBe('false')
  })

  test('a slower first hash cannot replace already completed hashes for the second file', async () => {
    const first = deferred<FileHashes>()
    calculateFileHashes.mockReturnValueOnce(first.promise)
    selectFile('first.txt')
    selectFile('second.txt')
    await screen.findByText('second.txt-md5')
    await act(async () => {
      first.resolve(hashes('first'))
      await first.promise
    })

    expect(screen.getByText('second.txt-md5')).toBeTruthy()
    expect(screen.queryByText('first-md5')).toBeNull()
    expect(screen.getByText('second.txt metadata')).toBeTruthy()
    expect(extractFileMetadata).toHaveBeenCalledTimes(1)
  })

  test('old file metadata cannot replace newer metadata or start stale EXIF extraction', async () => {
    const first = deferred<FileMetadata>()
    const second = deferred<FileMetadata>()
    extractFileMetadata
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    selectFile('first.jpg', 'image/jpeg')
    await screen.findByText('first.jpg-md5')
    selectFile('second.jpg', 'image/jpeg')
    await screen.findByText('second.jpg-md5')

    await act(async () => {
      first.resolve(metadata('first'))
      await first.promise
    })
    expect(screen.getByLabelText('Processing').textContent).toBe('true')
    expect(screen.queryByText('first metadata')).toBeNull()
    expect(extractExifMetadata).not.toHaveBeenCalled()

    await act(async () => {
      second.resolve(metadata('second'))
      await second.promise
    })
    expect(screen.getByText('second metadata')).toBeTruthy()
    expect(extractExifMetadata).toHaveBeenCalledTimes(1)
    expect(extractExifMetadata.mock.calls[0][0].name).toBe('second.jpg')
  })

  test('metadata that finishes after the replacement cannot overwrite its completed results', async () => {
    const first = deferred<FileMetadata>()
    extractFileMetadata.mockReturnValueOnce(first.promise)
    selectFile('first.jpg', 'image/jpeg')
    await screen.findByText('first.jpg-md5')
    selectFile('second.jpg', 'image/jpeg')
    await screen.findByText('second.jpg metadata')
    await act(async () => {
      first.resolve(metadata('first'))
      await first.promise
    })
    expect(screen.getByText('second.jpg metadata')).toBeTruthy()
    expect(screen.queryByText('first metadata')).toBeNull()
    expect(extractExifMetadata).toHaveBeenCalledTimes(1)
  })

  test('out-of-order EXIF completion cannot change current results or loading indicators', async () => {
    const first = deferred<ExifMetadata>()
    const second = deferred<ExifMetadata>()
    extractExifMetadata
      .mockImplementationOnce((_file, onExtracting) => {
        onExtracting?.(true)
        return first.promise
      })
      .mockImplementationOnce((_file, onExtracting) => {
        onExtracting?.(true)
        return second.promise
      })
    selectFile('first.jpg', 'image/jpeg')
    await screen.findByText('first.jpg metadata')
    selectFile('second.jpg', 'image/jpeg')
    await screen.findByText('second.jpg metadata')

    await act(async () => {
      extractExifMetadata.mock.calls[0][1]?.(false)
      first.resolve({ Camera: 'First camera' })
      await first.promise
    })
    expect(screen.getByText('Extracting EXIF metadata...')).toBeTruthy()
    expect(screen.getByLabelText('Processing').textContent).toBe('true')
    expect(screen.queryByText('First camera')).toBeNull()

    await act(async () => {
      extractExifMetadata.mock.calls[1][1]?.(false)
      second.resolve({ Camera: 'Second camera' })
      await second.promise
    })
    expect(screen.getByText('Second camera')).toBeTruthy()
    expect(screen.queryByText('First camera')).toBeNull()
    expect(screen.getByLabelText('Processing').textContent).toBe('false')
  })

  test.each(['hash', 'metadata', 'exif'] as const)(
    'clearing during %s invalidates pending results and progress',
    async (stage) => {
      const pendingHashes = deferred<FileHashes>()
      const pendingMetadata = deferred<FileMetadata>()
      const pendingExif = deferred<ExifMetadata>()
      if (stage === 'hash')
        calculateFileHashes.mockReturnValueOnce(pendingHashes.promise)
      if (stage === 'metadata')
        extractFileMetadata.mockReturnValueOnce(pendingMetadata.promise)
      if (stage === 'exif')
        extractExifMetadata.mockReturnValueOnce(pendingExif.promise)

      selectFile('cleared.jpg', 'image/jpeg')
      if (stage !== 'hash') await screen.findByText('cleared.jpg-md5')
      if (stage === 'exif') await screen.findByText('cleared.jpg metadata')
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

      await act(async () => {
        calculateFileHashes.mock.calls[0][1]?.(95)
        extractExifMetadata.mock.calls[0]?.[1]?.(true)
        pendingHashes.resolve(hashes('cleared'))
        pendingMetadata.resolve(metadata('cleared'))
        pendingExif.resolve({ Camera: 'Cleared camera' })
        await Promise.all([
          pendingHashes.promise,
          pendingMetadata.promise,
          pendingExif.promise,
        ])
      })
      expect(screen.getByText('Drop a file here')).toBeTruthy()
      expect(screen.queryByText('cleared-md5')).toBeNull()
      expect(screen.queryByText('cleared metadata')).toBeNull()
      expect(screen.queryByText('Cleared camera')).toBeNull()
      expect(screen.queryByText('95%')).toBeNull()
      expect(screen.getByLabelText('Processing').textContent).toBe('false')
      expect(screen.getByLabelText('Stored results').textContent).toBe(
        JSON.stringify({
          fileHashes: null,
          fileMetadata: null,
          exifMetadata: {},
          isExtractingExif: false,
          hashProgress: 0,
        }),
      )
      if (stage === 'hash') expect(extractFileMetadata).not.toHaveBeenCalled()
      if (stage === 'metadata')
        expect(extractExifMetadata).not.toHaveBeenCalled()
    },
  )
})

test('copies complete digests and announces explicit verification results', async () => {
  const writeText = vi
    .fn<(value: string) => Promise<void>>()
    .mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  selectFile('sample.txt')
  await screen.findByText('sample.txt-md5')
  for (const label of ['MD5', 'SHA1', 'SHA256']) {
    fireEvent.click(screen.getByRole('button', { name: `Copy ${label}` }))
    await screen.findByText(`${label} copied`)
    expect(writeText).toHaveBeenLastCalledWith(
      `sample.txt-${label.toLowerCase()}`,
    )
  }
  fireEvent.click(screen.getByRole('button', { name: 'Copy all checksums' }))
  await screen.findByText('All checksums copied')
  expect(writeText).toHaveBeenLastCalledWith(
    'MD5: sample.txt-md5\nSHA1: sample.txt-sha1\nSHA256: sample.txt-sha256',
  )
  fireEvent.change(screen.getByLabelText('Expected hash (optional)'), {
    target: { value: ' SAMPLE.TXT-MD5 ' },
  })
  expect(screen.getByText('Matches MD5').getAttribute('role')).toBe('status')
  fireEvent.change(screen.getByLabelText('Expected hash (optional)'), {
    target: { value: 'different-checksum' },
  })
  expect(
    screen
      .getByText('Does not match any calculated hash')
      .getAttribute('aria-live'),
  ).toBe('polite')
})

test('non-image metadata describes its scope without an irrelevant EXIF panel or cleanup action', async () => {
  selectFile('sample.txt')
  await screen.findByText('sample.txt metadata')
  expect(
    screen.queryByRole('heading', { name: 'Image EXIF metadata' }),
  ).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Download Without Metadata' }),
  ).toBeNull()
  expect(
    screen.getByText(/This file type has no image EXIF metadata/),
  ).toBeTruthy()
  expect(
    screen.queryByText('Select an image file to view EXIF metadata'),
  ).toBeNull()
})

test('completed file analysis survives leaving and returning to the workspace', async () => {
  selectFile('retained.txt')
  await screen.findByText('retained.txt metadata')
  cleanup()
  const UtilitiesLayout = UtilitiesRoute.options.component!
  render(
    <ProcessingProvider>
      <UtilitiesLayout />
    </ProcessingProvider>,
  )
  expect(screen.getByText('retained.txt')).toBeTruthy()
  expect(screen.getByText('retained.txt-md5')).toBeTruthy()
  expect(screen.getByText('retained.txt metadata')).toBeTruthy()
})

test('metadata removal for a replaced file cannot download or finish replacement analysis', async () => {
  const stripping = deferred<Blob>()
  stripFileMetadata.mockReturnValueOnce(stripping.promise)
  selectFile('first.jpg', 'image/jpeg')
  await screen.findByText('first.jpg metadata')
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  const replacementHashes = deferred<FileHashes>()
  calculateFileHashes.mockReturnValueOnce(replacementHashes.promise)
  selectFile('second.jpg', 'image/jpeg')
  expect(screen.getByLabelText('Processing').textContent).toBe('true')
  await act(async () => {
    stripping.resolve(new Blob(['obsolete'], { type: 'image/jpeg' }))
    await stripping.promise
  })
  expect(download).not.toHaveBeenCalled()
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
  expect(screen.getByLabelText('Processing').textContent).toBe('true')

  await act(async () => {
    replacementHashes.resolve(hashes('second.jpg'))
    await replacementHashes.promise
  })
  await screen.findByText('second.jpg metadata')
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  await screen.findByRole('region', { name: 'Result' })
  expect(download).toHaveBeenCalledTimes(1)
  expect(download.mock.calls[0][1]).toBe('no-metadata_second.jpg')
})

test('metadata removal completing after navigation cannot publish a stale result or download', async () => {
  const stripping = deferred<Blob>()
  stripFileMetadata.mockReturnValueOnce(stripping.promise)
  selectFile('first.jpg', 'image/jpeg')
  await screen.findByText('first.jpg metadata')
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  )
  cleanup()
  await act(async () => {
    stripping.resolve(new Blob(['obsolete'], { type: 'image/jpeg' }))
    await stripping.promise
  })
  expect(download).not.toHaveBeenCalled()
  const UtilitiesLayout = UtilitiesRoute.options.component!
  render(
    <ProcessingProvider>
      <UtilitiesLayout />
    </ProcessingProvider>,
  )
  expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Download Without Metadata' }),
  ).toBeTruthy()
})
