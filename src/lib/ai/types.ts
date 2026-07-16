export type ProviderId = 'openrouter' | 'ollama'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  provider: ProviderId
  model: string
  apiKey: string
  messages: ChatMessage[]
  signal?: AbortSignal
  ollamaCpuOnly?: boolean
  ollamaBaseUrl?: string
}

export interface ChatResult {
  content: string
  provider: ProviderId
  model: string
}

export interface ProviderAdapter {
  readonly id: ProviderId
  readonly requiresKey: boolean
  send(request: ChatRequest): Promise<ChatResult>
  sendStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
  ): Promise<ChatResult>
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openrouter: 'OpenRouter',
  ollama: 'Ollama (local)',
}

export const OPENROUTER_DEFAULT_MODELS = [
  'openrouter/free',
  'openai/gpt-4o-mini',
  'anthropic/claude-sonnet-4',
  'meta-llama/llama-3.3-70b-instruct:free',
]

export const OLLAMA_DEFAULT_MODELS = [
  'llama3',
  'mistral',
  'qwen2.5',
  'gemma2',
]

export const DEFAULT_MODEL: Record<ProviderId, string> = {
  openrouter: 'openrouter/free',
  ollama: 'llama3',
}

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'
