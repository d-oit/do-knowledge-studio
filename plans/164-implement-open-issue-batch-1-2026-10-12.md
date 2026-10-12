# Plan 164 — Implement the highest-value open issues (2026-10-12)

**Scope**: the four highest-value items from the triage order in plan 163
(`plans/163-open-pr-issue-triage-and-merge-order-2026-10-12.md`, on branch
`integration/land-open-prs`): **#863** (destructive actions with no confirmation,
data loss), **#861** (library table semantics), **#856** (status bar announces
every keystroke), **#886** (model/endpoint defaults copy-pasted and already
drifted).

**Branch**: `fix/open-issues-a11y-ux`, cut from the branch point of the open-PR
integration work (main state, 8759327), so it lands independently of the PR
merge order. Nothing here touches `main`.

## 1. What landed

| Issue | Change | Evidence it is real |
|---|---|---|
| #863 | New shared `ConfirmDialog` (`ui/confirm-dialog.tsx`) built on the existing `Overlay`. `Clear chat history` and `Discard changes` now require confirmation; the two one-off dialogs are gone. | Before: `chat-view.tsx:handleClear` called `clearChat()` straight from the Trash2 button; `editor-view.tsx:handleDiscard` called `removeDraft()` + `finishEditing()` on one click. Both are irreversible (no undo, draft deleted). |
| #861 | Library list rows are rows again. The open control is a real `<button>` in the name cell with a stretched `::before` (`inset-0` against the positioned `<tr>`), so the whole row still clicks. `role="link"`, `tabIndex` and the hand-rolled Enter/Space `onKeyDown` were removed from the `<tr>`. | `role="link"` on a `<tr>` demoted the table and, because `aria-label` overrode the cell content, screen readers heard only "Open X, link" — description, type, tags and date were off the tree. |
| #856 | The word/char counters and the "Unsaved changes" flag are out of the live region; only the persistence outcome (saved / error) sits in a persistent `role="status"` region. | `editor-hooks.tsx` wrapped the count spans in `aria-live="polite" aria-atomic="true"`, so every keystroke narrated "N words · M characters". |
| #886 | One source of truth for the AI defaults: `DEFAULT_MODEL.openrouter` / `DEFAULT_OLLAMA_BASE_URL` are consumed by `ai-settings.ts` (including the legacy-model migration) and `ai-harness-view.tsx`; the drifted second model list (`OPENROUTER_DEFAULT_MODELS` — which disagreed with `OPENROUTER_MODELS` about which Claude exists), the dead `ProviderOption.models` field, and the duplicate `getProviderEndpoint` helper are deleted. | `grep -rn "openrouter/free" src/` now finds only `src/lib/ai/types.ts` (the constant) plus test fixtures. |

## 2. Design notes

- **`ConfirmDialog` placement**: the issue proposed appending it to
  `ui/shared-primitives.tsx`. It lives in its own module instead — it is a
  client component that uses hooks (`useReducedMotion`, a focus ref), and
  `shared-primitives.tsx` is a hook-free, mixed-purpose primitives file
  ("prefer small, composable modules"). Same shared-implementation outcome,
  one module per responsibility.
- **Who owns the confirmation**: the *control that triggers the destructive
  action* owns its gate. `EditorStatusBar` holds the discard confirmation
  (it owns the button); `RightPanel`'s inspector holds the delete confirmation;
  `ChatView`/`ExportView` hold theirs. This also kept
  `views/editor-view.tsx` at **484 LOC** — the first draft pushed it to 509,
  over the 500-LOC rule, which the restructure fixed.
- **Strings**: new copy goes to per-scope i18n modules as the repo requires —
  `messages/chat.ts`, `messages/editor.ts`, `messages/inspector.ts`. The reset
  dialog reuses the existing `messages/export.ts` scope. Existing labels
  (`CLEAR_CHAT_LABEL`, `DISCARD_CHANGES_TEXT`) are reused as the confirm action
  instead of being duplicated.
- **`getProviderEndpoint` deleted** rather than de-duplicated: its only caller
  was its own test. `providers.ts` keeps the private `OPENROUTER_ENDPOINT` it
  actually fetches with.

## 3. Verification

| Check | Command | Result |
|---|---|---|
| Lint | `pnpm run lint` | **0 warnings, 0 errors** |
| Types | `pnpm run typecheck` (`next typegen && tsc -p tsconfig.app.json`) | **0 errors** |
| New dialog tests | `vitest run src/components/studio/ui/confirm-dialog.test.tsx` | **7 passed** (closed/open, focus on cancel, confirm acts, cancel and Escape do not, optional icon) |
| Studio suite | `vitest run src/components/studio` | **75 files / 1171 tests passed** |
| AI defaults | `vitest run` over `types-coverage`, `ai-settings`, `schema`, `ai-harness-*` | **9 files / 272 tests passed** |
| App + primitives | `vitest run src/app src/components/ui src/test` | **27 files / 211 tests passed** |
| Editor + a11y libs | `vitest run src/lib/a11y src/lib/editor src/lib/studio/store-coverage.test.ts` | **6 files / 158 tests passed** |
| Behavioural tests added | clear-chat confirm + cancel, discard confirm + cancel, counters-out-of-live-region, status region asserts, library row semantics (jsdom), e2e specs updated to the new roles | see the diffs |

**Not verified here (honest limits).**
- `pnpm run build` **did not complete in this environment**: the build
  (`next build` + Turbopack workers) is **OOM-killed by the memory cgroup** —
  `dmesg` shows `Memory cgroup out of memory: Killed process … (next-build (v16)`
  with ~530 MB RSS while four workers held ~260 MB each on a 3.9 GB / 2 vCPU
  box. Two attempts (default and `--max-old-space-size=700`) both died. The
  merged *and* the base tree were equally affected, so this is an environment
  limit, not a regression signal — **CI's Build job is the authority.**
- The full unit suite cannot fit a 5-minute command window here
  (`vitest.config.ts` pins `maxWorkers: 2`); it is covered by the four shards
  above, which include every directory this change touches.
- `pnpm run test:e2e` was not run (no Playwright browsers). The three e2e specs
  whose selectors this change invalidates were updated:
  `e2e/chat-a11y.spec.ts` (clear now goes through the dialog),
  `e2e/accessibility.spec.ts` and `e2e/library-virtualization.spec.ts`
  (`role=link` → `role=button` for the row open control).
- Native `<button>` Enter/Space activation cannot be synthesized by jsdom; the
  jsdom test asserts the control is a button and that the row no longer claims
  an interactive role, and the e2e specs exercise the real browser path.

## 4. Still open (next batch, in the order plan 163 recommends)

1. **#865** — nav labels hardcoded in three parallel maps (`app-shell.tsx`
   `VIEW_NAMES`, `topbar.tsx` `VIEW_TITLES`, `sidebar.tsx` `NAV_GROUPS`) plus the
   duplicate Keyword/Ranked toggles and the raw mind-map toolbar labels. Wants
   one `messages/nav.ts` scope.
2. **#886 follow-up** — nothing left from the issue's acceptance criteria; the
   drift list is now single-sourced.
3. **#862** mobile-drawer touch targets (24–36 px in the touch-only UI).
4. **#851 / #852 / #853 / #855 / #858** — the token sweep
   (`44px` literals grew 109 → 161 in 11 days; arbitrary `text-[Npx]`, hex
   palettes in TS, pre-v4 `@layer` utilities). **Do these together in one
   pass** — five overlapping sweeps over the same files conflict exactly like
   the four conflicts in plan 163 §3.2.
5. **#870** view chrome patchwork (broad/subjective).
6. **#863 follow-up** — the same confirmation treatment is still missing for
   `deleteEntity` from the graph toolbar and the mind-map toolbar
   (`graph-view.tsx:173`, `mindmap-view.tsx:104`). The inspector path is now
   gated; these two are not.

## 5. Process state

- Branch pushed for review; **no PR merged and no issue closed** — this
  environment still has no GitHub write credentials (plan 163 §8).
- `code-review-assistant` has **not** been run; AGENTS.md makes it mandatory
  after CI passes and before merge.
- #863 / #861 / #856 / #886 close on merge of this branch.
