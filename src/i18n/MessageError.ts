import { workspaceEnglish } from './workspaceMessages'
import { message, renderMessage } from './messages'
import type {
  LocalizedMessage,
  MessageKey,
  MessageValues,
  Translator,
} from './messages'

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
  return renderMessage(t, messageFromError(error, fallback))
}

export function messageFromError(
  error: unknown,
  fallback: LocalizedMessage | string,
) {
  if (error instanceof MessageError) return message(error.key, error.values)
  return error instanceof Error ? error.message : fallback
}
