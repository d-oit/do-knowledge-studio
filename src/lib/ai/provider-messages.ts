import type { ChatMessage } from './types'

/**
 * Wire-format chat message: exactly the fields every provider protocol
 * (OpenRouter, Ollama, transformers.js) accepts.
 */
export interface ProviderMessage {
  role: ChatMessage['role']
  content: string
}

/**
 * Projects app-internal chat history onto the provider wire shape.
 *
 * `ChatMessage` carries UI-only fields (the React key `id`) that are not part
 * of any provider protocol, so every adapter must serialize its request
 * through this mapper rather than passing `ChatRequest.messages` straight to
 * `JSON.stringify`/the model.
 */
export const toProviderMessages = (messages: ChatMessage[]): ProviderMessage[] =>
  messages.map(({ role, content }) => ({ role, content }))
