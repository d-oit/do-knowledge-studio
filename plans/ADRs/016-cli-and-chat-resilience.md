# ADR 016: CLI Surface Completion + Chat Streaming Resilience

**Status**: 📝 Proposed
**Date**: 2026-06-16
**Source**: Plan 042 — repo audit of `src/` and `cli/`
**Deciders**: Engineering

## Context

A 2026-06-16 audit of the `do-knowledge-studio` repository surfaced three gaps with high-confidence fixes:

### Gap 1 — `db:backup` documented but not implemented

`db:backup` is referenced as a deliverable in four places:

- `docs/CLI.md:268-274` describes the user-facing command
- `plans/ADRs/004-db-migration-system.md:66` lists it as a requirement
- `plans/GOAP.md:184` (M4) tracks it as a 1-hour task
- `plans/041-goap-remaining-gaps-tests-docs-logging-2026-06-16.md:101` lists it as a required test case

But `cli/commands/db.ts` (95 LOC) only registers `db:migrate`, `db:rollback`, `db:status`, and `db:reset`. The command is **documented, planned, and tested-for in the test matrix — but never registered**. This is a documentation/code drift hazard.

### Gap 2 — Claim CRUD missing from CLI

`cli/commands/claim.ts` (34 LOC) registers only `claim-create`. The repository layer in `src/db/repository.ts` exposes:

- `getClaimsByEntity(entityId): Promise<Claim[]>`
- `updateClaim(claimId, patch): Promise<Claim>`
- `deleteClaim(claimId): Promise<void>`

…with no CLI surface. Users (and automation scripts) have no way to enumerate, edit, or remove claims from the terminal. The entity CRUD commands in `cli/commands/entity.ts` already follow the same pattern; claim CRUD was simply never extracted.

### Gap 3 — Chat streaming has no cancellation and no retry

`src/features/ai/useChat.ts:145-207` runs the streaming agentic loop without:

- An `AbortController` to cancel an in-flight response
- Retry/backoff for transient provider errors (`5xx`, `429`)

Practical consequences:

- A user clicking "Send" on a long response has no way to abort it — the request runs to completion
- A 429 from OpenRouter / Kilo / Anthropic / Ollama bubbles up as a hard error instead of being retried with exponential backoff
- The four LLM provider files (`src/lib/llm/{anthropic,openrouter,kilo,ollama}.ts`) all wrap `fetch(...)` but do not pass a `signal`, making cancellation impossible at the transport layer

The `useChat` agentic loop already uses an `AsyncGenerator<LLMStreamChunk>` (`LLMStreamChunk` from `src/lib/llm/types.ts`), which is the natural seam for an `AbortSignal`.

## Decision

Adopt three coordinated changes under one plan (042) to close the gaps:

### Decision 1 — Implement `db:backup` in `cli/commands/db.ts`

```ts
program
  .command('db:backup')
  .description('Create a backup of the SQLite database using VACUUM INTO')
  .argument('[path]', 'backup file path', '')
  .action(async (pathArg?: string) => {
    const db = ctx.getDb();
    if (!db) {
      console.error('Database not initialized');
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = pathArg && pathArg.length > 0
      ? pathArg
      : `.studio-cli-backup-${timestamp}.db`;
    try {
      db.exec({ sql: `VACUUM INTO '${outPath.replace(/'/g, "''")}'` });
      console.log(`Backup created: ${outPath}`);
    } catch (err) {
      console.error(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
```

**Pattern reused**: `db:reset` in the same file uses `db.exec({ sql: '...' })` for raw SQL — `VACUUM INTO` follows the same pattern. The single-quote escape mirrors the SQL-injection mitigation flagged in `analysis/SWARM_ANALYSIS.md:240` (S-08).

**Why `VACUUM INTO`**: SQLite's `VACUUM INTO` is the documented, transactional way to produce a consistent, defragmented copy of the database into a file. It runs without locking the source for writes and produces a fully valid SQLite file. `better-sqlite3` (used in the CLI) supports it natively.

### Decision 2 — Expose claim CRUD in `cli/commands/claim.ts`

Add three subcommands to the existing `registerClaimCommand` registrar, mirroring the patterns from `cli/commands/entity.ts:64-113`:

```ts
program
  .command('claim-list')
  .description('List claims for an entity')
  .argument('<entity-name>')
  .action(async (entityName: string) => { /* ... */ });

program
  .command('claim-update')
  .description('Update a claim by id')
  .argument('<claim-id>')
  .option('-s, --statement <statement>')
  .option('-c, --confidence <confidence>')
  .action(async (claimId: string, options: { statement?: string; confidence?: string }) => { /* ... */ });

program
  .command('claim-delete')
  .description('Delete a claim by id')
  .argument('<claim-id>')
  .action(async (claimId: string) => { /* ... */ });
```

**Idempotency / errors**: follow the same `try/catch` + `console.error` pattern as `claim-create` (lines 5-32 of `claim.ts`). No Zod re-validation at the CLI boundary — the repository layer is the source of truth.

**File size check**: adding ~55 LOC keeps `claim.ts` under 90 LOC, well under the 200 LOC budget for `cli/commands/*.ts` from taste.

### Decision 3 — Chat cancellation + retry

Two coordinated changes to the chat pipeline:

#### Cancellation

1. Add `AbortController` ref + `cancel()` to `useChat.ts`:

```ts
const abortRef = useRef<AbortController | null>(null);

async function sendMessage(text: string) {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  // ... pass controller.signal to chatStream
}

function cancel() {
  abortRef.current?.abort();
  abortRef.current = null;
}

return { ..., cancel };
```

2. Plumb `signal` through the call chain: `useChat.sendMessage` → `chatStream(messages, options)` → provider's `fetch(url, { ..., signal })`.
3. In each provider (`anthropic.ts`, `openrouter.ts`, `kilo.ts`, `ollama.ts`), add `signal` to the `RequestInit` passed to `fetch(...)`.
4. Between agentic rounds (the `for` loop in `useChat.ts:145-207`), check `signal.aborted` and break out cleanly without an error toast.

#### Retry / backoff

Add a small pure helper in `useChat.ts`:

```ts
async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseMs = 500, isRetryable }: {
    attempts?: number;
    baseMs?: number;
    isRetryable?: (e: unknown) => boolean;
  },
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isRetryable && !isRetryable(err)) throw err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastErr;
}
```

Wrap the per-round `chatStream` call:

```ts
const stream = await withRetry(
  () => chatStream(messages, { signal: controller.signal }),
  {
    isRetryable: (e) => {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      if (e instanceof HttpError && (e.status === 429 || e.status >= 500)) return true;
      return false;
    },
  },
);
```

**Why a `withRetry` helper instead of inline**: the helper is pure, unit-testable in isolation, and avoids cluttering the agentic loop. The `isRetryable` predicate keeps the policy explicit and overridable.

**Why exclude `AbortError`**: cancellation is intentional user action, not a transient failure. Retrying after a cancel would defeat the cancel button and could trigger a duplicate request.

#### UI: cancel button

In `src/features/ai/ChatView.tsx`, add a small cancel button next to the input that is visible only while `isStreaming`:

- Calls `cancel()` from the hook
- `aria-label="Cancel response"`
- Reuses the existing input-area button styles (no new design tokens)
- Hides itself when `!isStreaming` (no layout shift)

## Alternatives

### A. Status quo (do nothing)
- **Pros**: Zero change.
- **Cons**: Documentation/code drift grows; users hitting 429 see a hard error; no way to abort long responses.

### B. Implement only `db:backup` (skip claim CRUD and chat)
- **Pros**: Smallest possible PR.
- **Cons**: Leaves the CLI surface incomplete; chat remains fragile. Two follow-up plans needed.

### C. Use `puppeteer` / `wkhtmltopdf` for backup (rejected — not relevant; called out to match the ADR-012 precedent of rejecting tooling that violates local-first)
- **N/A**: not relevant to this ADR.

### D. Use `fs.copyFile` instead of `VACUUM INTO` for backup
- **Pros**: Simple.
- **Cons**: Copies a possibly-locked or non-atomic database file; risk of corruption if a writer is active. `VACUUM INTO` is the SQLite-recommended way to produce a consistent backup.

### E. Implement only cancellation (no retry)
- **Pros**: Half the chat changes.
- **Cons**: 429s still bubble up as hard errors; users on rate-limited providers (Kilo, free tier OpenRouter) hit walls.

### F. Implement cancellation + retry without `AbortController` signal plumbing
- **Pros**: Smaller diff.
- **Cons**: Cancellation would only stop the agentic loop, not the in-flight HTTP request — wasted bandwidth and tokens during cancellation.

### G. Coordinated plan (chosen)
- **Pros**: One PR per area (CLI / chat), all three gaps closed with consistent patterns; verification gates align with `plans/041` test matrix.
- **Cons**: Slightly larger scope; touches 9 files in two PRs.

## Consequences

### Positive
- Documentation/code drift eliminated for `db:backup`
- CLI offers complete claim lifecycle (create, list, update, delete) — matches entity lifecycle
- Chat users can cancel long responses and survive transient provider errors
- Provider signal plumbing is a one-time, mechanical change that benefits all future fetches in those modules
- The `withRetry` helper is reusable for any future async call in the chat pipeline (e.g., tool execution)

### Negative
- 9 files touched in two PRs (slightly above the "small change" threshold)
- `useChat.ts` grows by ~45 LOC; total estimated 245 LOC, still under the 500 LOC limit from AGENTS.md
- `claim.ts` grows from 34 to ~90 LOC; still under the 200 LOC per-file budget from taste

### Neutral
- No new dependencies
- No DB schema changes
- No breaking API changes for existing CLI users (new subcommands are additive)
- Cancellation is best-effort: if the provider ignores the signal at the TCP level, the request may still complete server-side; the local state is still cleaned up

## Files Affected

### CLI (Wave 2)

| File | Change | LOC delta |
|------|--------|-----------|
| `cli/commands/db.ts` | Add `db:backup` command | +18 |
| `cli/commands/claim.ts` | Add `claim-list`, `claim-update`, `claim-delete` | +55 |
| `cli/__tests__/commands.test.ts` | Add 10+ test cases (carryover from `plans/041:101`) | +120 |

### Chat (Wave 3)

| File | Change | LOC delta |
|------|--------|-----------|
| `src/features/ai/useChat.ts` | AbortController ref, `cancel()`, `withRetry` helper | +45 |
| `src/features/ai/ChatView.tsx` | Cancel button in input area | +15 |
| `src/lib/llm/anthropic.ts` | `signal` in `fetch` | +2 |
| `src/lib/llm/openrouter.ts` | `signal` in `fetch` | +2 |
| `src/lib/llm/kilo.ts` | `signal` in `fetch` | +2 |
| `src/lib/llm/ollama.ts` | `signal` in `fetch` (only if remote) | +2 |

All files stay under their existing LOC budgets. No new dependencies.

## Verification

### CLI

```bash
# db:backup
pnpm run cli -- db:backup
ls -1 .studio-cli-backup-*.db | head -1
pnpm run cli -- db:backup ./tmp/backup.db
ls -1 ./tmp/backup.db

# claim CRUD
pnpm run cli -- claim-list "My Entity"
pnpm run cli -- claim-update <id> --statement "Updated" --confidence 0.8
pnpm run cli -- claim-delete <id>

# Tests
pnpm run test cli/__tests__/commands.test.ts
# expect ≥ 10 new test cases, all passing
```

### Chat

```bash
# Type safety
pnpm run typecheck

# Unit tests for the new helper
pnpm run test src/features/ai/__tests__/useChat.test.ts
# (add tests for withRetry: transient retries, non-retryable throws, AbortError not retried)

# Manual: cancel mid-stream
# 1. open Chat in dev (pnpm run dev)
# 2. send a long prompt
# 3. click the cancel button before the response finishes
# 4. confirm the streaming stops, no error toast appears, UI returns to idle

# Manual: simulated 429 retry
# Add a one-off test using a mock provider that returns 429 twice then 200
# Confirm the helper retries twice and the final response streams
```

### Quality gate

```bash
./scripts/minimal_quality_gate.sh
# exits 0
```

### LOC budget check

```bash
wc -l cli/commands/db.ts cli/commands/claim.ts src/features/ai/useChat.ts src/features/ai/ChatView.tsx
# db.ts    < 200 LOC (was 95, +18 = ~113)
# claim.ts < 200 LOC (was 34, +55 = ~89)
# useChat  < 500 LOC (was ~200, +45 = ~245)
# ChatView < 500 LOC (was ~X, +15 = ~X+15; no risk)
```

## References

- Plan 042 (this work) — `plans/042-goap-cli-gaps-and-chat-resilience-2026-06-16.md`
- `db:backup` documentation — `docs/CLI.md:268-274`
- `db:backup` in ADR — `plans/ADRs/004-db-migration-system.md:66`
- `db:backup` in test matrix — `plans/041-goap-remaining-gaps-tests-docs-logging-2026-06-16.md:101`
- SWARM_ANALYSIS SQL escaping note — `analysis/SWARM_ANALYSIS.md:240` (S-08)
- `useChat` agentic loop — `src/features/ai/useChat.ts:145-207`
- LLM provider list — `src/lib/llm/{anthropic,openrouter,kilo,ollama}.ts`
- Taste — CLI command file budget — `.commandcode/taste/taste.md` (200 LOC per `cli/commands/*.ts`)
- ADR format reference — `plans/ADRs/014-test-architecture.md`, `plans/ADRs/015-jsdoc-policy.md`
- `AbortController` + `fetch` signal reference — MDN, "AbortController"
