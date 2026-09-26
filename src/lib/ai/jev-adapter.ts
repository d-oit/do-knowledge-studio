import type { ChatRequest, ChatResult, ProviderAdapter, ProviderId } from './types'
import { DEFAULT_JEV_BASE_URL, JEV_PROVIDER_ID } from './types'
import { validateJevBaseUrl } from './url-guard'

/** Max characters of an upstream error body included in adapter error messages. */
const ERROR_BODY_SLICE = 200

/** A single typed answer returned by /v1/systemone, keyed by question id. */
interface JevAnswer {
  type: string
  choice?: string
  noul?: number
  score?: number
  probabilities?: Record<string, number>
  confidence?: number
}

/** Response envelope returned by POST /v1/systemone. */
interface JevResponse {
  model?: string
  answers?: Record<string, JevAnswer>
  usage?: { input_tokens: number; output_tokens: number }
}

/** Formats a 0..1 ratio as a fixed-percentage string. */
const formatRatio = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`

/**
 * Flattens typed decision answers into readable markdown for the chat UI.
 *
 * Every field is optional: a self-hosted Von server may omit `confidence` or
 * `probabilities` entirely, and the rendering degrades to whichever field that
 * server does return.
 */
const renderJevAnswers = (answers: Record<string, JevAnswer>): string => {
  const parts: string[] = []
  for (const [key, answer] of Object.entries(answers)) {
    if (answer.choice !== undefined) {
      const confidence =
        answer.confidence !== undefined ? ` (confidence: ${formatRatio(answer.confidence)})` : ''
      parts.push(`**${key}**: ${answer.choice}${confidence}`)
    } else if (answer.noul !== undefined) {
      parts.push(`**${key}**: ${formatRatio(answer.noul)} likely`)
    } else if (answer.score !== undefined) {
      parts.push(`**${key}**: score ${answer.score}`)
    }
    if (answer.probabilities) {
      const lines = Object.entries(answer.probabilities)
        .map(([option, probability]) => `  - ${option}: ${formatRatio(probability)}`)
        .join('\n')
      parts.push(lines)
    }
  }
  return parts.length > 0 ? parts.join('\n') : JSON.stringify(answers)
}

/** Maps an upstream failure status onto an actionable message. */
const jevError = (status: number, detail: string): Error => {
  switch (status) {
    case 400:
      return new Error(
        `Jev error 400: malformed request — verify the model id is exact (e.g. jev-1.13.0, not jev-1.13). ${detail}`,
      )
    case 401:
      return new Error('Jev error 401: invalid or revoked API key')
    case 402:
      return new Error('Jev error 402: insufficient credits')
    case 403:
      return new Error('Jev error 403: account inactive')
    case 422:
      return new Error(`Jev error 422: missing required field (model and state are required). ${detail}`)
    case 429:
      return new Error('Jev error 429: rate limit or credits exhausted')
    default:
      return new Error(`Jev error ${status}: ${detail}`)
  }
}

/**
 * Jev / Von System One adapter.
 *
 * Jev is a decision API, not a text generator: it has no chat-completions
 * surface. The chat message array is therefore flattened into a single `state`
 * string and one `choice` question is asked; the chosen answer and its
 * probabilities are flattened back into `ChatResult.content` so the existing
 * chat UI renders it without a provider-specific branch.
 *
 * The same adapter serves the TypeSafe cloud API and a self-hosted Von server
 * (Apache 2.0), which speak the same `/v1/systemone` protocol.
 */
class JevAdapter implements ProviderAdapter {
  readonly id: ProviderId = JEV_PROVIDER_ID
  readonly requiresKey = true

  async send(request: ChatRequest): Promise<ChatResult> {
    const baseUrl = request.jevBaseUrl
      ? validateJevBaseUrl(request.jevBaseUrl)
      : DEFAULT_JEV_BASE_URL
    const modelSlug = typeof request.model === 'string' ? request.model : request.model.slug

    const state = request.messages.map((m) => `${m.role}: ${m.content}`).join('\n')

    const body = {
      model: modelSlug,
      state,
      questions: {
        respond: {
          type: 'choice' as const,
          instructions:
            'Based on the conversation, provide the most helpful response to the user.',
          criteria: {
            helpful: 'A thorough, accurate, and relevant answer to the user question.',
            clarify: 'A clarifying question if the user request is ambiguous.',
          },
        },
      },
    }

    // Base URL is validated above to known cloud hosts or localhost/.local
    // nosemgrep: rules.lgpl.javascript.ssrf.rule-node-ssrf
    const res = await fetch(`${baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw jevError(res.status, text.slice(0, ERROR_BODY_SLICE))
    }

    const data = (await res.json()) as JevResponse
    return {
      content: renderJevAnswers(data.answers ?? {}),
      provider: JEV_PROVIDER_ID,
      model: data.model ?? modelSlug,
    }
  }

  async sendStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
  ): Promise<ChatResult> {
    // /v1/systemone is not a streaming endpoint: one response, one chunk.
    const result = await this.send(request)
    onChunk(result.content)
    return result
  }
}

export const jevAdapter: ProviderAdapter = new JevAdapter()
