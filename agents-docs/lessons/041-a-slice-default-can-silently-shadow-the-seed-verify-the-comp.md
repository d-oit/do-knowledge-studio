### LESSON-041: A slice default can silently shadow the seed — verify the composition order, not just the pieces

**Date**: 2026-09-29
**Component**: State management / store decomposition
**Severity**: High

**Issue**: After decomposing `store.ts` into slices, the chat transcript was
empty on first load and the "Clear chat history" control was permanently
disabled. `e2e/chat-a11y.spec.ts` failed with a 30s click timeout on a
`disabled` button.

**Symptoms**:
- Locator resolved to `<button disabled ... aria-label="Clear chat history">`
- Two chat-a11y specs failed; the other two passed
- No unit test failed — 2759 tests green
- Console showed an unrelated-looking `Cannot read properties of undefined
  (reading 'update')` from the service worker, which was a red herring

**Root cause**: The composition root spread seed state first and the slices
after:

```ts
{ ...buildInitialState(), ...createChatSlice(set, get), /* ... */ }
```

`createChatSlice` declares `chat: []` and `chatLoading: false` because
`StateCreator` must return the full key set. Spread *after* the seed, that
empty array overwrote the seeded welcome message. Every slice that declares
a seed-owned key is a live hazard: moving `buildInitialState()` last makes
the seed authoritative for every field it owns.

**Prevention**:

- When adding a slice, check whether any key it declares is also a key in
  `buildSeedState()`. If so, the composition order is load-bearing — say so
  in a comment, as `store.ts` now does.
- Decomposition refactors need an end-to-end run, not just unit tests. Every
  unit test here passed because each mounted a mocked or reset store; only
  Playwright drove the real first-load path.
- A disabled-control timeout is a state bug, not a flake. Read the resolved
  element's attributes before assuming a selector problem.
- When a regression test appears not to fail, verify the injection actually
  reproduced the bug. Three of my first four re-injections moved
  `buildInitialState()` to the wrong position and "passed" for that reason;
  the test was fine and my reproduction was wrong.
- If a console error names your file, it is evidence, not noise — but
  correlate it with the actual assertion before chasing it. The service
  worker error here was unrelated.

---
