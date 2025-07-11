import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  OfficeToolsContext,
  type OfficeToolsContextType,
} from '@/contexts/OfficeToolsContext'

import {
  Upload,
  FileText,
  File,
  Presentation,
  FileSpreadsheet,
  Building,
  X,
} from 'lucide-react'
import { isOfficeFile, createOfficeFile, type OfficeFile } from '@/lib/pandoc'
import { formatFileSize, truncateFilename } from '@/lib/shared'

export const Route = createFileRoute('/office-documents')({
  component: OfficeDocumentsLayout,
})

function OfficeDocumentsLayout() {
  const { isProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFile, setSelectedFile] = useState<OfficeFile | null>(null)
  const [conversionStatus, setConversionStatus] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/convert')) return 'convert'
    // Add more tabs here as needed
    return 'convert' // default
  }, [location.pathname])

  // Handle tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      if (isProcessing) return // Prevent tab changes while processing

      void navigate({
        to: `/office-documents/${value}`,
      })
    },
    [navigate, isProcessing],
  )

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null)
    setConversionStatus('')
  }, [])

  const handleFileSelect = useCallback((files: FileList) => {
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
    } else {
      console.warn('📄 OfficeTools: Invalid file type selected', {
        name: file.name,
        type: file.type,
      })
      alert('Please select a valid office file (Word, PowerPoint, Excel)')
    }
  }, [])

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
    return <FileText className="w-4 text-primary" />
  }

  // Context value
  const contextValue: OfficeToolsContextType = useMemo(
    () => ({
      selectedFile,
      setSelectedFile,
      conversionStatus,
      setConversionStatus,
      clearSelectedFile,
    }),
    [selectedFile, conversionStatus, clearSelectedFile],
  )

  return (
    <OfficeToolsContext.Provider value={contextValue}>
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

        {/* Main Content Area */}
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
                      <div className="space-y-4 h-full flex flex-col">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-foreground">
                            Selected File
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelectedFile}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                          {getFileIcon(selectedFile.name)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {truncateFilename(selectedFile.name, 25)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files) {
                          handleFileSelect(e.target.files)
                        }
                      }}
                      accept=".docx,.doc,.pptx,.ppt,.xlsx,.xls"
                      className="hidden"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right 2/3 - Tools */}
              <div className="w-2/3">
                <div className="animate-fade-in">
                  <div className="flex flex-col gap-4">
                    {/* Navigation */}
                    <Tabs
                      value={currentTab}
                      onValueChange={handleTabChange}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-1 lg:w-auto lg:grid-cols-1">
                        <TabsTrigger
                          value="convert"
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          disabled={isProcessing}
                        >
                          <FileText className="h-4 w-4" />
                          Convert
                        </TabsTrigger>
                        {/* Add more tabs here as needed */}
                      </TabsList>
                    </Tabs>

                    {/* Tool Content */}
                    <Outlet />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OfficeToolsContext.Provider>
  )
}
