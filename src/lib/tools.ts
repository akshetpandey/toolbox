import { toolContentEnglish } from '../i18n/toolContentMessages.ts'
import { getToolCatalog } from './toolCatalog.ts'

export const { tools: allTools } = getToolCatalog(toolContentEnglish)
