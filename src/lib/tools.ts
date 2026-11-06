import Fuse from 'fuse.js'
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
        pageTitle: 'Resize Images by Width and Height',
        description: 'Change dimensions while keeping the right proportions.',
        instructions:
          'Choose a JPG, PNG, WebP, or GIF. Enter a width or height in pixels and keep the aspect ratio locked to resize without stretching the image.',
        keywords: 'photo picture scale resolution dimensions enlarge',
        icon: Maximize,
      },
      {
        name: 'Compress image',
        route: '/images/compress',
        pageTitle: 'Compress Images in Your Browser',
        description: 'Make a photo or image file smaller.',
        instructions:
          'Choose a JPG, PNG, WebP, or GIF and pick a compression preset or set the quality yourself. Compare the result with the original before sharing it.',
        keywords: 'photo picture shrink reduce size',
        icon: Minimize2,
      },
      {
        name: 'Convert image',
        route: '/images/convert',
        pageTitle: 'Image Converter for JPG, PNG, and WebP',
        description: 'Save an image in a different format.',
        instructions:
          'Choose an image and select JPG, PNG, or WebP for the output. Use PNG or WebP if you need to keep transparency. JPG is useful for photos.',
        keywords: 'jpg jpeg png webp gif format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Redact image',
        route: '/images/redact',
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
        route: '/images/metadata',
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
        route: '/videos/compress',
        pageTitle: 'Compress Video to a Smaller MP4',
        description: 'Reduce video size with a quality preset.',
        instructions:
          'Choose a video and pick a preset for file size or quality. You can adjust the settings before exporting an MP4 and comparing its size with the original.',
        keywords: 'movie shrink smaller reduce',
        icon: Minimize2,
      },
      {
        name: 'Convert video',
        route: '/videos/convert',
        pageTitle: 'Video Converter for MP4, WebM, MKV, and AVI',
        description: 'Change a video’s output format.',
        instructions:
          'Choose a video, then select MP4, WebM, MKV, or AVI for the output. The tool shows which video and audio codecs work with the selected format.',
        keywords: 'movie mp4 webm format',
        icon: SlidersHorizontal,
      },
      {
        name: 'Trim video',
        route: '/videos/trim',
        pageTitle: 'Trim Video and Save a Clip',
        description: 'Keep just the part you need.',
        instructions:
          'Set the start and end of the clip you want to keep. Export in the original video format or make a silent animated GIF or WebP.',
        keywords: 'cut clip movie length',
        icon: Scissors,
      },
      {
        name: 'Extract audio',
        route: '/videos/extract',
        pageTitle: 'Extract Audio from Video to MP3, AAC, or WAV',
        description: 'Save the sound from a video.',
        instructions:
          'Choose a video with an audio track, then save the audio as MP3, AAC, or WAV. WAV is uncompressed and generally produces a larger file.',
        keywords: 'music sound movie mp4 webm mp3 wav aac flac ogg opus m4a',
        icon: Music2,
      },
      {
        name: 'Video metadata',
        route: '/videos/metadata',
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
    name: 'PDFs',
    path: '/pdfs',
    icon: FileText,
    color: 'text-emerald-700 dark:text-emerald-400',
    tools: [
      {
        name: 'Merge PDFs',
        route: '/pdfs/merge',
        pageTitle: 'Merge PDFs into One File',
        description: 'Combine documents in the order you choose.',
        instructions:
          'Add two or more PDF files, arrange them in the order you want them to appear, and download the combined PDF.',
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
        pageTitle: 'Convert Word, Excel, and PowerPoint to PDF',
        description: 'Turn office documents into a shareable PDF.',
        instructions:
          'Choose a Word document, Excel spreadsheet, or PowerPoint presentation and download a PDF copy. Review the output before sharing if the layout matters.',
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
        pageTitle: 'Create ZIP, 7z, TAR, and TAR.GZ Archives',
        description: 'Bundle files into a ZIP or another archive.',
        instructions:
          'Add the files you want to bundle, choose ZIP, 7z, TAR, or GZIP, and name the archive. The GZIP option packages the files into a .tar.gz archive.',
        keywords: 'zip gzip tar 7z compress package',
        icon: Package,
      },
      {
        name: 'Extract archive',
        route: '/archives/extract',
        pageTitle: 'Extract ZIP, RAR, and 7z Archives',
        description: 'Open an archive and download its files.',
        instructions:
          'Choose a ZIP, RAR, 7z, TAR, or GZIP archive to see what it contains. Download a single file or save all the extracted files.',
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
        pageTitle: 'Calculate and Verify File Checksums',
        description: 'Calculate, copy, and verify a checksum.',
        instructions:
          'Choose a file to calculate its MD5, SHA-1, and SHA-256 checksums. Paste an expected checksum to see whether it matches the file.',
        keywords: 'md5 sha1 sha256 checksum verify',
        icon: Hash,
      },
      {
        name: 'File metadata',
        route: '/utilities/metadata',
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

// Ignore conversational glue while keeping meaningful task and format words.
const searchStopWords = new Set([
  'a',
  'an',
  'and',
  'as',
  'can',
  'do',
  'for',
  'from',
  'how',
  'help',
  'i',
  'in',
  'into',
  'me',
  'my',
  'need',
  'of',
  'please',
  'some',
  'the',
  'to',
  'want',
  'with',
  'you',
])

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/\bsha[\s_-]*(1|256)\b/g, 'sha$1')
    .replace(/\bmd[\s_-]*5\b/g, 'md5')
    .replace(/\b7[\s_-]*(?:zip|z)\b/g, '7z')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const searchableTools = allTools.map((tool) => {
  const text = normalizeSearchText(
    `${tool.name} ${tool.description} ${tool.keywords} ${tool.category}`,
  )
  return {
    tool,
    name: normalizeSearchText(tool.name),
    description: normalizeSearchText(tool.description),
    keywords: normalizeSearchText(tool.keywords),
    category: normalizeSearchText(tool.category),
    text,
    words: [...new Set(text.split(' '))],
  }
})

// Bound corrections to one insertion, deletion, substitution, or adjacent swap.
// Whole-word checks keep a fuzzy substring such as "rotate" → "create" from
// advertising a tool that cannot perform the requested task.
function isSingleTypo(query: string, word: string) {
  if (Math.abs(query.length - word.length) > 1) return false
  let index = 0
  while (index < query.length && query[index] === word[index]) index++
  if (query.length > word.length)
    return query.slice(index + 1) === word.slice(index)
  if (query.length < word.length)
    return query.slice(index) === word.slice(index + 1)
  return (
    query.slice(index + 1) === word.slice(index + 1) ||
    (query[index] === word[index + 1] &&
      query[index + 1] === word[index] &&
      query.slice(index + 2) === word.slice(index + 2))
  )
}

// Build once for the small local catalog. No model, server, or search requests.
const toolSearch = new Fuse(searchableTools, {
  useTokenSearch: true,
  tokenMatch: 'all',
  threshold: 0.4,
  includeScore: true,
  keys: [
    { name: 'name', weight: 3 },
    { name: 'keywords', weight: 2 },
    { name: 'description', weight: 1 },
    { name: 'category', weight: 0.5 },
  ],
})

export function findTools(query: string) {
  if (!query.trim()) return allTools
  const words = normalizeSearchText(query)
    .split(/\s+/)
    .filter((word) => word && !searchStopWords.has(word))
  if (words.length === 0) return []
  // Short format/digest tokens must stay literal: MP3 must not become MP4,
  // and an unsupported format should lead to the request link, not a guess.
  const exactMatch = (text: string) =>
    words.every((word) => text.includes(word))
  return toolSearch
    .search(words.join(' '))
    .filter(({ item }) =>
      words.every(
        (word) =>
          item.text.includes(word) ||
          (word.length > 3 &&
            !/\d/.test(word) &&
            item.words.some((candidate) => isSingleTypo(word, candidate))),
      ),
    )
    .sort(
      (a, b) =>
        Number(exactMatch(b.item.text)) - Number(exactMatch(a.item.text)) ||
        (a.score ?? 1) - (b.score ?? 1) ||
        a.refIndex - b.refIndex,
    )
    .map(({ item }) => item.tool)
}
