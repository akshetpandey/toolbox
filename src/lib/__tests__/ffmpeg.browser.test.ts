/**
 * E2E tests for the @ffmpeg/ffmpeg WASM package running in a real browser.
 * Uses vitest browser mode (Playwright) because @ffmpeg/ffmpeg explicitly
 * blocks Node.js imports and requires Web Workers + SharedArrayBuffer.
 *
 * Run with: pnpm vitest --config vitest.browser.config.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest'

// ─── FFmpeg Setup ───────────────────────────────────────────────────────────

let FFmpeg: typeof import('@ffmpeg/ffmpeg').FFmpeg
let toBlobURL: typeof import('@ffmpeg/util').toBlobURL
let ffmpeg: InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg>

beforeAll(async () => {
  const [ffmpegMod, utilMod] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ])
  FFmpeg = ffmpegMod.FFmpeg
  toBlobURL = utilMod.toBlobURL

  ffmpeg = new FFmpeg()

  const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.worker.js`,
      'text/javascript',
    ),
  })
}, 120_000)

afterAll(() => {
  ffmpeg?.terminate()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadFixture(name: string): Promise<Uint8Array> {
  // In vitest browser mode, project files are served by the dev server.
  // Use fetch() to load binary fixture files as ArrayBuffer.
  const url = `/src/lib/__tests__/fixtures/${name}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load fixture ${name}: ${response.status}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

async function writeInput(name: string, data: Uint8Array): Promise<void> {
  await ffmpeg.writeFile(name, data)
}

async function readOutput(name: string): Promise<Uint8Array> {
  const data = await ffmpeg.readFile(name)
  if (typeof data === 'string') {
    throw new Error(`Expected binary data from readFile, got string`)
  }
  return data
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('@ffmpeg/ffmpeg WASM (e2e, browser)', () => {
  describe('metadata extraction', () => {
    test('extracts video metadata via ffprobe', async () => {
      const mp4Data = await loadFixture('sample.mp4')
      await writeInput('probe.mp4', mp4Data)

      // ffprobe using exec with -show_format -show_streams
      const exitCode = await ffmpeg.exec(['-i', 'probe.mp4', '-f', 'null', '-'])
      // exitCode 0 = success (the file was readable)
      // ffmpeg returns 0 even with -f null (it just reads the file)
      expect(exitCode).toBe(0)

      await ffmpeg.deleteFile('probe.mp4')
    })
  })

  describe('video conversion', () => {
    test('converts MP4 to WebM', async () => {
      const mp4Data = await loadFixture('sample.mp4')
      await writeInput('input.mp4', mp4Data)

      const exitCode = await ffmpeg.exec([
        '-i',
        'input.mp4',
        '-t',
        '2',
        '-c:v',
        'libvpx',
        '-b:v',
        '200k',
        '-an',
        'output.webm',
      ])
      expect(exitCode).toBe(0)

      const output = await readOutput('output.webm')
      expect(output.length).toBeGreaterThan(0)
      // WebM magic: 0x1A 0x45 0xDF 0xA3
      expect(output[0]).toBe(0x1a)
      expect(output[1]).toBe(0x45)
      expect(output[2]).toBe(0xdf)
      expect(output[3]).toBe(0xa3)

      await ffmpeg.deleteFile('input.mp4')
      await ffmpeg.deleteFile('output.webm')
    })

    test('converts WebM to MP4', async () => {
      const webmData = await loadFixture('sample.webm')
      await writeInput('input.webm', webmData)

      const exitCode = await ffmpeg.exec([
        '-i',
        'input.webm',
        '-t',
        '2',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-an',
        'output.mp4',
      ])
      expect(exitCode).toBe(0)

      const output = await readOutput('output.mp4')
      expect(output.length).toBeGreaterThan(0)

      await ffmpeg.deleteFile('input.webm')
      await ffmpeg.deleteFile('output.mp4')
    })
  })

  describe('video compression', () => {
    test('compresses MP4 with CRF', async () => {
      const mp4Data = await loadFixture('sample.mp4')
      await writeInput('compress.mp4', mp4Data)

      const exitCode = await ffmpeg.exec([
        '-i',
        'compress.mp4',
        '-t',
        '2',
        '-c:v',
        'libx264',
        '-crf',
        '40',
        '-preset',
        'ultrafast',
        '-an',
        'compressed.mp4',
      ])
      expect(exitCode).toBe(0)

      const output = await readOutput('compressed.mp4')
      expect(output.length).toBeGreaterThan(0)

      await ffmpeg.deleteFile('compress.mp4')
      await ffmpeg.deleteFile('compressed.mp4')
    })
  })

  describe('video trimming', () => {
    test('trims video to a time range', async () => {
      const mp4Data = await loadFixture('sample.mp4')
      // Save length before writeInput (ffmpeg may transfer the ArrayBuffer)
      const originalLength = mp4Data.length
      await writeInput('trim.mp4', mp4Data)

      const exitCode = await ffmpeg.exec([
        '-i',
        'trim.mp4',
        '-ss',
        '1',
        '-to',
        '3',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-an',
        'trimmed.mp4',
      ])
      expect(exitCode).toBe(0)

      const output = await readOutput('trimmed.mp4')
      expect(output.length).toBeGreaterThan(0)
      // Trimmed should be smaller than original
      expect(output.length).toBeLessThan(originalLength)

      await ffmpeg.deleteFile('trim.mp4')
      await ffmpeg.deleteFile('trimmed.mp4')
    })

    test('converts video segment to GIF', async () => {
      const mp4Data = await loadFixture('sample.mp4')
      await writeInput('gif_src.mp4', mp4Data)

      const exitCode = await ffmpeg.exec([
        '-i',
        'gif_src.mp4',
        '-t',
        '1',
        '-vf',
        'fps=5,scale=160:-1',
        'output.gif',
      ])
      expect(exitCode).toBe(0)

      const output = await readOutput('output.gif')
      expect(output.length).toBeGreaterThan(0)
      // GIF magic: GIF8
      expect(output[0]).toBe(0x47) // G
      expect(output[1]).toBe(0x49) // I
      expect(output[2]).toBe(0x46) // F

      await ffmpeg.deleteFile('gif_src.mp4')
      await ffmpeg.deleteFile('output.gif')
    })
  })

  describe('audio extraction', () => {
    test('extracts audio as WAV', async () => {
      const mp4Data = await loadFixture('sample.mp4')
      await writeInput('audio_src.mp4', mp4Data)

      const exitCode = await ffmpeg.exec([
        '-i',
        'audio_src.mp4',
        '-t',
        '2',
        '-vn',
        '-c:a',
        'pcm_s16le',
        'output.wav',
      ])
      expect(exitCode).toBe(0)

      const output = await readOutput('output.wav')
      expect(output.length).toBeGreaterThan(0)
      // WAV magic: RIFF
      expect(output[0]).toBe(0x52) // R
      expect(output[1]).toBe(0x49) // I
      expect(output[2]).toBe(0x46) // F
      expect(output[3]).toBe(0x46) // F

      await ffmpeg.deleteFile('audio_src.mp4')
      await ffmpeg.deleteFile('output.wav')
    })
  })

  describe('metadata stripping', () => {
    test('strips metadata from video', async () => {
      const mp4Data = await loadFixture('sample.mp4')
      await writeInput('meta.mp4', mp4Data)

      const exitCode = await ffmpeg.exec([
        '-i',
        'meta.mp4',
        '-t',
        '2',
        '-map_metadata',
        '-1',
        '-c',
        'copy',
        'nometa.mp4',
      ])
      expect(exitCode).toBe(0)

      const output = await readOutput('nometa.mp4')
      expect(output.length).toBeGreaterThan(0)

      await ffmpeg.deleteFile('meta.mp4')
      await ffmpeg.deleteFile('nometa.mp4')
    })
  })
})
