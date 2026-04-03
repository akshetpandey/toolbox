import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

// Mock the loadFFmpeg import used by FFmpegProcessor.reloadFFmpeg
vi.mock('@/hooks/useInitFFmpeg', () => ({
  loadFFmpeg: vi.fn().mockResolvedValue(undefined),
}))

import { FFmpegProcessor, type VideoFile } from '../ffmpeg'

// ─── Mock FFmpeg Instance ────────────────────────────────────────────────────

function createMockFFmpeg() {
  return {
    createDir: vi.fn().mockResolvedValue(undefined),
    mount: vi.fn().mockResolvedValue(undefined),
    unmount: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue(0),
    ffprobe: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(new Uint8Array([0x00, 0x00, 0x00])),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(),
    on: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
  } as unknown as FFmpeg
}

function createVideoFile(overrides?: Partial<VideoFile>): VideoFile {
  return {
    file: new File([new Uint8Array(100)], 'video.mp4', { type: 'video/mp4' }),
    preview: 'blob:preview',
    name: 'video.mp4',
    size: 100,
    type: 'video/mp4',
    duration: 30,
    dimensions: { width: 1920, height: 1080 },
    ...overrides,
  }
}

let ffmpeg: ReturnType<typeof createMockFFmpeg>
let processor: FFmpegProcessor

beforeEach(() => {
  vi.clearAllMocks()
  ffmpeg = createMockFFmpeg()
  processor = new FFmpegProcessor(ffmpeg)
})

// ─── mountInputFile / unmountInputFile ───────────────────────────────────────

describe('FFmpegProcessor.mountInputFile', () => {
  test('creates input directory and mounts file', async () => {
    const videoFile = createVideoFile()
    await processor.mountInputFile(videoFile)

    expect(ffmpeg.createDir).toHaveBeenCalledWith('/input')
    expect(ffmpeg.mount).toHaveBeenCalledWith(
      'WORKERFS',
      { files: [videoFile.file] },
      '/input',
    )
  })

  test('only creates directory once for multiple mounts', async () => {
    const videoFile = createVideoFile()
    await processor.mountInputFile(videoFile)
    await processor.mountInputFile(createVideoFile({ name: 'second.mp4' }))

    expect(ffmpeg.createDir).toHaveBeenCalledTimes(1)
  })

  test('stores the input file reference', async () => {
    const videoFile = createVideoFile()
    await processor.mountInputFile(videoFile)

    expect(processor.inputFile).toBe(videoFile)
  })
})

describe('FFmpegProcessor.unmountInputFile', () => {
  test('does nothing when no file is mounted', async () => {
    await processor.unmountInputFile()
    expect(ffmpeg.unmount).not.toHaveBeenCalled()
  })

  test('unmounts the mounted file', async () => {
    const videoFile = createVideoFile()
    await processor.mountInputFile(videoFile)
    await processor.unmountInputFile()

    expect(ffmpeg.unmount).toHaveBeenCalledWith('/input/video.mp4')
    expect(processor.inputFile).toBeNull()
  })
})

// ─── extractMetadata ─────────────────────────────────────────────────────────

describe('FFmpegProcessor.extractMetadata', () => {
  const probeOutput = {
    format: {
      filename: 'video.mp4',
      format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
      format_long_name: 'QuickTime / MOV',
      duration: '30.5',
      size: '5242880',
      bit_rate: '1375000',
      nb_streams: 2,
    },
    streams: [
      {
        index: 0,
        codec_type: 'video',
        codec_name: 'h264',
        codec_long_name: 'H.264 / AVC',
        width: 1920,
        height: 1080,
        r_frame_rate: '30/1',
        avg_frame_rate: '30/1',
        pix_fmt: 'yuv420p',
      },
      {
        index: 1,
        codec_type: 'audio',
        codec_name: 'aac',
        codec_long_name: 'AAC (Advanced Audio Coding)',
        sample_rate: 44100,
        channels: 2,
        channel_layout: 'stereo',
      },
    ],
  }

  beforeEach(async () => {
    const encoded = new TextEncoder().encode(JSON.stringify(probeOutput))
    vi.mocked(ffmpeg.readFile).mockResolvedValue(encoded)
    await processor.mountInputFile(createVideoFile())
  })

  test('returns parsed video metadata', async () => {
    const meta = await processor.extractMetadata()

    expect(meta.format.filename).toBe('video.mp4')
    expect(meta.format.duration).toBeCloseTo(30.5)
    expect(meta.format.bit_rate).toBe(1375000)
    expect(meta.format.nb_streams).toBe(2)
    expect(meta.duration).toBeCloseTo(30.5)
  })

  test('extracts video stream info', async () => {
    const meta = await processor.extractMetadata()

    expect(meta.video_streams).toHaveLength(1)
    expect(meta.video_streams[0].codec_name).toBe('h264')
    expect(meta.video_streams[0].width).toBe(1920)
    expect(meta.video_streams[0].height).toBe(1080)
    expect(meta.video_streams[0].fps).toBe(30)
    expect(meta.width).toBe(1920)
    expect(meta.height).toBe(1080)
  })

  test('extracts audio stream info', async () => {
    const meta = await processor.extractMetadata()

    expect(meta.audio_streams).toHaveLength(1)
    expect(meta.audio_streams[0].codec_name).toBe('aac')
    expect(meta.audio_streams[0].sample_rate).toBe(44100)
    expect(meta.audio_streams[0].channels).toBe(2)
  })

  test('calls ffprobe with correct arguments', async () => {
    await processor.extractMetadata()

    expect(ffmpeg.ffprobe).toHaveBeenCalledWith([
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '/input/video.mp4',
      '-o', 'metadata.json',
    ])
  })

  test('cleans up temporary metadata.json file', async () => {
    await processor.extractMetadata()
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith('metadata.json')
  })

  test('returns fallback metadata on error', async () => {
    vi.mocked(ffmpeg.ffprobe).mockRejectedValue(new Error('ffprobe failed'))

    const meta = await processor.extractMetadata()

    expect(meta.format.filename).toBe('video.mp4')
    expect(meta.video_streams).toEqual([])
    expect(meta.codec).toBe('Unknown')
  })

  test('handles subtitle streams', async () => {
    const withSubs = {
      ...probeOutput,
      streams: [
        ...probeOutput.streams,
        {
          index: 2,
          codec_type: 'subtitle',
          codec_name: 'srt',
          codec_long_name: 'SubRip subtitle',
          tags: { language: 'eng', title: 'English' },
          disposition: { default: 1, forced: 0 },
        },
      ],
    }
    vi.mocked(ffmpeg.readFile).mockResolvedValue(
      new TextEncoder().encode(JSON.stringify(withSubs)),
    )

    const meta = await processor.extractMetadata()

    expect(meta.subtitle_streams).toHaveLength(1)
    expect(meta.subtitle_streams[0].codec_name).toBe('srt')
    expect(meta.subtitle_streams[0].language).toBe('eng')
    expect(meta.subtitle_streams[0].is_default).toBe(true)
  })
})

// ─── convertVideo ────────────────────────────────────────────────────────────

describe('FFmpegProcessor.convertVideo', () => {
  beforeEach(async () => {
    // Need metadata mock for getCurrentVideoCodec / getCurrentAudioCodec
    const probeOutput = {
      format: { duration: '10', bit_rate: '1000000' },
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1', avg_frame_rate: '30/1' },
        { codec_type: 'audio', codec_name: 'aac', sample_rate: 44100, channels: 2 },
      ],
    }
    vi.mocked(ffmpeg.readFile).mockResolvedValue(
      new TextEncoder().encode(JSON.stringify(probeOutput)),
    )
    await processor.mountInputFile(createVideoFile())
  })

  test('converts video with specified codecs', async () => {
    const blob = await processor.convertVideo({
      targetFormat: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      preset: 'medium',
    })

    expect(ffmpeg.exec).toHaveBeenCalled()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('video/mp4')
  })

  test('uses stream copy when codec matches', async () => {
    await processor.convertVideo({
      targetFormat: 'mp4',
      videoCodec: 'libx264', // matches current h264 -> libx264
      audioCodec: 'aac', // matches current aac
      preset: 'medium',
    })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    // Should use copy for video since h264 maps to libx264
    expect(execCall).toContain('-c:v')
    expect(execCall).toContain('copy')
  })

  test('applies downscaling filter when enabled', async () => {
    await processor.convertVideo({
      targetFormat: 'mp4',
      videoCodec: 'libx265', // different codec, won't stream copy
      audioCodec: 'aac',
      preset: 'medium',
      downscale: {
        enabled: true,
        resolution: '1280x720',
        maintainAspectRatio: true,
      },
    })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-vf')
    const vfIndex = execCall.indexOf('-vf')
    expect(execCall[vfIndex + 1]).toContain('1280')
    expect(execCall[vfIndex + 1]).toContain('720')
  })

  test('applies custom downscale dimensions', async () => {
    await processor.convertVideo({
      targetFormat: 'mp4',
      videoCodec: 'libx265',
      audioCodec: 'aac',
      preset: 'fast',
      downscale: {
        enabled: true,
        customWidth: 640,
        customHeight: 480,
      },
    })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-vf')
    const vfIndex = execCall.indexOf('-vf')
    expect(execCall[vfIndex + 1]).toContain('640')
    expect(execCall[vfIndex + 1]).toContain('480')
  })

  test('deletes output file after reading', async () => {
    await processor.convertVideo({
      targetFormat: 'webm',
      videoCodec: 'libvpx-vp9',
      audioCodec: 'libopus',
      preset: 'medium',
    })

    expect(ffmpeg.deleteFile).toHaveBeenCalledWith('output.webm')
  })

  test('reloads FFmpeg and rethrows on exec failure', async () => {
    vi.mocked(ffmpeg.exec).mockRejectedValue(new Error('Conversion failed'))

    await expect(
      processor.convertVideo({
        targetFormat: 'mp4',
        videoCodec: 'libx264',
        audioCodec: 'aac',
        preset: 'medium',
      }),
    ).rejects.toThrow('Conversion failed')

    expect(ffmpeg.terminate).toHaveBeenCalled()
  })
})

// ─── compressVideo ───────────────────────────────────────────────────────────

describe('FFmpegProcessor.compressVideo', () => {
  beforeEach(async () => {
    await processor.mountInputFile(createVideoFile())
  })

  test('compresses with CRF and preset', async () => {
    const blob = await processor.compressVideo({ crf: 28, preset: 'fast' })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-crf')
    expect(execCall).toContain('28')
    expect(execCall).toContain('-preset')
    expect(execCall).toContain('fast')
    expect(blob).toBeInstanceOf(Blob)
  })

  test('uses libx264 video codec and aac audio', async () => {
    await processor.compressVideo({ crf: 23, preset: 'medium' })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('libx264')
    expect(execCall).toContain('aac')
  })

  test('produces output with correct MIME type', async () => {
    const blob = await processor.compressVideo({ crf: 23, preset: 'medium' })
    expect(blob.type).toBe('video/mp4')
  })

  test('rethrows on exec failure', async () => {
    vi.mocked(ffmpeg.exec).mockRejectedValue(new Error('OOM'))

    await expect(
      processor.compressVideo({ crf: 23, preset: 'medium' }),
    ).rejects.toThrow('OOM')
  })
})

// ─── trimVideo ───────────────────────────────────────────────────────────────

describe('FFmpegProcessor.trimVideo', () => {
  beforeEach(async () => {
    await processor.mountInputFile(createVideoFile())
  })

  test('trims with start and end time using stream copy', async () => {
    const blob = await processor.trimVideo({
      startTime: '00:00:05',
      endTime: '00:00:15',
    })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-ss')
    expect(execCall).toContain('00:00:05')
    expect(execCall).toContain('-to')
    expect(execCall).toContain('00:00:15')
    expect(execCall).toContain('-c')
    expect(execCall).toContain('copy')
    expect(blob).toBeInstanceOf(Blob)
  })

  test('trims to GIF format with loop', async () => {
    await processor.trimVideo({
      startTime: '00:00:00',
      endTime: '00:00:03',
      format: 'gif',
      loop: true,
    })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-c:v')
    expect(execCall).toContain('gif')
    expect(execCall).toContain('-loop')
    expect(execCall).toContain('0')
    expect(execCall).toContain('-f')
    expect(execCall).toContain('gif')
  })

  test('trims to WebP format with loop', async () => {
    await processor.trimVideo({
      startTime: '00:00:00',
      endTime: '00:00:02',
      format: 'webp',
      loop: true,
    })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('libwebp')
    expect(execCall).toContain('-loop')
    expect(execCall).toContain('0')
    expect(execCall).toContain('-f')
    expect(execCall).toContain('webp')
  })

  test('cleans up output file', async () => {
    await processor.trimVideo({
      startTime: '00:00:00',
      endTime: '00:00:05',
    })

    expect(ffmpeg.deleteFile).toHaveBeenCalledWith(
      expect.stringContaining('trimmed'),
    )
  })
})

// ─── extractAudio ────────────────────────────────────────────────────────────

describe('FFmpegProcessor.extractAudio', () => {
  beforeEach(async () => {
    await processor.mountInputFile(createVideoFile())
  })

  test('extracts audio as MP3', async () => {
    const blob = await processor.extractAudio({ audioFormat: 'mp3' })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-vn')
    expect(execCall).toContain('libmp3lame')
    expect(execCall).toContain('-ab')
    expect(execCall).toContain('192k')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('audio/mp3')
  })

  test('extracts audio as WAV', async () => {
    const blob = await processor.extractAudio({ audioFormat: 'wav' })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-vn')
    expect(execCall).toContain('pcm_s16le')
    expect(blob.type).toBe('audio/wav')
  })

  test('extracts audio as AAC', async () => {
    const blob = await processor.extractAudio({ audioFormat: 'aac' })

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-vn')
    expect(execCall).toContain('aac')
    expect(blob.type).toBe('audio/aac')
  })

  test('throws for unsupported audio format', async () => {
    await expect(
      processor.extractAudio({ audioFormat: 'flac' }),
    ).rejects.toThrow('Unsupported audio format')
  })
})

// ─── stripMetadata ───────────────────────────────────────────────────────────

describe('FFmpegProcessor.stripMetadata', () => {
  beforeEach(async () => {
    await processor.mountInputFile(createVideoFile())
  })

  test('strips metadata using map_metadata flag', async () => {
    const blob = await processor.stripMetadata()

    const execCall = vi.mocked(ffmpeg.exec).mock.calls[0][0]
    expect(execCall).toContain('-map_metadata')
    expect(execCall).toContain('-1')
    expect(execCall).toContain('-c')
    expect(execCall).toContain('copy')
    expect(blob).toBeInstanceOf(Blob)
  })

  test('preserves original MIME type', async () => {
    const blob = await processor.stripMetadata()
    expect(blob.type).toBe('video/mp4')
  })

  test('cleans up output file', async () => {
    await processor.stripMetadata()
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith('stripped.mp4')
  })
})
