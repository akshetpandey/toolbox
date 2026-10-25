import type LibImageQuant from 'libimagequant-wasm'
import type { QuantizationOptions } from 'libimagequant-wasm'
import type { ImageFile } from './shared'

export class LibImageQuantProcessor {
  private quantizer: LibImageQuant | null = null
  private initializing: Promise<LibImageQuant> | null = null
  private generation = 0

  private async initQuantizer(): Promise<LibImageQuant> {
    if (this.quantizer) return this.quantizer
    if (!this.initializing) {
      const generation = this.generation
      // 0.5 embeds its worker and WASM in the browser entry. Load that entry
      // only when PNG compression is requested and share concurrent imports.
      const initializing = import('libimagequant-wasm').then(
        ({ default: Quantizer }) => {
          if (generation !== this.generation) {
            throw new Error('PNG compression was cancelled')
          }
          this.quantizer = new Quantizer({
            initTimeout: 30 * 1000,
            operationTimeout: 3 * 60 * 1000,
          })
          return this.quantizer
        },
      )
      this.initializing = initializing
      void initializing.catch(() => {
        if (this.initializing === initializing) this.initializing = null
      })
    }
    return this.initializing
  }

  async compressPNG(
    imageFile: ImageFile,
    quality: number, // 0-100, convert to libimagequant options
  ): Promise<Blob> {
    console.log('🎨 LibImageQuant: Starting PNG compression', {
      fileName: imageFile.name,
      quality,
    })

    try {
      const quantizer = await this.initQuantizer()

      const options: QuantizationOptions = {
        maxColors: 256,
        quality: {
          min: 0,
          target: quality,
        },
        speed: 3,
        dithering: 0.7,
        metadata: 'safe',
      }

      console.log('🎨 LibImageQuant: Processing PNG', {
        options,
      })

      const pngBytes = new Uint8Array(await imageFile.file.arrayBuffer())

      const result = await quantizer.quantizePng(pngBytes, options)

      console.log('🎨 LibImageQuant: PNG quantization completed')

      const blob = new Blob([result.pngBytes], { type: 'image/png' })

      console.log('🎨 LibImageQuant: PNG compression completed successfully', {
        originalSize: imageFile.size,
        newSize: blob.size,
        compressionRatio:
          (((imageFile.size - blob.size) / imageFile.size) * 100).toFixed(1) +
          '%',
        colors: result.paletteLength,
        quality: result.quality,
      })

      return blob
    } catch (error) {
      console.error('🎨 LibImageQuant: Error during PNG compression:', error)
      throw error
    }
  }

  dispose(): void {
    this.generation++
    this.initializing = null
    if (this.quantizer) {
      console.log('🎨 LibImageQuant: Disposing quantizer')
      this.quantizer.dispose()
      this.quantizer = null
    }
  }
}
