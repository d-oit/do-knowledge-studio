# ADR 017 — Chat Unification Strategy

**Date**: 2026-06-22
**Status**: Implemented (PR #520, 2026-07-26)
**Supersedes**: partial #227

## Context

Plan 041 audit identified two divergent chat surfaces (M7) and a
rate-limiter hook that was not gating the AI send path (M12). The
search panel "Create new entity" CTA (F5) was decorative, and the
command-palette knowledge results (F7) defaulted to the editor view
without selecting the entity.

## Decision

We unify the chat story by **naming the experiences, not merging
them**. The local retrieval chat is the always-on, offline-ready
"Ask" surface. The LLM-powered agent is the experimental "Chat"
surface under the existing Lab group.

This keeps the offline-first contract intact (the "Ask" surface
never requires an API key) while clearly surfacing the LLM
capability as an opt-in.

## API Contract Changes

### `SearchPanel`

```ts
onCreateEntity?: (name: string) => void
```

The callback receives the current query. App-level handler creates
the entity, refreshes data, sets the new id, and routes to the
editor.

### `CommandPalette`

`onEntitySelect` is **required** (was optional). The palette
guarantees it is called with the result id when a knowledge
result is selected, plus `onViewChange('editor')` is always
invoked. The parent owns the side effects.

### `useRateLimiter`

New API:

```ts
type RateLimitDecision = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterMs?: number;
};

canRequest(): RateLimitDecision
```

`useChat.sendMessage` calls `canRequest` first. On deny, it appends
a system message: "I'm being rate-limited — please slow down and try
again in a few seconds." No network call is made.

## Consequences

- The "Ask" surface stays fast and offline.
- "Chat" under Lab is clearly the LLM-backed one — discoverable but
  not the default.
- Rate-limit feedback becomes user-visible instead of silent.
- `CommandPalette.onEntitySelect` becomes required; existing call
  sites already pass it.

## Alternatives Considered

1. **Merge into one component.** Rejected: the local-only contract
   and the LLM contract differ enough that combining them would
   leak provider state into a critical offline path.
2. **Auto-fall-through to LLM when no local match.** Rejected: a
   privacy boundary violation — Ask is local-only by design.
3. **Make the rate-limit silent.** Rejected: opaque failures
   confuse users and bury real issues.

## Implementation Notes (PR #520)

- `useRateLimiter` created at `src/lib/ai/use-rate-limiter.ts` with sliding window counter (10 req/60s)
- `onEntitySelect` is required on `CommandPalette` as specified
- `onCreateEntity` callback routes to editor via `startNew()` — entity name pre-fill is a follow-up (requires store support for named entity creation)
- Rate limiter wired into `ai-harness-view.tsx` handleSend with cooldown UI
- Cooldown countdown displayed in `ai-harness-chat.tsx` with disabled inputs during cooldown

## Follow-up closed (2026-10-17 — [Plan 177](../177-older-plan-leftovers-2026-10-17.md))

The pre-fill follow-up above is implemented: `startNew(name?)` carries the typed
palette query into a one-shot `pendingEntityName` hand-off that the editor
consumes (seeding the title and clearing the hand-off), and every existing
no-argument call site was migrated. The palette also gained the theme-cycle and
direct JSON-export commands this ADR's palette work left open.
