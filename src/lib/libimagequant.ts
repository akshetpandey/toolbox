import LibImageQuant, { type QuantizationOptions } from 'libimagequant-wasm'
import type { ImageFile } from './shared'

export class LibImageQuantProcessor {
  private quantizer: LibImageQuant | null = null

  private initQuantizer(): LibImageQuant {
    if (!this.quantizer) {
      console.log('🎨 LibImageQuant: Initializing quantizer...')
      this.quantizer = new LibImageQuant({
        workerUrl: new URL(
          'libimagequant-wasm/worker',
          import.meta.url,
        ).toString(),
        wasmUrl: new URL('libimagequant-wasm/wasm', import.meta.url).toString(),
        initTimeout: 30 * 1000, // 30 seconds init timeout
        operationTimeout: 3 * 60 * 1000, // 3 minutes operation timeout
      })
      console.log('🎨 LibImageQuant: Quantizer initialized successfully')
    }
    return this.quantizer
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
      const quantizer = this.initQuantizer()

      const options: QuantizationOptions = {
        maxColors: 256,
        quality: {
          min: 0,
          target: quality,
        },
        speed: 3,
        dithering: 0.7,
      }

      console.log('🎨 LibImageQuant: Processing PNG', {
        options,
      })

      const pngBytes = new Uint8Array(await imageFile.file.arrayBuffer())

      const result = await quantizer.quantizePng(pngBytes, options)

      console.log('🎨 LibImageQuant: PNG quantization completed')

      const byteOffset = result.pngBytes.byteOffset
      const arrayBuffer = result.pngBytes.slice(
        byteOffset,
        byteOffset + result.pngBytes.byteLength,
      )
      const blob = new Blob([arrayBuffer], { type: 'image/png' })

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
    if (this.quantizer) {
      console.log('🎨 LibImageQuant: Disposing quantizer')
      this.quantizer.dispose()
      this.quantizer = null
    }
  }
}
