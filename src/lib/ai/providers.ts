import type {
  ProviderAdapter,
  ChatRequest,
  ChatResult,
  ProviderId,
} from './types'
import { DEFAULT_OLLAMA_BASE_URL } from './types'

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const APP_TITLE = 'Do Knowledge Studio'

class OpenRouterAdapter implements ProviderAdapter {
  readonly id: ProviderId = 'openrouter'
  readonly requiresKey = true

  async send(request: ChatRequest): Promise<ChatResult> {
    const { model, apiKey, messages, signal } = request
    if (!apiKey) throw new Error('OpenRouter API key is required')

    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': APP_TITLE,
      },
      body: JSON.stringify({ model, messages }),
      signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenRouter returned an empty response')
    return { content, provider: 'openrouter', model }
  }
}

class OllamaAdapter implements ProviderAdapter {
  readonly id: ProviderId = 'ollama'
  readonly requiresKey = false

  async send(request: ChatRequest): Promise<ChatResult> {
    const {
      model,
      messages,
      signal,
      ollamaCpuOnly = false,
      ollamaBaseUrl = DEFAULT_OLLAMA_BASE_URL,
    } = request

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    }

    if (ollamaCpuOnly) {
      body.options = { num_gpu: 0 }
    }

    const res = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = (await res.json()) as { message?: { content?: string } }
    const content = data.message?.content
    if (!content) throw new Error('Ollama returned an empty response')
    return { content, provider: 'ollama', model }
  }
}

const adapters: Record<ProviderId, ProviderAdapter> = {
  openrouter: new OpenRouterAdapter(),
  ollama: new OllamaAdapter(),
}

export function getAdapter(provider: ProviderId): ProviderAdapter {
  return adapters[provider]
}

export async function sendChat(request: ChatRequest): Promise<ChatResult> {
  const adapter = getAdapter(request.provider)
  return adapter.send(request)
}

export async function fetchOllamaModels(
  baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/tags`, { signal })
  if (!res.ok) throw new Error(`Ollama tags error ${res.status}`)
  const data = (await res.json()) as { models?: { name: string }[] }
  return data.models?.map((m) => m.name) ?? []
}
