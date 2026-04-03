export interface ConversionOptions {
  from: string
  to: string
  standalone?: boolean
  additionalArgs?: string[]
}

export interface ConversionResult {
  success: boolean
  output?: Blob | string
  error?: string
}

export interface OfficeFile {
  id: string
  file: File
  name: string
  size: number
  type: string
}

/**
 * Convert an office document to PDF using pandoc-wasm + typst.
 * Pipeline: input format → (pandoc) → typst markup → (typst WASM) → PDF
 */
export async function convertOfficeToPDF(
  file: File,
): Promise<ConversionResult> {
  try {
    const inputFormat = getInputFormat(file.name)

    const { convert } = await import('pandoc-wasm')
    const { compileTypstToPDF } = await import('./typst')
    const { extractZipEntries } = await import('./archive')

    // Step 1: Convert the office document to Typst markup via pandoc.
    // Use extract-media with a .zip extension so pandoc bundles embedded
    // images into a single zip file (directory mode is broken in pandoc-wasm
    // because its WASI filesystem iteration doesn't traverse subdirectories).
    const typstResult = await convert(
      {
        from: inputFormat,
        to: 'typst',
        standalone: true,
        'input-files': [file.name],
        'extract-media': 'media.zip',
      },
      null,
      { [file.name]: file },
    )

    if (!typstResult.stdout) {
      throw new Error(
        'Conversion to Typst failed — no output received' +
          (typstResult.stderr ? `: ${typstResult.stderr}` : ''),
      )
    }

    // Step 2: Extract embedded media from the zip pandoc produced.
    // pandoc puts images into media.zip (e.g. media/image1.png) and
    // the typst output references them as ./media/image1.png.
    const resourceFiles: Record<string, Uint8Array> = {}

    const mediaZip = typstResult.files?.['media.zip']
    if (mediaZip instanceof Blob && mediaZip.size > 0) {
      const zipBytes = new Uint8Array(await mediaZip.arrayBuffer())
      const entries = await extractZipEntries(zipBytes)
      for (const [path, data] of Object.entries(entries)) {
        resourceFiles[path] = data
        // Also register with ./ prefix since pandoc may reference as ./media/…
        if (!path.startsWith('./')) {
          resourceFiles[`./${path}`] = data
        }
      }
    }

    // Step 3: Compile the Typst markup to PDF
    const pdfData = await compileTypstToPDF(typstResult.stdout, resourceFiles)

    const pdfBlob = new Blob([pdfData.buffer as ArrayBuffer], {
      type: 'application/pdf',
    })

    return {
      success: true,
      output: pdfBlob,
    }
  } catch (error) {
    console.error('Office to PDF conversion error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown conversion error',
    }
  }
}

/**
 * Convert an office document to another format using pandoc-wasm
 */
export async function convertOfficeDocument(
  file: File,
  options: ConversionOptions,
): Promise<ConversionResult> {
  try {
    // Build pandoc options object
    const pandocOptions: Record<string, unknown> = {
      from: options.from,
      to: options.to,
      'input-files': [file.name],
    }

    if (options.standalone) {
      pandocOptions.standalone = true
    }

    const { convert } = await import('pandoc-wasm')

    // Parse additional args into options
    if (options.additionalArgs) {
      for (let i = 0; i < options.additionalArgs.length; i++) {
        const arg = options.additionalArgs[i]
        if (arg.startsWith('--')) {
          const eqIndex = arg.indexOf('=')
          if (eqIndex !== -1) {
            pandocOptions[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1)
          } else if (
            i + 1 < options.additionalArgs.length &&
            !options.additionalArgs[i + 1].startsWith('--')
          ) {
            pandocOptions[arg.slice(2)] = options.additionalArgs[++i]
          } else {
            pandocOptions[arg.slice(2)] = true
          }
        }
      }
    }

    const result = await convert(pandocOptions, null, {
      [file.name]: file,
    })

    if (result.stdout) {
      return {
        success: true,
        output: result.stdout,
      }
    } else {
      throw new Error('Conversion failed - no output received')
    }
  } catch (error) {
    console.error('Office document conversion error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown conversion error',
    }
  }
}

/**
 * Get supported input formats for office documents
 */
export function getSupportedInputFormats(): string[] {
  return [
    'docx',
    'doc',
    'pptx',
    'ppt',
    'xlsx',
    'xls',
    'odt',
    'odp',
    'ods',
    'rtf',
  ]
}

/**
 * Get supported output formats
 */
export function getSupportedOutputFormats(): string[] {
  return ['pdf', 'html', 'markdown', 'docx', 'odt', 'txt', 'epub', 'latex']
}

/**
 * Check if a file is a supported office document
 */
export function isOfficeFile(file: File): boolean {
  const extension = file.name.toLowerCase().split('.').pop()
  return getSupportedInputFormats().includes(extension ?? '')
}

/**
 * Create an OfficeFile object from a File
 */
export function createOfficeFile(file: File): OfficeFile {
  return {
    id: `${file.name}-${file.size}-${Date.now()}`,
    file,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
  }
}

/**
 * Get appropriate output filename with extension
 */
export function getOutputFilename(
  originalName: string,
  outputFormat: string,
): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '')
  const extensions: Record<string, string> = {
    pdf: 'pdf',
    html: 'html',
    markdown: 'md',
    docx: 'docx',
    odt: 'odt',
    txt: 'txt',
    epub: 'epub',
    latex: 'tex',
  }

  const extension = extensions[outputFormat] || outputFormat
  return `${baseName}.${extension}`
}

function getInputFormat(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'docx':
    case 'doc':
      return 'docx'
    case 'pptx':
    case 'ppt':
      return 'pptx'
    case 'xlsx':
    case 'xls':
      return 'xlsx'
    default:
      throw new Error(`Unsupported file format: ${ext}`)
  }
}
