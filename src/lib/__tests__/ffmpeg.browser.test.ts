/**
 * E2E tests for the @ffmpeg/ffmpeg WASM package running in a real browser.
 * Uses vitest browser mode (Playwright) because @ffmpeg/ffmpeg explicitly
 * blocks Node.js imports and requires Web Workers + SharedArrayBuffer.
 *
 * Run with: pnpm vitest --config vitest.browser.config.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { FFmpegProcessor, type VideoFile } from '../ffmpeg'
import { convertAudio, joinAudio, joinVideos } from '../media'

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

  // Load WASM files from the local @ffmpeg/core-mt package.
  // Served by the ffmpegCorePlugin in vitest.browser.config.ts.
  const baseURL = '/ffmpeg-core'
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

describe('FFmpegProcessor with real WASM', () => {
  async function fixtureVideo(name: string): Promise<VideoFile> {
    const type = name.endsWith('.webm') ? 'video/webm' : 'video/mp4'
    const file = new File([(await loadFixture(name)).slice()], name, { type })
    return { file, name, type, size: file.size, preview: '' }
  }

  test('replaces WORKERFS input and reuses the worker after a layout remount', async () => {
    const processor = new FFmpegProcessor(ffmpeg)
    const nextProcessor = new FFmpegProcessor(ffmpeg)
    try {
      await processor.mountInputFile(await fixtureVideo('sample.mp4'))
      await processor.mountInputFile(await fixtureVideo('sample.webm'))
      expect(
        (await processor.extractMetadata()).video_streams[0].codec_name,
      ).toBe('vp8')
      await nextProcessor.mountInputFile(await fixtureVideo('sample.mp4'))
      expect(processor.inputFile).toBeNull()
      await processor.unmountInputFile()
      expect(
        (await nextProcessor.extractMetadata()).video_streams[0].codec_name,
      ).toBe('h264')
    } finally {
      await nextProcessor.unmountInputFile()
      await processor.unmountInputFile()
    }
  })

  test('compresses WebM to a readable MP4 with matching MIME and codecs', async () => {
    const processor = new FFmpegProcessor(ffmpeg)
    try {
      await processor.mountInputFile(await fixtureVideo('sample.webm'))
      const blob = await processor.compressVideo({
        crf: 28,
        preset: 'ultrafast',
      })
      expect(blob.type).toBe('video/mp4')
      const bytes = new Uint8Array(await blob.arrayBuffer())
      expect(new TextDecoder().decode(bytes.slice(4, 8))).toBe('ftyp')
      const file = new File([blob], 'compressed.mp4', { type: blob.type })
      await processor.mountInputFile({
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        preview: '',
      })
      const metadata = await processor.extractMetadata()
      expect(metadata.video_streams[0].codec_name).toBe('h264')
      expect(metadata.audio_streams[0].codec_name).toBe('aac')
      expect(metadata.duration).toBeGreaterThan(0)
    } finally {
      await processor.unmountInputFile()
    }
  })

  test('rejects a failed encoder instead of returning a partial download', async () => {
    const processor = new FFmpegProcessor(ffmpeg)
    try {
      const file = new File(['invalid video bytes'], 'broken.mp4', {
        type: 'video/mp4',
      })
      await processor.mountInputFile({
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        preview: '',
      })
      await expect(
        processor.compressVideo({ crf: 28, preset: 'ultrafast' }),
      ).rejects.toThrow('FFmpeg exited with code')
      await processor.mountInputFile(await fixtureVideo('sample.mp4'))
      expect(
        (await processor.extractMetadata()).video_streams[0].codec_name,
      ).toBe('h264')
    } finally {
      await processor.unmountInputFile()
    }
  })

  test('encodes a playable MP4 and verifies the requested byte limit', async () => {
    const processor = new FFmpegProcessor(ffmpeg)
    const signal = new AbortController().signal
    try {
      await processor.mountInputFile(await fixtureVideo('sample.webm'))
      const maxBytes = 45_000
      const result = await processor.compressToSize(maxBytes, signal)
      expect(result.type).toBe('video/mp4')
      expect(result.size).toBeLessThanOrEqual(maxBytes)
      const file = new File([result], 'target.mp4', { type: result.type })
      await processor.mountInputFile({
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        preview: '',
      })
      const metadata = await processor.extractMetadata()
      expect(metadata.video_streams[0].codec_name).toBe('h264')
      expect(metadata.audio_streams[0].codec_name).toBe('aac')
    } finally {
      await processor.unmountInputFile()
    }
  })

  test('cancels target-size encoding and can retry with the same mounted video', async () => {
    const processor = new FFmpegProcessor(ffmpeg)
    const controller = new AbortController()
    const abortOnProgress = () => controller.abort()
    try {
      await processor.mountInputFile(await fixtureVideo('sample.webm'))
      ffmpeg.on('progress', abortOnProgress)
      await expect(
        processor.compressToSize(45_000, controller.signal),
      ).rejects.toThrow(/aborted/i)
      ffmpeg.off('progress', abortOnProgress)
      const retried = await processor.compressToSize(
        45_000,
        new AbortController().signal,
      )
      expect(retried.size).toBeLessThanOrEqual(45_000)
    } finally {
      ffmpeg.off('progress', abortOnProgress)
      await processor.unmountInputFile()
    }
  })

  test('releases the old video when leaving during target-size encoding', async () => {
    const processor = new FFmpegProcessor(ffmpeg)
    const controller = new AbortController()
    let unmounting: Promise<void> | undefined
    const leave = () => {
      if (!unmounting) {
        unmounting = processor.unmountInputFile()
        controller.abort()
      }
    }
    try {
      await processor.mountInputFile(await fixtureVideo('sample.webm'))
      ffmpeg.on('progress', leave)
      await expect(
        processor.compressToSize(45_000, controller.signal),
      ).rejects.toThrow(/aborted/i)
      expect(unmounting).toBeDefined()
      await unmounting
      expect(processor.inputFile).toBeNull()
    } finally {
      ffmpeg.off('progress', leave)
      await processor.unmountInputFile()
    }
  })

  test('joins mixed video containers including clips without an audio track', async () => {
    const signal = new AbortController().signal
    const mp4 = await fixtureVideo('sample.mp4')
    await writeInput(
      'with-sound.mp4',
      new Uint8Array(await mp4.file.arrayBuffer()),
    )
    expect(
      await ffmpeg.exec([
        '-i',
        'with-sound.mp4',
        '-t',
        '0.5',
        '-c:v',
        'copy',
        '-an',
        'silent.mp4',
      ]),
    ).toBe(0)
    const silent = new File(
      [(await readOutput('silent.mp4')).slice()],
      'same-name.mp4',
    )
    await ffmpeg.deleteFile('with-sound.mp4')
    await ffmpeg.deleteFile('silent.mp4')
    const webm = await fixtureVideo('sample.webm')
    const blob = await joinVideos(
      [silent, new File([webm.file], silent.name)],
      signal,
    )
    const processor = new FFmpegProcessor(ffmpeg)
    const file = new File([blob], 'joined.mp4', { type: blob.type })
    try {
      await processor.mountInputFile({
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        preview: '',
      })
      const metadata = await processor.extractMetadata()
      expect(metadata.video_streams[0].codec_name).toBe('h264')
      expect(metadata.audio_streams[0].codec_name).toBe('aac')
      expect(metadata.duration).toBeGreaterThan(1)
    } finally {
      await processor.unmountInputFile()
    }
  })

  test('converts WAV to MP3, trims M4A, and joins audio-only files', async () => {
    const signal = new AbortController().signal
    await writeInput('audio-fixture.mp4', await loadFixture('sample.mp4'))
    expect(
      await ffmpeg.exec([
        '-i',
        'audio-fixture.mp4',
        '-t',
        '0.5',
        '-vn',
        'fixture.wav',
        '-t',
        '0.5',
        '-vn',
        'fixture.m4a',
      ]),
    ).toBe(0)
    const wav = new File(
      [(await readOutput('fixture.wav')).slice()],
      'fixture.wav',
    )
    const m4a = new File(
      [(await readOutput('fixture.m4a')).slice()],
      'fixture.m4a',
    )
    for (const file of ['audio-fixture.mp4', 'fixture.wav', 'fixture.m4a'])
      await ffmpeg.deleteFile(file)
    const mp3 = await convertAudio(wav, 'mp3', signal)
    expect(mp3.type).toBe('audio/mpeg')
    expect(new TextDecoder().decode(await mp3.slice(0, 3).arrayBuffer())).toBe(
      'ID3',
    )
    const clip = await convertAudio(m4a, 'wav', signal, {
      start: 0.1,
      end: 0.3,
    })
    const joined = await joinAudio([wav, m4a], 'wav', signal)
    expect(new TextDecoder().decode(await clip.slice(0, 4).arrayBuffer())).toBe(
      'RIFF',
    )
    expect(joined.size).toBeGreaterThan(clip.size * 4)
  })
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
