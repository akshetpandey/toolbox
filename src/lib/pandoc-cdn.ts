/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ConsoleStdout,
  File,
  Directory,
  OpenFile,
  PreopenDirectory,
  WASI,
  Inode,
} from '@bjorn3/browser_wasi_shim'

// Use unpkg CDN instead of local import
const pandocWasmUrl = 'https://unpkg.com/wasm-pandoc@0.8.0/pandoc.wasm'

let pandocWasm: ArrayBuffer | null = null
let pandocWasmPromise: Promise<ArrayBuffer> | null = null

// Cache the WASM file to avoid multiple downloads
async function getPandocWasm(): Promise<ArrayBuffer> {
  if (pandocWasm) {
    return pandocWasm
  }

  pandocWasmPromise ??= (async () => {
    console.log('Downloading pandoc WASM from CDN...')
    const response = await fetch(pandocWasmUrl)
    if (!response.ok) {
      throw new Error(
        `Failed to download pandoc WASM: ${response.status} ${response.statusText}`,
      )
    }
    const arrayBuffer = await response.arrayBuffer()
    pandocWasm = arrayBuffer
    console.log('Pandoc WASM downloaded successfully')
    return arrayBuffer
  })()

  return pandocWasmPromise
}

const args = ['pandoc.wasm', '+RTS', '-H64m', '-RTS']
const env: string[] = []
const inFile = new File(new Uint8Array(), {
  readonly: true,
})
const outFile = new File(new Uint8Array(), {
  readonly: false,
})

async function toUint8Array(inData: string | Blob): Promise<Uint8Array> {
  let uint8Array

  if (typeof inData === 'string') {
    // If inData is a text string, convert it to a Uint8Array
    const encoder = new TextEncoder()
    uint8Array = encoder.encode(inData)
  } else if (inData instanceof Blob) {
    // If inData is a Blob, read it as an ArrayBuffer and then convert to Uint8Array
    const arrayBuffer = await inData.arrayBuffer()
    uint8Array = new Uint8Array(arrayBuffer)
  } else {
    throw new Error('Unsupported type: inData must be a string or a Blob')
  }

  return uint8Array
}

const textDecoder = new TextDecoder('utf-8', {
  fatal: true,
})

function convertData(data: Uint8Array): string | Blob {
  let outData
  try {
    // Attempt to decode the data as UTF-8 text
    // Return as string if successful
    outData = textDecoder.decode(data)
  } catch {
    // If decoding fails, assume it's binary data and return as Blob
    outData = new Blob([data])
  }
  return outData
}

function convertItem(
  name: string,
  value: File | Directory | Inode,
): [string, any] {
  if ('contents' in value && value.contents) {
    // directory
    return [
      name,
      new Map(
        [...value.contents].map(([name, value]: [string, any]) =>
          convertItem(name, value),
        ),
      ),
    ]
  } else if ('data' in value && value.data) {
    // file
    return [name, convertData(value.data)]
  }
  return [name, value]
}

export async function pandoc(
  args_str: string,
  inData: any,
  resources: any[] = [],
): Promise<{
  out: string | Blob
  mediaFiles: Map<string, any>
}> {
  const files: [string, File][] = [
    ['in', inFile],
    ['out', outFile],
  ]

  for (const resource of resources) {
    const contents = await toUint8Array(resource.contents)
    files.push([
      resource.filename,
      new File(contents, {
        readonly: true,
      }),
    ])
  }

  const rootDir = new PreopenDirectory('/', new Map(files))

  const fds = [
    new OpenFile(
      new File(new Uint8Array(), {
        readonly: true,
      }),
    ),
    ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
    ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
    rootDir,
  ]
  const options = {
    debug: false,
  }
  const wasi = new WASI(args, env, fds, options)

  // Use CDN version instead of local import
  const wasmBuffer = await getPandocWasm()
  const { instance } = await WebAssembly.instantiate(wasmBuffer, {
    wasi_snapshot_preview1: wasi.wasiImport,
  })

  // @ts-expect-error: wasi initialize
  wasi.initialize(instance)
  // @ts-expect-error: wasi ctors
  instance.exports.__wasm_call_ctors()

  function memory_data_view() {
    // @ts-expect-error: wasi memory
    return new DataView(instance.exports.memory.buffer)
  }

  // @ts-expect-error: malloc
  const argc_ptr = instance.exports.malloc(4)
  memory_data_view().setUint32(argc_ptr, args.length, true)
  // @ts-expect-error: malloc
  const argv = instance.exports.malloc(4 * (args.length + 1))
  for (let i = 0; i < args.length; ++i) {
    // @ts-expect-error: malloc
    const arg = instance.exports.malloc(args[i].length + 1)
    new TextEncoder().encodeInto(
      args[i],
      // @ts-expect-error: wasi memory
      new Uint8Array(instance.exports.memory.buffer, arg, args[i].length),
    )
    memory_data_view().setUint8(arg + args[i].length, 0)
    memory_data_view().setUint32(argv + 4 * i, arg, true)
  }
  memory_data_view().setUint32(argv + 4 * args.length, 0, true)
  // @ts-expect-error: malloc
  const argv_ptr = instance.exports.malloc(4)
  memory_data_view().setUint32(argv_ptr, argv, true)

  // @ts-expect-error: hs_init_with_rtsopts
  instance.exports.hs_init_with_rtsopts(argc_ptr, argv_ptr)

  // @ts-expect-error: malloc
  const args_ptr = instance.exports.malloc(args_str.length)
  new TextEncoder().encodeInto(
    args_str,
    // @ts-expect-error: wasi memory
    new Uint8Array(instance.exports.memory.buffer, args_ptr, args_str.length),
  )

  inFile.data = await toUint8Array(inData)

  // @ts-expect-error: wasm_main
  instance.exports.wasm_main(args_ptr, args_str.length)

  // Find any generated media files
  const knownFileNames = ['in', 'out'].concat(
    resources.map((resource) => resource.filename),
  )
  const mediaFiles = new Map(
    [...rootDir.dir.contents]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([name, _value]) => !knownFileNames.includes(name))
      .map(([name, value]) => convertItem(name, value)),
  )

  return {
    out: convertData(outFile.data),
    mediaFiles,
  }
}
