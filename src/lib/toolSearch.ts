import Fuse from 'fuse.js'
import { allTools } from './tools'
import { toolPaths } from './toolPaths'

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

const imageInputs = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
])
const imageOutputs = new Set(['jpg', 'jpeg', 'png', 'webp'])
const officeInputs = new Set([
  'word',
  'docx',
  'excel',
  'xlsx',
  'powerpoint',
  'pptx',
])

function conversionRoute(from: string, to: string) {
  if (imageInputs.has(from) && imageOutputs.has(to))
    return toolPaths.imageConvert
  if (to === 'pdf' && ['jpg', 'jpeg', 'png'].includes(from))
    return toolPaths.pdfFromImages
  if (from === 'pdf' && ['jpg', 'jpeg', 'png'].includes(to))
    return toolPaths.pdfToImages
  if (from === 'pdf' && ['word', 'docx'].includes(to))
    return toolPaths.pdfToWord
  if (to === 'pdf' && officeInputs.has(from)) return toolPaths.documentConvert
  if (from === 'mp4' && to === 'gif') return toolPaths.videoTrim
}

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
  const normalized = normalizeSearchText(query.replaceAll('→', ' to '))
  const words = normalized
    .split(/\s+/)
    .filter((word) => word && !searchStopWords.has(word))
  if (words.length === 0) return []
  // Prefer the requested direction for format pairs such as PDF to Word.
  const pair = /\b([a-z0-9]+) (?:to|into) ([a-z0-9]+)$/u.exec(normalized)
  const route = pair
    ? conversionRoute(pair[1], pair[2])
    : words.length === 2 &&
        imageInputs.has(words[0]) &&
        imageOutputs.has(words[1])
      ? toolPaths.imageConvert
      : undefined
  if (route) return allTools.filter((tool) => tool.route === route)
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
