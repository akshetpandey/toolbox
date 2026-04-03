import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  formatFileSize,
  formatDuration,
  downloadFile,
  downloadBlob,
  createObjectURL,
  revokeObjectURL,
  getFileExtension,
  truncateFilename,
  isValidImageFile,
  isValidVideoFile,
} from '../shared'

// ─── formatFileSize ──────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  test('returns "0 Bytes" for zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
  })

  test('formats small byte values', () => {
    expect(formatFileSize(1)).toBe('1 Bytes')
    expect(formatFileSize(512)).toBe('512 Bytes')
    expect(formatFileSize(1023)).toBe('1023 Bytes')
  })

  test('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(10240)).toBe('10 KB')
  })

  test('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB')
    expect(formatFileSize(5242880)).toBe('5 MB')
    expect(formatFileSize(1572864)).toBe('1.5 MB')
  })

  test('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB')
    expect(formatFileSize(2684354560)).toBe('2.5 GB')
  })

  test('formats with two decimal places when needed', () => {
    expect(formatFileSize(1234567)).toBe('1.18 MB')
    expect(formatFileSize(9876543)).toBe('9.42 MB')
  })
})

// ─── formatDuration ──────────────────────────────────────────────────────────

describe('formatDuration', () => {
  test('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('00:00:00')
  })

  test('formats seconds only', () => {
    expect(formatDuration(1)).toBe('00:00:01')
    expect(formatDuration(45)).toBe('00:00:45')
    expect(formatDuration(59)).toBe('00:00:59')
  })

  test('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('00:01:00')
    expect(formatDuration(125)).toBe('00:02:05')
    expect(formatDuration(599)).toBe('00:09:59')
  })

  test('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3600)).toBe('01:00:00')
    expect(formatDuration(3661)).toBe('01:01:01')
    expect(formatDuration(86399)).toBe('23:59:59')
  })

  test('truncates fractional seconds', () => {
    expect(formatDuration(90.7)).toBe('00:01:30')
    expect(formatDuration(0.9)).toBe('00:00:00')
  })

  test('handles large durations', () => {
    expect(formatDuration(360000)).toBe('100:00:00')
  })
})

// ─── getFileExtension ────────────────────────────────────────────────────────

describe('getFileExtension', () => {
  test('extracts simple extensions', () => {
    expect(getFileExtension('file.txt')).toBe('txt')
    expect(getFileExtension('photo.jpg')).toBe('jpg')
    expect(getFileExtension('archive.zip')).toBe('zip')
  })

  test('extracts last extension from multiple dots', () => {
    expect(getFileExtension('file.tar.gz')).toBe('gz')
    expect(getFileExtension('my.file.name.pdf')).toBe('pdf')
  })

  test('handles files with no extension', () => {
    expect(getFileExtension('README')).toBe('README')
    expect(getFileExtension('Makefile')).toBe('Makefile')
  })

  test('handles dot files', () => {
    expect(getFileExtension('.gitignore')).toBe('gitignore')
    expect(getFileExtension('.env.local')).toBe('local')
  })

  test('handles empty string', () => {
    expect(getFileExtension('')).toBe('')
  })
})

// ─── truncateFilename ────────────────────────────────────────────────────────

describe('truncateFilename', () => {
  test('returns short filenames unchanged', () => {
    expect(truncateFilename('short.txt')).toBe('short.txt')
    expect(truncateFilename('file.pdf', 32)).toBe('file.pdf')
  })

  test('returns filename at exact max length unchanged', () => {
    const name = 'a'.repeat(28) + '.txt'
    expect(truncateFilename(name, 32)).toBe(name)
  })

  test('truncates long filenames with ellipsis', () => {
    const result = truncateFilename(
      'this-is-a-very-long-filename-that-exceeds-limit.pdf',
      32,
    )
    expect(result).toContain('...')
    expect(result.endsWith('.pdf')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(32)
  })

  test('preserves file extension', () => {
    const result = truncateFilename('a'.repeat(50) + '.docx', 20)
    expect(result.endsWith('.docx')).toBe(true)
  })

  test('uses default maxLength of 32', () => {
    const longName = 'a'.repeat(40) + '.txt'
    const result = truncateFilename(longName)
    expect(result.length).toBeLessThanOrEqual(32)
  })

  test('handles custom maxLength', () => {
    const result = truncateFilename('medium-length-filename.txt', 15)
    expect(result).toContain('...')
    expect(result.endsWith('.txt')).toBe(true)
  })
})

// ─── isValidImageFile ────────────────────────────────────────────────────────

describe('isValidImageFile', () => {
  test('accepts common image types', () => {
    expect(
      isValidImageFile(new File([], 'a.jpg', { type: 'image/jpeg' })),
    ).toBe(true)
    expect(isValidImageFile(new File([], 'a.png', { type: 'image/png' }))).toBe(
      true,
    )
    expect(
      isValidImageFile(new File([], 'a.webp', { type: 'image/webp' })),
    ).toBe(true)
    expect(isValidImageFile(new File([], 'a.gif', { type: 'image/gif' }))).toBe(
      true,
    )
    expect(
      isValidImageFile(new File([], 'a.svg', { type: 'image/svg+xml' })),
    ).toBe(true)
  })

  test('rejects non-image types', () => {
    expect(isValidImageFile(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe(
      false,
    )
    expect(
      isValidImageFile(new File([], 'a.txt', { type: 'text/plain' })),
    ).toBe(false)
    expect(
      isValidImageFile(new File([], 'a.pdf', { type: 'application/pdf' })),
    ).toBe(false)
    expect(isValidImageFile(new File([], 'a', { type: '' }))).toBe(false)
  })
})

// ─── isValidVideoFile ────────────────────────────────────────────────────────

describe('isValidVideoFile', () => {
  test('accepts common video types', () => {
    expect(isValidVideoFile(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe(
      true,
    )
    expect(
      isValidVideoFile(new File([], 'a.webm', { type: 'video/webm' })),
    ).toBe(true)
    expect(
      isValidVideoFile(new File([], 'a.mkv', { type: 'video/x-matroska' })),
    ).toBe(true)
    expect(
      isValidVideoFile(new File([], 'a.avi', { type: 'video/x-msvideo' })),
    ).toBe(true)
  })

  test('rejects non-video types', () => {
    expect(
      isValidVideoFile(new File([], 'a.jpg', { type: 'image/jpeg' })),
    ).toBe(false)
    expect(
      isValidVideoFile(new File([], 'a.txt', { type: 'text/plain' })),
    ).toBe(false)
    expect(
      isValidVideoFile(new File([], 'a.mp3', { type: 'audio/mpeg' })),
    ).toBe(false)
  })
})

// ─── downloadFile ────────────────────────────────────────────────────────────

describe('downloadFile', () => {
  let clickSpy: ReturnType<typeof vi.fn>
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let appendChildSpy: ReturnType<typeof vi.spyOn>
  let removeChildSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    clickSpy = vi.fn()
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
      style: {},
    } as unknown as HTMLAnchorElement)
    appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockReturnValue(null as unknown as Node)
    removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockReturnValue(null as unknown as Node)
  })

  test('creates an anchor element with correct href and download attributes', () => {
    downloadFile('http://example.com/file.txt', 'file.txt')
    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(clickSpy).toHaveBeenCalled()
  })

  test('appends and removes the anchor from the DOM', () => {
    downloadFile('http://example.com/file.txt', 'file.txt')
    expect(appendChildSpy).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalled()
  })
})

// ─── downloadBlob ────────────────────────────────────────────────────────────

describe('downloadBlob', () => {
  let clickSpy: ReturnType<typeof vi.fn>
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
      style: {},
    } as unknown as HTMLAnchorElement)
    vi.spyOn(document.body, 'appendChild').mockReturnValue(
      null as unknown as Node,
    )
    vi.spyOn(document.body, 'removeChild').mockReturnValue(
      null as unknown as Node,
    )
    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url')
    revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockReturnValue(undefined)
  })

  test('creates an object URL, triggers download, and revokes URL', () => {
    const blob = new Blob(['test'], { type: 'text/plain' })
    downloadBlob(blob, 'test.txt')

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })
})

// ─── createObjectURL / revokeObjectURL ───────────────────────────────────────

describe('createObjectURL', () => {
  test('delegates to URL.createObjectURL', () => {
    const spy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:test-url')
    const blob = new Blob(['data'])
    const result = createObjectURL(blob)
    expect(result).toBe('blob:test-url')
    expect(spy).toHaveBeenCalledWith(blob)
  })
})

describe('revokeObjectURL', () => {
  test('delegates to URL.revokeObjectURL', () => {
    const spy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
    revokeObjectURL('blob:test-url')
    expect(spy).toHaveBeenCalledWith('blob:test-url')
  })
})
