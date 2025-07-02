import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageMagick, MagickFormat } from '@imagemagick/magick-wasm'
import { useInitImageMagick } from '@/hooks/useInitImageMagick'

import {
  Upload,
  Image as ImageIcon,
  Info,
  Maximize,
  FileImage,
  Loader2,
  Settings,
  Zap,
} from 'lucide-react'

interface ImageFile {
  file: File
  preview: string
  name: string
  size: number
  type: string
  dimensions?: { width: number; height: number }
}

interface ImageMetadata {
  width: number
  height: number
  format: string
  size: number
  colorspace: string
  depth: number
  compression: string
}

export function ImageTools() {
  const { isInitialized, isInitializing, error } = useInitImageMagick()
  const search = useSearch({ from: '/images' })
  const navigate = useNavigate()
  const [selectedFiles, setSelectedFiles] = useState<ImageFile[]>([])
  const [metadata, setMetadata] = useState<{ [key: string]: ImageMetadata }>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Get the current active tab from URL search params
  const activeTab = search?.tab || 'metadata'
  
  // Handle tab changes
  const handleTabChange = (value: string) => {
    navigate({
      to: '/images',
      search: { tab: value },
    })
  }
  
  // Resize settings
  const [resizeWidth, setResizeWidth] = useState('')
  const [resizeHeight, setResizeHeight] = useState('')
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true)

  // Convert settings
  const [targetFormat, setTargetFormat] = useState('webp')

  // Compress settings
  const [quality, setQuality] = useState(85)

  // Auto-update dimensions when aspect ratio is maintained
  useEffect(() => {
    if (maintainAspectRatio && selectedFiles.length > 0) {
      const imageFile = selectedFiles[0]
      const originalDimensions = imageFile.dimensions

      if (originalDimensions) {
        const aspectRatio = originalDimensions.width / originalDimensions.height

        // If width is entered, calculate height
        if (resizeWidth && !resizeHeight) {
          const newHeight = Math.round(parseInt(resizeWidth) / aspectRatio)
          setResizeHeight(newHeight.toString())
        }
        // If height is entered, calculate width
        else if (resizeHeight && !resizeWidth) {
          const newWidth = Math.round(parseInt(resizeHeight) * aspectRatio)
          setResizeWidth(newWidth.toString())
        }
        // If both are entered, prioritize width and recalculate height
        else if (resizeWidth && resizeHeight) {
          const newHeight = Math.round(parseInt(resizeWidth) / aspectRatio)
          setResizeHeight(newHeight.toString())
        }
      }
    }
  }, [maintainAspectRatio, selectedFiles])

  const handleFileSelect = useCallback(async (files: FileList) => {
    // Only take the first image file
    const file = files[0]
    if (file && file.type.startsWith('image/')) {
      const preview = URL.createObjectURL(file)

      // Get image dimensions
      const img = new Image()
      const dimensions = await new Promise<{ width: number; height: number }>(
        (resolve) => {
          img.onload = () => resolve({ width: img.width, height: img.height })
          img.src = preview
        },
      )

      const imageFile = {
        file,
        preview,
        name: file.name,
        size: file.size,
        type: file.type,
        dimensions,
      }

      setSelectedFiles([imageFile])
      setMetadata({})

      // Automatically extract metadata
      await extractMetadata(imageFile)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // Extract metadata using ImageMagick
  const extractMetadata = async (imageFile: ImageFile) => {
    try {
      const arrayBuffer = await imageFile.file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      ImageMagick.read(uint8Array, (img) => {
        const meta: ImageMetadata = {
          width: img.width,
          height: img.height,
          format: img.format.toString(),
          size: imageFile.size,
          colorspace: img.colorSpace.toString(),
          depth: img.depth,
          compression: img.compression.toString(),
        }

        setMetadata((prev) => ({ ...prev, [imageFile.name]: meta }))
      })
    } catch (error) {
      console.error('Error extracting metadata:', error)
      // Fallback to basic metadata
      const meta: ImageMetadata = {
        width: imageFile.dimensions?.width || 0,
        height: imageFile.dimensions?.height || 0,
        format: imageFile.type.split('/')[1].toUpperCase(),
        size: imageFile.size,
        colorspace: 'sRGB',
        depth: 8,
        compression: 'None',
      }
      setMetadata((prev) => ({ ...prev, [imageFile.name]: meta }))
    }
  }

    const resizeImage = async (imageFile: ImageFile) => {
    if (!resizeWidth || !resizeHeight) {
      alert('Please enter both width and height')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    try {
      const arrayBuffer = await imageFile.file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      ImageMagick.read(uint8Array, (img) => {
        const newWidth = parseInt(resizeWidth)
        const newHeight = parseInt(resizeHeight)
        
        if (maintainAspectRatio) {
          const aspectRatio = img.width / img.height
          const targetAspectRatio = newWidth / newHeight
          
          if (aspectRatio > targetAspectRatio) {
            img.resize(newWidth, Math.round(newWidth / aspectRatio))
          } else {
            img.resize(Math.round(newHeight * aspectRatio), newHeight)
          }
        } else {
          img.resize(newWidth, newHeight)
        }
        
        // Determine format based on original file type
        let format: MagickFormat
        if (imageFile.type.includes('jpeg') || imageFile.type.includes('jpg')) {
          format = MagickFormat.Jpeg
        } else if (imageFile.type.includes('png')) {
          format = MagickFormat.Png
        } else if (imageFile.type.includes('webp')) {
          format = MagickFormat.WebP
        } else {
          format = MagickFormat.Jpeg // Default
        }
        
        img.write(format, (data: Uint8Array) => {
          const blob = new Blob([data], { type: imageFile.type })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `resized_${imageFile.name}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          
          clearInterval(progressInterval)
          setProgress(100)
          setTimeout(() => {
            setIsProcessing(false)
            setProgress(0)
          }, 500)
        })
      })
    } catch (error) {
      console.error('Error resizing image:', error)
      clearInterval(progressInterval)
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const convertImage = async (imageFile: ImageFile) => {
    setIsProcessing(true)
    setProgress(0)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    try {
      const arrayBuffer = await imageFile.file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      ImageMagick.read(uint8Array, (img) => {
        let format: MagickFormat
        let mimeType: string
        
        switch (targetFormat) {
          case 'webp':
            format = MagickFormat.WebP
            mimeType = 'image/webp'
            break
          case 'png':
            format = MagickFormat.Png
            mimeType = 'image/png'
            break
          case 'jpg':
            format = MagickFormat.Jpeg
            mimeType = 'image/jpeg'
            break
          default:
            format = MagickFormat.WebP
            mimeType = 'image/webp'
        }
        
        img.write(format, (data: Uint8Array) => {
          const blob = new Blob([data], { type: mimeType })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${imageFile.name.split('.')[0]}.${targetFormat}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          
          clearInterval(progressInterval)
          setProgress(100)
          setTimeout(() => {
            setIsProcessing(false)
            setProgress(0)
          }, 500)
        })
      })
    } catch (error) {
      console.error('Error converting image:', error)
      clearInterval(progressInterval)
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const compressImage = async (imageFile: ImageFile) => {
    setIsProcessing(true)
    setProgress(0)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    try {
      const arrayBuffer = await imageFile.file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      ImageMagick.read(uint8Array, (img) => {
        // Set quality for compression
        img.quality = quality
        
        // Determine format based on original file type
        let format: MagickFormat
        if (imageFile.type.includes('jpeg') || imageFile.type.includes('jpg')) {
          format = MagickFormat.Jpeg
        } else if (imageFile.type.includes('png')) {
          format = MagickFormat.Png
        } else if (imageFile.type.includes('webp')) {
          format = MagickFormat.WebP
        } else {
          format = MagickFormat.Jpeg // Default to JPEG for compression
        }
        
        img.write(format, (data: Uint8Array) => {
          const blob = new Blob([data], { type: imageFile.type })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `compressed_${imageFile.name}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          
          clearInterval(progressInterval)
          setProgress(100)
          setTimeout(() => {
            setIsProcessing(false)
            setProgress(0)
          }, 500)
        })
      })
    } catch (error) {
      console.error('Error compressing image:', error)
      clearInterval(progressInterval)
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleWidthChange = (value: string) => {
    setResizeWidth(value)

    if (maintainAspectRatio && selectedFiles.length > 0) {
      const imageFile = selectedFiles[0]
      const originalDimensions = imageFile.dimensions

      if (originalDimensions && value) {
        const aspectRatio = originalDimensions.width / originalDimensions.height
        const newHeight = Math.round(parseInt(value) / aspectRatio)
        setResizeHeight(newHeight.toString())
      }
    }
  }

  const handleHeightChange = (value: string) => {
    setResizeHeight(value)

    if (maintainAspectRatio && selectedFiles.length > 0) {
      const imageFile = selectedFiles[0]
      const originalDimensions = imageFile.dimensions

      if (originalDimensions && value) {
        const aspectRatio = originalDimensions.width / originalDimensions.height
        const newWidth = Math.round(parseInt(value) * aspectRatio)
        setResizeWidth(newWidth.toString())
      }
    }
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background/80 z-50 fixed top-0 left-0">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="text-lg text-foreground">Loading image tools...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background/80 z-50 fixed top-0 left-0">
        <div className="flex flex-col items-center gap-4">
          <span className="text-lg text-red-500">Failed to load image tools: {error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="glass border-b border-border/50">
        <div className="container mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg flex items-center justify-center">
                <ImageIcon className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <h1 className="text-heading text-foreground">Image Tools</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          <div className="flex gap-6 h-full">
            {/* Left 1/3 - File Upload Area */}
            <div className="w-1/3">
              <Card className="glass-card border-0 animate-fade-in h-full">
                <CardContent className="p-6 h-full">
                  {selectedFiles.length === 0 ? (
                    // Upload interface when no files are selected
                    <div
                      className="border-2 border-dashed border-primary/20 rounded-xl p-6 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group h-full flex flex-col justify-center"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Drop an image here
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Supports JPG, PNG, WebP, GIF
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          JPG
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          PNG
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          WebP
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          GIF
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    // Display uploaded file
                    <div
                      className="border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer group"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                            <FileImage className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            Selected Image
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedFiles([])
                            setMetadata({})
                          }}
                          className="hover:bg-red-500 hover:text-red-foreground text-xs"
                        >
                          Clear
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {selectedFiles.map((file) => (
                          <div key={file.name} className="space-y-2">
                            <div className="relative">
                              <img
                                src={file.preview}
                                alt={file.name}
                                className="w-full max-h-64 object-contain rounded-lg bg-muted/20"
                                style={{
                                  minHeight:
                                    file.dimensions &&
                                    file.dimensions.height >
                                      file.dimensions.width
                                      ? '200px'
                                      : '120px',
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground truncate text-sm">
                                {file.name}
                              </p>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{formatFileSize(file.size)}</span>
                                {file.dimensions && (
                                  <span>
                                    {file.dimensions.width} ×{' '}
                                    {file.dimensions.height}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <Upload className="w-3 h-3" />
                          <span>Click to change image</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files && handleFileSelect(e.target.files)
                    }
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right 2/3 - Tools */}
            <div className="w-2/3">
              <div className="animate-fade-in">
                <Tabs
                  value={activeTab}
                  onValueChange={handleTabChange}
                  className="space-y-4"
                >
                  <TabsList className="flat-card border-0 grid w-full grid-cols-4 h-10">
                    <TabsTrigger
                      value="metadata"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Info className="w-4 h-4 mr-2" />
                      Metadata
                    </TabsTrigger>
                    <TabsTrigger
                      value="resize"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Maximize className="w-4 h-4 mr-2" />
                      Resize
                    </TabsTrigger>
                    <TabsTrigger
                      value="convert"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Convert
                    </TabsTrigger>
                    <TabsTrigger
                      value="compress"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Compress
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="metadata">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6">
                        {selectedFiles.length > 0 &&
                        metadata[selectedFiles[0].name] ? (
                          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-4 rounded-lg">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Dimensions:
                              </span>
                              <span className="font-medium">
                                {metadata[selectedFiles[0].name].width} ×{' '}
                                {metadata[selectedFiles[0].name].height}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Format:
                              </span>
                              <span className="font-medium">
                                {metadata[selectedFiles[0].name].format}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Colorspace:
                              </span>
                              <span className="font-medium">
                                {metadata[selectedFiles[0].name].colorspace}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Bit Depth:
                              </span>
                              <span className="font-medium">
                                {metadata[selectedFiles[0].name].depth}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Compression:
                              </span>
                              <span className="font-medium">
                                {metadata[selectedFiles[0].name].compression}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Size:
                              </span>
                              <span className="font-medium">
                                {formatFileSize(
                                  metadata[selectedFiles[0].name].size,
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-32">
                            <div className="text-center text-muted-foreground">
                              <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">
                                Select an image to view metadata
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="resize">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label
                              htmlFor="width"
                              className="text-sm font-medium"
                            >
                              Width (px)
                            </Label>
                            <Input
                              id="width"
                              type="number"
                              value={resizeWidth}
                              onChange={(e) =>
                                handleWidthChange(e.target.value)
                              }
                              placeholder="800"
                              className="border-border/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="height"
                              className="text-sm font-medium"
                            >
                              Height (px)
                            </Label>
                            <Input
                              id="height"
                              type="number"
                              value={resizeHeight}
                              onChange={(e) =>
                                handleHeightChange(e.target.value)
                              }
                              placeholder="600"
                              className="border-border/50"
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="aspect-ratio"
                            checked={maintainAspectRatio}
                            onCheckedChange={(checked) =>
                              setMaintainAspectRatio(checked as boolean)
                            }
                          />
                          <Label
                            htmlFor="aspect-ratio"
                            className="text-sm font-medium cursor-pointer"
                          >
                            Keep aspect ratio
                          </Label>
                        </div>

                        {progress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Processing...</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full h-2" />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={() => resizeImage(selectedFiles[0])}
                            disabled={
                              isProcessing ||
                              !resizeWidth ||
                              !resizeHeight ||
                              selectedFiles.length === 0
                            }
                            className="bg-purple-500 hover:bg-purple-600"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Resize & Download
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="convert">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6 space-y-4">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">
                            Target Format
                          </Label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="webp"
                                name="format"
                                value="webp"
                                checked={targetFormat === 'webp'}
                                onChange={(e) =>
                                  setTargetFormat(e.target.value)
                                }
                                className="w-4 h-4 text-primary border-border/50"
                              />
                              <Label
                                htmlFor="webp"
                                className="text-sm font-normal cursor-pointer"
                              >
                                WebP (Recommended)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="png"
                                name="format"
                                value="png"
                                checked={targetFormat === 'png'}
                                onChange={(e) =>
                                  setTargetFormat(e.target.value)
                                }
                                className="w-4 h-4 text-primary border-border/50"
                              />
                              <Label
                                htmlFor="png"
                                className="text-sm font-normal cursor-pointer"
                              >
                                PNG (Lossless)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="jpg"
                                name="format"
                                value="jpg"
                                checked={targetFormat === 'jpg'}
                                onChange={(e) =>
                                  setTargetFormat(e.target.value)
                                }
                                className="w-4 h-4 text-primary border-border/50"
                              />
                              <Label
                                htmlFor="jpg"
                                className="text-sm font-normal cursor-pointer"
                              >
                                JPG (Compressed)
                              </Label>
                            </div>
                          </div>
                        </div>

                        {progress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Converting...</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full h-2" />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={() => convertImage(selectedFiles[0])}
                            disabled={
                              isProcessing || selectedFiles.length === 0
                            }
                            className="bg-green-500 hover:bg-green-600"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Convert & Download
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="compress">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6 space-y-4">
                        <div className="space-y-3">
                          <Label
                            htmlFor="quality"
                            className="text-sm font-medium"
                          >
                            Quality: {quality}%
                          </Label>
                          <Input
                            id="quality"
                            type="range"
                            min="1"
                            max="100"
                            value={quality}
                            onChange={(e) =>
                              setQuality(parseInt(e.target.value))
                            }
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Smaller file</span>
                            <span>Better quality</span>
                          </div>
                        </div>

                        {progress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Compressing...</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full h-2" />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={() => compressImage(selectedFiles[0])}
                            disabled={
                              isProcessing || selectedFiles.length === 0
                            }
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Compress & Download
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
