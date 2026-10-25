import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ExifMetadata, FileHashes, FileMetadata } from '@/lib/metadata'
import { ProcessingProvider, useProcessing } from '@/contexts/ProcessingContext'
import { useUtilities } from '@/contexts/UtilitiesContext'

const { calculateFileHashes, extractFileMetadata, extractExifMetadata } =
  vi.hoisted(() => ({
    calculateFileHashes:
      vi.fn<
        (
          file: File,
          onProgress?: (progress: number) => void,
        ) => Promise<FileHashes>
      >(),
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
  stripFileMetadata: vi.fn(),
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
  vi.resetAllMocks()
  calculateFileHashes.mockImplementation((file) =>
    Promise.resolve(hashes(file.name)),
  )
  extractFileMetadata.mockImplementation((file) =>
    Promise.resolve(metadata(file.name)),
  )
  extractExifMetadata.mockResolvedValue({})
  const UtilitiesLayout = UtilitiesRoute.options.component!
  render(
    <ProcessingProvider>
      <UtilitiesLayout />
    </ProcessingProvider>,
  )
})

afterEach(cleanup)

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
