# ADR 013: Silent Catch Logging Policy

**Status**: 📝 Proposed
**Date**: 2026-06-16
**Source**: Plan 37.5 (Security & Quality Hardening) — gap closure via Plan 041
**Deciders**: Engineering
**Supersedes**: Implicit "comments-only" approach used in 0.2.4 (CHANGELOG)

## Context

Plan 37.5 (Security & Quality Hardening) called for replacing 14 silent-catch blocks across the codebase with active `logger.debug()` calls. The 2026-05-31 implementation wave landed **descriptive comments** at 12 of 14 sites but did **not** add active logging. The CHANGELOG entry for 0.2.4 reads: "Silent catch blocks now have descriptive comments explaining expected errors".

This partial implementation left a gap: when something goes wrong in a "best-effort" code path (e.g., `localStorage` unavailable, SSE chunk invalid, embeddings failed), the only signal is a comment. Operators have no telemetry; the Sentry/console pipeline never fires.

Audit on 2026-06-16 found these 12 sites still silent (no `logger.debug`):

| File:Line (current) | Context |
|---|---|
| `src/lib/resolver.ts:149` | Invalid URL detection |
| `src/lib/resolver.ts:183` | Direct fetch failure (wrapping catch) |
| `src/lib/perf/core.ts:54` | `performance.now()` unavailable |
| `src/lib/perf/core.ts:77` | `performance.measure` unavailable |
| `src/lib/perf/core.ts:88` | `performance.getEntriesByName` unavailable |
| `src/lib/llm/kilo.ts:117` | SSE chunk parse |
| `src/lib/llm/openrouter.ts:117` | SSE chunk parse |
| `src/components/ThemeSwitcher.tsx:48` | localStorage write fail |
| `src/components/ThemeSwitcher.tsx:57` | localStorage read fail |
| `src/db/migrate.ts:208` | `getMigrationStatus` empty catch |
| `src/features/search/SearchPanel.tsx:284` | Embeddings best-effort |

## Decision

Replace descriptive-only comments with **active `logger.debug()` calls** in all 12 sites, following these rules:

1. **Use `logger.debug`, not `logger.error`**: these paths are *expected* to fail in certain environments; debug level is appropriate so production console is not polluted.

2. **Include a stable context string** identifying the catch site:
   ```typescript
   } catch (error) {
     logger.debug('Expected: localStorage unavailable', { error: String(error) });
   }
   ```

3. **Preserve the original fallback behavior**: the `return [];`, `return null;`, or empty-body must remain — only the *logging* changes.

4. **For `localStorage` and `crypto.subtle` failures** (SSR, private browsing, older browsers), the message should be `Expected: <capability> unavailable`.

5. **For SSE chunk parse failures** (LLM streaming), the message should be `Expected: SSE chunk incomplete or invalid`.

6. **For embeddings failures** (best-effort semantic search), the message should be `Expected: embeddings degraded`.

7. **For performance API failures**, the message should be `Expected: Performance API unavailable`.

The `src/db/repository/` split submodules already follow this pattern with `logger.error` (catch is logged at error level because those are unexpected DB failures). No change there.

## Alternatives

### A. Keep comments only (current state)
- **Pros**: No console noise, no code change, comments are useful for readers.
- **Cons**: Zero telemetry; impossible to detect "expected" failures escalating; no audit trail.

### B. Use `console.warn` instead of `logger.debug`
- **Pros**: Always visible.
- **Cons**: Pollutes production console; not filterable; not captured by Sentry-equivalent.

### C. Use `logger.error` everywhere
- **Pros**: Maximum signal.
- **Cons**: Pages on-call for expected failures; noisy alerts.

### D. Adopt `logger.debug` (chosen)
- **Pros**: Filterable, captured by log aggregation, not noisy by default; debug level is the established convention for "expected" failures.
- **Cons**: Requires `src/lib/logger.ts` debug-level filter (already implemented in 0.2.4).

## Consequences

### Positive
- Operators can grep logs for `Expected:` to see degradation events
- Stable context strings make it easy to write monitoring queries
- Pattern aligns with the new `src/db/repository/*` submodule convention
- Test surface: `pnpm run test` should still pass; no new tests required (logger is already a Vitest mock)

### Negative
- 12 file edits (small, mechanical)
- Slight console noise in dev mode (acceptable; only visible if debug logs enabled)

### Neutral
- The descriptive comments are **removed** because `logger.debug` message replaces them
- Pattern is documented once in this ADR; future silent-catch PRs will be rejected by code review

## Files Affected

- `src/lib/resolver.ts` (2 sites)
- `src/lib/perf/core.ts` (3 sites)
- `src/lib/llm/kilo.ts` (1 site)
- `src/lib/llm/openrouter.ts` (1 site)
- `src/components/ThemeSwitcher.tsx` (2 sites)
- `src/db/migrate.ts` (1 site)
- `src/features/search/SearchPanel.tsx` (1 site)

**Total**: 12 files, 12 single-line additions

## Verification

```bash
# 1. Count logger.debug before and after
grep -r "logger.debug" src/ cli/ --include="*.ts" --include="*.tsx" | wc -l
# Before: 0-5
# After: ≥ 12

# 2. All 12 specified files have at least one new logger.debug call
for f in src/lib/resolver.ts src/lib/perf/core.ts src/lib/llm/kilo.ts src/lib/llm/openrouter.ts \
         src/components/ThemeSwitcher.tsx src/db/migrate.ts src/features/search/SearchPanel.tsx; do
  echo "$f: $(grep -c "logger.debug" "$f")"
done
# Each should output ≥ 1

# 3. Tests still pass
pnpm run test
# All green
```

## References

- Plan 37.5 (Security & Quality Hardening) — `plans/37-security-quality-hardening.md`
- Plan 041 (this work) — `plans/041-goap-remaining-gaps-tests-docs-logging-2026-06-16.md`
- Existing convention — `src/db/repository/entities.ts`, `claims.ts`, etc. all use `logger.error` for unexpected DB failures
- Logger module — `src/lib/logger.ts` (already supports debug level)
