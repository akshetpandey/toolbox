import { useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/Footer'
import {
  Upload,
  FileText,
  File,
  Presentation,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  Building,
} from 'lucide-react'
import {
  convertOfficeToPDF,
  isOfficeFile,
  createOfficeFile,
  type OfficeFile,
} from '@/lib/pandoc'
import { formatFileSize, truncateFilename } from '@/lib/shared'

export function OfficeTools() {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<OfficeFile | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionStatus, setConversionStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const clearFile = () => {
    setSelectedFile(null)
    setConversionStatus('')
  }

  const handleConvertToPDF = useCallback(async (officeFile: OfficeFile) => {
    setIsConverting(true)
    setConversionStatus(`Converting ${officeFile.name}...`)

    try {
      const result = await convertOfficeToPDF(officeFile.file)

      if (result.success) {
        setConversionStatus(`✅ ${officeFile.name} - Print dialog opened`)

        // Reset file after successful conversion
        setTimeout(() => {
          setSelectedFile(null)
          setConversionStatus('')
        }, 4000)
      } else {
        throw new Error(result.error ?? `Failed to convert ${officeFile.name}`)
      }
    } catch (error) {
      console.error('Conversion error:', error)
      setConversionStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setIsConverting(false)
    }
  }, [])

  const handleFileSelect = useCallback(
    (files: FileList) => {
      console.log('📄 OfficeTools: File selection started', {
        fileCount: files.length,
      })

      // Only process the first file
      const file = files[0]
      if (!file) return

      if (isOfficeFile(file)) {
        console.log('📄 OfficeTools: Processing office file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        const officeFile = createOfficeFile(file)
        setSelectedFile(officeFile)

        // Automatically trigger conversion
        void handleConvertToPDF(officeFile)
      } else {
        console.warn('📄 OfficeTools: Invalid file type selected', {
          name: file.name,
          type: file.type,
        })
        alert('Please select a valid office file (Word, PowerPoint, Excel)')
      }
    },
    [handleConvertToPDF],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect],
  )

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase()
    if (lower.includes('doc')) return <File className="w-4 h-4 text-blue-600" />
    if (lower.includes('ppt'))
      return <Presentation className="w-4 h-4 text-orange-600" />
    if (lower.includes('xls'))
      return <FileSpreadsheet className="w-4 h-4 text-green-600" />
    return <FileText className="w-4 h-4 text-primary" />
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="glass border-b border-border/50">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 rounded-lg flex items-center justify-center">
                <Building className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-heading text-foreground">
                  Office Documents
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          <div className="flex gap-6 h-full">
            {/* Left 1/3 - File Upload Area */}
            <div className="w-1/3">
              <Card className="glass-card border-0 animate-fade-in h-full">
                <CardContent className="p-6 h-full">
                  {!selectedFile ? (
                    // Upload interface when no file is selected
                    <div
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 cursor-pointer group h-full flex flex-col justify-center ${
                        dragActive
                          ? 'border-primary bg-primary/5'
                          : 'border-primary/20 hover:border-primary/40'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Drop an office file here
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        or click to browse your files
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        PDF conversion will start automatically
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Word
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          PowerPoint
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Excel
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    // Display uploaded file
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                            <FileText className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            Selected File
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFile}
                          disabled={isConverting}
                          className="hover:bg-red-500 hover:text-red-foreground text-xs"
                        >
                          Clear
                        </Button>
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                            {getFileIcon(selectedFile.name)}
                          </div>
                          <div className="flex-1">
                            <p
                              className="font-medium text-foreground text-sm"
                              title={selectedFile.name}
                            >
                              {truncateFilename(selectedFile.name)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div
                          className="flex items-center justify-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-3 h-3" />
                          <span>Click to select a different file</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.doc,.pptx,.ppt,.xlsx,.xls,.odt,.odp,.ods,.rtf"
                    onChange={(e) =>
                      e.target.files && handleFileSelect(e.target.files)
                    }
                    className="hidden"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right 2/3 - Convert Tool */}
            <div className="w-2/3">
              <div className="animate-fade-in">
                <Card className="glass-card border-0">
                  <CardContent className="p-6">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <h3 className="font-semibold text-foreground">
                          Document to PDF via Print Dialog
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-border rounded-lg p-4 text-center">
                          <File className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                          <h4 className="font-medium text-foreground">
                            Word Documents
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            .docx, .doc, .odt, .rtf
                          </p>
                        </div>

                        <div className="border border-border rounded-lg p-4 text-center">
                          <Presentation className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                          <h4 className="font-medium text-foreground">
                            PowerPoint
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            .pptx, .ppt, .odp
                          </p>
                        </div>

                        <div className="border border-border rounded-lg p-4 text-center">
                          <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-green-600" />
                          <h4 className="font-medium text-foreground">Excel</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            .xlsx, .xls, .ods
                          </p>
                        </div>
                      </div>

                      {/* Conversion Status */}
                      {(isConverting || conversionStatus) && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            {isConverting && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            <span className="text-sm font-medium">
                              {conversionStatus}
                            </span>
                          </div>
                        </div>
                      )}

                      {!selectedFile && !isConverting && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground text-sm">
                            Upload an office document to automatically convert
                            it to PDF using your browser's print dialog
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
