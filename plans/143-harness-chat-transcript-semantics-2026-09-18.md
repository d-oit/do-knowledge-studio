# Plan 143 — Harness Chat Transcript Semantics: No Empty Assistant Bubble (2026-09-18)

**Type**: defect fix (chat transcript rendering)
**Scope**: `use-ai-harness-chat.ts` + `use-ai-harness-chat.test.tsx`
**Follows**: plans/142 §5.1

## 1. Defect

`handleSend` appended an empty assistant bubble *before* awaiting the provider:

```ts
let streamedContent = ''
setMessages((m) => [...m, { role: 'assistant', content: '' }])   // placeholder
const result = await sendChatStream(...)
```

Two paths left that bubble blank in the transcript:

| Path | Old behaviour |
|---|---|
| Provider failure (`catch`) | Appended an `[Error] …` bubble **after** the placeholder — the turn rendered an empty bubble plus an error bubble |
| Abort (`AbortError`) | Returned early with the placeholder still in place — a blank bubble that never fills |

Both are reachable from the UI: the chat panel renders `{message.content}`
verbatim (`ai-harness-chat.tsx`), so an empty content is a real blank bubble,
and abort is triggered whenever a send supersedes an in-flight request.

## 2. Decision — the transcript contract

A turn's assistant bubble **is created with its first content, never empty**.

| Event | Transcript result |
|---|---|
| First streamed delta | Assistant bubble appears and streams |
| Provider answers on the result with no deltas | Bubble appears filled with the returned reply |
| Provider failure before any delta | `[Error] …` bubble only — no empty bubble |
| Failure after partial deltas | Partial bubble is kept, `[Error] …` is appended (the partial answer is real information) |
| Abort before any delta | No assistant bubble for that turn — the user message stands alone |
| Abort after partial deltas | Partial bubble is kept |

This is the smallest change that removes the defect at the root: the empty
bubble cannot exist because it is never created. The alternative (delete or
rewrite the placeholder in `catch`) needs index bookkeeping to find *this*
turn's bubble — the abort-on-new-send path already has a newer user message
appended after it, so "remove the trailing empty assistant message" is not
sufficient.

## 3. Change

- Removed the eager placeholder; added `upsertAssistantBubble(content)` which
  appends the turn's bubble on first content and replaces it afterwards
  (`assistantBubbleStarted` flag local to the send).
- Both reply paths (streamed deltas, whole reply on the result) route through
  it; the `streamedContent === '' && result.content !== ''` fallback from
  plans/142 §1 is unchanged.
- `catch` keeps appending the error bubble (correct now that no placeholder
  exists) and the `AbortError` early return needs no cleanup.
- Doc comments updated to state the contract.

## 4. Regression proof

Fix stashed, tests run against the old hook:

```
× leaves no empty assistant bubble behind when the provider fails
  AssertionError: expected [ { role: 'assistant', content: '' } ] to deeply equal []
× leaves no assistant bubble when the turn is aborted before any delta
  AssertionError: expected [ 'assistant', 'user', 'assistant' ] to deeply equal [ 'assistant', 'user' ]
Tests  2 failed | 5 passed (7)
```

The third new test (`keeps the partial reply when the turn is aborted
mid-stream`) guards against over-correcting by discarding partial output.

## 5. Verification

| Check | Result |
|---|---|
| `vitest run` (hook test file) | 7 passed, 0 type errors |
| Fix stashed | 2 new tests fail (guard verified, above) |
| `pnpm run lint` | clean, 0 warnings |
| `pnpm run typecheck` | clean |
| `pnpm test` | 169 files, 2588 passed / 1 skipped |
| `pnpm run build` | clean (the `useTypeScriptCli` experiment notice is pre-existing and deliberate — plans/142 §4) |
| `./scripts/quality_gate.sh` | ✓ all gates passed, 0 warnings |

## 6. ADR check

No ADR needed. This is a rendering rule local to one hook — no storage,
search, export, or cross-cutting infrastructure change, and no persisted
state is affected (`ChatMessage` keeps its `{role, content}` shape). The
decision is recorded here because plans/142 §5.1 flagged it as needing an
explicit choice plus tests, not because it alters architecture.

## 7. Follow-ups

- Remaining plans/137 §5 findings: mention extraction inside code spans/fences
  (`mention.ts`); type filter applied after semantic truncation
  (`library-view.tsx`, needs a benchmark).
- DeepSource quota (plans/141 §1) — account-level, needs the maintainer.
- ESLint 10 (plans/140 §2) — blocked upstream.
