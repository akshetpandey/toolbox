import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import {
  ArchiveProcessor,
  type ArchiveFile,
  type ExtractedFile,
  type CompressionFormat,
} from '@/lib/archive'

export interface ArchiveToolsContextType {
  // Archive processor
  archiveProcessor: ArchiveProcessor
  isInitialized: boolean
  isInitializing: boolean
  initializeProcessor: () => Promise<void>

  // File management
  selectedFiles: ArchiveFile[]
  setSelectedFiles: (files: ArchiveFile[]) => void
  addFiles: (files: ArchiveFile[]) => void
  removeFile: (index: number) => void
  clearFiles: () => void

  // Archive management
  uploadedArchive: File | null
  setUploadedArchive: (file: File | null) => void
  extractedFiles: ExtractedFile[]
  setExtractedFiles: (files: ExtractedFile[]) => void

  // Compression settings
  compressionFormat: CompressionFormat
  setCompressionFormat: (format: CompressionFormat) => void
  archiveName: string
  setArchiveName: (name: string) => void

  // File operations
  compressFiles: () => Promise<void>
  decompressArchive: () => Promise<void>
  downloadExtractedFile: (file: ExtractedFile) => void
  downloadAllFiles: () => Promise<void>
}

const ArchiveToolsContext = createContext<ArchiveToolsContextType | undefined>(
  undefined,
)

export function useArchiveTools() {
  const context = useContext(ArchiveToolsContext)
  if (!context) {
    throw new Error(
      'useArchiveTools must be used within an ArchiveToolsProvider',
    )
  }
  return context
}

interface ArchiveToolsProviderProps {
  children: ReactNode
}

export function ArchiveToolsProvider({ children }: ArchiveToolsProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<ArchiveFile[]>([])
  const [uploadedArchive, setUploadedArchive] = useState<File | null>(null)
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([])
  const [compressionFormat, setCompressionFormat] =
    useState<CompressionFormat>('zip')
  const [archiveName, setArchiveName] = useState('archive')

  // Create archive processor instance
  const archiveProcessor = useMemo(() => new ArchiveProcessor(), [])

  // Initialize the archive processor
  const initializeProcessor = useCallback(async () => {
    if (!isInitialized && !isInitializing) {
      setIsInitializing(true)
      try {
        await archiveProcessor.init()
        setIsInitialized(true)
        console.log(
          '🗜️ ArchiveTools: Archive processor initialized successfully',
        )
      } catch (error) {
        console.error(
          '🗜️ ArchiveTools: Failed to initialize archive processor:',
          error,
        )
      } finally {
        setIsInitializing(false)
      }
    }
  }, [isInitialized, isInitializing, archiveProcessor])

  // File management functions
  const addFiles = useCallback((files: ArchiveFile[]) => {
    setSelectedFiles((prev) => [...prev, ...files])
  }, [])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearFiles = useCallback(() => {
    setSelectedFiles([])
  }, [])

  // Compress files
  const compressFiles = useCallback(async () => {
    if (selectedFiles.length === 0 || !isInitialized) return

    try {
      console.log('🗜️ ArchiveTools: Starting compression', {
        fileCount: selectedFiles.length,
        format: compressionFormat,
        archiveName,
      })

      const compressedData = await archiveProcessor.compress(
        selectedFiles,
        compressionFormat,
        archiveName,
      )

      const extension =
        compressionFormat === 'gzip' ? 'tar.gz' : compressionFormat
      const filename = `${archiveName}.${extension}`

      // Create download
      const blob = new Blob([compressedData], {
        type: 'application/octet-stream',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('🗜️ ArchiveTools: Compression completed successfully')
    } catch (error) {
      console.error('🗜️ ArchiveTools: Compression failed:', error)
      throw error
    }
  }, [
    selectedFiles,
    isInitialized,
    compressionFormat,
    archiveName,
    archiveProcessor,
  ])

  // Decompress archive
  const decompressArchive = useCallback(async () => {
    if (!uploadedArchive || !isInitialized) return

    try {
      console.log('🗜️ ArchiveTools: Starting decompression', {
        archiveName: uploadedArchive.name,
        size: uploadedArchive.size,
      })

      const archiveData = new Uint8Array(await uploadedArchive.arrayBuffer())
      const extractedFiles = archiveProcessor.decompress(
        archiveData,
        uploadedArchive.name,
      )

      setExtractedFiles(extractedFiles)

      console.log('🗜️ ArchiveTools: Decompression completed successfully', {
        extractedCount: extractedFiles.length,
      })
    } catch (error) {
      console.error('🗜️ ArchiveTools: Decompression failed:', error)
      throw error
    }
  }, [uploadedArchive, isInitialized, archiveProcessor])

  // Download individual file
  const downloadExtractedFile = useCallback((file: ExtractedFile) => {
    if (file.isDirectory) return

    const mimeType = file.name.endsWith('.txt')
      ? 'text/plain'
      : 'application/octet-stream'
    const blob = new Blob([file.data], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  // Download all extracted files as ZIP
  const downloadAllFiles = useCallback(async () => {
    if (extractedFiles.length === 0 || !isInitialized) return

    try {
      const nonDirectoryFiles = extractedFiles.filter((f) => !f.isDirectory)
      const archiveFiles: ArchiveFile[] = nonDirectoryFiles.map((f) => ({
        file: new File([f.data], f.name, { type: 'application/octet-stream' }),
        name: f.name,
        size: f.size,
        type: 'application/octet-stream',
      }))

      const compressedData = await archiveProcessor.compress(
        archiveFiles,
        'zip',
        'extracted_files',
      )

      const blob = new Blob([compressedData], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'extracted_files.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('🗜️ ArchiveTools: All files downloaded successfully')
    } catch (error) {
      console.error('🗜️ ArchiveTools: Failed to download all files:', error)
      throw error
    }
  }, [extractedFiles, isInitialized, archiveProcessor])

  const value: ArchiveToolsContextType = {
    archiveProcessor,
    isInitialized,
    isInitializing,
    initializeProcessor,
    selectedFiles,
    setSelectedFiles,
    addFiles,
    removeFile,
    clearFiles,
    uploadedArchive,
    setUploadedArchive,
    extractedFiles,
    setExtractedFiles,
    compressionFormat,
    setCompressionFormat,
    archiveName,
    setArchiveName,
    compressFiles,
    decompressArchive,
    downloadExtractedFile,
    downloadAllFiles,
  }

  return (
    <ArchiveToolsContext.Provider value={value}>
      {children}
    </ArchiveToolsContext.Provider>
  )
}
