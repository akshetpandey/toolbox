import { PDFDocument } from 'pdf-lib'

export interface PDFFile {
  id: string
  file: File
  name: string
  size: number
  preview?: string
}

export interface PDFMergeOptions {
  files: PDFFile[]
  onFileProcessed?: (
    fileIndex: number,
    fileName: string,
    pageCount: number,
  ) => void
}

export interface PDFOperationResult {
  success: boolean
  error?: string
  blob?: Blob
}

/**
 * Merges multiple PDF files into a single PDF document
 */
export async function mergePDFs(
  options: PDFMergeOptions,
): Promise<PDFOperationResult> {
  const { files, onFileProcessed } = options

  if (files.length < 2) {
    return {
      success: false,
      error: 'At least 2 PDF files are required for merging',
    }
  }

  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create()

    // Process each PDF file
    for (let i = 0; i < files.length; i++) {
      const pdfFile = files[i]

      // Read the PDF file
      const arrayBuffer = await pdfFile.file.arrayBuffer()

      // Load the PDF document
      const pdf = await PDFDocument.load(arrayBuffer)

      // Copy all pages from this PDF to the merged PDF
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
      pages.forEach((page) => mergedPdf.addPage(page))

      // Notify about file processing completion
      onFileProcessed?.(i, pdfFile.name, pages.length)
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save()

    // Create blob
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' })

    return {
      success: true,
      blob,
    }
  } catch (error) {
    console.error('PDF merge error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during PDF merge',
    }
  }
}

/**
 * Downloads a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Validates if a file is a valid PDF
 */
export function isPDFFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

/**
 * Creates a PDFFile object from a File
 */
export function createPDFFile(file: File): PDFFile {
  return {
    id: `${file.name}-${file.size}-${Date.now()}`,
    file,
    name: file.name,
    size: file.size,
  }
}
