# Wave 3 Chat Unification + Wiring (C9, C10)

**Date**: 2026-06-22
**Plan refs**: plan 041 C9-C10, plan 042 row 123-124
**Issues closed**: F5, F6, F7, M7, M12

## Scope

Two atomic work items wiring the chat surface and search results into
the editor, plus unifying the divergent chat experiences and gating the
LLM send path on the rate limiter.

### C9 — Wire F5/F6/F7

- **F5**: `SearchPanel.tsx` "Create new entity" CTA is decorative.
  Wire it to create an entity using the search query as the name and
  open the editor focused on the new entity.
- **F6**: `Chat.tsx` citation cards navigate to the editor (already
  wired via `onNavigate`; add regression coverage).
- **F7**: `CommandPalette.tsx` knowledge results open the editor with
  the entity selected (already wired via `onEntitySelect`; surface the
  contract).

### C10 — Unify Chat + Rate Limiter

- **M7**: Rename local `Chat` → "Ask" (local search only).
  AI Harness remains "Chat" (LLM-powered). Update nav group + label.
- **M12**: Wire `useRateLimiter` into the AI send path. Block send
  when over the threshold and surface a "slow down" message in the
  chat. Add `canRequest` helper to the hook.

## Files Touched

- `src/features/search/SearchPanel.tsx` — accept new
  `onCreateEntity?: (name: string) => void` and use the query.
- `src/app/App.tsx` — implement create-entity handler, refresh data
  after create, pass it down.
- `src/components/CommandPalette.tsx` — explicit guard, ensure
  editor view + entity id are both delivered to the parent.
- `src/features/chat/Chat.tsx` — keep citation nav (regression test).
- `src/features/ai/useRateLimiter.ts` — add `canRequest` /
  `getRetryAfterMs` API.
- `src/features/ai/useChat.ts` — call `canRequest`; on deny, append a
  rate-limit message to chat history.
- `src/components/SidebarNav.tsx` — rename "Chat" → "Ask"; keep
  "AI Harness" labeled "Chat (LLM)" so the divergence is resolved
  semantically.
- `src/features/chat/__tests__/Chat.test.tsx` — add citation nav
  regression test.
- `src/features/search/__tests__/SearchPanel.test.tsx` — add
  create-entity-from-query test.
- `src/components/__tests__/CommandPalette.test.tsx` — add
  knowledge-result-opens-editor test (new file).
- `src/features/ai/__tests__/useRateLimiter.test.ts` — add
  `canRequest` behavior tests (new file).
- `src/features/ai/__tests__/useChat.test.ts` — add rate-limit
  gating test (new file).

## ADR

Decision recorded in `plans/ADRs/017-chat-unification.md`.

## Quality Gate

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run test`
- `pnpm run build`
