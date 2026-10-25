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
} from 'lucide-react'

export const toolCategories = [
  {
    name: 'Images',
    path: '/images',
    icon: Image,
    color: 'text-blue-600 dark:text-blue-400',
    tools: [
      {
        name: 'Resize image',
        route: '/images/resize',
        description: 'Change dimensions while keeping the right proportions.',
        keywords: 'photo picture scale resolution dimensions',
        icon: Maximize,
      },
      {
        name: 'Compress image',
        route: '/images/compress',
        description: 'Make a photo or image file smaller.',
        keywords: 'photo picture shrink reduce size',
        icon: Minimize2,
      },
      {
        name: 'Convert image',
        route: '/images/convert',
        description: 'Save an image in a different format.',
        keywords: 'jpg jpeg png webp gif format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Redact image',
        route: '/images/redact',
        description: 'Cover private details before sharing.',
        keywords: 'hide cover blur pixelate privacy',
        icon: ScanEye,
      },
      {
        name: 'Image metadata',
        route: '/images/metadata',
        description: 'Inspect image details and remove metadata.',
        keywords: 'exif gps location privacy',
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
        route: '/videos/compress',
        description: 'Reduce video size with a quality preset.',
        keywords: 'movie shrink smaller reduce',
        icon: Minimize2,
      },
      {
        name: 'Convert video',
        route: '/videos/convert',
        description: 'Change a video’s output format.',
        keywords: 'movie mp4 webm format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Trim video',
        route: '/videos/trim',
        description: 'Keep just the part you need.',
        keywords: 'cut clip movie length',
        icon: Scissors,
      },
      {
        name: 'Extract audio',
        route: '/videos/extract',
        description: 'Save the sound from a video.',
        keywords: 'music sound mp3 wav',
        icon: Music2,
      },
      {
        name: 'Video metadata',
        route: '/videos/metadata',
        description: 'Inspect duration, dimensions, and codecs.',
        keywords: 'movie info details',
        icon: Info,
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
        route: '/pdfs/merge',
        description: 'Combine documents in the order you choose.',
        keywords: 'join combine pages documents',
        icon: Merge,
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
        route: '/office-documents/convert',
        description: 'Turn office documents into a shareable PDF.',
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
        route: '/archives/compress',
        description: 'Bundle files into a ZIP or another archive.',
        keywords: 'zip gzip tar 7z compress package',
        icon: Package,
      },
      {
        name: 'Extract archive',
        route: '/archives/extract',
        description: 'Open an archive and download its files.',
        keywords: 'unzip zip 7z rar unpack',
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
        route: '/utilities/hash',
        description: 'Calculate, copy, and verify a checksum.',
        keywords: 'md5 sha1 sha256 checksum verify',
        icon: Hash,
      },
      {
        name: 'File metadata',
        route: '/utilities/metadata',
        description: 'Inspect the type and details of a file.',
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
export function findTools(query: string) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return allTools.filter((tool) =>
    words.every((word) =>
      `${tool.name} ${tool.description} ${tool.keywords} ${tool.category}`
        .toLowerCase()
        .includes(word),
    ),
  )
}
