import { expect, test } from 'vitest'
import { allTools } from '@/lib/tools'
import { findTools } from '@/lib/toolSearch'
import { createTranslator } from '@/i18n/messages'
import es from '@/i18n/locales/es.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import ar from '@/i18n/locales/ar.json'
import nl from '@/i18n/locales/nl.json'

const localizedCatalogs = { es, ja, ru, ar, nl }

test.each([
  ['es', 'JPG a PNG', '/images/convert'],
  ['ja', 'JPGからPNG', '/images/convert'],
  ['ja', 'WordをPDFに変換', '/office-documents/convert'],
  ['ru', 'JPG в PNG', '/images/convert'],
  ['ar', 'تحويل JPG إلى PNG', '/images/convert'],
  ['nl', 'JPG naar PNG', '/images/convert'],
] as const)(
  'finds the right conversion for %s search %s',
  (language, query, route) => {
    const t = createTranslator(language, localizedCatalogs[language])
    expect(findTools(query, t, language).map((tool) => tool.route)).toEqual([
      route,
    ])
  },
)

const routes = (query: string) => findTools(query).map((tool) => tool.route)

test.each([
  'JPG to PNG',
  'please convert a JPEG into PNG',
  'How can I convert my jpg to png?',
  '  JPG   →   PNG  ',
  'jpg/png',
])('image format query %s finds the converter', (query) => {
  expect(routes(query)).toEqual(['/images/convert'])
})

test.each(['SHA-256', 'sha 256', 'SHA_256', 'md-5', 'SHA-1'])(
  'recognizes common checksum notation %s',
  (query) => {
    expect(routes(query)).toEqual(['/utilities/hash'])
  },
)

test('keeps meaningful terms, curated aliases, and category matches', () => {
  expect(routes('shrink photo')).toEqual(['/images/compress'])
  expect(routes('merge PDFs')).toEqual(['/pdfs/merge'])
  expect(routes('Word to PDF')).toEqual(['/office-documents/convert'])
  expect(routes('MP4 to MP3')).toEqual(['/videos/extract'])
  expect(routes('extract 7-Zip')).toEqual(['/archives/extract'])
  expect(routes('convert images')).toContain('/images/convert')
  expect(routes('JPG to nonexistent-format')).toEqual([])
})

test.each([
  ['MP4 to GIF', '/videos/convert'],
  ['Video to APNG', '/videos/convert'],
  ['animated PNG to GIF', '/videos/convert'],
  ['MP4 to animated PNG', '/videos/convert'],
  ['GIF to MP4', '/videos/convert'],
  ['APNG to GIF', '/videos/convert'],
  ['split PDF', '/pdfs/split'],
  ['PDF to Word', '/pdfs/to-word'],
  ['JPG to PDF', '/pdfs/from-images'],
  ['PDF to JPG', '/pdfs/to-images'],
  ['HEIC to JPG', '/images/convert'],
  ['M4A to MP3', '/audio/convert'],
])('finds the tool for %s', (query, route) => {
  expect(routes(query)).toEqual([route])
})

test('empty and non-searchable input do not produce misleading matches', () => {
  expect(findTools('')).toEqual(allTools)
  expect(findTools('   ')).toEqual(allTools)
  expect(findTools('how do I')).toEqual([])
  expect(findTools('to')).toEqual([])
  expect(findTools('→ / ?')).toEqual([])
})

test.each([
  ['compres imgae', '/images/compress'],
  ['cmpress photo', '/images/compress'],
  ['compreess photo', '/images/compress'],
  ['compress phito', '/images/compress'],
  ['reszie phoot', '/images/resize'],
  ['megre pdfs', '/pdfs/merge'],
  ['unizp archive', '/archives/extract'],
  ['conver jpg png', '/images/convert'],
])('corrects small typos in %s', (query, route) => {
  expect(routes(query)[0]).toBe(route)
})

test('matches everyday descriptions and word order without a model', () => {
  expect(routes('Can you help me make my picture smaller?')).toEqual([
    '/images/compress',
  ])
  expect(routes('censor a face')).toEqual(['/images/redact'])
  expect(routes('remove location from photo')).toEqual(['/images/metadata'])
  expect(routes('PNG JPG convert')).toEqual(routes('convert JPG PNG'))
})

test('unavailable tasks and short format names do not become misleading fuzzy matches', () => {
  for (const query of [
    'JPG to SVG',
    'PNG to SVG',
    'MP4 to PNG',
    'APNG to JPG',
    'MP4 to MP2',
    'sha257',
    'zzzzzzzz',
  ]) {
    expect(routes(query), query).toEqual([])
  }
  expect(routes('MP4 to MP3')).toEqual(['/videos/extract'])
})

test('matching is case insensitive and ranks direct matches ahead of approximate ones', () => {
  expect(findTools('IMAGE')).toEqual(findTools('image'))
  expect(routes('compress').slice(0, 2)).toEqual([
    '/images/compress',
    '/videos/compress',
  ])
  expect(routes('image metadata')).toEqual(['/images/metadata'])
  expect(findTools('compres imgae')).toEqual(findTools('COMPRES IMGAE'))
})

test.each([
  ['image to text', '/images/ocr'],
  ['PNG to text', '/images/ocr'],
  ['QR code generator', '/utilities/qr'],
  ['fill pdf form', '/pdfs/edit'],
])('finds the new tool for %s', (query, route) => {
  expect(routes(query)[0]).toBe(route)
})
