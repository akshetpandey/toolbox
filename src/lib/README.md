# File Processing Library

This library provides reusable components for FFmpeg and ImageMagick operations in the toolbox application.

## Structure

### `ffmpeg.ts`

Contains FFmpeg-related functionality for video processing:

- `FFmpegProcessor` class for video operations
- Video metadata extraction
- Video conversion between formats
- Video compression
- Video trimming
- Audio extraction from videos

### `imagemagick.ts`

Contains ImageMagick-related functionality for image processing:

- `ImageMagickProcessor` class for image operations
- Image metadata extraction
- Image resizing
- Image format conversion
- Image compression

### `shared.ts`

Common utility functions used across both FFmpeg and ImageMagick tools:

- File size formatting
- Duration formatting
- File download utilities
- Object URL management
- File type validation
- Progress simulation

### `utils.ts`

General utility functions (from shadcn/ui):

- CSS class name merging

## Usage

### FFmpeg Operations

```typescript
import {
  FFmpegProcessor,
  type VideoFile,
  type VideoConvertOptions,
} from '@/lib/ffmpeg'

// Create processor instance
const ffmpegProcessor = new FFmpegProcessor(ffmpegInstance)

// Convert video
const options: VideoConvertOptions = {
  targetFormat: 'mp4',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  preset: 'medium',
}
const blob = await ffmpegProcessor.convertVideo(videoFile, options)
```

### ImageMagick Operations

```typescript
import {
  ImageMagickProcessor,
  type ImageFile,
  type ImageConvertOptions,
} from '@/lib/imagemagick'

// Create processor instance
const imageMagickProcessor = new ImageMagickProcessor()

// Convert image
const options: ImageConvertOptions = {
  targetFormat: 'webp',
}
const blob = await imageMagickProcessor.convertImage(imageFile, options)
```

### Shared Utilities

```typescript
import { formatFileSize, downloadFile, createObjectURL } from '@/lib/shared'

// Format file size
const size = formatFileSize(1024) // "1 KB"

// Download file
downloadFile(url, 'filename.ext')

// Create object URL
const url = createObjectURL(blob)
```

## Interfaces

### Video Processing

- `VideoFile`: Video file with metadata
- `VideoMetadata`: Extracted video information
- `VideoConvertOptions`: Video conversion settings
- `VideoCompressOptions`: Video compression settings
- `TrimOptions`: Video trimming settings
- `AudioExtractOptions`: Audio extraction settings

### Image Processing

- `ImageFile`: Image file with metadata
- `ImageMetadata`: Extracted image information
- `ResizeOptions`: Image resizing settings
- `ImageConvertOptions`: Image conversion settings
- `ImageCompressOptions`: Image compression settings

## Benefits

1. **Reusability**: Common functionality extracted into shared libraries
2. **Type Safety**: Strong TypeScript interfaces for all operations
3. **Consistency**: Unified API patterns across different tools
4. **Maintainability**: Centralized logic for easier updates and bug fixes
5. **Testability**: Isolated functions and classes for better testing
