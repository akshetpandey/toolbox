import { ImageMagick, MagickFormat } from '@imagemagick/magick-wasm'

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
        return MagickFormat.WebP
      case 'png':
        return MagickFormat.Png
      case 'jpg':
      case 'jpeg':
        return MagickFormat.Jpeg
      case 'gif':
        return MagickFormat.Gif
      default:
        return MagickFormat.WebP
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
