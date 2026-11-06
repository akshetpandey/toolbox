import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import {
  ArchiveProcessor,
  type ArchiveFile,
  type ExtractedFile,
  type CompressionFormat,
} from '@/lib/archive'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { useToolResult, type ToolResult } from '@/components/ResultCard'
import { downloadBlob } from '@/lib/shared'

// All processor instances share one WASM filesystem, including after navigation.
let archiveQueue = Promise.resolve()
function runArchiveOperation<T>(run: () => T | Promise<T>): Promise<T> {
  const operation = archiveQueue.then(run)
  archiveQueue = operation.then(
    () => undefined,
    () => undefined,
  )
  return operation
}

export interface ArchiveToolsContextType {
  // Archive processor
  archiveProcessor: ArchiveProcessor
  isInitialized: boolean
  isInitializing: boolean
  initializationError: string
  compressionResult: ToolResult | null
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
  decompressArchive: (password?: string) => Promise<void>
  downloadExtractedFile: (file: ExtractedFile) => void
  downloadAllFiles: () => Promise<void>
}

const ArchiveToolsContext = createContext<ArchiveToolsContextType | undefined>(
  undefined,
)

export function useArchiveTools() {
  const context = useContext(ArchiveToolsContext)
  if (!context)
    throw new Error(
      'useArchiveTools must be used within an ArchiveToolsProvider',
    )
  return context
}

export function ArchiveToolsProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initializationError, setInitializationError] = useState('')
  const [selectedFiles, updateSelectedFiles] = useWorkspaceState<ArchiveFile[]>(
    'archives.files',
    [],
  )
  const [uploadedArchive, updateUploadedArchive] =
    useWorkspaceState<File | null>('archives.uploaded', null)
  const [extractedFiles, updateExtractedFiles] = useWorkspaceState<
    ExtractedFile[]
  >('archives.extracted', [])
  const [compressionFormat, setCompressionFormat] =
    useWorkspaceState<CompressionFormat>('archives.format', 'zip')
  const [archiveName, setArchiveName] = useWorkspaceState(
    'archives.name',
    'archive',
  )
  const { result: compressionResult, setResult: setCompressionResult } =
    useToolResult(selectedFiles, 'archives.compress')
  const { result: extractedZip, setResult: setExtractedZip } = useToolResult(
    extractedFiles,
    'archives.extractedZip',
  )
  const archiveProcessor = useMemo(() => new ArchiveProcessor(), [])
  const initialization = useRef<Promise<void> | null>(null)
  const mounted = useRef(true)
  const filesRef = useRef(selectedFiles)
  const archiveRef = useRef(uploadedArchive)
  const extractedRef = useRef(extractedFiles)
  filesRef.current = selectedFiles
  archiveRef.current = uploadedArchive
  extractedRef.current = extractedFiles

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const initializeProcessor = useCallback(async () => {
    if (initialization.current) return initialization.current
    setIsInitializing(true)
    setInitializationError('')
    initialization.current = archiveProcessor
      .init()
      .then(() => {
        if (mounted.current) setIsInitialized(true)
      })
      .catch((error: unknown) => {
        initialization.current = null
        if (mounted.current)
          setInitializationError(
            error instanceof Error
              ? error.message
              : 'Archive tools could not be loaded',
          )
      })
      .finally(() => {
        if (mounted.current) setIsInitializing(false)
      })
    return initialization.current
  }, [archiveProcessor])

  useEffect(() => {
    if (selectedFiles.length || uploadedArchive) void initializeProcessor()
  }, [selectedFiles, uploadedArchive, initializeProcessor])

  const setSelectedFiles = useCallback(
    (files: ArchiveFile[]) => {
      filesRef.current = files
      updateSelectedFiles(files)
      invalidateWorkspaceState(['result.archives.compress'])
    },
    [updateSelectedFiles],
  )
  const addFiles = useCallback(
    (files: ArchiveFile[]) => {
      updateSelectedFiles((previous) => {
        const next = [...previous, ...files]
        filesRef.current = next
        return next
      })
      invalidateWorkspaceState(['result.archives.compress'])
    },
    [updateSelectedFiles],
  )
  const removeFile = useCallback(
    (index: number) => {
      updateSelectedFiles((previous) => {
        const next = previous.filter((_, i) => i !== index)
        filesRef.current = next
        return next
      })
      invalidateWorkspaceState(['result.archives.compress'])
    },
    [updateSelectedFiles],
  )
  const clearFiles = useCallback(() => setSelectedFiles([]), [setSelectedFiles])
  const setExtractedFiles = useCallback(
    (files: ExtractedFile[]) => {
      extractedRef.current = files
      updateExtractedFiles(files)
      invalidateWorkspaceState(['result.archives.extractedZip'])
    },
    [updateExtractedFiles],
  )
  const setUploadedArchive = useCallback(
    (file: File | null) => {
      archiveRef.current = file
      updateUploadedArchive(file)
      setExtractedFiles([])
    },
    [updateUploadedArchive, setExtractedFiles],
  )

  const compressFiles = useCallback(async () => {
    if (!selectedFiles.length || !isInitialized) return
    const compressed = await runArchiveOperation(() =>
      archiveProcessor.compress(
        selectedFiles,
        compressionFormat,
        archiveName.trim(),
      ),
    )
    if (!mounted.current || filesRef.current !== selectedFiles) return
    const extension =
      compressionFormat === 'gzip' ? 'tar.gz' : compressionFormat
    const filename = `${archiveName.trim()}.${extension}`
    const types = {
      zip: 'application/zip',
      tar: 'application/x-tar',
      gzip: 'application/gzip',
      '7z': 'application/x-7z-compressed',
    }
    const blob = new Blob([compressed.slice()], {
      type: types[compressionFormat],
    })
    setCompressionResult({
      blob,
      filename,
      sourceSize: selectedFiles.reduce((sum, file) => sum + file.size, 0),
      details: [
        `${selectedFiles.length} ${selectedFiles.length === 1 ? 'file' : 'files'} in ${extension.toUpperCase()} format`,
      ],
    })
    downloadBlob(blob, filename)
  }, [
    selectedFiles,
    isInitialized,
    archiveProcessor,
    compressionFormat,
    archiveName,
    setCompressionResult,
  ])

  const decompressArchive = useCallback(
    async (password?: string) => {
      if (!uploadedArchive || !isInitialized) return
      setExtractedFiles([])
      const data = new Uint8Array(await uploadedArchive.arrayBuffer())
      const extracted = await runArchiveOperation(() =>
        archiveProcessor.decompress(
          data,
          uploadedArchive.name,
          undefined,
          password,
        ),
      )
      if (mounted.current && archiveRef.current === uploadedArchive)
        setExtractedFiles(extracted)
    },
    [uploadedArchive, isInitialized, archiveProcessor, setExtractedFiles],
  )

  const downloadExtractedFile = useCallback((file: ExtractedFile) => {
    if (file.isDirectory) return
    downloadBlob(
      new Blob([file.data.slice()], {
        type: file.name.endsWith('.txt')
          ? 'text/plain'
          : 'application/octet-stream',
      }),
      file.name,
    )
  }, [])

  const downloadAllFiles = useCallback(async () => {
    if (!extractedFiles.length || !isInitialized) return
    if (extractedZip) {
      downloadBlob(extractedZip.blob, extractedZip.filename)
      return
    }
    const files: ArchiveFile[] = extractedFiles
      .filter((file) => !file.isDirectory)
      .map((file) => ({
        file: new File([file.data.slice()], file.name),
        name: file.name,
        size: file.size,
        type: 'application/octet-stream',
      }))
    const compressed = await runArchiveOperation(() =>
      archiveProcessor.compress(files, 'zip', 'extracted_files'),
    )
    if (!mounted.current || extractedRef.current !== extractedFiles) return
    const blob = new Blob([compressed.slice()], { type: 'application/zip' })
    setExtractedZip({ blob, filename: 'extracted_files.zip' })
    downloadBlob(blob, 'extracted_files.zip')
  }, [
    extractedFiles,
    isInitialized,
    extractedZip,
    archiveProcessor,
    setExtractedZip,
  ])

  const value: ArchiveToolsContextType = {
    archiveProcessor,
    isInitialized,
    isInitializing,
    initializationError,
    compressionResult,
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
