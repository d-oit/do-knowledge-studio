import { z } from 'zod'
import type {
  ProviderAdapter,
  ChatRequest,
  ChatResult,
  ProviderId,
  OpenRouterTarget,
} from './types'
import { DEFAULT_OLLAMA_BASE_URL, OPENROUTER_DEFAULT_TARGETS } from './types'

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const APP_TITLE = 'Do Knowledge Studio'

const ALLOWED_OLLAMA_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

const isAllowedOllamaHost = (hostname: string): boolean =>
  ALLOWED_OLLAMA_HOSTS.has(hostname) || hostname.endsWith('.local')

/** Validate and normalize an Ollama base URL to localhost-only. */
export const validateOllamaUrl = (baseUrl: string): string => {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error('Invalid Ollama base URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Ollama base URL must use http or https protocol')
  }
  if (!isAllowedOllamaHost(url.hostname)) {
    throw new Error('Ollama base URL must point to localhost or a .local hostname')
  }
  return baseUrl.replace(/\/+$/, '')
}

const OpenRouterResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }).optional(),
    }),
  ).optional(),
})

const OllamaResponseSchema = z.object({
  message: z.object({ content: z.string() }).optional(),
})

const OllamaTagsSchema = z.object({
  models: z.array(z.object({ name: z.string() })).optional(),
})

async function consumeSSE(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[]
          }
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk(content)
          }
        } catch {
          console.warn('Skipping malformed SSE frame during streaming')
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullContent
}

async function consumeNDJSON(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string }
          }
          const content = parsed.message?.content
          if (content) {
            fullContent += content
            onChunk(content)
          }
        } catch {
          console.warn('Skipping malformed NDJSON frame during streaming')
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullContent
}

class OpenRouterAdapter implements ProviderAdapter {
  readonly id: ProviderId = 'openrouter'
  readonly requiresKey = true

  private resolveTarget(model: string | OpenRouterTarget): OpenRouterTarget {
    if (typeof model === 'object' && model !== null) {
      return model
    }
    const found = OPENROUTER_DEFAULT_TARGETS.find((t) => t.slug === model)
    if (found) return found
    return {
      kind: 'model',
      slug: model,
      display_name: model,
    }
  }

  async send(request: ChatRequest): Promise<ChatResult> {
    const { model, apiKey, messages, signal } = request
    if (!apiKey) throw new Error('OpenRouter API key is required')

    const target = this.resolveTarget(model)
    const modelSlug = target.slug

    const body: Record<string, any> = { model: modelSlug, messages }
    if (target.default_params) {
      Object.assign(body, target.default_params)
    }

    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': APP_TITLE,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = OpenRouterResponseSchema.parse(await res.json())
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenRouter returned an empty response')
    return { content, provider: 'openrouter', model: modelSlug }
  }

  async sendStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
  ): Promise<ChatResult> {
    const { model, apiKey, messages, signal } = request
    if (!apiKey) throw new Error('OpenRouter API key is required')

    const target = this.resolveTarget(model)
    const modelSlug = target.slug

    const body: Record<string, any> = { model: modelSlug, messages, stream: true }
    if (target.default_params) {
      Object.assign(body, target.default_params)
    }

    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': APP_TITLE,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 200)}`)
    }

    const content = await consumeSSE(res, onChunk)
    if (!content) throw new Error('OpenRouter returned an empty response')
    return { content, provider: 'openrouter', model: modelSlug }
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

    const modelSlug = typeof model === 'string' ? model : model.slug
    const validatedUrl = validateOllamaUrl(ollamaBaseUrl)

    const body: Record<string, unknown> = {
      model: modelSlug,
      messages,
      stream: false,
    }

    if (ollamaCpuOnly) {
      body.options = { num_gpu: 0 }
    }

    // URL is validated to localhost-only by validateOllamaUrl above
    const res = await fetch(`${validatedUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = OllamaResponseSchema.parse(await res.json())
    const content = data.message?.content
    if (!content) throw new Error('Ollama returned an empty response')
    return { content, provider: 'ollama', model: modelSlug }
  }

  async sendStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
  ): Promise<ChatResult> {
    const {
      model,
      messages,
      signal,
      ollamaCpuOnly = false,
      ollamaBaseUrl = DEFAULT_OLLAMA_BASE_URL,
    } = request

    const modelSlug = typeof model === 'string' ? model : model.slug
    const validatedUrl = validateOllamaUrl(ollamaBaseUrl)

    const body: Record<string, unknown> = {
      model: modelSlug,
      messages,
      stream: true,
    }

    if (ollamaCpuOnly) {
      body.options = { num_gpu: 0 }
    }

    // URL is validated to localhost-only by validateOllamaUrl above
    // nosemgrep: rules.lgpl.javascript.ssrf.rule-node-ssrf
    const res = await fetch(`${validatedUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`)
    }

    const content = await consumeNDJSON(res, onChunk)
    if (!content) throw new Error('Ollama returned an empty response')
    return { content, provider: 'ollama', model: modelSlug }
  }
}

const adapters: Record<ProviderId, ProviderAdapter> = {
  openrouter: new OpenRouterAdapter(),
  ollama: new OllamaAdapter(),
}

/** Return the provider adapter for the given provider ID. */
export const getAdapter = (provider: ProviderId): ProviderAdapter => {
  return adapters[provider]
}

/** Send a single-shot chat request to the specified provider. */
export const sendChat = (request: ChatRequest): Promise<ChatResult> => {
  const adapter = getAdapter(request.provider)
  return adapter.send(request)
}

/** Send a streaming chat request, invoking onChunk for each content delta. */
export const sendChatStream = (
  request: ChatRequest,
  onChunk: (chunk: string) => void,
): Promise<ChatResult> => {
  const adapter = getAdapter(request.provider)
  return adapter.sendStream(request, onChunk)
}

/** Fetch the list of model names available on a local Ollama instance. */
export const fetchOllamaModels = async (
  baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
  signal?: AbortSignal,
): Promise<string[]> => {
  const validatedUrl = validateOllamaUrl(baseUrl)
  // nosemgrep: rules.lgpl.javascript.ssrf.rule-node-ssrf
  const res = await fetch(`${validatedUrl}/api/tags`, { signal })
  if (!res.ok) throw new Error(`Ollama tags error ${res.status}`)
  const data = OllamaTagsSchema.parse(await res.json())
  return data.models?.map((m) => m.name) ?? []
}
