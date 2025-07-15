import { useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, FileImage } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface FileItem {
  name: string
  size?: number
  // Allow additional properties for different file types including complex objects
  [key: string]: string | number | boolean | undefined | object
}

interface FileUploadProps {
  selectedFiles: FileItem[]
  onFileSelect: (files: FileList) => void
  onClearFiles: () => void
  acceptedTypes: string
  title: string
  description: string
  supportedFormats: string[]
  emptyStateIcon?: LucideIcon
  selectedFileIcon?: LucideIcon
  children?: React.ReactNode // For custom file display
  multiple?: boolean // Allow multiple file selection
}

export function FileUpload({
  selectedFiles,
  onFileSelect,
  onClearFiles,
  acceptedTypes,
  title,
  description,
  supportedFormats,
  emptyStateIcon: EmptyIcon = Upload,
  selectedFileIcon: SelectedIcon = FileImage,
  children,
  multiple = false,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      onFileSelect(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card className="glass-card border-0 animate-fade-in h-full">
      <CardContent className="p-4 sm:p-6 h-full">
        {selectedFiles.length === 0 ? (
          // Upload interface when no files are selected
          <div
            className="border-2 border-dashed border-primary/20 rounded-xl p-4 sm:p-6 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group h-full flex flex-col justify-center min-h-[200px] lg:min-h-0"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={handleClick}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <EmptyIcon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{description}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {supportedFormats.map((format) => (
                <Badge key={format} variant="secondary" className="text-xs">
                  {format}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          // Display uploaded file(s)
          <div
            className="border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer group"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={handleClick}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                  <SelectedIcon className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Selected File{selectedFiles.length > 1 ? 's' : ''}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onClearFiles()
                }}
                className="hover:bg-red-500 hover:text-red-foreground text-xs"
              >
                Clear
              </Button>
            </div>

            {/* Custom file display or default */}
            {children ?? (
              <div className="flex flex-col gap-2">
                {selectedFiles.map((file, index) => (
                  <div key={file.name ?? index} className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-foreground truncate text-sm">
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {file.size
                            ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Upload className="w-3 h-3" />
                <span>Click to change file</span>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files && onFileSelect(e.target.files)}
        />
      </CardContent>
    </Card>
  )
}
