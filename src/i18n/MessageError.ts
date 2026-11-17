import { workspaceEnglish } from './workspaceMessages'
import type { MessageKey, MessageValues, Translator } from './messages'

export class MessageError extends Error {
  readonly key: MessageKey
  readonly values?: MessageValues

  constructor(key: MessageKey, values?: MessageValues, options?: ErrorOptions) {
    super(workspaceEnglish(key, values), options)
    this.key = key
    this.values = values
  }
}

export function errorMessage(t: Translator, error: unknown, fallback: string) {
  if (error instanceof MessageError) return t(error.key, error.values)
  return error instanceof Error ? error.message : fallback
}
