import wasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import wasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

const modelSize = 320
const pixelCount = modelSize * modelSize
const mean = [0.485, 0.456, 0.406]
const deviation = [0.229, 0.224, 0.225]

async function loadModel() {
  const { env, InferenceSession, Tensor } = await import('onnxruntime-web/wasm')
  env.wasm.numThreads = 1
  env.wasm.wasmPaths = {
    mjs: new URL(wasmModuleUrl, window.location.href).href,
    wasm: new URL(wasmBinaryUrl, window.location.href).href,
  }
  const response = await fetch(`${import.meta.env.BASE_URL}models/u2netp.onnx`)
  if (!response.ok) throw new Error('The background model could not be loaded.')
  const session = await InferenceSession.create(await response.arrayBuffer(), {
    executionProviders: ['wasm'],
  })
  return { session, Tensor }
}

let model: ReturnType<typeof loadModel> | undefined

function getModel() {
  model ??= loadModel().catch((error: unknown) => {
    model = undefined
    throw error
  })
  return model
}

export async function removeImageBackground(previewUrl: string): Promise<Blob> {
  const image = new Image()
  image.src = previewUrl
  await image.decode()

  const mask = document.createElement('canvas')
  mask.width = mask.height = modelSize
  const maskContext = mask.getContext('2d', { willReadFrequently: true })
  if (!maskContext) throw new Error('The browser could not open this image.')
  maskContext.imageSmoothingQuality = 'high'
  maskContext.drawImage(image, 0, 0, modelSize, modelSize)
  const pixels = maskContext.getImageData(0, 0, modelSize, modelSize).data
  // U²-Netp expects normalized planar RGB at 320 × 320.
  let maximum = 1
  for (let offset = 0; offset < pixels.length; offset += 4) {
    maximum = Math.max(
      maximum,
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
    )
  }
  const input = new Float32Array(3 * pixelCount)
  for (let channel = 0; channel < 3; channel++) {
    for (let pixel = 0; pixel < pixelCount; pixel++) {
      input[channel * pixelCount + pixel] =
        (pixels[pixel * 4 + channel] / maximum - mean[channel]) /
        deviation[channel]
    }
  }

  const { session, Tensor } = await getModel()
  const tensor = new Tensor('float32', input, [1, 3, modelSize, modelSize])
  const outputName = session.outputNames[0]
  const alphaMask = maskContext.createImageData(modelSize, modelSize)
  try {
    const { [outputName]: output } = await session.run(
      { [session.inputNames[0]]: tensor },
      [outputName],
    )
    try {
      const values = output.data
      if (!(values instanceof Float32Array) || values.length !== pixelCount) {
        throw new Error('The background model returned an invalid mask.')
      }
      let min = Infinity
      let max = -Infinity
      for (const value of values) {
        min = Math.min(min, value)
        max = Math.max(max, value)
      }
      const range = max - min
      if (!Number.isFinite(range) || range <= Number.EPSILON) {
        throw new Error('A subject could not be isolated in this image.')
      }
      for (let pixel = 0; pixel < pixelCount; pixel++) {
        alphaMask.data[pixel * 4 + 3] = ((values[pixel] - min) / range) * 255
      }
    } finally {
      output.dispose()
    }
  } finally {
    tensor.dispose()
  }
  maskContext.putImageData(alphaMask, 0, 0)

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('The browser could not create the output image.')
  context.drawImage(image, 0, 0)
  context.globalCompositeOperation = 'destination-in'
  context.imageSmoothingQuality = 'high'
  context.drawImage(mask, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The output image could not be saved.'))
    }, 'image/png')
  })
}
