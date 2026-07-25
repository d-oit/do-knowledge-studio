# ADR 024 — Editor Feedback and Notification Policy

**Date**: 2026-07-12
**Status**: Implemented — Inline status announcements; no routine toasts.
**Related**: ADR 020, ADR 023,
`plans/053-goap-markdown-editor-ux-2026-07-12.md`

## Context

The current editor uses Sonner toasts for formatting placeholders, AI Extract,
entity save success, validation failure, and claim creation. Routine actions
therefore interrupt the user even when the result should already be visible in
the editor. Formatting buttons are especially misleading: they show an
informational toast but do not change the Markdown.

Product editing feedback should be close to the affected content, persistent
for recoverable problems, and quiet during normal flow. Toasts are appropriate
only when the outcome has no stable inline home, completes in the background,
or must remain visible after context changes.

## Decision

Use the least interruptive feedback channel that communicates the outcome.

| Event | Primary feedback | Toast? |
|-------|------------------|--------|
| Typing or formatting | Text changes; dirty status updates | Never |
| Edit/Split/Preview switch | Selected mode and changed layout | Never |
| Recovery draft persisted | Subdued inline status | Never |
| Explicit entity commit succeeds | Inline “Entity saved” state | Never |
| Required field or unsafe URL | Inline field error + focus | Never |
| Claim added | Claim appears in the list | Never |
| Tag added/removed | Chip appears/disappears | Never |
| Draft storage fails | Persistent inline alert with retry/copy | Optional single deduplicated error toast |
| Commit fails unexpectedly | Persistent inline alert with retry | Optional single deduplicated error toast |
| AI extraction in current editor | Button progress + inline results/review | Only if it finishes after context changed |
| Explicit discard/destructive reset | Named confirmation or undo affordance | Not as routine success feedback |
| Cross-context export/download | Inline completion where possible | Allowed when no stable inline destination exists |

### Notification rules

1. Formatting commands must perform the edit. A toast is never a substitute for
   implementation, disabled state, or explanatory copy.
2. Routine success is conveyed by the changed interface, not “Saved!” or
   “Added!” announcements.
3. Validation errors remain beside the field until corrected. A transient toast
   alone is insufficient.
4. Error toasts are deduplicated and rate-limited by operation identity. A
   retry loop must not create a stack of identical messages.
5. Toast copy states the outcome and next action; it does not use celebratory or
   generic language.
6. Status messages are visible, not color-only, and use appropriate semantics.
   `aria-live="polite"` announces meaningful commit/error transitions, not every
   debounce or keystroke. Persistent failures use an alert relationship without
   repeatedly re-announcing unchanged text.
7. Focus remains in the editing context after formatting, save, and inline
   validation recovery.

## Consequences

- Editing becomes quieter and faster because normal work is self-confirming.
- Failures become more actionable because they persist next to the affected
  state.
- Sonner remains available for exceptional and cross-context outcomes, but is
  removed from formatting and routine editor success paths.
- Tests must assert both the presence of required feedback and the absence of
  routine toasts.

## Alternatives considered

1. **Toast every successful action.** Rejected as noisy, redundant, and harmful
   to screen-reader and cognitive load.
2. **Never use toasts.** Rejected because background or cross-context outcomes
   sometimes lack a stable inline destination.
3. **Status text only in the footer.** Rejected for field validation and
   storage failures, which require local context and recovery actions.
