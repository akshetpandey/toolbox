import type { MessageText } from '@/i18n/messages'
import { message, renderMessage } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
import {
  OfficeToolsContext,
  type ConversionStatus,
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
import {
  createOfficeFile,
  getOfficePdfInputFormat,
  officePdfInputFormats,
  type OfficeFile,
} from '@/lib/pandoc'
import { formatFileSize } from '@/lib/shared'

export const Route = createFileRoute('/office-documents')({
  component: OfficeDocumentsLayout,
})

function OfficeDocumentsLayout() {
  const t = useTranslator()
  const [selectionError, setSelectionError] = useState<MessageText>('')
  const [selectedFile, updateSelectedFile] =
    useWorkspaceState<OfficeFile | null>('office.file', null)
  const selectedFileRef = useRef<OfficeFile | null>(selectedFile)
  const fileUploadRef = useRef<HTMLDivElement>(null)
  const [conversionStatus, setConversionStatus] =
    useWorkspaceState<ConversionStatus>('office.status', null)

  const setSelectedFile = useCallback(
    (file: OfficeFile | null) => {
      selectedFileRef.current = file
      setSelectionError('')
      updateSelectedFile(file)
      setConversionStatus(null)
      invalidateWorkspaceState(['result.office.'])
    },
    [updateSelectedFile, setConversionStatus],
  )

  const chooseAnotherFile = useCallback(() => {
    fileUploadRef.current
      ?.querySelector<HTMLInputElement>('input[type=file]')
      ?.click()
  }, [])

  const isCurrentFile = useCallback(
    (file: OfficeFile) => selectedFileRef.current === file,
    [],
  )

  useEffect(() => {
    selectedFileRef.current = selectedFile
    return () => {
      selectedFileRef.current = null
    }
  }, [selectedFile])

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null)
  }, [setSelectedFile])

  const handleFileSelect = useCallback(
    (files: FileList) => {
      console.log('📄 OfficeTools: File selection started', {
        fileCount: files.length,
      })

      // Only process the first file
      const file = files[0]
      if (!file) return

      if (getOfficePdfInputFormat(file.name)) {
        console.log('📄 OfficeTools: Processing office file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        const officeFile = createOfficeFile(file)
        setSelectedFile(officeFile)
      } else {
        setSelectionError(message('officeDocumentsChooseADOCXPPTXOrXLSX'))
      }
    },
    [setSelectedFile],
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
      isCurrentFile,
      conversionStatus,
      setConversionStatus,
      clearSelectedFile,
      chooseAnotherFile,
    }),
    [
      selectedFile,
      conversionStatus,
      clearSelectedFile,
      setSelectedFile,
      isCurrentFile,
      chooseAnotherFile,
    ],
  )

  const officeFileUpload = (
    <div ref={fileUploadRef}>
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
        acceptedTypes={officePdfInputFormats
          .map((format) => `.${format}`)
          .join(',')}
        title={t('officeDocumentsDropAnOfficeFileHere')}
        description={t('officeDocumentsChooseAWordPowerPointOrExcel')}
        supportedFormats={['DOCX', 'PPTX', 'XLSX']}
        emptyStateIcon={Upload}
        selectedFileIcon={FileText}
      >
        {selectedFile && (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              {getFileIcon(selectedFile.name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size, t)}
                </p>
              </div>
            </div>
          </div>
        )}
      </FileUpload>
      {selectionError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {renderMessage(t, selectionError)}
        </p>
      )}
    </div>
  )

  return (
    <OfficeToolsContext.Provider value={contextValue}>
      <ToolLayout
        title={t('officeDocumentsConvertDocumentToPDF')}
        icon={Building}
        iconColor="text-primary"
        iconBgColor="bg-primary/10"
        fileUploadComponent={officeFileUpload}
      >
        <Outlet />
      </ToolLayout>
    </OfficeToolsContext.Provider>
  )
}
