import { createContext, useContext } from 'react'
import type { VideoFile, VideoMetadata, FFmpegProcessor } from '@/lib/ffmpeg'

export interface VideoToolsContextType {
  selectedFile: VideoFile | null
  metadata: Record<string, VideoMetadata>
  ffmpegProcessor: FFmpegProcessor | null
  isProcessing: boolean
  progress: number
  progressStartTime: number | null
  estimatedTimeRemaining: string | null
  elapsedTime: string | null
  showSlowProcessingWarning: boolean
  currentAbortController: AbortController | null
  handleFileSelect: (files: FileList) => Promise<void>
  clearSelectedFile: () => void
  setProgress: (progress: number) => void
  setProgressStartTime: (time: number | null) => void
  setEstimatedTimeRemaining: (time: string | null) => void
  setElapsedTime: (time: string | null) => void
  setShowSlowProcessingWarning: (show: boolean) => void
  setCurrentAbortController: (controller: AbortController | null) => void
  getFfmpegProcessor: () => Promise<FFmpegProcessor>
  setIsProcessing: (processing: boolean) => void
  cancelProcessing: () => void
}

export const VideoToolsContext = createContext<VideoToolsContextType | null>(
  null,
)

export function useVideoTools() {
  const context = useContext(VideoToolsContext)
  if (!context) {
    throw new Error('useVideoTools must be used within a VideoToolsProvider')
  }
  return context
}
