export type ProviderId = 'openrouter' | 'ollama'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type OpenRouterTargetKind = 'model' | 'router'

export interface OpenRouterTarget {
  kind: OpenRouterTargetKind
  slug: string
  display_name: string
  description?: string
  default_params?: Record<string, any>
}

export const OPENROUTER_ROUTERS: OpenRouterTarget[] = [
  {
    kind: 'router',
    slug: 'openrouter/auto',
    display_name: 'Auto Router',
    description: 'Automatic best-model selection based on prompt requirements and prompt complexity.',
  },
  {
    kind: 'router',
    slug: 'openrouter/free',
    display_name: 'Free Models Router',
    description: 'Cost-optimized routing that routes only to free models on OpenRouter.',
  },
  {
    kind: 'router',
    slug: 'openrouter/fusion',
    display_name: 'Fusion Router',
    description: 'Multi-model deliberation and judge panel that aggregates several model responses into a single high-quality output.',
  },
  {
    kind: 'router',
    slug: 'openrouter/pareto',
    display_name: 'Pareto Router',
    description: 'Coding and instruction-following score-based routing to achieve the best trade-off between speed and performance.',
  },
  {
    kind: 'router',
    slug: 'openrouter/body-builder',
    display_name: 'Body Builder',
    description: 'Dynamic weights and custom parameter router that maps requests to optimized model targets.',
  },
  {
    kind: 'router',
    slug: 'openrouter/flavor-latest',
    display_name: 'Latest Model Resolution',
    description: 'Family-latest style resolution slug (e.g. automatically routes to the latest model in a family).',
  },
]

export const OPENROUTER_MODELS: OpenRouterTarget[] = [
  {
    kind: 'model',
    slug: 'openrouter/free',
    display_name: 'Free Models Router',
    description: 'Cost-optimized routing that routes only to free models on OpenRouter.',
  },
  {
    kind: 'model',
    slug: 'openai/gpt-4o-mini',
    display_name: 'GPT-4o Mini',
    description: 'Fast, lightweight and cost-efficient intelligence for everyday tasks.',
  },
  {
    kind: 'model',
    slug: 'anthropic/claude-sonnet-4',
    display_name: 'Claude 3.5 Sonnet',
    description: 'State-of-the-art model with exceptional coding, reasoning, and analysis capabilities.',
  },
  {
    kind: 'model',
    slug: 'meta-llama/llama-3.3-70b-instruct:free',
    display_name: 'Llama 3.3 70B Instruct (Free)',
    description: 'Highly capable open-weight instruction-tuned model, served for free.',
  },
]

export const OPENROUTER_DEFAULT_TARGETS: OpenRouterTarget[] = [
  ...OPENROUTER_ROUTERS,
  ...OPENROUTER_MODELS,
]

export interface ChatRequest {
  provider: ProviderId
  model: string | OpenRouterTarget
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
