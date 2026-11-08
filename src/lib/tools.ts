import {
  Image,
  Video,
  FileText,
  Archive,
  FileCheck2,
  Settings,
  Maximize,
  SlidersHorizontal,
  Minimize2,
  ScanEye,
  Info,
  Scissors,
  Music2,
  Merge,
  Package,
  FolderOpen,
  Hash,
  AudioLines,
  Crop,
  Eraser,
  FileImage,
  Layers,
  ListOrdered,
  PenLine,
  ScanText,
  Stamp,
} from 'lucide-react'
import { toolPaths } from './toolPaths.ts'

export const toolCategories = [
  {
    name: 'Images',
    path: '/images',
    icon: Image,
    color: 'text-blue-600 dark:text-blue-400',
    tools: [
      {
        name: 'Resize image',
        route: toolPaths.imageResize,
        pageTitle: 'Resize Images Online by Width and Height',
        description: 'Change dimensions while keeping the right proportions.',
        instructions:
          'Resize a JPG, PNG, WebP, or GIF by entering a width or height in pixels. Lock the aspect ratio to keep the original proportions.',
        keywords: 'photo picture scale resolution dimensions enlarge',
        icon: Maximize,
      },
      {
        name: 'Compress image',
        route: toolPaths.imageCompress,
        pageTitle: 'Compress JPG, PNG and WebP Images Online',
        description: 'Make a photo or image file smaller.',
        instructions:
          'Reduce photo file size with a compression preset, or compress a JPG to a maximum size in KB for a form or attachment.',
        keywords: 'photo picture shrink reduce size limit kb',
        icon: Minimize2,
      },
      {
        name: 'Convert image',
        route: toolPaths.imageConvert,
        pageTitle: 'Image Converter for HEIC, JPG, PNG and WebP',
        description: 'Save an image in a different format.',
        instructions:
          'Convert HEIC to JPG, JPG to PNG, or WebP to JPG in your browser. Choose PNG or WebP to preserve transparency.',
        keywords: 'jpg jpeg png webp gif heic heif format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Crop, rotate and flip image',
        route: toolPaths.imageCrop,
        pageTitle: 'Crop, Rotate or Flip Images Online',
        description: 'Keep a selected area or change the image orientation.',
        instructions:
          'Crop a photo to keep the area you want, rotate it in 90-degree steps, or flip it horizontally or vertically. Preview your edits before saving.',
        keywords: 'photo picture crop rotate flip mirror aspect ratio',
        icon: Crop,
      },
      {
        name: 'Batch resize or convert images',
        route: toolPaths.imageBatch,
        pageTitle: 'Batch Resize or Convert Images Online',
        description: 'Apply the same settings to multiple images.',
        instructions:
          'Resize multiple images to fit the same dimensions or convert them to JPG, PNG, or WebP in bulk. Download the results together as a ZIP.',
        keywords: 'bulk batch multiple photos zip dimensions',
        icon: Layers,
      },
      {
        name: 'Remove image background',
        route: toolPaths.imageBackground,
        pageTitle: 'Remove Image Background and Save as PNG',
        description: 'Keep the subject and make the background transparent.',
        instructions:
          'Remove a photo background by detecting the subject automatically or picking a solid color to make transparent. Download a transparent PNG.',
        keywords: 'background transparent photo chroma key green screen',
        icon: Eraser,
      },
      {
        name: 'Redact image',
        route: toolPaths.imageRedact,
        pageTitle: 'Image Redaction Tool for Photos and Screenshots',
        description: 'Cover private details before sharing.',
        instructions:
          'Redact a photo or screenshot by covering private details with solid boxes. You can also blur or pixelate parts of the image.',
        keywords:
          'photo picture hide cover blur pixelate privacy censor mask black out sensitive face',
        icon: ScanEye,
      },
      {
        name: 'Image metadata',
        route: toolPaths.imageMetadata,
        pageTitle: 'View and Remove EXIF and GPS Metadata from Photos',
        description: 'Inspect image details and remove metadata.',
        instructions:
          'Check a photo for camera settings and GPS location. Remove supported EXIF, GPS, and XMP metadata from JPG, PNG, WebP, or TIFF files.',
        keywords:
          'photo picture exif gps location geotag privacy remove delete personal data',
        icon: Info,
      },
    ],
  },
  {
    name: 'Videos',
    path: '/videos',
    icon: Video,
    color: 'text-violet-600 dark:text-violet-400',
    tools: [
      {
        name: 'Compress video',
        route: toolPaths.videoCompress,
        pageTitle: 'Compress Video Online to a Smaller MP4',
        description: 'Reduce video size with a preset or a maximum size.',
        instructions:
          'Reduce video file size with a quality preset or a maximum size in MB. Compare the compressed MP4 with the original before sharing.',
        keywords: 'movie shrink smaller reduce limit mb',
        icon: Minimize2,
      },
      {
        name: 'Convert video',
        route: toolPaths.videoConvert,
        pageTitle: 'Video Converter for MP4, WebM, MKV and AVI',
        description: 'Change a video’s output format.',
        instructions:
          'Convert WebM, MKV, or AVI to MP4, or export a video in one of those formats. Choose compatible video and audio codecs in your browser.',
        keywords: 'movie mp4 webm format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Trim video',
        route: toolPaths.videoTrim,
        pageTitle: 'Online Video Trimmer for MP4, MOV and WebM',
        description: 'Keep just the part you need.',
        instructions:
          'Trim a video by setting its start and end times. Save the clip in its original video format or turn it into a silent animated GIF or WebP.',
        keywords: 'cut clip movie length mp4 gif animated webp',
        icon: Scissors,
      },
      {
        name: 'Join videos',
        route: toolPaths.videoJoin,
        pageTitle: 'Join Videos Online into One MP4',
        description: 'Combine clips in the order you choose.',
        instructions:
          'Combine two or more video clips into a single MP4. Arrange the clips in playback order before downloading the merged video.',
        keywords: 'merge combine concatenate movie clips',
        icon: Merge,
      },
      {
        name: 'Extract audio from video',
        route: toolPaths.videoExtract,
        pageTitle: 'Extract Audio from Video to MP3, AAC or WAV',
        description: 'Save the sound from a video.',
        instructions:
          'Extract the audio track from an MP4 or another video and save it as MP3, AAC, or uncompressed WAV.',
        keywords: 'music sound movie mp4 webm mp3 wav aac',
        icon: Music2,
      },
      {
        name: 'Video metadata',
        route: toolPaths.videoMetadata,
        pageTitle: 'View and Remove Video Metadata',
        description: 'Inspect duration, dimensions, and codecs.',
        instructions:
          'Check video duration, resolution, and codecs. Download a copy with descriptive metadata removed while keeping the video and audio streams.',
        keywords: 'movie info details',
        icon: Info,
      },
    ],
  },
  {
    name: 'Audio',
    path: '/audio',
    icon: AudioLines,
    color: 'text-pink-700 dark:text-pink-400',
    tools: [
      {
        name: 'Convert audio',
        route: toolPaths.audioConvert,
        pageTitle: 'Convert Audio Files to MP3, WAV or M4A',
        description: 'Save a sound file in a different format.',
        instructions:
          'Convert M4A voice memos or WAV recordings to MP3. Choose MP3, uncompressed WAV, or M4A with AAC audio for the output.',
        keywords: 'sound music mp3 wav aac m4a voice memo format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Trim audio',
        route: toolPaths.audioTrim,
        pageTitle: 'Trim Audio Online and Save an MP3, WAV or M4A',
        description: 'Keep part of a recording.',
        instructions:
          'Cut an audio recording by setting the start and end times. Preview the source and save the selected clip as MP3, WAV, or M4A.',
        keywords: 'cut clip sound recording music',
        icon: Scissors,
      },
      {
        name: 'Join audio',
        route: toolPaths.audioJoin,
        pageTitle: 'Join Audio Files Online into One Track',
        description: 'Combine recordings in playback order.',
        instructions:
          'Merge audio files in the order you choose. Combine recordings, voice memos, or music clips into one MP3, WAV, or M4A file.',
        keywords: 'merge combine concatenate sound recording music',
        icon: Merge,
      },
    ],
  },
  {
    name: 'PDFs',
    path: '/pdfs',
    icon: FileText,
    color: 'text-emerald-700 dark:text-emerald-400',
    tools: [
      {
        name: 'Merge PDFs',
        route: toolPaths.pdfMerge,
        pageTitle: 'Merge PDF Files Online into One PDF',
        description: 'Combine documents in the order you choose.',
        instructions:
          'Combine two or more PDFs into one document. Drag the files into the order you want, then download the merged PDF.',
        keywords: 'join combine pages documents',
        icon: Merge,
      },
      {
        name: 'Compress PDF',
        route: toolPaths.pdfCompress,
        pageTitle: 'Compress PDF Online and Keep Text Selectable',
        description: 'Reduce PDF file size in your browser.',
        instructions:
          'Reduce PDF file size while keeping text and page layout. Choose lossless compression or reduce the quality of embedded photos.',
        keywords: 'pdf shrink reduce size optimize scan document',
        icon: Minimize2,
      },
      {
        name: 'Images to PDF',
        route: toolPaths.pdfFromImages,
        pageTitle: 'JPG or PNG to PDF Converter',
        description: 'Put one or more images into a PDF.',
        instructions:
          'Convert JPG or PNG images to PDF. Add photos or scans, arrange them in page order, and download them as one document.',
        keywords: 'photo photos jpg jpeg png picture pdf combine',
        icon: FileImage,
      },
      {
        name: 'Split or extract PDF pages',
        route: toolPaths.pdfSplit,
        pageTitle: 'Split PDF Online or Extract Pages',
        description: 'Save selected pages or split a PDF into parts.',
        instructions:
          'Split a PDF into separate files or extract selected pages into one new PDF. Enter page ranges or save each page separately.',
        keywords: 'pdf separate divide select extract pages ranges',
        icon: Scissors,
      },
      {
        name: 'Organize PDF pages',
        route: toolPaths.pdfOrganize,
        pageTitle: 'Reorder, Rotate or Delete PDF Pages',
        description: 'Change the order, orientation, or contents of a PDF.',
        instructions:
          'Rearrange PDF pages, rotate sideways pages, or delete pages you no longer need. Save the edited document as a new PDF.',
        keywords: 'pdf rearrange reorder rotate delete remove pages',
        icon: ListOrdered,
      },
      {
        name: 'PDF to images',
        route: toolPaths.pdfToImages,
        pageTitle: 'PDF to JPG or PNG Converter',
        description: 'Save PDF pages as images.',
        instructions:
          'Convert PDF pages to JPG or PNG images at your chosen resolution. Export a single page or download multiple pages as a ZIP.',
        keywords: 'pdf jpg jpeg png render image export',
        icon: FileImage,
      },
      {
        name: 'Make PDF searchable',
        route: toolPaths.pdfOCR,
        pageTitle: 'PDF OCR Tool to Make Scanned PDFs Searchable',
        description: 'Recognize English text in scanned pages.',
        instructions:
          'Run OCR on a scanned PDF to recognize English text. Download a copy with a text layer you can search, select, and copy.',
        keywords: 'ocr pdf scanned scan text recognition searchable copy',
        icon: ScanText,
      },
      {
        name: 'Redact PDF',
        route: toolPaths.pdfRedact,
        pageTitle: 'Redact PDF Online and Black Out Sensitive Text',
        description: 'Black out sensitive areas in a new PDF copy.',
        instructions:
          'Black out text or images in a PDF before sharing. Mark the areas to redact and download a copy made from the redacted page images.',
        keywords: 'pdf redact hide black out sensitive remove private',
        icon: Eraser,
      },
      {
        name: 'Sign a PDF',
        route: toolPaths.pdfSign,
        pageTitle: 'Sign a PDF with a Typed Signature',
        description: 'Place a visible signature on a selected page.',
        instructions:
          'Type your name to add a visible signature to a PDF. Choose a page and position, then download a copy with the signature.',
        keywords: 'pdf sign signature stamp',
        icon: PenLine,
      },
      {
        name: 'Watermark PDF',
        route: toolPaths.pdfWatermark,
        pageTitle: 'Watermark PDF Online with Custom Text',
        description: 'Stamp a text label on PDF pages.',
        instructions:
          'Add a text watermark such as Draft or Confidential to every page of a PDF. Enter your own label and save the watermarked copy.',
        keywords: 'pdf watermark text draft confidential stamp',
        icon: Stamp,
      },
      {
        name: 'PDF to editable Word',
        route: toolPaths.pdfToWord,
        pageTitle: 'PDF to Word Converter for Editable Text',
        description: 'Save selectable text as an editable DOCX.',
        instructions:
          'Export selectable text from a PDF into an editable Word DOCX. This experimental converter focuses on text, so review the layout and tables.',
        keywords: 'pdf word docx extract editable text',
        icon: FileText,
      },
    ],
  },
  {
    name: 'Documents',
    path: '/office-documents',
    icon: FileCheck2,
    color: 'text-indigo-600 dark:text-indigo-400',
    tools: [
      {
        name: 'Convert document to PDF',
        route: toolPaths.documentConvert,
        pageTitle: 'Convert Word, Excel or PowerPoint to PDF',
        description: 'Turn office documents into a shareable PDF.',
        instructions:
          'Convert Word to PDF from DOCX, Excel to PDF from XLSX, or PowerPoint to PDF from PPTX. Review the PDF layout before sharing.',
        keywords: 'word docx excel xlsx spreadsheet office',
        icon: FileText,
      },
    ],
  },
  {
    name: 'Archives',
    path: '/archives',
    icon: Archive,
    color: 'text-amber-700 dark:text-amber-400',
    tools: [
      {
        name: 'Create a ZIP or other archive',
        route: toolPaths.archiveCompress,
        pageTitle: 'Create ZIP, 7z, TAR or TAR.GZ Archives Online',
        description: 'Bundle files into a ZIP or another archive.',
        instructions:
          'Bundle multiple files into a ZIP, 7z, or TAR archive. Select GZIP for a compressed TAR.GZ download.',
        keywords: 'zip gzip tar 7z compress package',
        icon: Package,
      },
      {
        name: 'Unzip or extract an archive',
        route: toolPaths.archiveExtract,
        pageTitle: 'Online Archive Extractor for ZIP, RAR and 7z',
        description: 'Open an archive and download its files.',
        instructions:
          'Extract files from ZIP, RAR, 7z, TAR, or GZIP archives in your browser. Enter a password if needed, then download the files you want.',
        keywords: 'unzip zip 7z rar unpack encrypted password protected',
        icon: FolderOpen,
      },
    ],
  },
  {
    name: 'Utilities',
    path: '/utilities',
    icon: Settings,
    color: 'text-slate-600 dark:text-slate-400',
    tools: [
      {
        name: 'File hashes',
        route: toolPaths.fileHash,
        pageTitle: 'File Checksum Calculator for MD5, SHA-1 and SHA-256',
        description: 'Calculate, copy, and verify a checksum.',
        instructions:
          'Generate MD5, SHA-1, and SHA-256 hashes for a file in your browser. Paste an expected checksum to verify it against the calculated value.',
        keywords: 'md5 sha1 sha256 checksum verify',
        icon: Hash,
      },
      {
        name: 'File metadata',
        route: toolPaths.fileMetadata,
        pageTitle: 'Identify File Type and Detect MIME Type Online',
        description: 'Inspect the type and details of a file.',
        instructions:
          'Check a file to see its detected MIME type, format description, and size. Identify an unknown file even if its extension is missing or wrong.',
        keywords: 'mime info identify details',
        icon: Info,
      },
    ],
  },
]

export const allTools = toolCategories.flatMap((category) =>
  category.tools.map((tool) => ({
    ...tool,
    category: category.name,
    color: category.color,
  })),
)
