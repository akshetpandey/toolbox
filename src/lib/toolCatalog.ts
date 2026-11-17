import { english } from '../i18n/messages.ts'
import type { MessageKey, Translator } from '../i18n/messages.ts'
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
  QrCode,
} from 'lucide-react'
import { toolPaths } from './toolPaths.ts'

const categories = [
  {
    name: 'toolsImagesCategory',
    path: '/images',
    icon: Image,
    color: 'text-blue-600 dark:text-blue-400',
    tools: [
      { id: 'imageResize', icon: Maximize },
      { id: 'imageCompress', icon: Minimize2 },
      { id: 'imageConvert', icon: SlidersHorizontal },
      { id: 'imageCrop', icon: Crop },
      { id: 'imageBatch', icon: Layers },
      { id: 'imageBackground', icon: Eraser },
      { id: 'imageOCR', icon: ScanText },
      { id: 'imageRedact', icon: ScanEye },
      { id: 'imageMetadata', icon: Info },
    ],
  },
  {
    name: 'toolsVideosCategory',
    path: '/videos',
    icon: Video,
    color: 'text-violet-600 dark:text-violet-400',
    tools: [
      { id: 'videoCompress', icon: Minimize2 },
      { id: 'videoConvert', icon: SlidersHorizontal },
      { id: 'videoTrim', icon: Scissors },
      { id: 'videoJoin', icon: Merge },
      { id: 'videoExtract', icon: Music2 },
      { id: 'videoMetadata', icon: Info },
    ],
  },
  {
    name: 'toolsAudioCategory',
    path: '/audio',
    icon: AudioLines,
    color: 'text-pink-700 dark:text-pink-400',
    tools: [
      { id: 'audioConvert', icon: SlidersHorizontal },
      { id: 'audioTrim', icon: Scissors },
      { id: 'audioJoin', icon: Merge },
    ],
  },
  {
    name: 'toolsPDFsCategory',
    path: '/pdfs',
    icon: FileText,
    color: 'text-emerald-700 dark:text-emerald-400',
    tools: [
      { id: 'pdfEditor', icon: PenLine },
      { id: 'pdfMerge', icon: Merge },
      { id: 'pdfCompress', icon: Minimize2 },
      { id: 'pdfFromImages', icon: FileImage },
      { id: 'pdfSplit', icon: Scissors },
      { id: 'pdfOrganize', icon: ListOrdered },
      { id: 'pdfToImages', icon: FileImage },
      { id: 'pdfOCR', icon: ScanText },
      { id: 'pdfRedact', icon: Eraser },
      { id: 'pdfSign', icon: PenLine },
      { id: 'pdfWatermark', icon: Stamp },
      { id: 'pdfToWord', icon: FileText },
    ],
  },
  {
    name: 'toolsDocumentsCategory',
    path: '/office-documents',
    icon: FileCheck2,
    color: 'text-indigo-600 dark:text-indigo-400',
    tools: [{ id: 'documentConvert', icon: FileText }],
  },
  {
    name: 'toolsArchivesCategory',
    path: '/archives',
    icon: Archive,
    color: 'text-amber-700 dark:text-amber-400',
    tools: [
      { id: 'archiveCompress', icon: Package },
      { id: 'archiveExtract', icon: FolderOpen },
    ],
  },
  {
    name: 'toolsUtilitiesCategory',
    path: '/utilities',
    icon: Settings,
    color: 'text-slate-600 dark:text-slate-400',
    tools: [
      { id: 'qrCode', icon: QrCode },
      { id: 'fileHash', icon: Hash },
      { id: 'fileMetadata', icon: Info },
    ],
  },
] as const

type ToolId = keyof typeof toolPaths
type ToolField = 'Name' | 'PageTitle' | 'Description' | 'Instructions'

function toolMessage(id: ToolId, field: ToolField): MessageKey {
  const name = (id.charAt(0).toUpperCase() + id.slice(1)) as Capitalize<ToolId>
  return `tools${name}${field}`
}

function createToolCatalog(t: Translator) {
  const localizedCategories = categories.map((category) => ({
    ...category,
    name: t(category.name),
    tools: category.tools.map(({ id, icon }) => ({
      route: toolPaths[id],
      name: t(toolMessage(id, 'Name')),
      pageTitle: t(toolMessage(id, 'PageTitle')),
      description: t(toolMessage(id, 'Description')),
      instructions: t(toolMessage(id, 'Instructions')),
      icon,
    })),
  }))
  const tools = localizedCategories.flatMap((category) =>
    category.tools.map((tool) => ({
      ...tool,
      category: category.name,
      categoryPath: category.path,
      color: category.color,
    })),
  )
  return { categories: localizedCategories, tools }
}

const catalogs = new WeakMap<Translator, ReturnType<typeof createToolCatalog>>()

export function getToolCatalog(t = english) {
  const existing = catalogs.get(t)
  if (existing) return existing
  const catalog = createToolCatalog(t)
  catalogs.set(t, catalog)
  return catalog
}
