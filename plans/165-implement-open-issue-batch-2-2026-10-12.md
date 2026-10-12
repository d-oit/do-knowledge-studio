# Plan 165 — Implement open-issue batch 2: tokens, nav i18n, destructive-action gates (2026-10-12)

**Scope**: the next items from the triage order in plan 163 §3.5, after batch 1
(plan 164): **#865** (nav labels in three parallel maps), **#862** (mobile-drawer
touch targets), **#863 follow-up** (graph/mind-map delete with no confirmation),
**#851** (entity-type colors claim tokens but render stock palette), **#852**
(magic `44px`), **#853** (hex clusters in TS), **#858** (`@layer utilities` →
`@utility`).

**Branch**: `fix/open-issues-a11y-ux` (continues batch 1). Nothing lands on `main`
from here; no issue is closed from here (no GitHub write credentials in this
environment — plan 163 §8).

## 1. What landed

| Issue | Change | Why it was real |
|---|---|---|
| **#865** | New `src/lib/i18n/messages/nav.ts` (labels, titles, subtitles, group headings) and `src/lib/studio/view-meta.ts` (`VIEW_META`). `app-shell.tsx` `VIEW_NAMES`, `topbar.tsx` `VIEW_TITLES` and `sidebar.tsx` `NAV_GROUPS` now consume it; the mind-map toolbar labels moved into the existing `mindmap.ts` scope. | Eleven view labels were duplicated in three hardcoded maps; renaming a view created three bugs and one stale aria-label. `grep 'Mind Map'` in components now returns only the i18n module. |
| **#852** | `--spacing-touch: 2.75rem` in `globals.css` `@theme`, plus `TOUCH_TARGET_CLASS` in `ui/shared-primitives.tsx`. All **163** non-test `min-h-[44px]` / `min-w-[44px]` / `w-[44px]` / `h-[44px]` literals migrated to `min-h-touch` / `min-w-touch` / `w-touch` / `h-touch`; the `≈0` acceptance `grep -c '44px' src/` (non-test) now returns **0**. | The accessibility floor was a magic number repeated 163 times — one digit typo away from a silent WCAG regression. |
| **#862** | Drawer close (32px), the nav/search tab buttons (~30px), the nav items (~36px) and the footer theme toggle (~30px) now carry `min-h-touch`; the shortcuts-dialog close uses `TOUCH_TARGET_CLASS` and its clear-filter button moved `size-9` → `size-touch`. | The touch-only UI shipped the smallest targets in the app — the priorities were literally inverted. |
| **#863 (follow-up)** | The graph canvas `Delete`/`Backspace` handler and the mind-map toolbar/keyboard delete now open the shared `ConfirmDialog` instead of destroying on the spot. The confirmation copy moved to a new shared `messages/entity-delete.ts` scope; `messages/inspector.ts` is deleted in its favour (the inspector had the only copy). | These were the last two unguarded `deleteEntity` paths (plan 164 gated the inspector and the editor/chat/reset flows). Deleting a mind-map node removes its subtree with no undo. |
| **#851** | `ENTITY_TYPE_META` renders the bespoke `--sky` / `--saffron` / `--clay` / `--sage` tokens (`bg-sky/15`, `text-sky`, …) instead of Tailwind's stock sky/amber/rose/emerald; `NEUTRAL_META` uses `bg-muted` / `text-ink-mute` / `bg-ink-faint` instead of the cool `zinc-*` the design language bans. The export-format `COLOR_MAP` and the TRIZ `clay` accents were aligned so the export preview and TRIZ chips do not drift from the entity palette. | The meta claimed `color: 'saffron'` while rendering `amber-700` (`#b45309` vs `#9a5c2a`) — the claim and the render disagreed. |
| **#853** | New `src/lib/colors.ts` is the single home for the peer palette (`PEER_COLORS`), the standalone-export palette (`EXPORT_COLORS`) and the PNG fallback background. `sync/cursors.ts`, `sync/presence.ts`, `views/export-helpers.ts` and `views/mindmap-export.ts` consume it. | Four modules carried bootleg hex clusters (the two peer lists were almost-but-not-quite the same) — a palette change was four edits and could silently miss one. |
| **#858** | The `@layer utilities` block became `@utility` definitions (v4 idiom, so the classes compose with variants); the type scale moved into `@theme` as `--text-badge` / `--text-caption` / `--text-label` / `--text-body-sm` (each with a `--line-height` pair); the hand-rolled `.font-serif` is gone — Tailwind generates `font-serif` from `--font-serif`, and the `ss01`/`ss02` sets ride along via `--font-serif--font-feature-settings`. `@keyframes` moved to the top level (`@utility` bodies must not host them). | The old block was the pre-v4 API: it could not take variants and duplicated a `font-serif` utility Tailwind already generates from the theme. |

## 2. Design notes

- **Who owns each confirmation**: the control that triggers the destructive
  action owns its gate, as in plan 164. The graph canvas, the mind-map toolbar
  and the mind-map keyboard handler all funnel into one owner each — the
  `ConfirmDialog` state is local to `graph-view.tsx` / `mindmap-view.tsx`.
- **One delete scope, not five**: the inspector already owned delete copy. Rather
  than add two more copies, `messages/entity-delete.ts` holds the shared strings
  and the inspector migrates onto it. This is the same *outcome* the issue asked
  for (a shared implementation), achieved by deleting a scope rather than adding
  one.
- **Type scale in `@theme`, not `@utility`**: `text-badge` and friends are font
  sizes, so the theme's `--text-*` namespace is the right home — it emits real
  utilities that carry their own line-height and work with `sm:`/`hover:`.
  `@utility` is used for the non-type helpers (`focus-ring`, `canvas-grid`, …).
- **`min-h-touch` vs `TOUCH_TARGET_CLASS`**: the token is the primitive; the
  class constant exists for the common "icon button" case the issue called out,
  and is used where a single string is clearer than two classes.
- **`#853` is a module, not CSS tokens**: the peer palette needs 12 distinct
  values and the export document must be self-contained, so a shared TS module
  (with each export value annotated against its `globals.css` token) is the
  correct fix — these values genuinely cannot be custom properties.

## 3. Verification

| Check | Command | Result |
|---|---|---|
| Lint | `pnpm run lint` | **0 warnings, 0 errors** |
| Types | `pnpm run typecheck` | **0 errors** |
| CSS compiles | `@tailwindcss/postcss` over `src/app/globals.css` | 164 KB output; `.focus-ring`, `.press-scale`, `.skeleton`, `.canvas-grid`, `.shadow-*`, `.hover-lift`, `.stagger-children`, `.min-h-touch`, `.min-w-touch`, `.text-badge/caption/label/body-sm`, `.font-serif` all emitted with the expected declarations (`min-height: var(--spacing-touch)`; `font-feature-settings: "ss01","ss02"`) |
| New tests | `view-meta.test.ts` (**5**), `colors.test.ts` (**3**) | passed |
| Behavioural tests | graph delete open/confirm/cancel, mind-map delete button + Delete + Backspace (confirm + cancel), delete announcement through the dialog | passed |
| Studio suite | `vitest run src/components/studio` | **75 files / 1173 tests passed** |
| UI + hooks + integration + app | `vitest run src/components/ui src/hooks src/integration src/lib/okf src/lib/__tests__ src/lib/studio src/app` | **65 files / 963 tests passed** |
| AI/search/export/editor/a11y | `vitest run src/lib/ai src/lib/search src/lib/export src/lib/editor src/lib/a11y …` | **27 files / 461 tests passed** |
| Sync + i18n | `vitest run src/lib/sync src/lib/i18n` | **16 files / 209 passed, 1 skipped** |

**Updated existing tests** (assertions that encoded the *old* behaviour):
- `entity-types.test.ts` neutral-fallback assertions (`zinc` → the new tokens).
- Four `lucide-react` / `shared-primitives` mocks gained the new exports
  (`AlertTriangle`, `TOUCH_TARGET_CLASS`).
- Delete tests in `graph-view.test.tsx`, `mindmap-view-coverage.test.tsx` and
  `announcer-integration.test.tsx` now go through the confirmation, and assert
  the gate (no delete before confirm) as well as the outcome.

**Not verified here (honest limits).**
- `pnpm run build` still **cannot complete in this environment**: `next build`'s
  Turbopack workers are OOM-killed by the memory cgroup (dmesg confirms; 3.9 GB
  / 2 vCPU). `next dev` dies the same way while compiling `/`. **CI's Build job
  is the authority** for both the CSS restructure and the whole batch. The CSS
  itself *was* verified by compiling it directly with the project's own
  `@tailwindcss/postcss` — see the row above.
- **No browser/preview verification**: the dev server is OOM-killed, so the
  visual result (touch targets, token colors, `@utility` behaviour with
  variants) was not seen rendered. Reported as pending, not as passed.
- `pnpm run test:e2e` was not run (no Playwright browsers). `e2e/touch-targets.spec.ts`
  measures real rendered sizes and is the real check for #862/#852.

## 4. Deliberately deferred

1. **#855 (arbitrary `text-[Npx]` → type scale)** — the mechanical swap is *not*
   safe: an arbitrary `text-[13px]` does **not** set a line-height, while the
   token utilities do (`--text-*--line-height`), so replacing 238 sites changes
   every affected block's leading. That needs visual review, which the OOM-killed
   dev server precludes here. The groundwork is done (the scale is now a real
   `@theme` scale, so the swap is a one-line-per-rung change once it can be seen);
   the two missing rungs (12 px, 15 px) still need a naming decision from the
   design owner.
2. **#870 (view chrome patchwork)** — broad and partly subjective (hero-header
   policy). The objective half (container constant + empty-canvas CTAs) is a
   follow-up; it belongs with a visual pass for the same reason.
3. **#858 remainder** — `.text-balance`, `.text-pretty`, `.ink-rule`,
   `.truncate-2/3` are documented in `DESIGN-SYSTEM.md` but do not exist in
   `globals.css` at all; that is doc drift (#857), tracked separately.

## 5. Process state

- Branch pushed for review; **no PR merged and no issue closed** (plan 163 §8:
  this environment has no GitHub write credentials).
- `code-review-assistant` has **not** been run (AGENTS.md requires it after CI
  passes, before merge).
- #865 / #851 / #852 / #853 / #858 close on merge of this branch; #862 and #863
  close once their e2e checks confirm the rendered result.
