# Plan 145 — Contextual Right-Panel Close Controls (2026-09-21)

**Type**: UI behavior and accessibility fix
**Scope**: contextual panels in `src/components/studio/right-panel.tsx`

## Problem

The Search panel displayed a close button without an action. The Inspector's
close control only cleared its selection, after which the component fell back
to the first entity and stayed visible. The Citations panel had no close
control. This left the sidebar toggle as the only reliable way to dismiss a
contextual panel.

## Decision

Route every contextual close control through `setRightPanelOpen(false)`. Keep
selection state independent of closing the Inspector so reopening it preserves
the user's graph context. Extract the citations panel and shared close button
to keep every source file below the repository's 500-line limit.

## Acceptance criteria

1. Search, Inspector (including its empty state), and Citations expose a
   consistently labelled close button.
2. Each close button dismisses the entire right panel.
3. Closing the Inspector does not alter the selected entity.
4. Focused unit coverage verifies each contextual close path.
5. The running studio confirms the panel disappears after activation.

## Verification

- `pnpm exec vitest run src/components/studio/right-panel.test.tsx src/components/studio/right-panel-coverage.test.tsx`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `pnpm exec playwright test e2e/right-panel.spec.ts --project=chromium --project=desktop-xl`
- `./scripts/quality_gate.sh`

## Verification environment repair

`scripts/agent-surface.py` imports PyYAML, but the repository had no setup
step that installed the Python dependency. `scripts/validate-skills.sh` now
uses the system module when available, otherwise creates a cached virtual
environment with a pinned PyYAML dependency. The quality gate delegates to
the same wrapper so local and CI validation use the same dependency path.

## Tooling follow-up

Vitest 4.1.10 reports that its built-in type-test runner is experimental on
every test invocation. Application type checking completes with no errors;
evaluate Vitest's stable type-test support in a dedicated toolchain update
before changing this repository's test configuration.

The preview also exposed a pre-existing hydration warning from a diagnostic
`data-hydrated` attribute on the Topbar badge. The attribute had no consumer,
so it was removed to keep server and client markup aligned.
