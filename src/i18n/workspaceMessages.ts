import { createTranslator } from './messages.ts'
import source from './en-workspaces.json' with { type: 'json' }

export const workspaceSource = source
export const workspaceEnglish = createTranslator('en', {}, source)
