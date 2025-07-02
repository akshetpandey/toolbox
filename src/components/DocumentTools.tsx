import { useState, useCallback, useRef } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { PDFDocument } from 'pdf-lib'
import {
  Upload,
  FileText,
  Info,
  Merge,
  Loader2,
  Download,
  Trash2,
  File,
  Settings,
  Split,
  Minimize,
} from 'lucide-react'

interface PDFFile {
  file: File
  name: string
  size: number
  preview?: string
}

export function DocumentTools() {
  const search = useSearch({ from: '/documents' })
  const navigate = useNavigate()
  const [selectedFiles, setSelectedFiles] = useState<PDFFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get the current active tab from URL search params
  const activeTab = search?.tab ?? 'merge'

  // Handle tab changes
  const handleTabChange = async (value: string) => {
    await navigate({
      to: '/documents',
      search: { tab: value },
    })
  }

  const handleFileSelect = useCallback((files: FileList) => {
    console.log('📄 DocumentTools: File selection started', {
      fileCount: files.length,
    })

    const pdfFiles: PDFFile[] = []

    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        console.log('📄 DocumentTools: Processing PDF file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        const pdfFile = {
          file,
          name: file.name,
          size: file.size,
        }

        pdfFiles.push(pdfFile)
      } else {
        console.warn('📄 DocumentTools: Invalid file type selected', {
          name: file.name,
          type: file.type,
        })
      }
    }

    if (pdfFiles.length > 0) {
      setSelectedFiles(pdfFiles)
      console.log('📄 DocumentTools: File selection completed successfully')
    } else {
      alert('Please select valid PDF files')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setSelectedFiles([])
  }

  const mergePDFs = async () => {
    if (selectedFiles.length < 2) {
      alert('Please select at least 2 PDF files to merge')
      return
    }

    console.log('📄 DocumentTools: Starting PDF merge operation', {
      fileCount: selectedFiles.length,
      fileNames: selectedFiles.map((f) => f.name),
    })

    setIsProcessing(true)
    setProgress(0)

    try {
      // Create a new PDF document
      const mergedPdf = await PDFDocument.create()

      // Process each PDF file
      for (let i = 0; i < selectedFiles.length; i++) {
        const pdfFile = selectedFiles[i]

        // Update progress
        setProgress((i / selectedFiles.length) * 80)

        console.log(
          `📄 DocumentTools: Processing PDF ${i + 1}/${selectedFiles.length}`,
          {
            fileName: pdfFile.name,
          },
        )

        // Read the PDF file
        const arrayBuffer = await pdfFile.file.arrayBuffer()

        // Load the PDF document
        const pdf = await PDFDocument.load(arrayBuffer)

        // Copy all pages from this PDF to the merged PDF
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        pages.forEach((page) => mergedPdf.addPage(page))

        console.log(
          `📄 DocumentTools: Added ${pages.length} pages from ${pdfFile.name}`,
        )
      }

      // Update progress to 90%
      setProgress(90)

      // Save the merged PDF
      console.log('📄 DocumentTools: Saving merged PDF...')
      const mergedPdfBytes = await mergedPdf.save()

      // Update progress to 100%
      setProgress(100)

      // Create download link
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'merged-document.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('📄 DocumentTools: PDF merge completed successfully')

      // Reset progress after a short delay
      setTimeout(() => {
        setProgress(0)
        setIsProcessing(false)
      }, 1000)
    } catch (error) {
      console.error('📄 DocumentTools: Error merging PDFs:', error)
      alert('Error merging PDFs. Please try again.')
      setProgress(0)
      setIsProcessing(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="glass border-b border-border/50">
        <div className="container mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg flex items-center justify-center">
                <FileText className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <h1 className="text-heading text-foreground">Document Tools</h1>
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
                  {selectedFiles.length === 0 ? (
                    // Upload interface when no files are selected
                    <div
                      className="border-2 border-dashed border-primary/20 rounded-xl p-6 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group h-full flex flex-col justify-center"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Drop PDF files here
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Supports multiple PDF files
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          PDF
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    // Display uploaded files
                    <div
                      className="border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer group h-full flex flex-col"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                            <File className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            Selected Files ({selectedFiles.length})
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            clearFiles()
                          }}
                          className="hover:bg-red-500 hover:text-red-foreground text-xs"
                        >
                          Clear All
                        </Button>
                      </div>

                      <div className="space-y-2 flex-1 overflow-auto">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-foreground text-sm truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(index)
                              }}
                              className="text-destructive hover:text-destructive h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <Upload className="w-3 h-3" />
                          <span>Click to add more files</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        void handleFileSelect(e.target.files)
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right 2/3 - Tools */}
            <div className="w-2/3">
              <div className="animate-fade-in">
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => void handleTabChange(value)}
                  className="space-y-4"
                >
                  <TabsList className="flat-card border-0 grid w-full grid-cols-4 h-10">
                    <TabsTrigger
                      value="merge"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Merge className="w-4 h-4 mr-2" />
                      Merge
                    </TabsTrigger>
                    <TabsTrigger
                      value="split"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Split className="w-4 h-4 mr-2" />
                      Split
                    </TabsTrigger>
                    <TabsTrigger
                      value="compress"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Minimize className="w-4 h-4 mr-2" />
                      Compress
                    </TabsTrigger>
                    <TabsTrigger
                      value="convert"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Convert
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="merge">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6">
                        {selectedFiles.length >= 2 ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <Merge className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <h3 className="font-semibold text-foreground">
                                  Merge PDFs
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Combine {selectedFiles.length} PDF files into
                                  one document
                                </p>
                              </div>
                            </div>

                            {isProcessing && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    Merging PDFs...
                                  </span>
                                  <span className="text-muted-foreground">
                                    {Math.round(progress)}%
                                  </span>
                                </div>
                                <Progress value={progress} className="w-full" />
                              </div>
                            )}

                            <Button
                              onClick={() => void mergePDFs()}
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
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-foreground">
                                    About PDF Merge
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    This tool combines multiple PDF files into a
                                    single document. All embedded fonts and
                                    formatting will be preserved in the merged
                                    PDF. Files are merged in the order they
                                    appear in the list.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-32">
                            <div className="text-center text-muted-foreground">
                              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">
                                Select at least 2 PDF files to merge
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="split">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6">
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            Split PDF Tool
                          </h3>
                          <p className="text-muted-foreground">
                            Coming soon! This tool will allow you to split PDF
                            files into separate documents.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="compress">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6">
                        <div className="text-center py-12">
                          <Minimize className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            Compress PDF Tool
                          </h3>
                          <p className="text-muted-foreground">
                            Coming soon! This tool will allow you to compress
                            PDF files to reduce their size.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="convert">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6">
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            Convert Tool
                          </h3>
                          <p className="text-muted-foreground">
                            Coming soon! This tool will allow you to convert
                            documents to PDF format.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
