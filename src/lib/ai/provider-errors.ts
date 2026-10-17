import { AppError, ErrorCode } from '@/lib/errors'

/**
 * Provider request failure classification and bounded initial-request retries.
 *
 * Adapters hand their one initial `fetch` to {@link fetchProviderWithRetry}:
 * HTTP failures become typed {@link AppError}s (so the harness can branch on
 * the code instead of pattern-matching provider text), and transient statuses
 * are retried with bounded exponential backoff. Retries happen strictly before
 * any response body is consumed, so a partially streamed answer is never
 * re-issued.
 */

/** Number of retries allowed after the initial attempt. */
export const PROVIDER_MAX_RETRIES = 3

/** Base delay for exponential backoff between provider retries (ms). */
export const PROVIDER_RETRY_BASE_DELAY_MS = 500

/** Upper bound for a backoff-derived retry delay (ms). */
export const PROVIDER_RETRY_MAX_DELAY_MS = 8_000

/** Upper bound for a server-supplied `Retry-After` delay (ms). */
export const PROVIDER_RETRY_AFTER_MAX_MS = 30_000

/** Random jitter fraction added to each backoff delay, as a share of the base. */
export const PROVIDER_RETRY_JITTER_RATIO = 0.25

/** Multiplier applied per retry for exponential backoff. */
export const PROVIDER_RETRY_BACKOFF_FACTOR = 2

/** Milliseconds in one second, for `Retry-After` conversion. */
export const MILLISECONDS_PER_SECOND = 1000

/** Number of response-body bytes retained in a provider diagnostic message. */
export const PROVIDER_ERROR_BODY_LIMIT = 200

/** HTTP status for "Too Many Requests". */
const HTTP_TOO_MANY_REQUESTS = 429

/** First HTTP status in the retryable 5xx server-error range. */
const HTTP_SERVER_ERROR_MIN = 500

/** Last HTTP status in the retryable 5xx server-error range. */
const HTTP_SERVER_ERROR_MAX = 599

/** DOMException name used by a caller-initiated abort (`AbortController.abort`). */
const ABORT_ERROR_NAME = 'AbortError'

/** DOMException name used by a timeout-driven abort (`AbortSignal.timeout`). */
const TIMEOUT_ERROR_NAME = 'TimeoutError'

/** True for a DOMException produced by an `AbortSignal` abort. */
export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === ABORT_ERROR_NAME

/** True when a response status is worth retrying before any body is consumed. */
export const isRetryableStatus = (status: number): boolean =>
  status === HTTP_TOO_MANY_REQUESTS ||
  (status >= HTTP_SERVER_ERROR_MIN && status <= HTTP_SERVER_ERROR_MAX)

/**
 * Parses a `Retry-After` header into a bounded delay in milliseconds.
 *
 * Accepts both the delta-seconds and the HTTP-date forms; returns `undefined`
 * when the header is absent or unparseable so the caller falls back to backoff.
 */
export const parseRetryAfter = (headerValue: string | null): number | undefined => {
  if (!headerValue) return undefined
  const seconds = Number(headerValue)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * MILLISECONDS_PER_SECOND, PROVIDER_RETRY_AFTER_MAX_MS)
  }
  const httpDate = Date.parse(headerValue)
  if (Number.isNaN(httpDate)) return undefined
  const deltaMs = httpDate - Date.now()
  return deltaMs > 0 ? Math.min(deltaMs, PROVIDER_RETRY_AFTER_MAX_MS) : 0
}

/**
 * Delay before the next retry: the server-supplied `Retry-After` when present,
 * otherwise bounded exponential backoff with jitter.
 */
export const computeRetryDelayMs = (attempt: number, retryAfterMs?: number): number => {
  if (retryAfterMs !== undefined) return retryAfterMs
  const exponentialMs = Math.min(
    PROVIDER_RETRY_BASE_DELAY_MS * PROVIDER_RETRY_BACKOFF_FACTOR ** attempt,
    PROVIDER_RETRY_MAX_DELAY_MS,
  )
  const jitterMs = Math.random() * PROVIDER_RETRY_BASE_DELAY_MS * PROVIDER_RETRY_JITTER_RATIO
  return Math.min(exponentialMs + jitterMs, PROVIDER_RETRY_MAX_DELAY_MS)
}

/** Resolves after `ms`, rejecting with the signal's abort reason if it fires. */
const delayUntil = (ms: number, signal?: AbortSignal): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  const onAbort = (): void => {
    clearTimeout(timerId)
    reject(signal?.reason ?? new DOMException('Aborted', ABORT_ERROR_NAME))
  }
  const timerId = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve()
  }, ms)
  if (signal?.aborted) {
    onAbort()
  } else {
    signal?.addEventListener('abort', onAbort, { once: true })
  }
  return promise
}

/** Reads a bounded slice of an error response body for diagnostics. */
const readErrorBody = async (response: Response): Promise<string> => {
  try {
    const text = await response.text()
    return text.slice(0, PROVIDER_ERROR_BODY_LIMIT)
  } catch {
    return ''
  }
}

/** Classifies a non-OK response into the AppError taxonomy. */
const toHttpError = async (label: string, response: Response): Promise<AppError> => {
  const body = await readErrorBody(response)
  const detail = `${label} error ${response.status}${body ? `: ${body}` : ''}`
  const context = { provider: label, status: response.status, body }
  if (response.status === HTTP_TOO_MANY_REQUESTS) {
    return new AppError(ErrorCode.AI_PROVIDER_RATE_LIMITED, detail, { cause: context })
  }
  return new AppError(ErrorCode.AI_PROVIDER_ERROR, detail, { cause: context })
}

/** Classifies a thrown fetch failure (timeout vs. network/other) for `label`. */
const toRequestError = (label: string, error: unknown): AppError => {
  if (error instanceof DOMException && error.name === TIMEOUT_ERROR_NAME) {
    return new AppError(ErrorCode.AI_PROVIDER_TIMEOUT, `${label} request timed out`, {
      cause: error,
    })
  }
  const detail = error instanceof Error ? error.message : String(error)
  return new AppError(ErrorCode.AI_PROVIDER_ERROR, `${label} network error: ${detail}`, {
    cause: error,
  })
}

/** Inputs for {@link fetchProviderWithRetry}. */
export interface ProviderFetchOptions {
  /** Human-readable provider name used in diagnostic messages. */
  label: string
  url: string
  init: RequestInit
  signal?: AbortSignal
}

/**
 * Runs a provider's initial request with bounded retries.
 *
 * Retries 429 and 5xx (honouring `Retry-After`), never retries a caller abort,
 * and never retries a non-retryable 4xx such as 401/403. Because this wraps
 * only the request that has not yet produced a body, a streaming turn is never
 * replayed once deltas have begun.
 */
export const fetchProviderWithRetry = async ({
  label,
  url,
  init,
  signal,
}: ProviderFetchOptions): Promise<Response> => {
  let attempt = 0
  for (;;) {
    let response: Response
    try {
      response = await fetch(url, { ...init, signal })
    } catch (error) {
      // A caller cancel (Stop, unmount, timeout) is not a provider failure and
      // keeps its DOMException identity so the harness stays silent on it.
      if (isAbortError(error)) throw error
      throw toRequestError(label, error)
    }

    if (response.ok) return response

    if (!isRetryableStatus(response.status) || attempt >= PROVIDER_MAX_RETRIES) {
      throw await toHttpError(label, response)
    }

    // Discard the retried response's body before re-issuing: a socket left
    // holding an unread body can exhaust the connection pool under load.
    await response.body?.cancel().catch(() => undefined)
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
    await delayUntil(computeRetryDelayMs(attempt, retryAfterMs), signal)
    attempt += 1
  }
}
