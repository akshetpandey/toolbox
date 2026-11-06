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

function canWriteOriginal(format: MagickFormat) {
  return format !== 'HEIC' && format !== 'HEIF'
}

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
  onlyShrink?: boolean
}

export interface ImageConvertOptions {
  targetFormat: string
}

export interface ImageCompressOptions {
  quality: number
}

export interface ImageTransformOptions {
  crop?: { x: number; y: number; width: number; height: number }
  rotation: 0 | 90 | 180 | 270
  flipHorizontal: boolean
  flipVertical: boolean
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

      return ImageMagick.read(uint8Array, (img) => ({
        width: img.width,
        height: img.height,
        format: img.format.toString(),
        size: imageFile.size,
        colorspace: img.colorSpace.toString(),
        depth: img.depth,
        compression: img.compression.toString(),
      }))
    } catch (error) {
      console.error('🖼️ ImageMagick: Error extracting metadata:', error)
      // Fallback to basic metadata
      const fallbackMetadata = {
        width: imageFile.dimensions?.width ?? 0,
        height: imageFile.dimensions?.height ?? 0,
        format: imageFile.type.split('/')[1]?.toUpperCase() ?? 'Unknown',
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
    if (options.onlyShrink) geometry.greater = true

    return ImageMagick.readCollection(bytes, (images) => {
      const source = images[0].format
      const format = canWriteOriginal(source) ? source : 'PNG'
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

  async previewImage(file: File) {
    const { ImageMagick } = await initImageMagick()
    const bytes = new Uint8Array(await file.arrayBuffer())
    return ImageMagick.read(bytes, (image) => {
      image.autoOrient()
      return {
        dimensions: { width: image.width, height: image.height },
        blob: image.write(
          'PNG',
          (data) => new Blob([data.slice()], { type: 'image/png' }),
        ),
      }
    })
  }

  async transformImage(file: File, options: ImageTransformOptions) {
    const { ImageMagick, MagickGeometry } = await initImageMagick()
    const bytes = new Uint8Array(await file.arrayBuffer())
    return ImageMagick.readCollection(bytes, (images) => {
      const source = images[0].format
      const format = canWriteOriginal(source) ? source : 'PNG'
      if (images.length > 1) images.coalesce()
      const { crop, rotation, flipHorizontal, flipVertical } = options
      for (const image of images) {
        image.autoOrient()
        image.resetPage()
        if (crop) {
          const { x, y, width, height } = crop
          if (
            ![x, y, width, height].every(Number.isSafeInteger) ||
            x < 0 ||
            y < 0 ||
            width < 1 ||
            height < 1 ||
            x + width > image.width ||
            y + height > image.height
          )
            throw new Error('The crop must stay inside the image.')
          image.crop(new MagickGeometry(x, y, width, height))
          image.resetPage()
        }
        if (rotation) image.rotate(rotation)
        if (flipHorizontal) image.flop()
        if (flipVertical) image.flip()
        image.resetPage()
      }
      return {
        width: images[0].width,
        height: images[0].height,
        blob: images.write(
          format,
          (data) =>
            new Blob([data.slice()], {
              type: this.getOriginalMimeType(format, file.type),
            }),
        ),
      }
    })
  }

  async removeBackgroundColor(file: File, color: string, tolerance: number) {
    const { ImageMagick, MagickColor, Percentage } =
      await import('@imagemagick/magick-wasm')
    const bytes = new Uint8Array(await file.arrayBuffer())
    return ImageMagick.read(bytes, (image) => {
      image.autoOrient()
      image.colorFuzz = new Percentage(tolerance)
      image.transparent(new MagickColor(color))
      return image.write(
        'PNG',
        (data) => new Blob([data.slice()], { type: 'image/png' }),
      )
    })
  }

  async compressToSize(file: File, maximumBytes: number, allowResize: boolean) {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
      throw new Error('Enter a valid file size limit.')
    }
    const { ImageMagick, AlphaAction, MagickColors } =
      await import('@imagemagick/magick-wasm')
    const bytes = new Uint8Array(await file.arrayBuffer())
    return ImageMagick.read(bytes, (image) => {
      image.autoOrient()
      const result = (blob: Blob) => ({
        blob,
        width: image.width,
        height: image.height,
      })
      if (image.format === 'JPEG' && file.size <= maximumBytes) {
        return result(new Blob([file], { type: 'image/jpeg' }))
      }
      image.backgroundColor = MagickColors.White
      image.alpha(AlphaAction.Remove)
      const colorProfile = image.getProfile('icc')
      image.strip()
      if (colorProfile) image.setProfile(colorProfile)

      const encode = (quality: number) => {
        image.quality = quality
        return image.write('JPEG', (data) => ({
          size: data.length,
          blob:
            data.length <= maximumBytes
              ? new Blob([data.slice()], { type: 'image/jpeg' })
              : null,
        }))
      }

      while (true) {
        const highestQuality = encode(100).blob
        if (highestQuality) return result(highestQuality)
        const minimum = encode(1)
        if (minimum.blob) {
          let best = minimum.blob
          let low = 2
          let high = 99
          while (low <= high) {
            const quality = Math.floor((low + high) / 2)
            const candidate = encode(quality).blob
            if (candidate) {
              best = candidate
              low = quality + 1
            } else {
              high = quality - 1
            }
          }
          return result(best)
        }
        if (!allowResize || (image.width === 1 && image.height === 1))
          return null
        const scale = Math.min(
          0.8,
          Math.sqrt(maximumBytes / minimum.size) * 0.9,
        )
        image.resize(
          Math.max(1, Math.floor(image.width * scale)),
          Math.max(1, Math.floor(image.height * scale)),
        )
      }
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
      const source = images[0].format
      const format = canWriteOriginal(source) ? source : 'JPEG'
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
