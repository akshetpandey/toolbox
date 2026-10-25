import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
import { Button } from '@/components/ui/button'
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

interface UtilityAnalysis {
  hashes?: FileHashes
  metadata?: FileMetadata
  exif?: ExifMetadata
  hashing?: Promise<FileHashes>
  readingMetadata?: Promise<FileMetadata>
  readingExif?: Promise<ExifMetadata>
  progress: number
  extractingExif: boolean
  listeners: Set<() => void>
}

// Pending stages survive route remounts without holding cleared files alive.
const analyses = new WeakMap<UploadedFile, UtilityAnalysis>()
function analysisFor(file: UploadedFile): UtilityAnalysis {
  let analysis = analyses.get(file)
  if (!analysis) {
    analysis = { progress: 0, extractingExif: false, listeners: new Set() }
    analyses.set(file, analysis)
  }
  return analysis
}
function notifyAnalysis(analysis: UtilityAnalysis) {
  for (const listener of analysis.listeners) listener()
}
function readHashes(file: UploadedFile, analysis: UtilityAnalysis) {
  analysis.hashing ??= calculateFileHashes(file.file, (progress) => {
    analysis.progress = progress
    notifyAnalysis(analysis)
  }).then(
    (hashes) => {
      analysis.hashes = hashes
      analysis.progress = 0
      notifyAnalysis(analysis)
      return hashes
    },
    (error: unknown) => {
      analysis.hashing = undefined
      throw error
    },
  )
  return analysis.hashing
}
function readMetadata(file: UploadedFile, analysis: UtilityAnalysis) {
  analysis.readingMetadata ??= extractFileMetadata(file.file).then(
    (metadata) => {
      analysis.metadata = metadata
      return metadata
    },
    (error: unknown) => {
      analysis.readingMetadata = undefined
      throw error
    },
  )
  return analysis.readingMetadata
}
function readExif(file: UploadedFile, analysis: UtilityAnalysis) {
  if (analysis.readingExif) return analysis.readingExif
  analysis.extractingExif = true
  notifyAnalysis(analysis)
  analysis.readingExif = extractExifMetadata(file.file, (extracting) => {
    analysis.extractingExif = extracting
    notifyAnalysis(analysis)
  }).then(
    (exif) => {
      analysis.exif = exif
      analysis.extractingExif = false
      notifyAnalysis(analysis)
      return exif
    },
    (error: unknown) => {
      analysis.readingExif = undefined
      analysis.extractingExif = false
      notifyAnalysis(analysis)
      throw error
    },
  )
  return analysis.readingExif
}

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
  const [selectedFile, updateSelectedFile] =
    useWorkspaceState<UploadedFile | null>('utilities.file', null)
  const selectedFileRef = useRef<UploadedFile | null>(selectedFile)
  const [fileMetadata, setFileMetadata] =
    useWorkspaceState<FileMetadata | null>('utilities.metadata', null)
  const [exifMetadata, setExifMetadata] = useWorkspaceState<ExifMetadata>(
    'utilities.exif',
    {},
  )
  const [fileHashes, setFileHashes] = useWorkspaceState<FileHashes | null>(
    'utilities.hashes',
    null,
  )
  const [expectedHash, setExpectedHash] = useWorkspaceState(
    'utilities.expected-hash',
    '',
  )
  const [isExtractingExif, setIsExtractingExif] = useState(false)
  const [hashProgress, setHashProgress] = useState(0)
  const [analysisError, setAnalysisError] = useState(false)
  const [analysisAttempt, setAnalysisAttempt] = useState(0)
  const analysisOwner = useRef<symbol | null>(null)

  const setSelectedFile = useCallback(
    (file: UploadedFile | null) => {
      const previous = selectedFileRef.current
      selectedFileRef.current = file
      if (previous && previous !== file) analyses.delete(previous)
      if (analysisOwner.current) {
        analysisOwner.current = null
        setIsProcessing(false)
      }
      updateSelectedFile(file)
      setFileMetadata(null)
      setExifMetadata({})
      setFileHashes(null)
      setExpectedHash('')
      setIsExtractingExif(false)
      setHashProgress(0)
      setAnalysisError(false)
      invalidateWorkspaceState(['result.utilities.'])
    },
    [
      updateSelectedFile,
      setFileMetadata,
      setExifMetadata,
      setFileHashes,
      setExpectedHash,
      setIsProcessing,
    ],
  )

  useEffect(() => {
    selectedFileRef.current = selectedFile
    if (!selectedFile) return
    const file = selectedFile
    const analysis = analysisFor(file)
    const owner = Symbol('utility analysis')
    analysisOwner.current = owner
    let active = true
    const isCurrent = () =>
      active &&
      selectedFileRef.current === file &&
      analysisOwner.current === owner
    const updateProgress = () => {
      if (isCurrent()) {
        setHashProgress(analysis.progress)
        setIsExtractingExif(analysis.extractingExif)
      }
    }
    analysis.listeners.add(updateProgress)
    updateProgress()
    setAnalysisError(false)
    const complete =
      analysis.hashes &&
      analysis.metadata &&
      (!file.type.startsWith('image/') || analysis.exif !== undefined)
    if (!complete) setIsProcessing(true)
    void (async () => {
      try {
        const hashes = analysis.hashes ?? (await readHashes(file, analysis))
        if (!isCurrent()) return
        setFileHashes(hashes)
        const metadata =
          analysis.metadata ?? (await readMetadata(file, analysis))
        if (!isCurrent()) return
        setFileMetadata(metadata)
        if (file.type.startsWith('image/')) {
          const exif = analysis.exif ?? (await readExif(file, analysis))
          if (!isCurrent()) return
          setExifMetadata(exif)
        }
      } catch (error) {
        if (isCurrent()) {
          console.error('Utility file analysis failed:', error)
          setAnalysisError(true)
        }
      } finally {
        if (isCurrent()) {
          analysisOwner.current = null
          setHashProgress(0)
          setIsExtractingExif(false)
          if (!complete) setIsProcessing(false)
        }
      }
    })()
    return () => {
      active = false
      analysis.listeners.delete(updateProgress)
      if (selectedFileRef.current === file) selectedFileRef.current = null
      if (analysisOwner.current === owner) {
        analysisOwner.current = null
        if (!complete) setIsProcessing(false)
      }
    }
  }, [
    selectedFile,
    analysisAttempt,
    setFileHashes,
    setFileMetadata,
    setExifMetadata,
    setIsProcessing,
  ])

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

  const handleFileSelect = useCallback(
    (files: FileList) => {
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

        console.log('🔧 UtilitiesTools: File selection completed successfully')
      }
      return Promise.resolve()
    },
    [setSelectedFile],
  )

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
    if (selectedFileRef.current !== file) return
    const hashes = await readHashes(file, analysisFor(file))
    if (selectedFileRef.current === file) setFileHashes(hashes)
  }

  const extractMetadata = async (file: UploadedFile) => {
    if (selectedFileRef.current !== file) return
    const analysis = analysisFor(file)
    const metadata = await readMetadata(file, analysis)
    if (selectedFileRef.current !== file) return
    setFileMetadata(metadata)
    if (file.type.startsWith('image/')) {
      const exif = await readExif(file, analysis)
      if (selectedFileRef.current === file) setExifMetadata(exif)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
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
        title={currentTab === 'hash' ? 'File checksums' : 'File metadata'}
        icon={Settings}
        iconColor="text-orange-500"
        iconBgColor="bg-gradient-to-br from-orange-500/10 to-orange-500/5"
        fileUploadComponent={utilityFileUpload}
        toolsComponent={utilityToolsNav}
      >
        {analysisError && (
          <div role="alert" className="space-y-3 text-sm">
            <p>
              File analysis could not be completed. Try again or choose another
              file.
            </p>
            <Button
              variant="outline"
              onClick={() => setAnalysisAttempt((attempt) => attempt + 1)}
            >
              Try analysis again
            </Button>
          </div>
        )}
        <Outlet />
      </ToolLayout>
    </UtilitiesContext.Provider>
  )
}
