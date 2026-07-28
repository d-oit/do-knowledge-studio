# ADR 005: Error Handling Architecture

## Status
Superseded by ADR 028 — specific error patterns for import, hydration, and sync replace generic error handling.

## Context
The codebase has widespread error handling issues:
- Silently swallowed errors in search, repository, LLM config, and connection pool
- `catch` blocks that return false/null without distinguishing "not found" from "error"
- Single ErrorBoundary wrapping all features (one crash kills the entire app)
- No user-facing error messages with recovery suggestions
- CLI lacks cleanup (no `closeDb()` call, no try/catch on synchronous FS ops)
- Error screen renders raw error strings without sanitization

See GitHub issue #192 for detailed findings.

## Decision
We will implement a layered error handling architecture:

### 1. `AppError` class (typed errors)
```typescript
class AppError extends Error {
  constructor(
    code: ErrorCode,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(message ?? USER_MESSAGES[code], options);
    this.code = code;
    this.userMessage = USER_MESSAGES[code];
  }
}

enum ErrorCode {
  ENTITY_NOT_FOUND, ENTITY_CREATE_FAILED, ENTITY_UPDATE_FAILED, ENTITY_DELETE_FAILED,
  CLAIM_NOT_FOUND, CLAIM_CREATE_FAILED, CLAIM_UPDATE_FAILED, CLAIM_DELETE_FAILED,
  IMPORT_INVALID_JSON, IMPORT_INVALID_PAYLOAD, IMPORT_EMPTY_ENTITIES, IMPORT_ORPHANED_CLAIMS,
  EXPORT_FAILED, STORAGE_READ_FAILED, STORAGE_WRITE_FAILED, SEARCH_FAILED,
  AI_PROVIDER_ERROR, AI_PROVIDER_TIMEOUT, AI_PROVIDER_RATE_LIMITED, UNKNOWN,
}
```

### 2. Error boundaries (feature isolation)
- Per-feature ErrorBoundaries in `App.tsx` (Editor, Graph, MindMap, Chat, Export)
- Each boundary shows a feature-specific fallback with retry button
- Global ErrorBoundary as outermost layer for truly unrecoverable errors

### 3. Distinguish "not found" from "error"
- Repository methods return `T | null` for not-found, throw `AppError` for errors
- `getWebCache()` returns `null` for cache-miss, throws for DB errors
- `loadConfig()` throws on parse error (don't silently fallback)

### 4. User-facing error messages
- Every user-visible error has a `userMessage` string (human-readable)
- Log detailed errors to `console.error` / logger for debugging
- Never render raw error strings in UI (XSS vector, see ADR-002)

### 5. CLI cleanup
- `process.on('exit')` handler calls `closeDb()`
- `fs.readdirSync()` and other sync ops wrapped in try/catch
- CLI commands return non-zero exit codes on failure

## Alternatives Considered
- **Result types (Rust-style `Ok/Err`)**: More type-safe but adds significant boilerplate for an OOP-style codebase. `AppError` with thrown exceptions is more idiomatic for TypeScript/React.
- **Zod error handling**: Use Zod's built-in error formatting for validation errors specifically.
- **Sentry/Rollbar**: Overkill for a local-first app; would introduce third-party dependency.

## Implementation Plan
1. Create `src/lib/errors.ts` with `AppError` class, `ErrorCode` type, `result` helpers
2. Update `ErrorBoundary.tsx` to accept `fallbackTitle`, `fallbackMessage`, `onRetry` props
3. Add per-feature ErrorBoundaries in `App.tsx` route definitions
4. Refactor silent `catch` blocks in:
   - `src/lib/search.ts` (progressive search, initEmbeddings)
   - `src/db/repository.ts` (upsertWebCache, getWebCache)
   - `src/lib/llm/config.ts` (loadConfig)
   - `src/db/client.ts` (getSchema)
5. Add user-facing error messages in:
   - `ExportPanel.tsx` (error state with retry button)
   - `AIHarness.tsx` (error boundary around async handleSend)
   - `Editor.tsx` (detailed save failure message)
6. Add CLI cleanup:
   - `process.on('exit', () => db?.close())` in `cli/index.ts`
   - try/catch around `fs.readdirSync`
7. Update `App.tsx` error screen to sanitize error display

## Consequences
- **Positive**: No more silently swallowed errors
- **Positive**: Feature crash doesn't take down entire app
- **Positive**: Users get actionable error messages with recovery options
- **Positive**: CLI properly cleans up resources
- **Negative**: Refactoring ~15-20 catch blocks is tedious but mechanical
- **Negative**: `AppError` adds another abstraction layer
- **Risk**: Some callers may need updating if they relied on silent fallback behavior

## Acceptance Criteria
- [x] `AppError` class created with error codes and user messages
- [ ] All `catch` blocks either rethrow `AppError` or provide user feedback — infrastructure created, adoption deferred to follow-up
- [x] Per-feature ErrorBoundaries in App.tsx (at minimum: Editor, Graph, Chat, Export)
- [x] ErrorBoundary fallback shows feature name + retry button
- ~~CLI calls `closeDb()` on exit~~ — No CLI exists in the codebase
- ~~CLI synchronous FS ops are wrapped in try/catch~~ — No CLI exists in the codebase
- [x] Error screen does not render raw error strings
- [x] `npm run typecheck` and `npm test` pass
