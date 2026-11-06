export const toolPaths = {
  imageResize: '/images/resize',
  imageCompress: '/images/compress',
  imageConvert: '/images/convert',
  imageRedact: '/images/redact',
  imageMetadata: '/images/metadata',
  videoCompress: '/videos/compress',
  videoConvert: '/videos/convert',
  videoTrim: '/videos/trim',
  videoExtract: '/videos/extract',
  videoMetadata: '/videos/metadata',
  pdfMerge: '/pdfs/merge',
  pdfCompress: '/pdfs/compress',
  pdfSplit: '/pdfs/split',
  documentConvert: '/office-documents/convert',
  archiveCompress: '/archives/compress',
  archiveExtract: '/archives/extract',
  fileHash: '/utilities/hash',
  fileMetadata: '/utilities/metadata',
} as const

export const categoryRedirects = {
  '/images': toolPaths.imageMetadata,
  '/videos': toolPaths.videoMetadata,
  '/pdfs': toolPaths.pdfMerge,
  '/office-documents': toolPaths.documentConvert,
  '/archives': toolPaths.archiveCompress,
  '/utilities': toolPaths.fileHash,
} as const
