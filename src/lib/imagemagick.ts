import type {
  ImageMagick,
  MagickFormat,
  DitherMethod,
  ColorSpace,
  QuantizeSettings,
} from '@imagemagick/magick-wasm'

// Dynamic imports for ImageMagick
let _ImageMagick: typeof ImageMagick | null = null
let _MagickFormat: typeof MagickFormat | null = null
let _DitherMethod: typeof DitherMethod | null = null
let _ColorSpace: typeof ColorSpace | null = null
let _QuantizeSettings: typeof QuantizeSettings | null = null

async function initImageMagick() {
  if (
    !_ImageMagick ||
    !_MagickFormat ||
    !_DitherMethod ||
    !_ColorSpace ||
    !_QuantizeSettings
  ) {
    console.log('🖼️ ImageMagick: Loading ImageMagick library...')
    const {
      ImageMagick,
      MagickFormat,
      DitherMethod,
      ColorSpace,
      QuantizeSettings,
    } = await import('@imagemagick/magick-wasm')
    _ImageMagick = ImageMagick
    _MagickFormat = MagickFormat
    _DitherMethod = DitherMethod
    _ColorSpace = ColorSpace
    _QuantizeSettings = QuantizeSettings
    console.log('🖼️ ImageMagick: Library loaded successfully')
  }
  return {
    ImageMagick: _ImageMagick,
    MagickFormat: _MagickFormat,
    DitherMethod: _DitherMethod,
    ColorSpace: _ColorSpace,
    QuantizeSettings: _QuantizeSettings,
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

export interface ImageFile {
  file: File
  preview: string
  name: string
  size: number
  type: string
  dimensions?: { width: number; height: number }
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

    const { ImageMagick, MagickFormat } = await initImageMagick()

    const arrayBuffer = await imageFile.file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    console.log('🖼️ ImageMagick: File loaded into memory', {
      size: uint8Array.length,
    })

    return new Promise((resolve) => {
      ImageMagick.read(uint8Array, (img) => {
        console.log('🖼️ ImageMagick: Original image dimensions', {
          width: img.width,
          height: img.height,
        })

        if (options.maintainAspectRatio) {
          const aspectRatio = img.width / img.height
          const targetAspectRatio = options.width / options.height

          if (aspectRatio > targetAspectRatio) {
            const newHeight = Math.round(options.width / aspectRatio)
            console.log('🖼️ ImageMagick: Resizing with aspect ratio', {
              newWidth: options.width,
              newHeight,
            })
            img.resize(options.width, newHeight)
          } else {
            const newWidth = Math.round(options.height * aspectRatio)
            console.log('🖼️ ImageMagick: Resizing with aspect ratio', {
              newWidth,
              newHeight: options.height,
            })
            img.resize(newWidth, options.height)
          }
        } else {
          console.log('🖼️ ImageMagick: Resizing without aspect ratio', {
            newWidth: options.width,
            newHeight: options.height,
          })
          img.resize(options.width, options.height)
        }

        // Determine format based on original file type
        let format: MagickFormat
        if (imageFile.type.includes('jpeg') || imageFile.type.includes('jpg')) {
          format = MagickFormat.Jpeg
        } else if (imageFile.type.includes('png')) {
          format = MagickFormat.Png
        } else if (imageFile.type.includes('webp')) {
          format = MagickFormat.WebP
        } else {
          format = MagickFormat.Jpeg // Default
        }

        console.log('🖼️ ImageMagick: Writing resized image', {
          format: format.toString(),
        })
        img.write(format, (data: Uint8Array) => {
          const blob = new Blob([data], { type: imageFile.type })
          console.log(
            '🖼️ ImageMagick: Resize operation completed successfully',
            {
              originalSize: imageFile.size,
              newSize: blob.size,
            },
          )
          resolve(blob)
        })
      })
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
        const format = this.getMagickFormat(options.targetFormat)
        const mimeType = this.getMimeType(options.targetFormat)

        console.log('🖼️ ImageMagick: Converting image format', {
          originalFormat: img.format.toString(),
          targetFormat: format.toString(),
          mimeType,
        })

        img.write(format, (data: Uint8Array) => {
          const blob = new Blob([data], { type: mimeType })
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

    // Check if this is a PNG file and use specialized PNG compression
    if (
      imageFile.type.includes('png') ||
      imageFile.name.toLowerCase().endsWith('.png')
    ) {
      console.log(
        '🖼️ ImageMagick: PNG detected, using specialized PNG compression',
      )
      try {
        const {
          ImageMagick,
          MagickFormat,
          DitherMethod,
          ColorSpace,
          QuantizeSettings,
        } = await initImageMagick()

        const arrayBuffer = await imageFile.file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        return new Promise((resolve) => {
          ImageMagick.read(uint8Array, (img) => {
            // Calculate number of colors based on quality for palette quantization
            const colors = Math.max(
              2,
              Math.min(256, Math.round((options.quality / 100) * 256)),
            )

            console.log('🖼️ ImageMagick: Setting PNG compression quality', {
              quality: options.quality,
              colors: colors,
            })

            // Use PNG format with quality settings and color quantization
            img.strip()
            img.quality = options.quality
            const quantizeSettings = new QuantizeSettings()
            quantizeSettings.colors = colors
            quantizeSettings.ditherMethod = DitherMethod.FloydSteinberg
            quantizeSettings.colorSpace = ColorSpace.Undefined
            quantizeSettings.measureErrors = false
            quantizeSettings.treeDepth = 0
            img.quantize(quantizeSettings)
            img.write(MagickFormat.Png, (data: Uint8Array) => {
              const blob = new Blob([data], { type: 'image/png' })
              console.log(
                '🖼️ ImageMagick: PNG compression completed successfully',
                {
                  originalSize: imageFile.size,
                  newSize: blob.size,
                  compressionRatio:
                    (
                      ((imageFile.size - blob.size) / imageFile.size) *
                      100
                    ).toFixed(1) + '%',
                  colors: colors,
                },
              )
              resolve(blob)
            })
          })
        })
      } catch (error) {
        console.warn(
          '🖼️ ImageMagick: PNG compression failed, falling back to standard compression:',
          error,
        )
        // Fall back to standard ImageMagick compression
      }
    }

    // Use ImageMagick for non-PNG files or as fallback
    const { ImageMagick, MagickFormat } = await initImageMagick()

    const arrayBuffer = await imageFile.file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    console.log('🖼️ ImageMagick: File loaded into memory', {
      size: uint8Array.length,
    })

    return new Promise((resolve) => {
      ImageMagick.read(uint8Array, (img) => {
        // Set quality for compression
        img.quality = options.quality
        console.log('🖼️ ImageMagick: Setting compression quality', {
          quality: options.quality,
        })

        // Determine format based on original file type
        let format: MagickFormat
        if (imageFile.type.includes('jpeg') || imageFile.type.includes('jpg')) {
          format = MagickFormat.Jpeg
        } else if (imageFile.type.includes('png')) {
          format = MagickFormat.Png
        } else if (imageFile.type.includes('webp')) {
          format = MagickFormat.WebP
        } else {
          format = MagickFormat.Jpeg // Default to JPEG for compression
        }

        console.log('🖼️ ImageMagick: Writing compressed image', {
          format: format.toString(),
        })
        img.write(format, (data: Uint8Array) => {
          const blob = new Blob([data], { type: imageFile.type })
          console.log('🖼️ ImageMagick: Compression completed successfully', {
            originalSize: imageFile.size,
            newSize: blob.size,
            compressionRatio:
              (((imageFile.size - blob.size) / imageFile.size) * 100).toFixed(
                1,
              ) + '%',
          })
          resolve(blob)
        })
      })
    })
  }
}

// Re-export shared utilities
export {
  formatFileSize,
  downloadFile,
  createObjectURL,
  revokeObjectURL,
} from './shared'
