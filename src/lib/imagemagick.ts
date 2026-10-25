import type {
  ImageMagick,
  MagickFormat,
  DitherMethod,
  ColorSpace,
  QuantizeSettings,
  MagickGeometry,
} from '@imagemagick/magick-wasm'
import { LibImageQuantProcessor } from './libimagequant'
import type { ImageFile } from './shared'

// Dynamic imports for ImageMagick
let _ImageMagick: typeof ImageMagick | null = null
let _MagickFormat: typeof MagickFormat | null = null
let _DitherMethod: typeof DitherMethod | null = null
let _ColorSpace: typeof ColorSpace | null = null
let _QuantizeSettings: typeof QuantizeSettings | null = null
let _MagickGeometry: typeof MagickGeometry | null = null

async function initImageMagick() {
  if (
    !_ImageMagick ||
    !_MagickFormat ||
    !_DitherMethod ||
    !_ColorSpace ||
    !_QuantizeSettings ||
    !_MagickGeometry
  ) {
    console.log('🖼️ ImageMagick: Loading ImageMagick library...')
    const {
      ImageMagick,
      MagickFormat,
      DitherMethod,
      ColorSpace,
      QuantizeSettings,
      MagickGeometry,
    } = await import('@imagemagick/magick-wasm')
    _ImageMagick = ImageMagick
    _MagickFormat = MagickFormat
    _DitherMethod = DitherMethod
    _ColorSpace = ColorSpace
    _QuantizeSettings = QuantizeSettings
    _MagickGeometry = MagickGeometry
    console.log('🖼️ ImageMagick: Library loaded successfully')
  }
  return {
    ImageMagick: _ImageMagick,
    MagickFormat: _MagickFormat,
    DitherMethod: _DitherMethod,
    ColorSpace: _ColorSpace,
    QuantizeSettings: _QuantizeSettings,
    MagickGeometry: _MagickGeometry,
  }
}

export interface ImageMetadata {
  width: number
  height: number
  format: string
  size: number
  colorspace: string
  depth: number
  compression: string
}

export interface ResizeOptions {
  width: number
  height: number
  maintainAspectRatio: boolean
}

export interface ImageConvertOptions {
  targetFormat: string
}

export interface ImageCompressOptions {
  quality: number
}

export class ImageMagickProcessor {
  private libImageQuantProcessor: LibImageQuantProcessor

  constructor() {
    this.libImageQuantProcessor = new LibImageQuantProcessor()
  }

  private getMagickFormat(format: string): MagickFormat {
    switch (format.toLowerCase()) {
      case 'webp':
        return 'WEBP'
      case 'png':
        return 'PNG'
      case 'jpg':
      case 'jpeg':
        return 'JPEG'
      case 'gif':
        return 'GIF'
      default:
        return 'WEBP'
    }
  }

  private getMimeType(format: string): string {
    switch (format.toLowerCase()) {
      case 'webp':
        return 'image/webp'
      case 'png':
        return 'image/png'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'gif':
        return 'image/gif'
      default:
        return 'image/webp'
    }
  }

  private getOriginalMimeType(format: MagickFormat, fallback: string): string {
    switch (format.toString()) {
      case 'JPEG':
        return 'image/jpeg'
      case 'PNG':
        return 'image/png'
      case 'WEBP':
        return 'image/webp'
      case 'GIF':
        return 'image/gif'
      default:
        return fallback || 'application/octet-stream'
    }
  }

  async extractMetadata(imageFile: ImageFile): Promise<ImageMetadata> {
    console.log('🖼️ ImageMagick: Starting metadata extraction', {
      fileName: imageFile.name,
    })
    try {
      const { ImageMagick } = await initImageMagick()

      const arrayBuffer = await imageFile.file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      console.log('🖼️ ImageMagick: File loaded into memory', {
        size: uint8Array.length,
      })

      return new Promise((resolve) => {
        ImageMagick.read(uint8Array, (img) => {
          const meta: ImageMetadata = {
            width: img.width,
            height: img.height,
            format: img.format.toString(),
            size: imageFile.size,
            colorspace: img.colorSpace.toString(),
            depth: img.depth,
            compression: img.compression.toString(),
          }
          console.log(
            '🖼️ ImageMagick: Metadata extraction completed successfully',
            meta,
          )
          resolve(meta)
        })
      })
    } catch (error) {
      console.error('🖼️ ImageMagick: Error extracting metadata:', error)
      // Fallback to basic metadata
      const fallbackMetadata = {
        width: imageFile.dimensions?.width ?? 0,
        height: imageFile.dimensions?.height ?? 0,
        format: imageFile.type.split('/')[1].toUpperCase(),
        size: imageFile.size,
        colorspace: 'sRGB',
        depth: 8,
        compression: 'None',
      }
      console.log('🖼️ ImageMagick: Using fallback metadata', fallbackMetadata)
      return fallbackMetadata
    }
  }

  async resizeImage(
    imageFile: ImageFile,
    options: ResizeOptions,
  ): Promise<Blob> {
    console.log('🖼️ ImageMagick: Starting image resize', {
      fileName: imageFile.name,
      options,
    })

    const { ImageMagick, MagickGeometry } = await initImageMagick()
    const bytes = new Uint8Array(await imageFile.file.arrayBuffer())
    const geometry = new MagickGeometry(options.width, options.height)
    geometry.ignoreAspectRatio = !options.maintainAspectRatio

    return ImageMagick.readCollection(bytes, (images) => {
      const format = images[0].format
      // Animated frames can store only the changed rectangle. Expand them
      // before resizing, then update the animation canvas to the new size.
      if (images.length > 1) images.coalesce()
      for (const image of images) {
        image.autoOrient()
        image.resize(geometry)
        image.resetPage()
      }
      return images.write(
        format,
        (data) =>
          new Blob([data.slice()], {
            type: this.getOriginalMimeType(format, imageFile.type),
          }),
      )
    })
  }

  async convertImage(
    imageFile: ImageFile,
    options: ImageConvertOptions,
  ): Promise<Blob> {
    console.log('🖼️ ImageMagick: Starting image conversion', {
      fileName: imageFile.name,
      options,
    })

    const { ImageMagick } = await initImageMagick()

    const arrayBuffer = await imageFile.file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    console.log('🖼️ ImageMagick: File loaded into memory', {
      size: uint8Array.length,
    })

    return new Promise((resolve) => {
      ImageMagick.read(uint8Array, (img) => {
        // Apply EXIF orientation before converting — prevents rotation
        // issues when the source has an EXIF Orientation tag (common on
        // phone photos) and the target format doesn't support it.
        img.autoOrient()

        const format = this.getMagickFormat(options.targetFormat)
        const mimeType = this.getMimeType(options.targetFormat)

        console.log('🖼️ ImageMagick: Converting image format', {
          originalFormat: img.format.toString(),
          targetFormat: format.toString(),
          mimeType,
        })

        img.write(format, (data: Uint8Array) => {
          const arrayBuffer = new ArrayBuffer(data.length)
          new Uint8Array(arrayBuffer).set(data)
          const blob = new Blob([arrayBuffer], { type: mimeType })
          console.log('🖼️ ImageMagick: Conversion completed successfully', {
            originalSize: imageFile.size,
            newSize: blob.size,
          })
          resolve(blob)
        })
      })
    })
  }

  async compressImage(
    imageFile: ImageFile,
    options: ImageCompressOptions,
  ): Promise<Blob> {
    console.log('🖼️ ImageMagick: Starting image compression', {
      fileName: imageFile.name,
      options,
    })

    // Check if this is a PNG file and use libimagequant for better compression
    if (
      imageFile.type.includes('png') ||
      imageFile.name.toLowerCase().endsWith('.png')
    ) {
      console.log(
        '🖼️ ImageMagick: PNG detected, using libimagequant for optimal compression',
      )
      try {
        return await this.libImageQuantProcessor.compressPNG(
          imageFile,
          options.quality,
        )
      } catch (error) {
        console.warn(
          '🖼️ ImageMagick: libimagequant compression failed, falling back to ImageMagick:',
          error,
        )
        // Fall back to standard ImageMagick compression below
      }
    }

    // Preserve the original encoding and all animation frames.
    const { ImageMagick } = await initImageMagick()
    const bytes = new Uint8Array(await imageFile.file.arrayBuffer())
    return ImageMagick.readCollection(bytes, (images) => {
      const format = images[0].format
      if (images.length > 1) images.coalesce()
      for (const image of images) {
        image.autoOrient()
        image.quality = options.quality
      }
      return images.write(
        format,
        (data) =>
          new Blob([data.slice()], {
            type: this.getOriginalMimeType(format, imageFile.type),
          }),
      )
    })
  }

  /**
   * Clean up resources, especially for libimagequant
   */
  dispose(): void {
    this.libImageQuantProcessor.dispose()
  }
}

// Re-export shared utilities
export {
  formatFileSize,
  downloadFile,
  createObjectURL,
  revokeObjectURL,
} from './shared'
