import { createTranslator } from './messages.ts'
import source from './en-tool-content.json' with { type: 'json' }

export const toolContent = source
export const toolContentEnglish = createTranslator('en', {}, source)
