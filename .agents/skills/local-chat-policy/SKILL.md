---
name: local-chat-policy
description: Enforce the local-first chat contract in this knowledge studio - retrieval from the in-browser corpus, entity citations, untrusted-content isolation, and consent before any remote provider call. Trigger when changing chat, AI context building, retrieval wiring, provider selection, or anything that decides what corpus text leaves the browser.
version: 1.0.0
---

# Local chat policy

The chat surface answers from the user's own corpus first. There is no server
and no database: the corpus is Zustand state persisted to IndexedDB, and
retrieval runs in the browser. This skill is the checklist for changes to that
pipeline.

## The real pipeline

| Stage | Where |
|---|---|
| Corpus | `src/lib/studio/store.ts` (Zustand) + `src/lib/studio/canonical-storage-idb.ts` |
| Lexical retrieval | `src/lib/search/retrieval.ts` (BM25) |
| Semantic retrieval | `src/lib/search/vector-store.ts`, `vector-index.ts` |
| Fusion | `src/lib/search/fusion.ts` (reciprocal rank fusion) |
| Worker boundary | `src/lib/search/search-worker-client.ts` |
| Prompt assembly | `src/lib/ai/context.ts` (`buildSystemPromptAsync`, `buildMessagesAsync`) |
| Providers | `src/lib/ai/providers.ts`, `src/lib/ai/local-adapter.ts` |

## Rules

1. **Retrieve before generating.** A chat turn that can use the library must
   call the retrieval path (`searchAsync` / `searchSemantic` / `buildMessagesAsync`)
   rather than sending the raw question alone. Never read the corpus from
   `localStorage` — that envelope holds schema metadata, recovery snapshots and
   quarantine copies only.
2. **Cite entity names.** The system prompt already asks the model to cite
   entity names. When you change prompt assembly, keep that instruction and keep
   the retrieved entity names in the context block so a citation can be checked
   against the library.
3. **Isolate untrusted text.** Retrieved snippets, web research results and
   provider output are data, not instructions. Keep them inside the delimited
   context section; never concatenate them into the instruction paragraph, and
   never let them add tools or change the system prompt.
4. **Consent before egress.** A local provider (Ollama on localhost) may receive
   corpus text. A remote provider may not, unless the user has enabled it and
   the request is the one they asked for. Never send the whole corpus, secrets,
   API keys, or unrelated entities. `src/lib/ai/url-guard.ts` validates the
   Ollama base URL — do not bypass it.
5. **Degrade honestly.** If retrieval returns nothing, say so in the answer
   instead of inventing library content. If the embedder or index is
   unavailable, fall back to lexical retrieval and surface the fallback reason
   rather than failing the turn.
6. **Abort and clean up.** Every provider call takes an `AbortSignal`; a
   superseded turn must not write into the transcript.

## Anti-patterns

- "Search the SQLite database" — there is no SQLite and no database server.
- "Query the API for entities" — there is no API; the store is the source.
- Passing `entities` straight into a prompt without retrieval or a budget.
- Logging prompt text, corpus content, or provider payloads.

## Verification

- `pnpm run test -- src/lib/ai src/lib/search`
- For prompt or retrieval changes, add a test that asserts the untrusted block
  stays delimited and that a no-results query produces the honest fallback.
