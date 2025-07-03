import type { FFmpeg } from '@ffmpeg/ffmpeg'

export interface VideoStream {
  index: number
  codec_name: string
  codec_long_name: string
  profile?: string
  width: number
  height: number
  display_aspect_ratio?: string
  sample_aspect_ratio?: string
  pix_fmt?: string
  color_range?: string
  color_space?: string
  color_transfer?: string
  color_primaries?: string
  r_frame_rate: string
  avg_frame_rate: string
  fps?: number
  level?: number
}

export interface AudioStream {
  index: number
  codec_name: string
  codec_long_name: string
  profile?: string
  sample_rate: number
  channels: number
  channel_layout?: string
  sample_fmt?: string
  bit_rate?: number
  bits_per_sample?: number
  language?: string
  title?: string
  is_default?: boolean
}

export interface SubtitleStream {
  index: number
  codec_name: string
  codec_long_name: string
  language?: string
  title?: string
  is_default?: boolean
  is_forced?: boolean
}

export interface FormatInfo {
  filename: string
  format_name: string
  format_long_name: string
  duration: number
  size: number
  bit_rate: number
  nb_streams: number
}

export interface VideoMetadata {
  format: FormatInfo
  video_streams: VideoStream[]
  audio_streams: AudioStream[]
  subtitle_streams: SubtitleStream[]
  // Legacy fields for backward compatibility
  duration: number
  width: number
  height: number
  bitrate: string
  fps: string
  codec: string
}

export interface VideoFile {
  file: File
  preview: string
  name: string
  size: number
  type: string
  duration?: number
  dimensions?: { width: number; height: number }
}

export interface VideoConvertOptions {
  targetFormat: string
  videoCodec: string
  audioCodec: string
  preset: string
  fastConvert?: boolean // Use stream copy when possible
}

export interface VideoCompressOptions {
  crf: number
  preset: string
}

export interface TrimOptions {
  startTime: string
  endTime: string
}

export interface AudioExtractOptions {
  audioFormat: string
}

interface FFProbeStream {
  index?: number
  codec_type?: string
  codec_name?: string
  codec_long_name?: string
  profile?: string
  width?: number
  height?: number
  display_aspect_ratio?: string
  sample_aspect_ratio?: string
  pix_fmt?: string
  color_range?: string
  color_space?: string
  color_transfer?: string
  color_primaries?: string
  r_frame_rate?: string
  avg_frame_rate?: string
  level?: number
  sample_rate?: number
  channels?: number
  channel_layout?: string
  sample_fmt?: string
  bit_rate?: string
  bits_per_sample?: number
  disposition?: {
    default?: number
    forced?: number
  }
  tags?: {
    language?: string
    title?: string
  }
}

interface FFProbeFormat {
  filename?: string
  format_name?: string
  format_long_name?: string
  duration?: string
  size?: string
  bit_rate?: string
  nb_streams?: number
}

interface FFProbeOutput {
  streams?: FFProbeStream[]
  format?: FFProbeFormat
}

export class FFmpegProcessor {
  private ffmpeg: FFmpeg
  private inputDir = '/input'
  private didCreateInputDir = false
  private inputFileName: string | null = null

  public inputFile: VideoFile | null = null

  constructor(ffmpeg: FFmpeg) {
    this.ffmpeg = ffmpeg
  }

  private async ensureInputDir() {
    if (this.didCreateInputDir) return
    await this.ffmpeg.createDir(this.inputDir)
    this.didCreateInputDir = true
  }

  async mountInputFile(videoFile: VideoFile) {
    this.inputFile = videoFile
    this.inputFileName = this.inputDir + '/' + videoFile.file.name
    console.log('🎬 FFmpeg: Mounting input file', {
      inputFileName: this.inputFileName,
    })
    await this.ensureInputDir()
    await this.ffmpeg.mount(
      //@ts-expect-error - WORKERFS is not a valid FFFSType
      'WORKERFS',
      {
        files: [videoFile.file],
      },
      this.inputDir,
    )
  }

  async unmountInputFile() {
    if (!this.inputFileName) return
    await this.ffmpeg.unmount(this.inputFileName)
    this.inputFile = null
    this.inputFileName = null
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop() ?? ''
  }

  private createBlobFromFFmpegOutput(
    data: Uint8Array | string | { buffer: Uint8Array },
    mimeType: string,
  ): Blob {
    // Handle different data types from FFmpeg
    if (data instanceof Uint8Array) {
      return new Blob([data], { type: mimeType })
    } else if (typeof data === 'string') {
      return new Blob([data], { type: mimeType })
    } else if (data?.buffer) {
      return new Blob([data.buffer], { type: mimeType })
    } else {
      throw new Error('Unsupported data format from FFmpeg')
    }
  }

  async extractMetadata(): Promise<VideoMetadata> {
    console.log('🎬 FFmpeg: Starting metadata extraction', {
      fileName: this.inputFileName,
    })
    try {
      // Use ffprobe to get detailed metadata in JSON format
      console.log('🎬 FFmpeg: Running ffprobe for detailed metadata')
      await this.ffmpeg.ffprobe([
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        this.inputFileName ?? '',
        '-o',
        'metadata.json',
      ])

      // Read the JSON output
      console.log('🎬 FFmpeg: Reading ffprobe output')
      const jsonData = await this.ffmpeg.readFile('metadata.json')
      const jsonString = new TextDecoder().decode(jsonData as Uint8Array)
      const probeData = JSON.parse(jsonString) as FFProbeOutput

      // Extract format information
      const formatInfo: FormatInfo = {
        filename:
          probeData.format?.filename ?? this.inputFile?.name ?? 'Unknown',
        format_name: probeData.format?.format_name ?? 'Unknown',
        format_long_name: probeData.format?.format_long_name ?? 'Unknown',
        duration: probeData.format?.duration
          ? parseFloat(probeData.format.duration)
          : (this.inputFile?.duration ?? 0),
        size: probeData.format?.size
          ? parseInt(probeData.format.size)
          : (this.inputFile?.size ?? 0),
        bit_rate: probeData.format?.bit_rate
          ? parseInt(probeData.format.bit_rate)
          : 0,
        nb_streams: probeData.format?.nb_streams ?? 0,
      }

      // Extract video streams
      const videoStreams: VideoStream[] =
        probeData.streams
          ?.filter((stream: FFProbeStream) => stream.codec_type === 'video')
          .map((stream: FFProbeStream) => {
            const fps = stream.r_frame_rate
              ? this.calculateFps(stream.r_frame_rate)
              : undefined
            return {
              index: stream.index ?? 0,
              codec_name: stream.codec_name ?? 'Unknown',
              codec_long_name: stream.codec_long_name ?? 'Unknown',
              profile: stream.profile,
              width: stream.width ?? 0,
              height: stream.height ?? 0,
              display_aspect_ratio: stream.display_aspect_ratio,
              sample_aspect_ratio: stream.sample_aspect_ratio,
              pix_fmt: stream.pix_fmt,
              color_range: stream.color_range,
              color_space: stream.color_space,
              color_transfer: stream.color_transfer,
              color_primaries: stream.color_primaries,
              r_frame_rate: stream.r_frame_rate ?? '0/0',
              avg_frame_rate: stream.avg_frame_rate ?? '0/0',
              fps,
              level: stream.level,
            }
          }) ?? []

      // Extract audio streams
      const audioStreams: AudioStream[] =
        probeData.streams
          ?.filter((stream: FFProbeStream) => stream.codec_type === 'audio')
          .map((stream: FFProbeStream) => ({
            index: stream.index ?? 0,
            codec_name: stream.codec_name ?? 'Unknown',
            codec_long_name: stream.codec_long_name ?? 'Unknown',
            profile: stream.profile,
            sample_rate: stream.sample_rate ?? 0,
            channels: stream.channels ?? 0,
            channel_layout: stream.channel_layout,
            sample_fmt: stream.sample_fmt,
            bit_rate: stream.bit_rate ? parseInt(stream.bit_rate) : undefined,
            bits_per_sample: stream.bits_per_sample,
            language: stream.tags?.language,
            title: stream.tags?.title,
            is_default: stream.disposition?.default === 1,
          })) ?? []

      // Extract subtitle streams
      const subtitleStreams: SubtitleStream[] =
        probeData.streams
          ?.filter((stream: FFProbeStream) => stream.codec_type === 'subtitle')
          .map((stream: FFProbeStream) => ({
            index: stream.index ?? 0,
            codec_name: stream.codec_name ?? 'Unknown',
            codec_long_name: stream.codec_long_name ?? 'Unknown',
            language: stream.tags?.language,
            title: stream.tags?.title,
            is_default: stream.disposition?.default === 1,
            is_forced: stream.disposition?.forced === 1,
          })) ?? []

      // Build complete metadata object
      const metadata: VideoMetadata = {
        format: formatInfo,
        video_streams: videoStreams,
        audio_streams: audioStreams,
        subtitle_streams: subtitleStreams,
        // Legacy fields for backward compatibility
        duration: formatInfo.duration,
        width: videoStreams[0]?.width ?? this.inputFile?.dimensions?.width ?? 0,
        height:
          videoStreams[0]?.height ?? this.inputFile?.dimensions?.height ?? 0,
        bitrate: formatInfo.bit_rate
          ? `${Math.round(formatInfo.bit_rate / 1000)} kbps`
          : 'Unknown',
        fps: videoStreams[0]?.fps ? `${videoStreams[0].fps} fps` : 'Unknown',
        codec: videoStreams[0]?.codec_name ?? 'Unknown',
      }

      // Clean up files
      try {
        console.log('🎬 FFmpeg: Cleaning up temporary files')
        await this.ffmpeg.deleteFile('metadata.json')
      } catch {
        // Ignore cleanup errors
      }

      console.log(
        '🎬 FFmpeg: Metadata extraction completed successfully',
        metadata,
      )
      return metadata
    } catch (error) {
      console.error('🎬 FFmpeg: Error extracting metadata:', error)
      // Fallback to basic metadata
      const fallbackMetadata: VideoMetadata = {
        format: {
          filename: this.inputFile?.name ?? 'Unknown',
          format_name:
            this.inputFile?.type.split('/')[1]?.toUpperCase() ?? 'Unknown',
          format_long_name: 'Unknown',
          duration: this.inputFile?.duration ?? 0,
          size: this.inputFile?.size ?? 0,
          bit_rate: 0,
          nb_streams: 0,
        },
        video_streams: [],
        audio_streams: [],
        subtitle_streams: [],
        duration: this.inputFile?.duration ?? 0,
        width: this.inputFile?.dimensions?.width ?? 0,
        height: this.inputFile?.dimensions?.height ?? 0,
        bitrate: 'Unknown',
        fps: 'Unknown',
        codec: 'Unknown',
      }
      console.log('🎬 FFmpeg: Using fallback metadata', fallbackMetadata)
      return fallbackMetadata
    }
  }

  private calculateFps(frameRate: string): number | undefined {
    if (!frameRate || frameRate === '0/0') return undefined
    const [num, den] = frameRate.split('/')
    if (num && den && parseInt(den) !== 0) {
      return Math.round((parseInt(num) / parseInt(den)) * 100) / 100
    }
    return undefined
  }

  async convertVideo(options: VideoConvertOptions): Promise<Blob> {
    console.log('🎬 FFmpeg: Starting video conversion', {
      fileName: this.inputFileName,
      options,
    })
    const outputFileName = `output.${options.targetFormat}`
    // Build FFmpeg command based on format
    const command = ['-i', this.inputFileName ?? '']

    // Check if we can use fast convert (stream copy)
    if (options.fastConvert) {
      console.log('🎬 FFmpeg: Using fast convert (stream copy)')
      command.push('-c', 'copy')
    } else {
      // Add memory-efficient encoding options
      command.push('-movflags', '+faststart') // Optimize for streaming
      command.push('-threads', '4') // Use a small no. of thread to avoid memory issues
      command.push('-max_muxing_queue_size', '1024') // Limit muxing queue
    }

    if (!options.fastConvert && options.targetFormat === 'mp4') {
      command.push(
        '-c:v',
        options.videoCodec,
        '-c:a',
        options.audioCodec,
        '-preset',
        options.preset,
      )
      // Add quality constraints to prevent memory issues
      if (options.videoCodec === 'libx264') {
        command.push('-crf', '23') // Reasonable quality
        command.push('-maxrate', '2M') // Max bitrate
        command.push('-bufsize', '4M') // Buffer size
      }
    } else if (!options.fastConvert && options.targetFormat === 'webm') {
      command.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus')
      command.push('-crf', '30') // Lower quality for WebM
      command.push('-b:v', '1M') // Target bitrate
    } else if (!options.fastConvert && options.targetFormat === 'avi') {
      command.push('-c:v', 'libx264', '-c:a', 'mp3')
      command.push('-crf', '23')
      command.push('-maxrate', '2M')
      command.push('-bufsize', '4M')
    } else if (!options.fastConvert && options.targetFormat === 'mov') {
      command.push('-c:v', 'libx264', '-c:a', 'aac')
      command.push('-crf', '23')
      command.push('-maxrate', '2M')
      command.push('-bufsize', '4M')
    }

    command.push(outputFileName)

    console.log('🎬 FFmpeg: Executing conversion command', { command })

    // Set up progress monitoring
    const startTime = Date.now()
    const timeoutMs = 300000 // 5 minutes timeout

    try {
      const execPromise = this.ffmpeg.exec(command)

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Video conversion timed out after 5 minutes'))
        }, timeoutMs)
      })

      await Promise.race([execPromise, timeoutPromise])

      const processingTime = Date.now() - startTime
      console.log(`🎬 FFmpeg: Conversion completed in ${processingTime}ms`)
    } catch (error) {
      console.error('🎬 FFmpeg: Conversion failed', error)
      throw error
    }

    console.log('🎬 FFmpeg: Reading output file', { outputFileName })
    const data = await this.ffmpeg.readFile(outputFileName)
    console.log('🎬 FFmpeg: Video conversion completed successfully')
    await this.ffmpeg.deleteFile(outputFileName)

    return this.createBlobFromFFmpegOutput(
      data,
      `video/${options.targetFormat}`,
    )
  }

  async compressVideo(options: VideoCompressOptions): Promise<Blob> {
    console.log('🎬 FFmpeg: Starting video compression', {
      fileName: this.inputFileName,
      options,
    })

    const outputFileName = `compressed.${this.getFileExtension(this.inputFileName ?? '')}`

    const command = [
      '-i',
      this.inputFileName ?? '',
      '-c:v',
      'libx264',
      '-crf',
      options.crf.toString(),
      '-preset',
      options.preset,
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      // Add memory-efficient encoding options
      '-movflags',
      '+faststart',
      '-threads',
      '4', // Use a small no. of thread to avoid memory issues
      '-max_muxing_queue_size',
      '1024',
      // Add quality constraints to prevent memory issues
      '-maxrate',
      '2M',
      '-bufsize',
      '4M',
      outputFileName,
    ]

    console.log('🎬 FFmpeg: Executing compression command', { command })

    // Set up progress monitoring
    const startTime = Date.now()
    const timeoutMs = 300000 // 5 minutes timeout

    try {
      const execPromise = this.ffmpeg.exec(command)

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Video compression timed out after 5 minutes'))
        }, timeoutMs)
      })

      await Promise.race([execPromise, timeoutPromise])

      const processingTime = Date.now() - startTime
      console.log(`🎬 FFmpeg: Compression completed in ${processingTime}ms`)
    } catch (error) {
      console.error('🎬 FFmpeg: Compression failed', error)
      throw error
    }

    console.log('🎬 FFmpeg: Reading output file', { outputFileName })
    const data = await this.ffmpeg.readFile(outputFileName)
    console.log('🎬 FFmpeg: Video compression completed successfully')
    await this.ffmpeg.deleteFile(outputFileName)

    return this.createBlobFromFFmpegOutput(
      data,
      this.inputFile?.type ?? 'video/mp4',
    )
  }

  async trimVideo(options: TrimOptions): Promise<Blob> {
    console.log('🎬 FFmpeg: Starting video trimming', {
      fileName: this.inputFileName,
      options,
    })

    const outputFileName = `trimmed.${this.getFileExtension(this.inputFileName ?? '')}`

    const command = [
      '-i',
      this.inputFileName ?? '',
      '-ss',
      options.startTime,
      '-to',
      options.endTime,
      '-c',
      'copy',
      outputFileName,
    ]

    console.log('🎬 FFmpeg: Executing trim command', { command })
    await this.ffmpeg.exec(command)

    console.log('🎬 FFmpeg: Reading output file', { outputFileName })
    const data = await this.ffmpeg.readFile(outputFileName)
    console.log('🎬 FFmpeg: Video trimming completed successfully')
    await this.ffmpeg.deleteFile(outputFileName)

    return this.createBlobFromFFmpegOutput(
      data,
      this.inputFile?.type ?? 'video/mp4',
    )
  }

  async extractAudio(options: AudioExtractOptions): Promise<Blob> {
    console.log('🎬 FFmpeg: Starting audio extraction', {
      fileName: this.inputFileName,
      options,
    })

    const outputFileName = `audio.${options.audioFormat}`

    let command: string[]
    if (options.audioFormat === 'mp3') {
      command = [
        '-i',
        this.inputFileName ?? '',
        '-vn',
        '-acodec',
        'libmp3lame',
        '-ab',
        '192k',
        outputFileName,
      ]
    } else if (options.audioFormat === 'wav') {
      command = [
        '-i',
        this.inputFileName ?? '',
        '-vn',
        '-acodec',
        'pcm_s16le',
        outputFileName,
      ]
    } else if (options.audioFormat === 'aac') {
      command = [
        '-i',
        this.inputFileName ?? '',
        '-vn',
        '-acodec',
        'aac',
        '-ab',
        '192k',
        outputFileName,
      ]
    } else {
      throw new Error(`Unsupported audio format: ${options.audioFormat}`)
    }

    console.log('🎬 FFmpeg: Executing audio extraction command', { command })
    await this.ffmpeg.exec(command)

    console.log('🎬 FFmpeg: Reading output file', { outputFileName })
    const data = await this.ffmpeg.readFile(outputFileName)
    console.log('🎬 FFmpeg: Audio extraction completed successfully')
    await this.ffmpeg.deleteFile(outputFileName)

    return this.createBlobFromFFmpegOutput(data, `audio/${options.audioFormat}`)
  }
}

// Re-export shared utilities
export { formatFileSize, formatDuration, downloadFile } from './shared'
