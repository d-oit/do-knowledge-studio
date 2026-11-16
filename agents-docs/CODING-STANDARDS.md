# Coding Standards

Generic TypeScript / React / i18n guidance moved out of AGENTS.md (#1145) so
the agent entry file stays on budget. These are conventions, not gates —
Biome and the `code-quality` skill own enforcement.

## TypeScript

- Use strict TypeScript. Do not use `any`.
- Prefer `const` assertions and `satisfies` over type assertions for narrowing.
- Prefer `structuredClone` over JSON parse/stringify for deep copies.
- Use `crypto.randomUUID()` for IDs, not `Math.random()`.

## React

- Escape JSX text content — `&apos;` for apostrophes, `&quot;` for quotes.
- Clean up side effects in `useEffect` return functions (abort fetches, clear
  timers, remove listeners).
- Use `AbortController` for all `fetch` calls; prefer native `AbortController`
  over custom cancellation patterns.
- Use `React.memo` for pure components with stable props, `useCallback` for
  handlers passed to children, `useMemo` for expensive computations.
- Batch DOM updates with `queueMicrotask` or `requestAnimationFrame`, never
  `setTimeout(fn, 0)`.

## Errors and resources

- Every `catch` must handle errors meaningfully (log, toast, rethrow) — never
  empty `catch {}`. Use `try/catch` with `finally` for cleanup (AbortController,
  timers, subscriptions, file handles).

## i18n and locale

- Never hardcode user-facing strings; extract to constants or i18n-ready maps.
- Use `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`
  for locale-sensitive formatting; `Intl.Segmenter` over manual splitting.

## Validation and secrets

- Validate all external input at boundaries (API responses, user input,
  storage rehydration) with Zod schemas.
- Never log secrets or API keys. `console.error` for errors, never
  `console.log` in production.

## Module conventions (enforced)

- **Named exports only** (tree-shaking, safe refactoring). Exception: Next.js
  App Router files (`src/app/page.tsx`, `src/app/layout.tsx`) require
  `export default` by framework convention.
- **Module-scope helpers are `const fn = () => {}`**, not `function`
  declarations — DeepSource JS-0067 flags top-level `function` as global scope
  (LESSON-027). Applies to test helpers and non-exported helpers in `src/`.
- Test filenames describe the behavior under test, not coverage chasing.
