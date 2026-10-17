/**
 * Zero-dependency structured logger facade (ADR 035, Plan 130 G1).
 *
 * Every failure path in the studio — view boundaries, framework error files,
 * runtime handlers, store/sync/AI failures — is meant to land in one queryable
 * stream. This module is that stream: a level-filtered facade over a list of
 * `LogSink`s, with a console sink for development and a bounded in-memory ring
 * buffer that a future "export diagnostics" action can read without any
 * backend (the local-first rule, AGENTS.md).
 *
 * Entries are plain objects (`{ timestamp, level, area, message, data? }`) that
 * the logger serializes itself, never string-interpolated at the call site:
 * `logger.info('imported', { entities })` keeps `entities` a number in
 * `entry.data`, so a diagnostics export stays machine-readable.
 *
 * Redaction discipline: data is scrubbed before it reaches any sink. Values
 * whose key names a credential (`apiKey`, `token`, ...) or an entity content
 * blob (`content`) are replaced with `[REDACTED]`, cycles are marked instead of
 * throwing, and recursion is depth-capped. Messages and codes are what callers
 * should log; this is the backstop for what they log anyway.
 */

/** Severity of a log entry, lowest to highest. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** A single structured log entry. Plain data — never a stringified object. */
export interface LogEntry {
  /** ISO-8601 timestamp taken when the entry was created. */
  readonly timestamp: string
  readonly level: LogLevel
  /** Subsystem tag, e.g. `store`, `sync`, `global`, `app`. */
  readonly area: string
  readonly message: string
  /** Redaction-safe structured payload; absent when the call site passed none. */
  readonly data?: Record<string, unknown>
}

/**
 * Destination for structured entries.
 *
 * The seam exists so an opt-in remote transport can be registered later
 * (ADR 035) without touching a single call site. `addLogSink` returns the
 * unregister function.
 */
export interface LogSink {
  write(entry: LogEntry): void
}

/** Subsystem tag inherited by child loggers. */
export interface LogContext {
  /** Children without an `area` inherit their parent's. */
  readonly area?: string
}

/** Structured logger bound to one subsystem tag. */
export interface Logger {
  /** Records a debug entry: developer-facing detail, dropped in production. */
  debug(message: string, data?: Record<string, unknown>): void
  /** Records an info entry: a completed operation worth correlating later. */
  info(message: string, data?: Record<string, unknown>): void
  /** Records a warning: something recoverable the user should know about. */
  warn(message: string, data?: Record<string, unknown>): void
  /** Records an error: a failure that reached a boundary or a catch block. */
  error(message: string, data?: Record<string, unknown>): void
  /** Returns a logger tagging every entry with the given area. */
  child(context?: LogContext): Logger
}

/** Tag used by the default logger and by children that name no area. */
export const DEFAULT_LOG_AREA = 'app'

/** How many entries the in-memory ring buffer keeps before evicting the oldest. */
export const MAX_BUFFERED_ENTRIES = 200

/** Replacement for a value whose key names a secret or an entity content blob. */
const REDACTED = '[REDACTED]'

/** Replacement for a reference already on the current serialization path. */
const CIRCULAR = '[Circular]'

/** Replacement for a value nested deeper than the logger will follow. */
const MAX_DEPTH_MARKER = '[MaxDepth]'

/** Object nesting the scrubber follows before it stops descending. */
const MAX_DATA_DEPTH = 4

/** Rank order used to decide which levels a minimum level lets through. */
const LEVEL_SEQUENCE: readonly LogLevel[] = ['debug', 'info', 'warn', 'error']

/**
 * Key names whose values never reach a sink, normalized by stripping every
 * non-letter and lowercasing, so `apiKey`, `api_key` and `API-KEY` all match
 * `apikey`. `content` is here because an entity's body is exactly the blob the
 * security rules forbid logging (AGENTS.md). Membership is tested against
 * arbitrary payload keys, hence a Set rather than a record.
 */
const SENSITIVE_KEY_NAMES = new Set([
  'apikey',
  'key',
  'token',
  'secret',
  'password',
  'passphrase',
  'authorization',
  'credential',
  'credentials',
  'content',
])

/** Formats a caught value for a single-line report, without re-throwing it. */
const describeThrown = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)

/** Renders a function without invoking it. */
const functionLabel = (value: unknown): string => {
  if (typeof value !== 'function') return '[Function]'
  return value.name === '' ? '[Function]' : `[Function ${value.name}]`
}

const formatScalar = (value: unknown): unknown => {
  if (typeof value === 'number') {
    // `NaN` and `Infinity` are not JSON-representable; name them rather than
    // letting a diagnostics export turn them into `null`.
    return Number.isFinite(value) ? value : String(value)
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') return String(value)
  if (typeof value === 'function') return functionLabel(value)
  if (typeof value === 'undefined') return undefined
  return value
}

/** Values `formatScalar` must handle, by `typeof` result. */
const SCALAR_KINDS = new Set(['string', 'boolean', 'number', 'bigint', 'symbol', 'function', 'undefined'])

/** Scrubs one level of a plain object, redacting sensitive keys. */
const scrubRecord = (
  record: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> => {
  const scrubbed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    // `kebab-case`, `snake_case` and `camelCase` spellings of one credential
    // all normalize to the same Set member.
    const isSensitive = SENSITIVE_KEY_NAMES.has(key.toLowerCase().replace(/[^a-z]/g, ''))
    scrubbed[key] = isSensitive ? REDACTED : scrubValue(value, depth, seen)
  }
  return scrubbed
}

/** Renders an Error as name/message/stack, following its cause. */
const scrubError = (error: Error, depth: number, seen: WeakSet<object>): Record<string, unknown> => ({
  name: error.name,
  message: error.message,
  ...(typeof error.stack === 'string' ? { stack: error.stack } : {}),
  ...(error.cause === undefined ? {} : { cause: scrubValue(error.cause, depth, seen) }),
})

/** Dispatches a non-null reference to its Error, array, container or record form. */
const scrubNested = (value: object, depth: number, seen: WeakSet<object>): unknown => {
  if (value instanceof Error) return scrubError(value, depth, seen)
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth, seen))
  // Containers `Object.entries` would render as an empty object: name the kind
  // and size rather than pretending there was nothing inside.
  if (value instanceof Map || value instanceof Set) {
    return `${value instanceof Map ? 'Map' : 'Set'}(${value.size})`
  }
  // Every other shape is a plain object; own enumerable string keys are exactly
  // what `Record<string, unknown>` names. Named here, not cast at the access.
  const record = value as Record<string, unknown>
  return scrubRecord(record, depth, seen)
}

/**
 * Descends one object level, remembering the reference only for as long as this
 * branch is being walked: a cycle is reported as `[Circular]`, while the same
 * object appearing twice as a sibling serializes twice (as a caller would
 * expect) instead of being mislabelled.
 */
const scrubContainer = (value: object, depth: number, seen: WeakSet<object>): unknown => {
  if (seen.has(value)) return CIRCULAR
  seen.add(value)
  try {
    return scrubNested(value, depth + 1, seen)
  } finally {
    seen.delete(value)
  }
}

const scrubObject = (value: object, depth: number, seen: WeakSet<object>): unknown => {
  if (depth >= MAX_DATA_DEPTH) return MAX_DEPTH_MARKER
  if (value instanceof Date) return value.toISOString()
  return scrubContainer(value, depth, seen)
}

/** Scrubs any value: scalars through `formatScalar`, references by recursion. */
const scrubValue = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
  const kind: string = typeof value
  if (SCALAR_KINDS.has(kind)) return formatScalar(value)
  if (value === null) return null
  // Only object references are left; `typeof` reports functions as `function`,
  // which `formatScalar` already named.
  const reference = value as object
  return scrubObject(reference, depth, seen)
}

/**
 * Redaction-safe, non-throwing serialization of a call site's `data`.
 *
 * A payload that cannot even be enumerated (a throwing getter) is *reported* —
 * the marker below travels in the entry itself, so it reaches every sink
 * instead of being swallowed here. Nothing a caller logs may break the caller,
 * which is why there is no rethrow.
 */
const toLogData = (data: Record<string, unknown>): Record<string, unknown> => {
  try {
    return scrubRecord(data, 0, new WeakSet<object>())
  } catch (error) {
    return { serializationFailed: true, reason: describeThrown(error) }
  }
}

/** Bounded in-memory sink; the oldest entry is evicted once the cap is reached. */
export interface RingBufferSink extends LogSink {
  /** Snapshot of the buffered entries, oldest first. */
  read(): readonly LogEntry[]
}

/**
 * Creates a bounded in-memory sink: once the cap is reached, each new entry
 * evicts the oldest one.
 * @param maxEntries - Buffer cap; defaults to `MAX_BUFFERED_ENTRIES`.
 * @returns The sink, plus a `read()` snapshot accessor.
 */
export const createRingBufferSink = (maxEntries: number = MAX_BUFFERED_ENTRIES): RingBufferSink => {
  const limit = Math.max(1, Math.floor(maxEntries))
  const entries: LogEntry[] = []
  return {
    write: (entry) => {
      entries.push(entry)
      if (entries.length > limit) entries.shift()
    },
    read: () => [...entries],
  }
}

/**
 * Writes one entry to the matching console method.
 *
 * A `Record<LogLevel, writer>` indexed by the entry's level would be the
 * compact shape, but a level-keyed function lookup is a dynamic property call
 * (a static-analysis finding) even though the key set is closed — the switch
 * keeps every call site static and makes exhaustiveness the compiler's problem.
 */
const writeConsoleEntry = (entry: LogEntry): void => {
  const line = `[${entry.level}] ${entry.area}: ${entry.message}`
  switch (entry.level) {
    case 'debug':
      if (entry.data === undefined) console.debug(line)
      else console.debug(line, entry.data)
      return
    case 'info':
      if (entry.data === undefined) console.info(line)
      else console.info(line, entry.data)
      return
    case 'warn':
      if (entry.data === undefined) console.warn(line)
      else console.warn(line, entry.data)
      return
    case 'error':
      if (entry.data === undefined) console.error(line)
      else console.error(line, entry.data)
  }
}

/**
 * Creates the development console sink.
 * @returns A sink writing `[level] area: message` plus the structured payload.
 */
export const createConsoleSink = (): LogSink => ({
  write: writeConsoleEntry,
})

/** Ring buffer behind `readLogEntries`, so a diagnostics export needs no plumbing. */
const bufferedEntries = createRingBufferSink()

/** Sinks every logger instance writes to, in registration order. */
const sinks: LogSink[] = [createConsoleSink(), bufferedEntries]

/**
 * Registers an additional sink.
 * @param sink - Destination for entries written after registration.
 * @returns The function that unregisters it.
 */
export const addLogSink = (sink: LogSink): (() => void) => {
  sinks.push(sink)
  return () => {
    const index = sinks.indexOf(sink)
    if (index !== -1) sinks.splice(index, 1)
  }
}

/**
 * Snapshot of the bounded in-memory buffer, oldest first.
 * @returns A copy of the buffered entries; mutating it cannot affect the buffer.
 */
export const readLogEntries = (): readonly LogEntry[] => bufferedEntries.read()

const writeToSink = (sink: LogSink, entry: LogEntry): void => {
  try {
    sink.write(entry)
  } catch (error) {
    // A broken sink must not fail the caller's code path, and it cannot report
    // its own failure (it would throw again), so the console is the floor of
    // last resort here.
    console.error('[logging] sink rejected an entry', describeThrown(error))
  }
}

const createTaggedLogger = (area: string, minLevel: LogLevel): Logger => {
  const enabledLevels = new Set(LEVEL_SEQUENCE.slice(LEVEL_SEQUENCE.indexOf(minLevel)))

  const emit = (level: LogLevel, message: string, data?: Record<string, unknown>): void => {
    if (!enabledLevels.has(level)) return
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      area,
      message,
      ...(data === undefined ? {} : { data: toLogData(data) }),
    }
    for (const sink of sinks) writeToSink(sink, entry)
  }

  return {
    debug: (message, data) => emit('debug', message, data),
    info: (message, data) => emit('info', message, data),
    warn: (message, data) => emit('warn', message, data),
    error: (message, data) => emit('error', message, data),
    child: (context = {}) => createTaggedLogger(context.area ?? area, minLevel),
  }
}

/** Options for `createLogger`; the app-level `logger` needs none. */
export interface LoggerOptions {
  /** Lowest level that reaches the sinks. */
  readonly minLevel?: LogLevel
}

/**
 * Creates a logger with its own minimum level. The default follows the build:
 * development and test builds log `debug`, production starts at `info`.
 * @param options - Optional `minLevel` override.
 * @returns A logger tagged with `DEFAULT_LOG_AREA`; use `child` for a subsystem.
 */
export const createLogger = (options: LoggerOptions = {}): Logger =>
  createTaggedLogger(
    DEFAULT_LOG_AREA,
    options.minLevel ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  )

/** The application logger. Call sites should use `logger.child({ area })`. */
export const logger: Logger = createLogger()
