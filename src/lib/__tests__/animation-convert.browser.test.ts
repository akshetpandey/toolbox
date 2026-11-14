import { afterAll, beforeAll, expect, test } from 'vitest'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { loadFFmpeg } from '@/hooks/useInitFFmpeg'
import { FFmpegProcessor, type VideoFile } from '../ffmpeg'
import { readAnimationInfo } from '../animation'

let ffmpeg: FFmpeg
let source: VideoFile

beforeAll(async () => {
  ffmpeg = new FFmpeg()
  await loadFFmpeg(ffmpeg)
  const bytes = await (
    await fetch(new URL('./fixtures/sample.mp4', import.meta.url))
  ).arrayBuffer()
  const file = new File([bytes], 'sample.mp4', { type: 'video/mp4' })
  source = {
    file,
    preview: '',
    name: file.name,
    type: file.type,
    size: file.size,
  }
}, 120_000)
afterAll(() => ffmpeg?.terminate())

async function frames(blob: Blob) {
  await ffmpeg.writeFile(
    'inspect-animation',
    new Uint8Array(await blob.arrayBuffer()),
  )
  try {
    expect(
      await ffmpeg.exec(
        [
          '-threads',
          '1',
          '-i',
          'inspect-animation',
          '-threads',
          '1',
          '-filter_threads',
          '1',
          '-vf',
          'scale=8:8',
          '-pix_fmt',
          'rgba',
          '-f',
          'rawvideo',
          'decoded-animation.raw',
        ],
        20_000,
      ),
    ).toBe(0)
    const data = (await ffmpeg.readFile('decoded-animation.raw')) as Uint8Array
    const count = data.length / (8 * 8 * 4)
    expect(Number.isInteger(count)).toBe(true)
    expect(count).toBeGreaterThan(1)
    expect([...data.slice(0, 256)]).not.toEqual([...data.slice(-256)])
    return count
  } finally {
    await ffmpeg.deleteFile('inspect-animation')
    await ffmpeg.deleteFile('decoded-animation.raw').catch(() => undefined)
  }
}

test.each(
  (['gif', 'apng', 'webp'] as const).flatMap((format) =>
    [true, false].map((loop) => ({ format, loop })),
  ),
)(
  'exports $format with loop=$loop and retains animation frames',
  async ({ format, loop }) => {
    const processor = new FFmpegProcessor(ffmpeg)
    try {
      await processor.mountInputFile(source)
      const result = await processor.convertVideo({
        targetFormat: format,
        videoCodec: 'libx264',
        audioCodec: 'aac',
        preset: 'ultrafast',
        animation: { fps: 5, loop },
        downscale: { enabled: true, customWidth: 32, customHeight: 24 },
      })
      expect(result.type).toBe(`image/${format}`)
      expect(result.size).toBeGreaterThan(100)
      const bytes = new Uint8Array(await result.arrayBuffer())
      const view = new DataView(bytes.buffer)
      const text = new TextDecoder().decode(bytes)
      if (format === 'gif') expect(text.includes('NETSCAPE2.0')).toBe(loop)
      if (format === 'apng') {
        let plays: number | undefined
        for (
          let offset = 8;
          offset + 12 <= bytes.length;
          offset += view.getUint32(offset) + 12
        ) {
          if (
            new TextDecoder().decode(bytes.slice(offset + 4, offset + 8)) ===
            'acTL'
          )
            plays = view.getUint32(offset + 12)
        }
        expect(plays).toBe(loop ? 0 : 1)
        await expect(
          readAnimationInfo(result.slice(0, result.size - 8)),
        ).rejects.toThrow('missing frames')
      }
      if (format !== 'webp') {
        await frames(result)
        const info = await readAnimationInfo(result)
        expect(info?.format).toBe(format)
        expect(info?.width).toBe(32)
        expect(info?.height).toBe(24)
        const file = new File(
          [result],
          format === 'apng' ? 'animation.png' : 'animation.gif',
          { type: result.type },
        )
        await processor.mountInputFile({
          file,
          name: file.name,
          type: file.type,
          size: file.size,
          preview: '',
          animation: info ?? undefined,
        })
        const metadata = await processor.extractMetadata()
        expect(metadata.duration).toBeGreaterThan(0)
        const video = await processor.convertVideo({
          targetFormat: 'mp4',
          videoCodec: 'libx264',
          audioCodec: 'aac',
          preset: 'ultrafast',
        })
        expect(video.type).toBe('video/mp4')
        await frames(video)
      } else {
        const data = new Uint8Array(await result.arrayBuffer())
        expect(new TextDecoder().decode(data.slice(0, 4))).toBe('RIFF')
        expect(new TextDecoder().decode(data)).toContain('ANIM')
        let repeats: number | undefined
        for (let offset = 12; offset + 8 <= bytes.length;) {
          const length = view.getUint32(offset + 4, true)
          if (
            new TextDecoder().decode(bytes.slice(offset, offset + 4)) === 'ANIM'
          )
            repeats = view.getUint16(offset + 12, true)
          offset += length + 8 + (length % 2)
        }
        expect(repeats).toBe(loop ? 0 : 1)
      }
    } finally {
      await processor.unmountInputFile()
    }
  },
  120_000,
)
