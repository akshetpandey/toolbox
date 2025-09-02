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
import {
  extractExifMetadata,
  extractFileMetadata,
  calculateFileHashes,
  formatFileSize,
  type ExifMetadata,
  type FileMetadata,
  type FileHashes,
} from '@/lib/metadata'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  UtilitiesContext,
  type UtilitiesContextType,
  type UploadedFile,
} from '@/contexts/UtilitiesContext'

import { Upload, Hash, Info, FileText, Settings } from 'lucide-react'

const utilityTabs = [
  { value: 'hash', label: 'Hash', icon: Hash },
  { value: 'metadata', label: 'Metadata', icon: Info },
]

export const Route = createFileRoute('/utilities')({
  component: UtilitiesLayout,
  head: () => ({
    meta: [
      {
        title: 'Utility Tools - Free Browser-Based File Utilities | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based file utility tools. Generate file hashes, view metadata, and strip metadata for privacy protection entirely in your browser.',
      },
      {
        name: 'keywords',
        content:
          'file hash generator, MD5 SHA256 calculator, file metadata viewer, privacy tools, browser utilities',
      },
      {
        property: 'og:title',
        content: 'Utility Tools - Free Browser-Based File Utilities',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based file utilities. Hash generation, metadata viewing, and privacy tools.',
      },
    ],
  }),
})

function UtilitiesLayout() {
  const { isProcessing, setIsProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)
  const [exifMetadata, setExifMetadata] = useState<ExifMetadata>({})
  const [fileHashes, setFileHashes] = useState<FileHashes | null>(null)
  const [expectedHash, setExpectedHash] = useState('')
  const [isExtractingExif, setIsExtractingExif] = useState(false)
  const [hashProgress, setHashProgress] = useState(0)

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/hash')) return 'hash'
    if (path.includes('/metadata')) return 'metadata'
    return 'hash' // default
  }, [location.pathname])

  // Handle tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      if (isProcessing) return // Prevent tab changes while processing

      void navigate({
        to: `/utilities/${value}`,
      })
    },
    [navigate, isProcessing],
  )

  const handleFileSelect = useCallback(async (files: FileList) => {
    console.log('🔧 UtilitiesTools: File selection started', {
      fileCount: files.length,
    })

    // Only take the first file
    const file = files[0]
    if (file) {
      console.log('🔧 UtilitiesTools: Processing file', {
        name: file.name,
        size: file.size,
        type: file.type,
      })

      const uploadedFile: UploadedFile = {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      }

      setSelectedFile(uploadedFile)
      setFileMetadata(null)
      setExifMetadata({})
      setFileHashes(null)
      setExpectedHash('')
      setIsExtractingExif(false)
      setHashProgress(0)

      console.log('🔧 UtilitiesTools: File selection completed successfully')

      await generateHashes(uploadedFile)
      await extractMetadata(uploadedFile)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files) {
        await handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const generateHashes = async (file: UploadedFile) => {
    setIsProcessing(true)
    setHashProgress(0)

    try {
      const hashes = await calculateFileHashes(file.file, (progress) => {
        setHashProgress(progress)
      })
      setFileHashes(hashes)
    } catch (error) {
      console.error('🔧 UtilitiesTools: Error generating hashes:', error)
    } finally {
      setIsProcessing(false)
      setHashProgress(0)
    }
  }

  const extractMetadata = async (file: UploadedFile) => {
    setIsProcessing(true)

    try {
      // Extract file metadata using wasmagic
      const metadata = await extractFileMetadata(file.file)
      setFileMetadata(metadata)

      // Extract EXIF metadata if it's an image
      if (file.type.startsWith('image/')) {
        const exifData = await extractExifMetadata(
          file.file,
          setIsExtractingExif,
        )
        setExifMetadata(exifData)
      }
    } catch (error) {
      console.error('🔧 UtilitiesTools: Error extracting metadata:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setFileMetadata(null)
    setExifMetadata({})
    setFileHashes(null)
    setExpectedHash('')
    setIsExtractingExif(false)
    setHashProgress(0)
  }

  // Context value
  const contextValue: UtilitiesContextType = {
    selectedFile,
    setSelectedFile,
    fileMetadata,
    setFileMetadata,
    exifMetadata,
    setExifMetadata,
    fileHashes,
    setFileHashes,
    expectedHash,
    setExpectedHash,
    isExtractingExif,
    setIsExtractingExif,
    hashProgress,
    setHashProgress,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    clearFile,
    generateHashes,
    extractMetadata,
  }

  const utilityFileUpload = (
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
      onClearFiles={clearFile}
      acceptedTypes="*/*"
      title="Drop a file here"
      description="Any file type supported"
      supportedFormats={['All Files', 'Images', 'Documents', 'Videos']}
      emptyStateIcon={Upload}
      selectedFileIcon={FileText}
    >
      {selectedFile && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground truncate text-sm">
              {selectedFile.name}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatFileSize(selectedFile.size)}</span>
              <span>{selectedFile.type || 'Unknown type'}</span>
            </div>
          </div>
        </div>
      )}
    </FileUpload>
  )

  const utilityToolsNav = (
    <div className="w-full">
      <ResponsiveTabs
        tabs={utilityTabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        isProcessing={isProcessing}
      />
    </div>
  )

  return (
    <UtilitiesContext.Provider value={contextValue}>
      <ToolLayout
        title="Utilities"
        icon={Settings}
        iconColor="text-orange-500"
        iconBgColor="bg-gradient-to-br from-orange-500/10 to-orange-500/5"
        fileUploadComponent={utilityFileUpload}
        toolsComponent={utilityToolsNav}
      >
        <Outlet />
      </ToolLayout>
    </UtilitiesContext.Provider>
  )
}
