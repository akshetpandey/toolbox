import { toolPaths } from './toolPaths'

// Search-only aliases stay out of the homepage startup bundle.
export const toolSearchKeywords = {
  [toolPaths.imageResize]: 'photo picture scale resolution dimensions enlarge',
  [toolPaths.imageCompress]: 'photo picture shrink reduce size limit kb',
  [toolPaths.imageConvert]: 'jpg jpeg png webp gif heic heif format',
  [toolPaths.imageCrop]: 'photo picture crop rotate flip mirror aspect ratio',
  [toolPaths.imageBatch]: 'bulk batch multiple photos zip dimensions',
  [toolPaths.imageBackground]:
    'background transparent photo chroma key green screen',
  [toolPaths.imageOCR]:
    'ocr image photo picture screenshot jpg png text txt recognize recognition extract copy scan',
  [toolPaths.imageRedact]:
    'photo picture hide cover blur pixelate privacy censor mask black out sensitive face',
  [toolPaths.imageMetadata]:
    'photo picture exif gps location geotag privacy remove delete personal data',
  [toolPaths.videoCompress]: 'movie shrink smaller reduce limit mb',
  [toolPaths.videoConvert]:
    'movie mp4 webm avi mkv mov gif apng animated png webp animation format converter',
  [toolPaths.videoTrim]: 'cut clip movie length mp4',
  [toolPaths.videoJoin]: 'merge combine concatenate movie clips',
  [toolPaths.videoExtract]: 'music sound movie mp4 webm mp3 wav aac',
  [toolPaths.videoMetadata]: 'movie info details',
  [toolPaths.audioConvert]: 'sound music mp3 wav aac m4a voice memo format',
  [toolPaths.audioTrim]: 'cut clip sound recording music',
  [toolPaths.audioJoin]: 'merge combine concatenate sound recording music',
  [toolPaths.pdfEditor]:
    'pdf editor edit fill filler form fields checkbox radio dropdown annotate annotation highlight text checkmark drawing rectangle',
  [toolPaths.pdfMerge]: 'join combine pages documents',
  [toolPaths.pdfCompress]: 'pdf shrink reduce size optimize scan document',
  [toolPaths.pdfFromImages]: 'photo photos jpg jpeg png picture pdf combine',
  [toolPaths.pdfSplit]: 'pdf separate divide select extract pages ranges',
  [toolPaths.pdfOrganize]: 'pdf rearrange reorder rotate delete remove pages',
  [toolPaths.pdfToImages]: 'pdf jpg jpeg png render image export',
  [toolPaths.pdfOCR]: 'ocr pdf scanned scan text recognition searchable copy',
  [toolPaths.pdfRedact]: 'pdf redact hide black out sensitive remove private',
  [toolPaths.pdfSign]: 'pdf sign signature stamp',
  [toolPaths.pdfWatermark]: 'pdf watermark text draft confidential stamp',
  [toolPaths.pdfToWord]: 'pdf word docx extract editable text',
  [toolPaths.documentConvert]: 'word docx excel xlsx spreadsheet office',
  [toolPaths.archiveCompress]: 'zip gzip tar 7z compress package',
  [toolPaths.archiveExtract]:
    'unzip zip 7z rar unpack encrypted password protected',
  [toolPaths.qrCode]:
    'qr qrcode code generator generate create wifi wi fi network url website text png svg',
  [toolPaths.fileHash]: 'md5 sha1 sha256 checksum verify',
  [toolPaths.fileMetadata]: 'mime info identify details',
} satisfies Record<(typeof toolPaths)[keyof typeof toolPaths], string>
