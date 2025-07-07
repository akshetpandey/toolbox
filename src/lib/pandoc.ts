import { pandoc } from 'wasm-pandoc'

interface PandocResult {
  out: Blob | string
  mediaFiles: Map<string, Map<string, Blob>>
}

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
  mediaFiles?: Map<string, Map<string, Blob>>
}

export interface OfficeFile {
  id: string
  file: File
  name: string
  size: number
  type: string
}

/**
 * Convert an office document to PDF using wasm-pandoc
 * Uses HTML as intermediate format to avoid LaTeX dependency issues in WASI
 */
export async function convertOfficeToPDF(
  file: File,
): Promise<ConversionResult> {
  try {
    console.log('Starting PDF conversion for:', file.name, 'Size:', file.size)

    // Read file as ArrayBuffer
    const fileContent = await file.arrayBuffer()
    console.log('File content loaded, size:', fileContent.byteLength)

    // Determine input format based on file extension
    const fileExtension = file.name.toLowerCase().split('.').pop()
    let inputFormat = 'docx'

    switch (fileExtension) {
      case 'docx':
        inputFormat = 'docx'
        break
      case 'doc':
        inputFormat = 'doc'
        break
      case 'pptx':
        inputFormat = 'pptx'
        break
      case 'ppt':
        inputFormat = 'ppt'
        break
      case 'xlsx':
        inputFormat = 'xlsx'
        break
      case 'xls':
        inputFormat = 'xls'
        break
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`)
    }

    console.log('Detected input format:', inputFormat)

    // First convert to HTML to avoid LaTeX/PDF generation issues in WASI
    console.log('Converting to HTML first...')
    const htmlArgs = `-f ${inputFormat} -t html --standalone --embed-resources`
    console.log('Pandoc HTML args:', htmlArgs)

    const htmlResult = (await pandoc(
      htmlArgs,
      new Blob([fileContent]),
      [], // No additional files needed for basic conversion
    )) as PandocResult

    console.log('HTML conversion result:', htmlResult)

    if (!htmlResult.out) {
      throw new Error('HTML conversion failed - no output received')
    }

    // Open HTML in print dialog for PDF generation
    console.log('Opening HTML in print dialog for PDF generation...')
    const htmlContent =
      htmlResult.out instanceof Blob
        ? await htmlResult.out.text()
        : htmlResult.out
    console.log('HTML content length:', htmlContent.length)

    await openHTMLInPrintDialog(htmlContent, file.name)

    // Return success without file - PDF generation is handled by user through print dialog
    return {
      success: true,
      output: undefined, // No file download - user generates PDF via print dialog
      mediaFiles: htmlResult.mediaFiles,
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
    // Store the original title at the start
    const originalTitle = document.title

    try {
      console.log('Creating print iframe...')

      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.top = '-9999px'
      iframe.style.width = '794px' // A4 width in pixels at 96 DPI
      iframe.style.height = '1123px' // A4 height in pixels at 96 DPI

      document.body.appendChild(iframe)

      // Get the iframe document
      const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document
      if (!iframeDoc) {
        console.error('Could not access iframe document')
        resolve()
        return
      }

      // Create well-formatted HTML with print styles
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
            
            /* Typography */
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
            
            /* Lists */
            ul, ol {
              margin: 0.75em 0;
              padding-left: 2em;
            }
            
            li {
              margin: 0.25em 0;
            }
            
            /* Tables */
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
            
            /* Images */
            img {
              max-width: 100%;
              height: auto;
              display: block;
              margin: 1em auto;
            }
            
            /* Code and preformatted text */
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
            
            /* Links */
            a {
              color: #007acc;
              text-decoration: none;
            }
            
            a:hover {
              text-decoration: underline;
            }
            
            /* Print-specific styles */
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              /* Avoid breaking elements across pages */
              h1, h2, h3, h4, h5, h6 {
                break-after: avoid;
                page-break-after: avoid;
              }
              
              table, img {
                break-inside: avoid;
                page-break-inside: avoid;
              }
              
              /* Ensure good contrast for printing */
              body {
                color: #000 !important;
                background: white !important;
              }
            }
            
            /* Remove any potential pandoc artifacts */
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

      // Write the HTML to the iframe
      iframeDoc.open()
      iframeDoc.write(printableHtml)
      iframeDoc.close()

      // Wait for content to load, then open print dialog
      iframe.onload = () => {
        try {
          console.log('Content loaded, opening print dialog...')

          // Temporarily change the document title for the print dialog
          const baseFileName = originalFileName.replace(/\.[^/.]+$/, '')
          const pdfFileName = baseFileName + '.pdf'
          console.log('Original file name:', originalFileName)
          console.log('Base file name:', baseFileName)
          console.log('PDF file name:', pdfFileName)
          document.title = pdfFileName
          console.log('Changed document title to:', pdfFileName)

          // Focus the iframe and trigger print
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()

          console.log('Print dialog opened successfully')

          // Restore the original title and clean up after a delay
          setTimeout(() => {
            document.title = originalTitle
            console.log('Restored original document title:', originalTitle)

            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe)
              console.log('Print iframe cleaned up')
            }
            resolve()
          }, 1000)
        } catch (error) {
          console.error('Error opening print dialog:', error)

          // Make sure to restore the original title even if there's an error
          document.title = originalTitle
          console.log(
            'Restored original document title after error:',
            originalTitle,
          )

          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
          resolve()
        }
      }

      // Fallback timeout
      setTimeout(() => {
        console.log('Print dialog timeout, cleaning up...')

        // Restore original title
        document.title = originalTitle
        console.log(
          'Restored original document title after timeout:',
          originalTitle,
        )

        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
        resolve()
      }, 5000)
    } catch (error) {
      console.error('Error creating print dialog:', error)
      // Restore original title in case of error
      document.title = originalTitle
      console.log(
        'Restored original document title after creation error:',
        originalTitle,
      )
      resolve()
    }
  })
}

/**
 * Convert an office document to another format using wasm-pandoc
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

    // Read file as ArrayBuffer
    const fileContent = await file.arrayBuffer()
    console.log('File content loaded, size:', fileContent.byteLength)

    // Build pandoc command arguments
    let args = `-f ${options.from} -t ${options.to}`

    if (options.standalone) {
      args += ' --standalone'
    }

    if (options.additionalArgs) {
      args += ' ' + options.additionalArgs.join(' ')
    }

    console.log('Pandoc args:', args)

    // Convert using pandoc
    const result = await pandoc(
      args,
      new Blob([fileContent]),
      [], // No additional files for basic conversion
    )

    console.log('Pandoc conversion result:', result)

    if (result.out) {
      console.log('Conversion successful, output type:', typeof result.out)
      return {
        success: true,
        output: result.out,
        mediaFiles: result.mediaFiles,
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
