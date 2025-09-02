import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  ArchiveToolsProvider,
  useArchiveTools,
} from '@/contexts/ArchiveToolsContext'

import { type ArchiveFile, formatFileSize } from '@/lib/archive'
import {
  Upload,
  Archive,
  FileArchive,
  Package,
  File as FileIcon,
  X,
} from 'lucide-react'

const archiveTabs = [
  { value: 'compress', label: 'Compress', icon: Package },
  { value: 'extract', label: 'Extract', icon: FileArchive },
]

export const Route = createFileRoute('/archives')({
  component: ArchiveToolsLayout,
  head: () => ({
    meta: [
      {
        title:
          'Archive Tools - Free Browser-Based Archive Processing | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based archive processing tools. Compress files into archives and extract from ZIP, 7Z, TAR, RAR formats entirely in your browser. No uploads required.',
      },
      {
        name: 'keywords',
        content:
          'free archive tools, ZIP extractor, 7Z compressor, file compression, browser archive manager, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Archive Tools - Free Browser-Based Archive Processing',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based archive tools. Compress and extract files with complete privacy.',
      },
    ],
  }),
})

function ArchiveToolsLayout() {
  return (
    <ArchiveToolsProvider>
      <ArchiveToolsContent />
    </ArchiveToolsProvider>
  )
}

function ArchiveToolsContent() {
  const { isProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    isInitialized,
    initializeProcessor,
    selectedFiles,
    addFiles,
    removeFile,
    clearFiles,
    uploadedArchive,
    setUploadedArchive,
    setExtractedFiles,
  } = useArchiveTools()

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/compress')) return 'compress'
    if (path.includes('/extract')) return 'extract'
    return 'compress' // default
  }, [location.pathname])

  // Handle tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      if (isProcessing) return // Prevent tab changes while processing

      void navigate({
        to: `/archives/${value}`,
      })
    },
    [navigate, isProcessing],
  )

  // Handle file selection for compression
  const handleFileSelect = useCallback(
    async (files: FileList) => {
      console.log('🗜️ ArchiveTools: Files selected for compression', {
        fileCount: files.length,
      })

      const archiveFiles: ArchiveFile[] = []

      for (const file of files) {
        let preview: string | undefined

        if (file.type.startsWith('image/')) {
          preview = URL.createObjectURL(file)
        }

        archiveFiles.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          preview,
        })
      }

      // Add new files to existing selected files
      addFiles(archiveFiles)

      // Initialize processor if not already initialized
      if (!isInitialized) {
        await initializeProcessor()
      }
    },
    [addFiles, isInitialized, initializeProcessor],
  )

  // Handle archive upload for decompression
  const handleArchiveUpload = useCallback(
    async (files: FileList) => {
      const file = files[0]
      if (!file) return

      console.log('🗜️ ArchiveTools: Archive uploaded for decompression', {
        name: file.name,
        size: file.size,
      })

      setUploadedArchive(file)
      setExtractedFiles([])

      // Initialize processor if not already initialized
      if (!isInitialized) {
        await initializeProcessor()
      }
    },
    [setUploadedArchive, setExtractedFiles, isInitialized, initializeProcessor],
  )

  const clearSelectedFiles = useCallback(() => {
    clearFiles()
  }, [clearFiles])

  const clearUploadedArchive = useCallback(() => {
    setUploadedArchive(null)
    setExtractedFiles([])
  }, [setUploadedArchive, setExtractedFiles])

  // Create file upload component for compression
  const compressFileUpload = (
    <FileUpload
      selectedFiles={selectedFiles.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        preview: file.preview,
      }))}
      onFileSelect={(files) => void handleFileSelect(files)}
      onClearFiles={clearSelectedFiles}
      acceptedTypes="*/*"
      title="Drop files to compress"
      description="Select multiple files to create an archive"
      supportedFormats={['All Files']}
      emptyStateIcon={Upload}
      selectedFileIcon={FileIcon}
      multiple={true}
    >
      {selectedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
            >
              <FileIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </FileUpload>
  )

  // Create file upload component for extraction
  const extractFileUpload = (
    <FileUpload
      selectedFiles={
        uploadedArchive
          ? [
              {
                name: uploadedArchive.name,
                size: uploadedArchive.size,
                type: uploadedArchive.type,
              },
            ]
          : []
      }
      onFileSelect={(files) => void handleArchiveUpload(files)}
      onClearFiles={clearUploadedArchive}
      acceptedTypes=".7z,.zip,.tar,.gz,.tar.gz,.rar"
      title="Drop archive to extract"
      description="Supports 7Z, ZIP, TAR, GZIP formats"
      supportedFormats={['7Z', 'ZIP', 'TAR', 'GZIP', 'RAR']}
      emptyStateIcon={Upload}
      selectedFileIcon={FileArchive}
    >
      {uploadedArchive && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
            <FileArchive className="h-8 w-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {uploadedArchive.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(uploadedArchive.size)}
              </p>
            </div>
          </div>
        </div>
      )}
    </FileUpload>
  )

  const archiveToolsNav = (
    <div className="w-full">
      <ResponsiveTabs
        tabs={archiveTabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        isProcessing={isProcessing}
      />
    </div>
  )

  return (
    <ToolLayout
      title="Archive Tools"
      icon={Archive}
      iconColor="text-purple-500"
      iconBgColor="bg-gradient-to-br from-purple-500/10 to-purple-500/5"
      fileUploadComponent={
        currentTab === 'compress' ? compressFileUpload : extractFileUpload
      }
      toolsComponent={archiveToolsNav}
    >
      <Outlet />
    </ToolLayout>
  )
}
