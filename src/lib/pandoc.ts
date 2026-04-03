import { convert } from 'pandoc-wasm'

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
 * Convert an office document to PDF using pandoc-wasm
 * Uses HTML as intermediate format since WASM pandoc cannot produce PDF directly
 */
export async function convertOfficeToPDF(
  file: File,
): Promise<ConversionResult> {
  try {
    console.log('Starting PDF conversion for:', file.name, 'Size:', file.size)

    const fileContent = await file.arrayBuffer()
    console.log('File content loaded, size:', fileContent.byteLength)

    const inputFormat = getInputFormat(file.name)
    console.log('Detected input format:', inputFormat)

    // Convert to HTML first since WASM pandoc cannot produce PDF directly
    console.log('Converting to HTML...')
    const result = await convert(
      {
        from: inputFormat,
        to: 'html',
        standalone: true,
        'embed-resources': true,
      },
      null,
      { [file.name]: new Blob([fileContent]) },
    )

    console.log('HTML conversion result, stderr:', result.stderr)

    if (!result.stdout) {
      throw new Error('HTML conversion failed - no output received')
    }

    console.log('HTML content length:', result.stdout.length)
    await openHTMLInPrintDialog(result.stdout, file.name)

    return {
      success: true,
      output: undefined, // No file download - user generates PDF via print dialog
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
 * Open HTML content in a print dialog for PDF generation
 */
async function openHTMLInPrintDialog(
  htmlContent: string,
  originalFileName: string,
): Promise<void> {
  return new Promise((resolve) => {
    const originalTitle = document.title

    try {
      console.log('Creating print iframe...')

      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.top = '-9999px'
      iframe.style.width = '794px' // A4 width in pixels at 96 DPI
      iframe.style.height = '1123px' // A4 height in pixels at 96 DPI

      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document
      if (!iframeDoc) {
        console.error('Could not access iframe document')
        resolve()
        return
      }

      const printableHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: A4;
              margin: 0.75in;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 100%;
              margin: 0;
              padding: 0;
              background: white;
            }

            h1, h2, h3, h4, h5, h6 {
              color: #2c3e50;
              margin: 1.5em 0 0.5em 0;
              font-weight: 600;
              line-height: 1.3;
            }

            h1 { font-size: 2em; }
            h2 { font-size: 1.5em; }
            h3 { font-size: 1.25em; }

            p {
              margin: 0.75em 0;
              text-align: justify;
            }

            ul, ol {
              margin: 0.75em 0;
              padding-left: 2em;
            }

            li {
              margin: 0.25em 0;
            }

            table {
              border-collapse: collapse;
              width: 100%;
              margin: 1em 0;
              font-size: 0.9em;
            }

            table, th, td {
              border: 1px solid #ddd;
            }

            th {
              background-color: #f8f9fa;
              font-weight: 600;
              text-align: left;
              padding: 12px 8px;
            }

            td {
              padding: 8px;
              text-align: left;
              vertical-align: top;
            }

            img {
              max-width: 100%;
              height: auto;
              display: block;
              margin: 1em auto;
            }

            code {
              background-color: #f8f9fa;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 0.9em;
            }

            pre {
              background-color: #f8f9fa;
              padding: 1em;
              border-radius: 5px;
              overflow-x: auto;
              border-left: 4px solid #007acc;
            }

            a {
              color: #007acc;
              text-decoration: none;
            }

            a:hover {
              text-decoration: underline;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              h1, h2, h3, h4, h5, h6 {
                break-after: avoid;
                page-break-after: avoid;
              }

              table, img {
                break-inside: avoid;
                page-break-inside: avoid;
              }

              body {
                color: #000 !important;
                background: white !important;
              }
            }

            .sourceCode {
              background-color: #f8f9fa;
              border: 1px solid #e9ecef;
              border-radius: 3px;
              padding: 0.5em;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `

      iframeDoc.open()
      iframeDoc.write(printableHtml)
      iframeDoc.close()

      iframe.onload = () => {
        try {
          console.log('Content loaded, opening print dialog...')

          const baseFileName = originalFileName.replace(/\.[^/.]+$/, '')
          const pdfFileName = baseFileName + '.pdf'
          document.title = pdfFileName

          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()

          console.log('Print dialog opened successfully')

          setTimeout(() => {
            document.title = originalTitle

            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe)
            }
            resolve()
          }, 1000)
        } catch (error) {
          console.error('Error opening print dialog:', error)

          document.title = originalTitle

          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
          resolve()
        }
      }

      setTimeout(() => {
        console.log('Print dialog timeout, cleaning up...')

        document.title = originalTitle

        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
        resolve()
      }, 5000)
    } catch (error) {
      console.error('Error creating print dialog:', error)
      document.title = originalTitle
      resolve()
    }
  })
}

/**
 * Convert an office document to another format using pandoc-wasm
 */
export async function convertOfficeDocument(
  file: File,
  options: ConversionOptions,
): Promise<ConversionResult> {
  try {
    console.log(
      'Starting document conversion for:',
      file.name,
      'Size:',
      file.size,
    )
    console.log('Conversion options:', options)

    const fileContent = await file.arrayBuffer()
    console.log('File content loaded, size:', fileContent.byteLength)

    // Build pandoc options object
    const pandocOptions: Record<string, unknown> = {
      from: options.from,
      to: options.to,
    }

    if (options.standalone) {
      pandocOptions.standalone = true
    }

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

    console.log('Pandoc options:', pandocOptions)

    const result = await convert(pandocOptions, null, {
      [file.name]: new Blob([fileContent]),
    })

    console.log('Pandoc conversion result, stderr:', result.stderr)

    if (result.stdout) {
      console.log('Conversion successful, output length:', result.stdout.length)
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
