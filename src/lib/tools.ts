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
        pageTitle: 'Resize Images by Width and Height',
        description: 'Change dimensions while keeping the right proportions.',
        instructions:
          'Choose a JPG, PNG, WebP, or GIF. Enter a width or height in pixels and keep the aspect ratio locked to resize without stretching the image.',
        keywords: 'photo picture scale resolution dimensions enlarge',
        icon: Maximize,
      },
      {
        name: 'Compress image',
        route: toolPaths.imageCompress,
        pageTitle: 'Compress Images in Your Browser',
        description: 'Make a photo or image file smaller.',
        instructions:
          'Choose an image and pick a quality preset. For a JPG, set a maximum size in KB when you need to meet an upload limit.',
        keywords: 'photo picture shrink reduce size limit kb',
        icon: Minimize2,
      },
      {
        name: 'Convert image',
        route: toolPaths.imageConvert,
        pageTitle: 'Convert HEIC, JPG, PNG, and WebP Images',
        description: 'Save an image in a different format.',
        instructions:
          'Choose a HEIC, JPG, PNG, WebP, or GIF image and save it as JPG, PNG, or WebP. PNG and WebP can preserve transparency.',
        keywords: 'jpg jpeg png webp gif heic heif format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Crop, rotate and flip image',
        route: toolPaths.imageCrop,
        pageTitle: 'Crop, Rotate, or Flip Images in Your Browser',
        description: 'Keep a selected area or change the image orientation.',
        instructions:
          'Choose an image, set the crop area, and rotate or mirror it as needed. Preview the result before saving.',
        keywords: 'photo picture crop rotate flip mirror aspect ratio',
        icon: Crop,
      },
      {
        name: 'Batch resize or convert images',
        route: toolPaths.imageBatch,
        pageTitle: 'Batch Resize or Convert Images',
        description: 'Apply the same settings to multiple images.',
        instructions:
          'Choose multiple images and apply the same resize or conversion settings. Download the processed files together as a ZIP.',
        keywords: 'bulk batch multiple photos zip dimensions',
        icon: Layers,
      },
      {
        name: 'Remove image background',
        route: toolPaths.imageBackground,
        pageTitle: 'Remove an Image Background in Your Browser',
        description: 'Keep the subject and make the background transparent.',
        instructions:
          'Choose an image to isolate the subject automatically, or pick a solid color to remove. Save the transparent result as a PNG.',
        keywords: 'background transparent photo chroma key green screen',
        icon: Eraser,
      },
      {
        name: 'Redact image',
        route: toolPaths.imageRedact,
        pageTitle: 'Redact Images and Screenshots',
        description: 'Cover private details before sharing.',
        instructions:
          'Mark the areas you want to cover, then download the edited image. Use a solid box for readable text such as names, addresses, or account numbers.',
        keywords:
          'photo picture hide cover blur pixelate privacy censor mask black out sensitive face',
        icon: ScanEye,
      },
      {
        name: 'Image metadata',
        route: toolPaths.imageMetadata,
        pageTitle: 'View and Remove Image EXIF Metadata',
        description: 'Inspect image details and remove metadata.',
        instructions:
          'Choose an image to inspect details such as camera settings and GPS location when present. Download a cleaned copy to remove supported embedded metadata before sharing.',
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
        pageTitle: 'Compress Video to a Smaller MP4',
        description: 'Reduce video size with a preset or a maximum size.',
        instructions:
          'Choose a video and pick a quality preset or set a maximum size in MB. Export an MP4 and compare its size with the original.',
        keywords: 'movie shrink smaller reduce limit mb',
        icon: Minimize2,
      },
      {
        name: 'Convert video',
        route: toolPaths.videoConvert,
        pageTitle: 'Video Converter for MP4, WebM, MKV, and AVI',
        description: 'Change a video’s output format.',
        instructions:
          'Choose a video, then select MP4, WebM, MKV, or AVI for the output. The tool shows which video and audio codecs work with the selected format.',
        keywords: 'movie mp4 webm format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Trim video',
        route: toolPaths.videoTrim,
        pageTitle: 'Trim Video and Save a Clip',
        description: 'Keep just the part you need.',
        instructions:
          'Set the start and end of the clip you want to keep. Export in the original video format or make a silent animated GIF or WebP.',
        keywords: 'cut clip movie length mp4 gif animated webp',
        icon: Scissors,
      },
      {
        name: 'Join videos',
        route: toolPaths.videoJoin,
        pageTitle: 'Join Video Clips into One MP4',
        description: 'Combine clips in the order you choose.',
        instructions:
          'Add two or more clips, arrange them in playback order, and download a single MP4.',
        keywords: 'merge combine concatenate movie clips',
        icon: Merge,
      },
      {
        name: 'Extract audio',
        route: toolPaths.videoExtract,
        pageTitle: 'Extract Audio from Video to MP3, AAC, or WAV',
        description: 'Save the sound from a video.',
        instructions:
          'Choose a video with an audio track, then save the audio as MP3, AAC, or WAV. WAV is uncompressed and generally produces a larger file.',
        keywords: 'music sound movie mp4 webm mp3 wav aac',
        icon: Music2,
      },
      {
        name: 'Video metadata',
        route: toolPaths.videoMetadata,
        pageTitle: 'View Video Metadata and Codecs',
        description: 'Inspect duration, dimensions, and codecs.',
        instructions:
          'Choose a video to see its duration, resolution, and video and audio codecs. Use these details to check what a player or editor needs to open it.',
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
        pageTitle: 'Convert Audio Files to MP3, WAV, or AAC',
        description: 'Save a sound file in a different format.',
        instructions:
          'Choose an audio file such as a voice memo or WAV recording, select an output format, and download the result.',
        keywords: 'sound music mp3 wav aac m4a voice memo format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Trim audio',
        route: toolPaths.audioTrim,
        pageTitle: 'Trim Audio and Save a Clip',
        description: 'Keep part of a recording.',
        instructions:
          'Choose an audio file, set the start and end of the part to keep, and download the clip.',
        keywords: 'cut clip sound recording music',
        icon: Scissors,
      },
      {
        name: 'Join audio',
        route: toolPaths.audioJoin,
        pageTitle: 'Join Audio Files into One Track',
        description: 'Combine recordings in playback order.',
        instructions:
          'Add two or more audio files, arrange them, and save them as one track.',
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
        pageTitle: 'Merge PDFs into One File',
        description: 'Combine documents in the order you choose.',
        instructions:
          'Add two or more PDF files, arrange them in the order you want them to appear, and download the combined PDF.',
        keywords: 'join combine pages documents',
        icon: Merge,
      },
      {
        name: 'Compress PDF',
        route: toolPaths.pdfCompress,
        pageTitle: 'Compress a PDF and Keep Text Selectable',
        description: 'Reduce PDF file size in your browser.',
        instructions:
          'Choose a PDF and select a compression mode. Compare the result with the original before downloading.',
        keywords: 'pdf shrink reduce size optimize scan document',
        icon: Minimize2,
      },
      {
        name: 'Images to PDF',
        route: toolPaths.pdfFromImages,
        pageTitle: 'Convert JPG or PNG Images to a PDF',
        description: 'Put one or more images into a PDF.',
        instructions:
          'Add JPG or PNG images, arrange them in page order, and download a single PDF.',
        keywords: 'photo photos jpg jpeg png picture pdf combine',
        icon: FileImage,
      },
      {
        name: 'Split or extract PDF pages',
        route: toolPaths.pdfSplit,
        pageTitle: 'Split a PDF or Extract Selected Pages',
        description: 'Save selected pages or split a PDF into parts.',
        instructions:
          'Choose a PDF and enter the page ranges to keep or split into separate files.',
        keywords: 'pdf separate divide select extract pages ranges',
        icon: Scissors,
      },
      {
        name: 'Organize PDF pages',
        route: toolPaths.pdfOrganize,
        pageTitle: 'Reorder, Rotate, or Delete PDF Pages',
        description: 'Change the order, orientation, or contents of a PDF.',
        instructions:
          'Choose a PDF, then move, rotate, or remove pages before saving a copy.',
        keywords: 'pdf rearrange reorder rotate delete remove pages',
        icon: ListOrdered,
      },
      {
        name: 'PDF to images',
        route: toolPaths.pdfToImages,
        pageTitle: 'Convert PDF Pages to JPG or PNG',
        description: 'Save PDF pages as images.',
        instructions:
          'Choose a PDF and export selected pages as JPG or PNG images. Multiple pages download as a ZIP.',
        keywords: 'pdf jpg jpeg png render image export',
        icon: FileImage,
      },
      {
        name: 'Make PDF searchable',
        route: toolPaths.pdfOCR,
        pageTitle: 'Make a Scanned PDF Searchable with OCR',
        description: 'Recognize English text in scanned pages.',
        instructions:
          'Choose a scanned PDF and run English text recognition to create a copy with searchable text.',
        keywords: 'ocr pdf scanned scan text recognition searchable copy',
        icon: ScanText,
      },
      {
        name: 'Redact PDF',
        route: toolPaths.pdfRedact,
        pageTitle: 'Redact Sensitive Information in a PDF',
        description: 'Black out sensitive areas in a new PDF copy.',
        instructions:
          'Choose a PDF and mark the areas to cover. The redacted copy is rebuilt from the visible pages.',
        keywords: 'pdf redact hide black out sensitive remove private',
        icon: Eraser,
      },
      {
        name: 'Add a signature to PDF',
        route: toolPaths.pdfSign,
        pageTitle: 'Add a Visible Signature to a PDF',
        description: 'Place a visible signature on a selected page.',
        instructions:
          'Choose a PDF, add your signature to a page, and download the signed copy.',
        keywords: 'pdf sign signature stamp',
        icon: PenLine,
      },
      {
        name: 'Watermark PDF',
        route: toolPaths.pdfWatermark,
        pageTitle: 'Add a Text Watermark to a PDF',
        description: 'Stamp a text label on PDF pages.',
        instructions:
          'Choose a PDF and enter the watermark text. Save a new copy with the label on its pages.',
        keywords: 'pdf watermark text draft confidential stamp',
        icon: Stamp,
      },
      {
        name: 'PDF to editable Word',
        route: toolPaths.pdfToWord,
        pageTitle: 'Export Selectable PDF Text to an Editable Word Document',
        description: 'Save selectable text as an editable DOCX.',
        instructions:
          'Choose a PDF with selectable text to export it to an editable Word document. This experimental converter focuses on text.',
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
        pageTitle: 'Convert Word, Excel, and PowerPoint to PDF',
        description: 'Turn office documents into a shareable PDF.',
        instructions:
          'Choose a DOCX, XLSX, or PPTX file and download a PDF copy. Save older Office files in a current format first. Review the output if the layout matters.',
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
        name: 'Create archive',
        route: toolPaths.archiveCompress,
        pageTitle: 'Create ZIP, 7z, TAR, and TAR.GZ Archives',
        description: 'Bundle files into a ZIP or another archive.',
        instructions:
          'Add the files you want to bundle, choose ZIP, 7z, TAR, or GZIP, and name the archive. The GZIP option packages the files into a .tar.gz archive.',
        keywords: 'zip gzip tar 7z compress package',
        icon: Package,
      },
      {
        name: 'Extract archive',
        route: toolPaths.archiveExtract,
        pageTitle: 'Extract ZIP, RAR, and 7z Archives',
        description: 'Open an archive and download its files.',
        instructions:
          'Choose a ZIP, RAR, 7z, TAR, or GZIP archive. Enter its password if needed, then download a single file or save all extracted files.',
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
        pageTitle: 'Calculate and Verify File Checksums',
        description: 'Calculate, copy, and verify a checksum.',
        instructions:
          'Choose a file to calculate its MD5, SHA-1, and SHA-256 checksums. Paste an expected checksum to see whether it matches the file.',
        keywords: 'md5 sha1 sha256 checksum verify',
        icon: Hash,
      },
      {
        name: 'File metadata',
        route: toolPaths.fileMetadata,
        pageTitle: 'Identify File Types and View File Metadata',
        description: 'Inspect the type and details of a file.',
        instructions:
          'Choose a file to see its detected MIME type, description, and size. This can help identify a file whose extension is missing or incorrect.',
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
