import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useMemo } from 'react'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
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
} from 'lucide-react'
import { isOfficeFile, createOfficeFile, type OfficeFile } from '@/lib/pandoc'
import { formatFileSize, truncateFilename } from '@/lib/shared'

const officeTabs = [{ value: 'convert', label: 'Convert', icon: FileText }]

export const Route = createFileRoute('/office-documents')({
  component: OfficeDocumentsLayout,
})

function OfficeDocumentsLayout() {
  const { isProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFile, setSelectedFile] = useState<OfficeFile | null>(null)
  const [conversionStatus, setConversionStatus] = useState<string>('')

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

  const officeFileUpload = (
    <FileUpload
      selectedFiles={
        selectedFile
          ? [
              {
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
              },
            ]
          : []
      }
      onFileSelect={(files) => void handleFileSelect(files)}
      onClearFiles={clearSelectedFile}
      acceptedTypes=".docx,.doc,.pptx,.ppt,.xlsx,.xls"
      title="Drop an office file here"
      description="Supports Word, PowerPoint, Excel"
      supportedFormats={['Word', 'PowerPoint', 'Excel']}
      emptyStateIcon={Upload}
      selectedFileIcon={FileText}
    >
      {selectedFile && (
        <div className="flex flex-col gap-2">
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
    </FileUpload>
  )

  const officeToolsNav = (
    <div className="w-full">
      <ResponsiveTabs
        tabs={officeTabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        isProcessing={isProcessing}
      />
    </div>
  )

  return (
    <OfficeToolsContext.Provider value={contextValue}>
      <ToolLayout
        title="Office Documents"
        icon={Building}
        iconColor="text-indigo-500"
        iconBgColor="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5"
        fileUploadComponent={officeFileUpload}
        toolsComponent={officeToolsNav}
      >
        <Outlet />
      </ToolLayout>
    </OfficeToolsContext.Provider>
  )
}
