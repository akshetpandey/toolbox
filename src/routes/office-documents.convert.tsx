import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useOfficeTools } from '@/contexts/OfficeToolsContext'
import {
  FileText,
  Loader2,
  CheckCircle,
  Download,
  X,
  RotateCcw,
} from 'lucide-react'
import { convertOfficeToPDF, getOutputFilename } from '@/lib/pandoc'
import { downloadBlob, formatFileSize } from '@/lib/shared'

export const Route = createFileRoute('/office-documents/convert')({
  component: ConvertTool,
  head: () => ({
    meta: [
      {
        title:
          'Office to PDF Converter - Free Browser-Based Document Conversion | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based office document to PDF converter. Convert Word, PowerPoint, and Excel files to PDF format entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'Word to PDF converter, PowerPoint to PDF, Excel to PDF, document converter, browser PDF creator',
      },
      {
        property: 'og:title',
        content: 'Office to PDF Converter - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based office document to PDF converter with complete privacy.',
      },
    ],
  }),
})

function ConvertTool() {
  const { isProcessing, setIsProcessing } = useProcessing()
  const { selectedFile, conversionStatus, setConversionStatus } =
    useOfficeTools()

  const handleConvertToPDF = useCallback(async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setConversionStatus(`Converting ${selectedFile.name}...`)

    try {
      const result = await convertOfficeToPDF(selectedFile.file)

      if (result.success && result.output instanceof Blob) {
        const outputName = getOutputFilename(selectedFile.name, 'pdf')
        downloadBlob(result.output, outputName)
        setConversionStatus(
          `✅ ${selectedFile.name} converted (${formatFileSize(result.output.size)})`,
        )
      } else {
        throw new Error(
          result.error ?? `Failed to convert ${selectedFile.name}`,
        )
      }
    } catch (error) {
      console.error('Conversion error:', error)
      setConversionStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setIsProcessing(false)
    }
  }, [selectedFile, setIsProcessing, setConversionStatus])

  // Auto-trigger conversion when file is selected
  useEffect(() => {
    if (selectedFile && !isProcessing && !conversionStatus) {
      void handleConvertToPDF()
    }
  }, [selectedFile, isProcessing, conversionStatus, handleConvertToPDF])

  return (
    <Card className="glass-card border-0 animate-fade-in h-full">
      <CardContent className="p-6 h-full">
        <div className="h-full flex flex-col justify-center items-center">
          {selectedFile ? (
            <div className="text-center space-y-4 w-full">
              {conversionStatus ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    {isProcessing ? (
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    ) : conversionStatus.includes('✅') ? (
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    ) : (
                      <X className="h-8 w-8 text-red-500" />
                    )}
                  </div>
                  <p className="text-lg font-medium text-foreground">
                    {conversionStatus}
                  </p>
                  {conversionStatus.includes('✅') && (
                    <p className="text-sm text-muted-foreground">
                      Your PDF has been downloaded automatically.
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                  <p className="text-lg font-medium text-foreground">
                    Preparing conversion...
                  </p>
                </div>
              )}

              {selectedFile && !isProcessing && (
                <div className="flex justify-center gap-2 mt-6">
                  <Button
                    onClick={() => void handleConvertToPDF()}
                    className="flex items-center gap-2"
                  >
                    {conversionStatus.includes('✅') ? (
                      <>
                        <RotateCcw className="h-4 w-4" />
                        Convert Again
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Convert to PDF
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Office Document Converter
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select a Word, PowerPoint, or Excel file to convert it to PDF
                  format
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
