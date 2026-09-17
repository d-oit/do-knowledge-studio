# Plan 142 — Harness Reply Fallback, CPU-Friendly Ollama Defaults, Type-Selector Trap (2026-09-17)

**Type**: defect fixes (chat rendering, a11y) + provider default models
**Scope**: `use-ai-harness-chat.ts`, `type-selector.tsx`, `lib/ai/types.ts` + 3 test files
**Follows**: plans/137 §5 (deferred findings), plans/141 §4 item 2

## 1. Local/in-browser replies could render as an empty bubble

plans/137 §5 recorded that `local-adapter.ts` never calls `onChunk` on its
non-streamed fallback path and judged the adapter contract deliberate — the
defect is in the consumer. Confirmed:

- `runGeneration` returns the text on the `ChatResult` when the streamer
  produced nothing (`if (streamed) return streamed; if (full) return full`,
  `local-adapter.ts:227-230`).
- `use-ai-harness-chat.ts` awaited `sendChatStream` and discarded the result,
  rendering only from `onChunk` — so the placeholder bubble stayed `''`.

**Fix**: keep the awaited result and fill the placeholder from it when nothing
was streamed. All three adapters throw on empty content, so an empty result
cannot mask the fix.

**Regression proof** (fix stashed, test run against the old consumer):

```
FAIL > renders the returned reply when the provider streamed nothing
AssertionError: expected '' to be 'A fallback answer'
```

## 2. Type selector trapped keyboard focus on an unregistered type

An entity can carry a type that is no longer registered (custom type removed,
or an entity received over sync). `type-selector.tsx` rendered options only
from `getEntityTypeDefs()`, so:

- the current value had no option at all, and
- every rendered option sat at `tabIndex={-1}` (`def.id === type` never matched)
  — nothing inside the listbox could take focus, and `ArrowDown`/`ArrowUp` had
  no focused option to move from.

**Fix**: prepend the entity's own type as an option when it is unregistered
(`{ ...meta, id: type }`, label falling back to the raw type string via
`getEntityTypeMeta`). It becomes the single `tabIndex={0}` option and carries
`aria-selected="true"`. Registered types are unaffected.

**Regression proof** (fix stashed): `keeps an unregistered current type
selectable and focusable` and `calls onSelect with an unregistered type id when
its option is clicked` both fail.

## 3. CPU-only Ollama path had no small model (impact check)

Requested: a small CPU-only model (Qwen / SmolLM) — only where it has impact.
Checked both providers before adding anything:

| Provider | Small CPU-capable models | Device | Gap |
|---|---|---|---|
| `local` (in-browser) | Qwen2.5-0.5B (default, q4) + SmolLM2-135M (q8) | `wasm` (CPU) — `LOCAL_DEFAULT_DEVICE`, and `localDevice` has no UI control | **none** — adding more would duplicate what ships |
| `ollama` | `llama3`, `mistral`, `qwen2.5`, `gemma2` — all 7-8B | GPU by default; `ollamaCpuOnly` sends `num_gpu: 0` | **real** — the "CPU only" toggle left the dropdown with only models that are unusably slow on CPU |

**Change**: two sub-1B tags lead `OLLAMA_DEFAULT_MODELS` (they stay listed for
GPU users too — a select whose options depend on the toggle could drop the
current value):

| Tag | Download | Source |
|---|---|---|
| `qwen2.5:0.5b` | ~400 MB | ollama.com/library/qwen2.5/tags |
| `smollm2:360m` | ~726 MB | ollama.com/library/smollm2/tags |

`smollm2:135m` (~271 MB) remains reachable through the custom-slug field.
`DEFAULT_MODEL.ollama` is unchanged, so existing selections are untouched.

## 4. Verification

| Check | Result |
|---|---|
| `vitest run` (3 touched test files) | 3 files, 38 passed, 0 type errors |
| Both fixes stashed individually | the new tests fail (guards verified) |
| `pnpm run lint` | clean, 0 warnings |
| `pnpm run typecheck` | clean |
| `pnpm test` | 169 files, 2585 passed / 1 skipped |
| `pnpm run build` | clean (the `useTypeScriptCli` experiment notice is pre-existing and deliberate — `next.config.ts` from #788, not introduced here) |
| `./scripts/quality_gate.sh` | ✓ all gates passed, 0 warnings |

## 5. Follow-ups

1. **Empty bubble on provider error / user abort** — observed while fixing §1:
   the `catch` in `use-ai-harness-chat.ts` appends an error bubble but leaves
   the empty placeholder bubble in the transcript, and the `AbortError` branch
   returns with the placeholder still empty. Not changed here: removing or
   rewriting the placeholder changes transcript semantics (does an aborted turn
   keep a bubble?) and deserves its own decision + tests.
2. **Remaining deferred findings from plans/137 §5** — mention extraction inside
   code spans/fences (`mention.ts`) and the type filter applied after semantic
   truncation (`library-view.tsx`). Both need scoped plans; the latter also
   needs a benchmark.
3. **DeepSource quota** (plans/141 §1) — still account-level; the analysis for
   this change cannot be confirmed by the service until it resets.

## 6. ADR check

No ADR needed: §1 and §2 are bug fixes that make existing contracts hold (the
adapter's documented "reply may ride on the result" contract, and the listbox's
`aria-selected`/roving-`tabIndex` pattern). §3 is a data-list change with no
storage, search, export, or workflow impact.
