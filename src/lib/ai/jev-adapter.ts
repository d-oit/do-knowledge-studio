import { z } from 'zod'
import { translate } from '@/lib/i18n/messages/ai'
import type { ChatRequest, ChatResult, ProviderAdapter, ProviderId } from './types'
import { DEFAULT_JEV_BASE_URL, JEV_PROVIDER_ID } from './types'
import { resolveJevEndpoint } from './url-guard'

/** Max characters of an upstream error body included in adapter error messages. */
const ERROR_BODY_SLICE = 200

/**
 * Runtime schema for the /v1/systemone response.
 *
 * The provider is remote and its body is untrusted, so `answers` is parsed
 * rather than asserted: every field the renderer touches is optional, and a
 * body that does not match surfaces as a provider error instead of a
 * TypeError thrown out of `Object.entries`.
 */
const JevAnswerSchema = z.object({
  type: z.string().optional(),
  choice: z.string().optional(),
  noul: z.number().optional(),
  score: z.number().optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().optional(),
})

const JevResponseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.string(), JevAnswerSchema).optional(),
})

/** Formats a 0..1 ratio as a fixed-percentage string. */
const formatRatio = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`

/**
 * Flattens typed decision answers into readable markdown for the chat UI.
 *
 * Every field is optional: a self-hosted Von server may omit `confidence` or
 * `probabilities` entirely, and the rendering degrades to whichever field that
 * server does return.
 */
const renderJevAnswers = (answers: Record<string, z.infer<typeof JevAnswerSchema>>): string => {
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
    // `{}` is truthy but contributes nothing; skipping it keeps `parts` free
    // of empty strings, which is what lets the caller's empty-content guard
    // distinguish "no usable answer" from a real one.
    if (answer.probabilities && Object.keys(answer.probabilities).length > 0) {
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
      return new Error(translate('ai.jev.error.badRequest', detail))
    case 401:
      return new Error(translate('ai.jev.error.unauthorized'))
    case 402:
      return new Error(translate('ai.jev.error.credits'))
    case 403:
      return new Error(translate('ai.jev.error.inactive'))
    case 422:
      return new Error(translate('ai.jev.error.missingField', detail))
    case 429:
      return new Error(translate('ai.jev.error.rateLimited'))
    default:
      return new Error(translate('ai.jev.error.upstream', String(status), detail))
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
    // `requiresKey` is enforced at the adapter, not only in the UI: sendChat
    // and sendChatStream are exported and take the key directly, so an empty
    // one would otherwise leave as the malformed header `Bearer `.
    if (!request.apiKey) {
      throw new Error(translate('ai.jev.error.missingKey'))
    }
    // The default goes through the same guard as a configured base URL, so
    // there is exactly one code path that can produce a credential-bearing
    // request and it is always allowlist-checked. The origin is allowlisted
    // and the path is a constant, so no user-controlled substring reaches the
    // request URL.
    const { origin, path } = resolveJevEndpoint(request.jevBaseUrl?.trim() || DEFAULT_JEV_BASE_URL)
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

    const res = await fetch(`${origin}${path}`, {
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

    const parsed = JevResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
      throw new Error(translate('ai.jev.error.malformed'))
    }
    const content = renderJevAnswers(parsed.data.answers ?? {})
    // Same guard as the OpenRouter and Ollama adapters. An empty result would
    // otherwise reach the chat hook, which only creates a bubble once content
    // exists, and the turn would vanish with no error.
    if (!content) {
      throw new Error(translate('ai.jev.error.empty'))
    }
    return {
      content,
      provider: JEV_PROVIDER_ID,
      model: parsed.data.model ?? modelSlug,
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
