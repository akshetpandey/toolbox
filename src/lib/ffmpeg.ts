import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  format: string
  size: number
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

export class FFmpegProcessor {
  private ffmpeg: FFmpeg
  private progressCallback?: (progress: number) => void

  constructor(ffmpeg: FFmpeg) {
    this.ffmpeg = ffmpeg
  }

  setProgressCallback(callback: (progress: number) => void) {
    this.progressCallback = callback
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

  async extractMetadata(videoFile: VideoFile): Promise<VideoMetadata> {
    console.log('🎬 FFmpeg: Starting metadata extraction', {
      fileName: videoFile.name,
    })
    try {
      const inputFileName = 'input' + this.getFileExtension(videoFile.name)
      console.log('🎬 FFmpeg: Writing input file', { inputFileName })
      await this.ffmpeg.writeFile(
        inputFileName,
        await fetchFile(videoFile.file),
      )

      // Initialize metadata with basic info
      const metadata: VideoMetadata = {
        duration: videoFile.duration ?? 0,
        width: videoFile.dimensions?.width ?? 0,
        height: videoFile.dimensions?.height ?? 0,
        format: videoFile.type.split('/')[1].toUpperCase(),
        size: videoFile.size,
        bitrate: 'Unknown',
        fps: 'Unknown',
        codec: 'Unknown',
      }

      // Use ffprobe to get detailed metadata in JSON format
      console.log('🎬 FFmpeg: Running ffprobe for detailed metadata')
      await this.ffmpeg.ffprobe([
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        inputFileName,
        '-o',
        'metadata.json',
      ])

      // Read the JSON output
      console.log('🎬 FFmpeg: Reading ffprobe output')
      const jsonData = await this.ffmpeg.readFile('metadata.json')
      const jsonString = new TextDecoder().decode(jsonData as Uint8Array)
      const probeData = JSON.parse(jsonString) as {
        format: { format_name: string; duration: string; bit_rate: string }
        streams: {
          codec_type: string
          codec_name: string
          width: number
          height: number
          r_frame_rate: string
        }[]
      }

      // Extract format information
      if (probeData.format) {
        metadata.format =
          probeData.format.format_name?.toUpperCase() || metadata.format
        if (probeData.format.duration) {
          metadata.duration = parseFloat(probeData.format.duration)
        }
        if (probeData.format.bit_rate) {
          const bitrateKbps = Math.round(
            parseInt(probeData.format.bit_rate) / 1000,
          )
          metadata.bitrate = `${bitrateKbps} kbps`
        }
      }

      // Extract video stream information
      if (probeData.streams) {
        const videoStream = probeData.streams.find(
          (stream: { codec_type: string }) => stream.codec_type === 'video',
        )
        if (videoStream) {
          metadata.codec = videoStream.codec_name || 'Unknown'
          metadata.width = videoStream.width || metadata.width
          metadata.height = videoStream.height || metadata.height

          // Extract frame rate
          if (videoStream.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/')
            if (num && den) {
              const fps =
                Math.round((parseInt(num) / parseInt(den)) * 100) / 100
              metadata.fps = `${fps} fps`
            }
          }
        }
      }

      // Clean up files
      try {
        console.log('🎬 FFmpeg: Cleaning up temporary files')
        await this.ffmpeg.deleteFile(inputFileName)
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
      const fallbackMetadata = {
        duration: videoFile.duration ?? 0,
        width: videoFile.dimensions?.width ?? 0,
        height: videoFile.dimensions?.height ?? 0,
        format: videoFile.type.split('/')[1].toUpperCase(),
        size: videoFile.size,
        bitrate: 'Unknown',
        fps: 'Unknown',
        codec: 'Unknown',
      }
      console.log('🎬 FFmpeg: Using fallback metadata', fallbackMetadata)
      return fallbackMetadata
    }
  }

  async convertVideo(
    videoFile: VideoFile,
    options: VideoConvertOptions,
  ): Promise<Blob> {
    console.log('🎬 FFmpeg: Starting video conversion', {
      fileName: videoFile.name,
      options,
    })

    const inputFileName = 'input' + this.getFileExtension(videoFile.name)
    const outputFileName = `output.${options.targetFormat}`

    console.log('🎬 FFmpeg: Writing input file', { inputFileName })
    await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile.file))

    // Build FFmpeg command based on format
    const command = ['-i', inputFileName]

    if (options.targetFormat === 'mp4') {
      command.push(
        '-c:v',
        options.videoCodec,
        '-c:a',
        options.audioCodec,
        '-preset',
        options.preset,
      )
    } else if (options.targetFormat === 'webm') {
      command.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus')
    } else if (options.targetFormat === 'avi') {
      command.push('-c:v', 'libx264', '-c:a', 'mp3')
    } else if (options.targetFormat === 'mov') {
      command.push('-c:v', 'libx264', '-c:a', 'aac')
    }

    command.push(outputFileName)

    console.log('🎬 FFmpeg: Executing conversion command', { command })
    await this.ffmpeg.exec(command)

    console.log('🎬 FFmpeg: Reading output file', { outputFileName })
    const data = await this.ffmpeg.readFile(outputFileName)
    console.log('🎬 FFmpeg: Video conversion completed successfully')

    return this.createBlobFromFFmpegOutput(
      data,
      `video/${options.targetFormat}`,
    )
  }

  async compressVideo(
    videoFile: VideoFile,
    options: VideoCompressOptions,
  ): Promise<Blob> {
    console.log('🎬 FFmpeg: Starting video compression', {
      fileName: videoFile.name,
      options,
    })

    const inputFileName = 'input' + this.getFileExtension(videoFile.name)
    const outputFileName = `compressed.${this.getFileExtension(videoFile.name)}`

    console.log('🎬 FFmpeg: Writing input file', { inputFileName })
    await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile.file))

    const command = [
      '-i',
      inputFileName,
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
      outputFileName,
    ]

    console.log('🎬 FFmpeg: Executing compression command', { command })
    await this.ffmpeg.exec(command)

    console.log('🎬 FFmpeg: Reading output file', { outputFileName })
    const data = await this.ffmpeg.readFile(outputFileName)
    console.log('🎬 FFmpeg: Video compression completed successfully')

    return this.createBlobFromFFmpegOutput(data, videoFile.type)
  }

  async trimVideo(videoFile: VideoFile, options: TrimOptions): Promise<Blob> {
    console.log('🎬 FFmpeg: Starting video trimming', {
      fileName: videoFile.name,
      options,
    })

    const inputFileName = 'input' + this.getFileExtension(videoFile.name)
    const outputFileName = `trimmed.${this.getFileExtension(videoFile.name)}`

    console.log('🎬 FFmpeg: Writing input file', { inputFileName })
    await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile.file))

    const command = [
      '-i',
      inputFileName,
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

    return this.createBlobFromFFmpegOutput(data, videoFile.type)
  }

  async extractAudio(
    videoFile: VideoFile,
    options: AudioExtractOptions,
  ): Promise<Blob> {
    console.log('🎬 FFmpeg: Starting audio extraction', {
      fileName: videoFile.name,
      options,
    })

    const inputFileName = 'input' + this.getFileExtension(videoFile.name)
    const outputFileName = `audio.${options.audioFormat}`

    console.log('🎬 FFmpeg: Writing input file', { inputFileName })
    await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile.file))

    let command: string[]
    if (options.audioFormat === 'mp3') {
      command = [
        '-i',
        inputFileName,
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
        inputFileName,
        '-vn',
        '-acodec',
        'pcm_s16le',
        outputFileName,
      ]
    } else if (options.audioFormat === 'aac') {
      command = [
        '-i',
        inputFileName,
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

    return this.createBlobFromFFmpegOutput(data, `audio/${options.audioFormat}`)
  }
}

// Re-export shared utilities
export { formatFileSize, formatDuration, downloadFile } from './shared'
