import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { loadFFmpeg } from '@/hooks/useInitFFmpeg'

const audioFormats = {
  mp3: { mime: 'audio/mpeg', args: ['-c:a', 'libmp3lame', '-b:a', '192k'] },
  m4a: { mime: 'audio/mp4', args: ['-c:a', 'aac', '-b:a', '192k'] },
  wav: { mime: 'audio/wav', args: ['-c:a', 'pcm_s16le'] },
} as const

export type AudioFormat = keyof typeof audioFormats

interface MediaInfo {
  format?: { duration?: string }
  streams?: {
    codec_type?: string
    duration?: string
    width?: number
    height?: number
    disposition?: { attached_pic?: number }
    side_data_list?: { rotation?: number }[]
  }[]
}

export class MediaInputError extends Error {}

async function execute(ffmpeg: FFmpeg, args: string[], signal: AbortSignal) {
  signal.throwIfAborted()
  const exitCode = await ffmpeg.exec(args, -1, { signal })
  signal.throwIfAborted()
  if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}`)
}

async function readOutput(ffmpeg: FFmpeg, path: string, signal: AbortSignal) {
  signal.throwIfAborted()
  const data = await ffmpeg.readFile(path, 'binary', { signal })
  signal.throwIfAborted()
  if (!(data instanceof Uint8Array) || !data.byteLength)
    throw new Error('FFmpeg returned an empty output.')
  return data
}

function asBlob(data: Uint8Array, type: string) {
  const buffer = data.buffer
  if (buffer instanceof ArrayBuffer)
    return new Blob(
      [new Uint8Array(buffer, data.byteOffset, data.byteLength)],
      {
        type,
      },
    )
  return new Blob([data.slice()], { type })
}

async function probe(ffmpeg: FFmpeg, path: string, signal: AbortSignal) {
  signal.throwIfAborted()
  const probePath = 'media-probe.json'
  try {
    // core-mt's FFprobe may return -1 after a successful probe.
    await ffmpeg.ffprobe(
      [
        '-v',
        'quiet',
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        '-o',
        probePath,
        path,
      ],
      -1,
      { signal },
    )
    return JSON.parse(
      new TextDecoder().decode(await readOutput(ffmpeg, probePath, signal)),
    ) as MediaInfo
  } catch (error) {
    signal.throwIfAborted()
    throw new MediaInputError(
      'This file could not be read. Choose another file.',
      {
        cause: error,
      },
    )
  } finally {
    if (!signal.aborted)
      await ffmpeg.deleteFile(probePath).catch(() => {
        // A failed probe may leave no file behind.
      })
  }
}

function primaryVideo(info: MediaInfo) {
  return info.streams?.find(
    (stream) =>
      stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1,
  )
}

async function withMediaFiles(
  files: readonly File[],
  signal: AbortSignal,
  run: (ffmpeg: FFmpeg, inputs: string[]) => Promise<Blob>,
) {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  signal.throwIfAborted()
  const ffmpeg = new FFmpeg()
  const stop = () => ffmpeg.terminate()
  signal.addEventListener('abort', stop, { once: true })
  try {
    await loadFFmpeg(ffmpeg, signal)
    signal.throwIfAborted()
    await ffmpeg.createDir('/inputs')
    // Use generated names so repeated names or user-supplied path characters
    // cannot affect the command. FFmpeg probes the file bytes for its format.
    const blobs = files.map((data, index) => ({ name: String(index), data }))
    await ffmpeg.mount(
      // @ts-expect-error WORKERFS is an enum but also accepts its string value.
      'WORKERFS',
      { blobs },
      '/inputs',
    )
    return await run(
      ffmpeg,
      blobs.map(({ name }) => '/inputs/' + name),
    )
  } catch (error) {
    signal.throwIfAborted()
    throw error
  } finally {
    signal.removeEventListener('abort', stop)
    ffmpeg.terminate()
  }
}

export function convertAudio(
  file: File,
  format: AudioFormat,
  signal: AbortSignal,
  range?: { start: number; end?: number },
) {
  return withMediaFiles([file], signal, async (ffmpeg, [input]) => {
    const info = await probe(ffmpeg, input, signal)
    const audio = info.streams?.find((stream) => stream.codec_type === 'audio')
    if (!audio) throw new MediaInputError('This file has no audio track.')
    const output = `output.${format}`
    const args = ['-i', input, '-map', '0:a:0']
    if (range) {
      const { start, end } = range
      const duration = Number(audio.duration ?? info.format?.duration)
      if (
        !Number.isFinite(start) ||
        start < 0 ||
        (end !== undefined && (!Number.isFinite(end) || end <= start)) ||
        (Number.isFinite(duration) &&
          (start >= duration || (end !== undefined && end > duration + 0.01)))
      ) {
        throw new MediaInputError('Choose a time range within the audio file.')
      }
      args.push('-ss', String(start))
      if (end !== undefined) args.push('-t', String(end - start))
    }
    await execute(
      ffmpeg,
      [...args, ...audioFormats[format].args, output],
      signal,
    )
    return asBlob(
      await readOutput(ffmpeg, output, signal),
      audioFormats[format].mime,
    )
  })
}

export function joinAudio(
  files: readonly File[],
  format: AudioFormat,
  signal: AbortSignal,
) {
  return withMediaFiles(files, signal, async (ffmpeg, inputs) => {
    const filters = inputs.map(
      (_, index) =>
        `[${index}:a:0]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${index}]`,
    )
    const tracks = inputs.map((_, index) => `[a${index}]`).join('')
    const output = `joined.${format}`
    await execute(
      ffmpeg,
      [
        ...inputs.flatMap((input) => ['-i', input]),
        '-filter_complex_threads',
        '2',
        '-filter_complex',
        [...filters, `${tracks}concat=n=${inputs.length}:v=0:a=1[a]`].join(';'),
        '-map',
        '[a]',
        ...audioFormats[format].args,
        output,
      ],
      signal,
    )
    return asBlob(
      await readOutput(ffmpeg, output, signal),
      audioFormats[format].mime,
    )
  })
}

export function joinVideos(files: readonly File[], signal: AbortSignal) {
  return withMediaFiles(files, signal, async (ffmpeg, inputs) => {
    let frameSize: string | undefined
    const segments: string[] = []
    for (const [index, input] of inputs.entries()) {
      const info = await probe(ffmpeg, input, signal)
      const video = primaryVideo(info)
      if (!video?.width || !video.height)
        throw new MediaInputError(
          `Clip ${index + 1} has no readable video track.`,
        )
      if (!frameSize) {
        const rotation = video.side_data_list?.find(
          (item) => item.rotation,
        )?.rotation
        const sideways = Math.abs(rotation ?? 0) % 180 === 90
        const width = sideways ? video.height : video.width
        const height = sideways ? video.width : video.height
        frameSize =
          width === height
            ? '720:720'
            : width < height
              ? '720:1280'
              : '1280:720'
      }
      const hasAudio = info.streams?.some(
        (stream) => stream.codec_type === 'audio',
      )
      const segment = `segment-${index}.mp4`
      // Normalize one clip at a time to bound decoder memory. Matching tracks
      // let the final concat demuxer assemble them without encoding again.
      await execute(
        ffmpeg,
        [
          '-i',
          input,
          ...(hasAudio
            ? []
            : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']),
          '-map',
          '0:V:0',
          '-map',
          hasAudio ? '0:a:0' : '1:a:0',
          '-filter_threads',
          '2',
          '-vf',
          `scale=${frameSize}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${frameSize}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`,
          '-af',
          'aresample=async=1:first_pts=0,apad',
          '-shortest',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-crf',
          '23',
          '-preset',
          'veryfast',
          '-threads',
          '2',
          '-c:a',
          'aac',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-map_metadata',
          '-1',
          segment,
        ],
        signal,
      )
      segments.push(segment)
    }
    await ffmpeg.writeFile(
      'segments.txt',
      segments.map((segment) => `file '${segment}'\n`).join(''),
    )
    const output = 'joined.mp4'
    await execute(
      ffmpeg,
      [
        '-f',
        'concat',
        '-i',
        'segments.txt',
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        output,
      ],
      signal,
    )
    return asBlob(await readOutput(ffmpeg, output, signal), 'video/mp4')
  })
}

export async function compressVideoToSize(
  ffmpeg: FFmpeg,
  input: string,
  maxBytes: number,
  signal: AbortSignal,
) {
  const info = await probe(ffmpeg, input, signal)
  const video = primaryVideo(info)
  const duration = Math.max(
    Number(video?.duration) || 0,
    Number(info.format?.duration) || 0,
  )
  if (!video || !Number.isFinite(duration) || duration <= 0)
    throw new MediaInputError(
      'A readable video with a known duration is required.',
    )

  const hasAudio = info.streams?.some((stream) => stream.codec_type === 'audio')
  // Allow room for MP4 overhead and differences between requested and actual
  // rates. The byte check after encoding is authoritative.
  const totalKbps = ((maxBytes * 0.94 - 8192) * 8) / duration / 1000
  const audioKbps = hasAudio
    ? Math.min(128, Math.max(32, Math.floor(totalKbps / 5)))
    : 0
  let videoKbps = Math.min(25_000, Math.floor(totalKbps - audioKbps))
  const output = 'target-compressed.mp4'
  const passLog = 'target-pass'
  try {
    for (let attempt = 0; attempt < 3 && videoKbps >= 24; attempt++) {
      const maxSide =
        videoKbps < 150
          ? 320
          : videoKbps < 400
            ? 640
            : videoKbps < 900
              ? 960
              : 1920
      const args = [
        '-i',
        input,
        '-map',
        '0:V:0',
        '-filter_threads',
        '2',
        '-vf',
        `scale=w='min(iw,${maxSide})':h='min(ih,${maxSide})':force_original_aspect_ratio=decrease:force_divisible_by=2`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-b:v',
        `${videoKbps}k`,
        '-preset',
        'veryfast',
        '-threads',
        '2',
        '-passlogfile',
        passLog,
      ]
      await execute(
        ffmpeg,
        [...args, '-pass', '1', '-an', '-f', 'null', '-'],
        signal,
      )
      await execute(
        ffmpeg,
        [
          ...args,
          '-pass',
          '2',
          ...(hasAudio
            ? ['-map', '0:a:0', '-c:a', 'aac', '-b:a', `${audioKbps}k`]
            : []),
          '-movflags',
          '+faststart',
          output,
        ],
        signal,
      )
      const data = await readOutput(ffmpeg, output, signal)
      if (data.byteLength <= maxBytes) return asBlob(data, 'video/mp4')
      await ffmpeg.deleteFile(output)
      videoKbps = Math.floor(videoKbps * (maxBytes / data.byteLength) * 0.88)
    }
  } finally {
    if (!signal.aborted) {
      for (const path of [
        output,
        `${passLog}-0.log`,
        `${passLog}-0.log.mbtree`,
      ])
        await ffmpeg.deleteFile(path).catch(() => {
          // Some paths only exist after a successful encoding pass.
        })
    }
  }
  throw new MediaInputError(
    'This video could not fit under the limit. Try a larger limit or a shorter clip.',
  )
}
