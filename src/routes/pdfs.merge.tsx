import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePDFTools } from '@/contexts/PDFToolsContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  Merge,
  ArrowUpDown,
  Loader2,
  Download,
  FileText,
  Info,
} from 'lucide-react'
import { mergePDFs } from '@/lib/pdf'
import { downloadBlob } from '@/lib/shared'

export const Route = createFileRoute('/pdfs/merge')({
  component: PDFMergeRoute,
  head: () => ({
    meta: [
      {
        title: 'PDF Merger - Free Browser-Based PDF Combining Tool | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based PDF merger. Combine multiple PDF files into one document with drag-and-drop reordering. Process PDFs entirely in your browser.',
      },
      {
        name: 'keywords',
        content:
          'free PDF merger, combine PDFs, merge PDF files, browser PDF editor, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'PDF Merger - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based PDF merger. Combine multiple PDFs into one document.',
      },
    ],
  }),
})

function PDFMergeRoute() {
  const { selectedFiles } = usePDFTools()
  const { isProcessing, setIsProcessing } = useProcessing()

  const handleMergePDFs = async () => {
    if (selectedFiles.length < 2) {
      alert('Please select at least 2 PDF files to merge')
      return
    }

    console.log('📄 PDFTools: Starting PDF merge operation', {
      fileCount: selectedFiles.length,
      fileNames: selectedFiles.map((f) => f.name),
    })

    setIsProcessing(true)

    try {
      const result = await mergePDFs({
        files: selectedFiles,
        onFileProcessed: (fileIndex, fileName, pageCount) => {
          console.log(
            `📄 PDFTools: Processed ${fileName} - ${pageCount} pages added (${fileIndex + 1}/${selectedFiles.length})`,
          )
        },
      })

      if (result.success && result.blob) {
        downloadBlob(result.blob, 'merged-document.pdf')
        console.log('📄 PDFTools: PDF merge completed successfully')
        setIsProcessing(false)
      } else {
        throw new Error(result.error ?? 'Unknown error occurred')
      }
    } catch (error) {
      console.error('📄 PDFTools: Error merging PDFs:', error)
      alert(
        `Error merging PDFs: ${error instanceof Error ? error.message : 'Please try again.'}`,
      )
      setIsProcessing(false)
    }
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6">
        {selectedFiles.length >= 2 ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Merge className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-foreground">Merge PDFs</h3>
                <p className="text-sm text-muted-foreground">
                  Combine {selectedFiles.length} PDF files into one document in
                  the order shown
                </p>
              </div>
            </div>

            {/* Order preview */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Merge Order
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`preview-${index}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="text-muted-foreground bg-muted rounded px-2 py-1 min-w-[1.5rem] text-center text-xs">
                      {index + 1}
                    </span>
                    <span className="text-foreground truncate">
                      {file.name}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                You can drag and drop files in the left panel to reorder them
              </p>
            </div>

            <Button
              onClick={() => void handleMergePDFs()}
              disabled={isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Merge & Download
                </>
              )}
            </Button>

            {/* Info about merge */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="flex flex-col gap-2">
                  <h4 className="font-semibold text-foreground">
                    About PDF Merge
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    This tool combines multiple PDF files into a single
                    document. All embedded fonts and formatting will be
                    preserved in the merged PDF. Files are merged in the exact
                    order they appear in the list above - you can drag and drop
                    files to reorder them as needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select at least 2 PDF files to merge</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
