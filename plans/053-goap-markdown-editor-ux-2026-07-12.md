# GOAP — Markdown Editor UX, Formatting, and Draft Safety

**Generated**: 2026-07-12
**Source**: Current editor/store audit plus the UI/UX findings from this thread
**Method**: Goal-Oriented Action Planning
**Scope**: Planning only; Markdown editing, formatting, draft persistence,
feedback policy, accessibility, responsiveness, performance, and verification
**Companion ADRs**: ADR 020, ADR 023, ADR 024

## 1. Task analysis

**Primary goal:** Deliver a trustworthy local-first Markdown editor in which
formatting controls edit Markdown, ordinary work stays quiet, drafts survive
navigation and refresh, canonical commits remain explicit, and keyboard/mobile/
assistive-technology users can complete the same workflow.

**User outcome:** A writer can open or create an entity, format with toolbar or
keyboard, preview accurately, leave and return without losing work, understand
whether the draft and entity are saved, and recover from storage or validation
failures without toast spam.

**Constraints:**

- Only the structured `Entity` in Zustand/localStorage is canonical. Markdown
  is the encoding of `Entity.content` and an import/export format.
- Local-first only; no required backend.
- Strict TypeScript; Zod validation at persisted boundaries; no `any`.
- Use design tokens, named constants, named exports, and existing abstractions.
- Source files remain below 500 LOC.
- Interactive targets are at least 44×44px on coarse pointers.
- User-facing strings are centralized for later localization.
- Routine editing and formatting must not produce notification messages.

**Complexity:** High. Marker insertion is small; reliable selection, native
undo, IME, persistence acknowledgment, first-save identity, conflict handling,
and accessibility form the real implementation cost.

## 2. Current-state ground truth

| Area | Current behavior | Consequence |
|------|------------------|-------------|
| Formatting toolbar | Every command calls `toast.info("…would apply formatting")` | Controls advertise behavior they do not perform. |
| AI Extract | Toast-only placeholder | Control theater; no progress, result, or honest disabled state. |
| Editor engine | Controlled textarea | Good baseline, but selection/undo/IME behavior is unproven. |
| Preview | Edit/Preview exists through `react-markdown` | Useful foundation; no Split mode or documented dialect contract. |
| Save | `saveEntity` upserts, clears editing ID, and navigates to Library | Save breaks writing flow and conflates persistence with navigation. |
| Save feedback | Success toast after save | Redundant with visible state/navigation and disruptive during writing. |
| Draft safety | Component-local state only | Refresh/remount/navigation can lose work. |
| Dirty comparison | Name, content, type, description only | Tag and source URL changes can be reported as clean. |
| New entity | No stable draft ID before commit | Unnamed work cannot be safely restored. |
| Cancel edit | Calls `startNew`, clears fields, and remains in Editor | “Cancel” does not restore the committed entity or return to the prior context. |
| Claims | Independently committed with success toast | Entity draft state and claim persistence are conceptually mixed. |
| Labels/focus | Name, description, tag, and content depend on placeholders; focus outlines removed | WCAG naming and focus-visible gaps. |
| Mode controls | Ordinary buttons with visual state only | Edit/Preview selection is not announced. |
| Toolbar sizing | Dense 28–32px-style controls that wrap | Poor touch use and unstable mobile hierarchy. |
| Typography/contrast | Footer and metadata use 9–11px faint/accent text | The UI audit measured failing AA combinations as low as 2.74:1. |
| Type menu | Custom absolute popover has no menu/listbox keyboard contract | Escape, focus movement, and selected state are undefined. |
| Rendering subscription | Editor subscribes to the whole studio store | Unrelated chat, drawer, search, or panel changes can rerender the editor. |
| Word/date formatting | Manual word splitting and hardcoded `en-US` date formatting | Counting and locale behavior are not internationalization-safe. |
| Tests | Store CRUD only; no editor component or formatter tests | No proof for formatting, draft recovery, undo, IME, or notification policy. |

## 3. Product principles

1. **The edit is the feedback.** Bold changes text; Preview changes the view;
   Claim added changes the list. Do not narrate visible routine actions.
2. **Draft saved is not entity committed.** Recovery and canonical truth are
   separate and named accurately.
3. **Save does not mean leave.** Commit remains in the editor; “Done” or
   navigation is an independent action.
4. **No control theater.** Implement, honestly disable with context, or remove.
5. **Source remains legible.** Do not hide or rewrite Markdown behind WYSIWYG.
6. **Data loss prevention beats confirmation dialogs.** Persist drafts first;
   interrupt only when persistence failed or destructive loss is real.
7. **Accessibility is part of editor correctness.** Focus, selection, keyboard,
   composition, and announcements are functional requirements.

## 4. Goal hierarchy

```diagram
╭─ G0: Contract and proof spike (P0) ────────────────────────────╮
│ Markdown dialect · feedback rules · textarea undo/IME proof    │
╰──────────────────────────────┬─────────────────────────────────╯
                               ▼
╭─ G1: Real formatting engine (P0) ──────────────────────────────╮
│ pure transforms · selection transactions · shortcuts · tests   │
╰──────────────────────────────┬─────────────────────────────────╯
                               │
              ╭────────────────┴────────────────╮
              ▼                                 ▼
╭─ G2: Draft lifecycle (P0) ───────╮  ╭─ G3: Editor UX (P1) ────╮
│ recovery · commit · conflicts    │  │ modes · a11y · responsive│
│ storage errors · navigation      │  │ preview · formatting UI  │
╰────────────────┬─────────────────╯  ╰──────────────┬────────────╯
                 ╰───────────────────┬───────────────╯
                                     ▼
╭─ G4: Quiet feedback integration (P1) ──────────────────────────╮
│ inline status/errors · deduplicated exceptional toasts         │
╰──────────────────────────────┬─────────────────────────────────╯
                               ▼
╭─ G5: Cross-device verification and rollout (P1) ───────────────╮
│ unit · integration · E2E · screen reader · IME · performance   │
╰────────────────────────────────────────────────────────────────╯
```

## 5. State model

The implementation must not compress all status into one enum.

```diagram
                 text/metadata change
╭───────────╮ ─────────────────────────▶ ╭──────────────╮
│ committed │                            │ draft differs │
│ baseline  │ ◀───────────────────────── │ from baseline │
╰───────────╯      commit succeeds       ╰──────┬───────╯
                                               │ debounce/flush
                                               ▼
                                     ╭──────────────────╮
                                     │ draft persistence │
                                     │ pending/ok/error  │
                                     ╰──────────────────╯
```

Derived visible states:

- **Entity saved**: draft equals committed baseline and latest storage write is
  acknowledged.
- **Unsaved changes**: draft differs from committed baseline.
- **Saving draft…**: newest revision has a pending storage write; omit if the
  synchronous transition would flicker.
- **Draft saved locally**: draft differs from entity but recovery is durable.
- **Could not save draft**: newest revision is not durable; expose retry and
  copy-Markdown recovery.
- **Conflict detected**: base entity revision changed elsewhere; preserve both.

Claims keep their own immediate persistence status and are not folded into the
entity draft state.

## 6. Feedback matrix

| Interaction | Visible result | Announcement | Toast |
|-------------|----------------|--------------|-------|
| Type text | Content + dirty state | None per keystroke | No |
| Apply formatting | Markdown and selection change | Control name/state only | No |
| Switch mode | Mode panel changes | Selected mode | No |
| Draft persistence success | Footer status | Polite only on meaningful transition | No |
| Entity commit success | “Entity saved” inline | Polite once | No |
| Validation error | Field error + focused field | Error association | No |
| Claim added | New claim in list | List/status update | No |
| Storage/commit failure | Persistent alert + recovery actions | Alert once | Optional deduplicated error |
| AI extraction | Button progress + inline review | Busy/result state | Only after context change |
| Destructive discard | Named confirmation/undo | Dialog semantics | No success toast |

## 7. Atomic action plan

| ID | Action | Priority | Depends on | Effort | Acceptance gate |
|----|--------|----------|------------|--------|-----------------|
| D1 | Update editor architecture and feedback decisions in ADRs 020/023/024 | P0 | — | Done in planning | Decisions are explicit and non-conflicting. |
| S1 | Build a two-command textarea spike: bold plus multiline list/quote | P0 | D1 | 0.5–1d | Native undo/redo, selection, Unicode, IME, pointer, and keyboard matrix passes. |
| S2 | Decide textarea vs CodeMirror from spike evidence | P0 | S1 | 1h | Decision recorded before the full toolbar is built. |
| F1 | Define `MarkdownSelection` and pure command result contracts | P0 | S2 | 2–3h | No DOM or React dependency; strict typed ranges. |
| F2 | Implement bold, italic, headings, bullet/ordered lists, quote, inline/fenced code, and link transforms | P0 | F1 | 1–2d | Deterministic fixtures cover collapsed and multiline selections. |
| F3 | Integrate commands as one editor transaction with selection/focus restoration | P0 | F2 | 0.5–1d | One command is one undo unit; no caret jump or scroll jump. |
| F4 | Add editor-scoped shortcuts: Mod+B, Mod+I, Mod+K, Mod+S and documented heading/list shortcuts | P1 | F3 | 3–5h | Shortcuts do not fire outside editor or during composition. |
| F5 | Replace or remove AI Extract placeholder | P1 | D1 | 2–8h | Real progress/results, honest disabled explanation, or no control. No placeholder toast. |
| P1 | Add versioned Zod `EditorDraft` schema and dedicated storage adapter | P0 | D1 | 0.5–1d | Corrupt data, unavailable storage, and quota errors are recoverable. |
| P2 | Add stable draft/session identity, including unnamed new entities | P0 | P1 | 3–5h | Refresh restores the correct draft. |
| P3 | Add named debounced persistence with actual write acknowledgment and boundary flushes | P0 | P2 | 1d | Latest revision survives refresh/navigation; no whole-store write per keystroke. |
| P4 | Split store contracts into commit, finish editing, navigation, and draft actions | P0 | P2 | 0.5–1d | Save no longer navigates or clears session identity. |
| P5 | Implement explicit commit shared by button and Mod+S | P0 | P3,P4 | 0.5–1d | Flush → validate → commit → remain in editor; retry is safe. |
| P6 | Add stale revision and multi-tab conflict detection | P1 | P5 | 1d | Newer canonical content is never silently overwritten. |
| P7 | Define import/reset/delete/discard handling for affected drafts | P1 | P5 | 3–5h | Recoverable work cannot be destroyed accidentally. |
| P8 | Replace ambiguous Cancel with explicit Done and Discard changes semantics | P1 | P5,P7 | 3–5h | Done preserves durable draft/commit state; Discard names exactly what will be lost. |
| U1 | Add persistent labels, error descriptions, editor/preview region names, and visible focus | P0 | D1 | 0.5–1d | WCAG 2.2 AA naming/focus checks pass. |
| U2 | Replace Edit/Preview buttons with a one-of-many mode control; add Split | P1 | D1 | 0.5–1d | Correct role/state/keyboard contract; mobile excludes Split. |
| U3 | Make Split container-aware and expand the writing canvas | P1 | U2 | 3–5h | No compressed panes with sidebar/right panel at 1024–1280px. |
| U4 | Make the toolbar a labelled keyboard-operable group with 44px coarse-pointer targets | P1 | F3 | 0.5–1d | Keyboard/touch parity and selection preservation pass. |
| U5 | Defer preview rendering and share renderer fixtures with export | P1 | D1 | 0.5–1d | Typing remains responsive on the agreed large-document fixture. |
| U6 | Improve mobile sticky bars, safe-area padding, and content visibility above the keyboard | P1 | U2,U4 | 0.5–1d | Save/status/content remain reachable at 320/390px. |
| U7 | Raise functional text to the editor type scale and replace failing faint/accent combinations | P0 | U1 | 3–5h | All normal text reaches 4.5:1; 9px functional text is removed. |
| U8 | Replace the type popover with a native select or fully accessible single-select pattern | P1 | U1 | 3–5h | Name, selected value, Escape, focus, and keyboard selection pass. |
| R1 | Narrow editor Zustand selectors and memoize expensive derived values | P1 | P4 | 3–5h | Unrelated store updates do not rerender the editor body. |
| R2 | Use `Intl.Segmenter`, `Intl.NumberFormat`, and `Intl.DateTimeFormat` for counts and dates | P2 | D1 | 2–3h | Locale-sensitive fixtures pass without manual splitting or hardcoded locale. |
| N1 | Remove formatting, save-success, and claim-success toasts | P0 | D1 | 1–2h | Tests assert routine interactions emit no toast. |
| N2 | Add inline commit/draft status and persistent field/storage errors | P0 | P3,P5,U1 | 0.5–1d | Visible and screen-reader feedback matches ADR 024. |
| N3 | Deduplicate exceptional editor error toasts | P1 | N2 | 2–3h | Retries do not stack duplicate messages. |
| T1 | Add formatter unit/property tests | P0 | F2 | 0.5–1d | Unicode, delimiters, multiline, idempotence, and range invariants pass. |
| T2 | Add draft lifecycle/store tests | P0 | P1–P7 | 1–2d | Restore, corruption, quota, conflict, discard, and first commit pass. |
| T3 | Add editor integration tests | P0 | F3,P5,U1,N2 | 1d | Formatting, shortcuts, dirty fields, save state, and no-toast policy pass. |
| T4 | Add focused E2E/manual matrix | P1 | all | 1–2d | Keyboard, screen reader, IME, mobile keyboard, zoom, themes, and responsive modes pass. |

## 8. Execution strategy

Use a hybrid sequence. Do not parallelize work that touches editor transaction
or draft contracts until the spike and state interfaces are fixed.

### Wave 0 — Decision gate

- S1 textarea spike.
- S2 engine decision.
- Quality gate: no full toolbar implementation until native undo/IME evidence is
  accepted. If it fails, revise ADR 020 implementation notes to CodeMirror.

### Wave 1 — Independent foundations

Parallel tracks after Wave 0:

- **Formatting track:** F1–F2 + T1.
- **Draft track:** P1–P2 + initial P3 tests.
- **Accessibility contract:** U1 and semantic mode/toolbar prototypes.
- Quality gate: pure transforms and persisted draft schema are stable.

### Wave 2 — Integration

- F3–F4, P3–P5, U2–U5, U7–U8, R1–R2, N1–N2.
- Integrate commit without remount or navigation.
- Quality gate: complete primary flow works without routine toasts or data loss.

### Wave 3 — Hardening

- P6–P8, U6, N3, T2–T4.
- Resolve stale drafts, multi-tab updates, destructive boundaries, mobile
  keyboard, and large-document performance.
- Quality gate: full repository quality workflow and editor-specific E2E pass.

## 9. Formatting acceptance table

| Command | Collapsed selection | Selected text | Multiline behavior |
|---------|---------------------|---------------|--------------------|
| Bold | Insert markers and place caret inside | Wrap/unwrap `**` | Wrap selection as a whole unless invalid |
| Italic | Insert markers and place caret inside | Wrap/unwrap `_` | Wrap selection as a whole |
| H1/H2 | Prefix current line | Prefix selected lines | Toggle/replace heading level per line |
| Bullet list | Prefix current line | Prefix selected lines | Toggle list markers; preserve indentation |
| Ordered list | Prefix current line with `1.` | Number selected lines | Renumber deterministically |
| Quote | Prefix current line | Prefix selected lines | Toggle `>` per selected line |
| Code | Insert paired backticks | Wrap with safe delimiter | Use fenced block and preserve content |
| Link | Insert `[text](url)` and select URL | Use selection as label | Reject unsafe URL inline |

Every command must preserve line endings, avoid splitting surrogate/grapheme
sequences, restore a useful selection, and leave malformed ambiguous Markdown
unchanged rather than guessing destructively.

## 10. Verification strategy

### Unit tests

- Table-driven fixtures for every command and selection shape.
- Property invariants: ranges stay within bounds; output remains valid text;
  toggle commands are idempotent where specified; unrelated text is unchanged.
- Dirty comparison covers name, type, description, content, tags, source URL,
  and future links.
- Draft schema versioning, migration, corruption, quota, and unavailable storage.

### Integration tests

- Toolbar click and shortcut produce identical text/selection.
- Formatting does not emit a toast.
- Save and Mod+S use one commit path, stay in the editor, and do not remount.
- Validation focuses the first invalid field and preserves the draft.
- Claim addition updates the list without a routine success toast.
- Preview renders the supported syntax contract and safe links.
- Status announcements do not fire on every keystroke/debounce.

### E2E and manual checks

- Keyboard-only traversal and formatting; Escape behavior for any link UI.
- NVDA/VoiceOver announcement of labels, modes, status, and failures.
- Composition in at least one CJK IME; emoji and combining-mark selections.
- Native undo/redo on Chromium, Firefox, and WebKit before accepting textarea.
- iOS/Android keyboard viewport behavior at 320px and 390px widths.
- Edit, Preview, and Split at 768, 1024, 1280, and 1440px with right panel on/off.
- 200% text zoom, 400% reflow, light/dark themes, reduced motion.
- Typing and preview performance for a realistic long entity; define a measured
  latency budget before implementation rather than adding an arbitrary number.

### Repository quality gates

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run test:e2e
pnpm run test:coverage
./scripts/quality_gate.sh
```

If the current package scripts do not expose an E2E command, adding the test
harness is an explicit prerequisite rather than silently skipping the gate.

## 11. Rollout and observability

1. Ship formatting and draft persistence behind separable internal feature
   boundaries so recovery can remain enabled if Split is rolled back.
2. Migrate no canonical entity data for formatting; only add/version the draft
   key.
3. On hydration failure, preserve a recoverable raw copy when safe and explain
   how to copy the Markdown; never log document content.
4. Track local, non-content diagnostics only if telemetry already exists:
   storage failure category, draft recovery count, conflict count, and editor
   engine fallback. Do not introduce required remote analytics.
5. Remove the old toast placeholders in the same wave that enables real
   formatting so there is no mixed behavior.

## 12. Definition of done

- Every visible formatting control performs a tested Markdown edit or is absent.
- Textarea spike passed, or CodeMirror was selected before toolbar expansion.
- Drafts survive refresh, navigation, and controlled lifecycle boundaries.
- A failed storage write is never labelled saved.
- Save remains in the editor and does not reset caret/undo/session state.
- Done and Discard replace the current misleading Cancel behavior.
- Routine formatting, save, tag, mode, and claim actions emit no toast.
- Validation and storage errors are persistent, local, actionable, and
  accessible.
- Edit/Preview/Split follow responsive and semantic contracts.
- Editor text meets contrast/type-size requirements, metadata uses locale-safe
  formatting, and unrelated store changes do not rerender the writing surface.
- Keyboard, screen-reader, IME, mobile, contrast, target-size, and performance
  matrices pass.
- All repository quality gates are green and no touched source file exceeds 500
  lines.
