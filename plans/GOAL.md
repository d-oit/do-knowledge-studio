# Goal: do-knowledge-studio

Build a local-first, structured knowledge engine that empowers users to capture, connect, and synthesize information without relying on cloud-based LLMs.

## Core Values
- **Local Sovereignty**: the core product is local-first — the canonical corpus is stored in Zustand + IndexedDB, with metadata/recovery envelopes in localStorage, and never leaves the device **unless the user opts into a remote feature**. Selecting a remote AI provider (OpenRouter), enabling web research, or joining a P2P sync room does transmit data off-device. Local Ollama and in-browser models stay local. "Never leaves the device" is therefore not an unconditional guarantee; it is the default posture for core functionality.
- **Structural Depth**: Moving beyond flat text to Entities, Claims, and relational Links.
- **Visual Intelligence**: Multiple perspectives on the same data (Graph, Mind Map, Chat).
- **Offline First**: Zero latency, zero dependency on external APIs for core functionality.
- **Security First**: All user content is sanitized before export; API keys are session-only.

## Current Architecture (refreshed 2026-10-05)
- Next.js 16 / React 19 / Tailwind 4 / shadcn / Zustand
- Persistence: Zustand + IndexedDB canonical corpus, localStorage metadata/recovery envelope (validated with Zod schemas), fail-closed on a refused hydration (ADR 028, Plan 159, ADR 046)
- Search: **BM25 keyword ranking plus a real semantic mode** (`src/lib/search/vector-store.ts`) that falls back to lexical on embedding failure
- AI: OpenRouter and Ollama providers via AI Harness, plus a **CPU-first in-browser local provider** (transformers.js/ONNX WASM, WebGPU opt-in — ADR 040, Plan 155)
- Sync: Yjs/WebRTC infrastructure (opt-in, bidirectional sync bridge per ADR 027)
- Export: JSON, Markdown, HTML, PDF, DOCX, encrypted self-contained HTML reader, the **`okf` bundle format** (ADR 031), and a **verified `.dksb` backup** with checksums and optional encryption (ADR 047)

## 2026 Goals (from GitHub Issue Analysis)
1. **Zero Security Vulnerabilities** — XSS fixes in export paths, session-only API keys ✓
2. **All Functional Bugs Resolved** — Broken nav, dead code, version sync ✓
3. **Infrastructure Integrity** — CI timeouts, caching, TypeScript configs ✓
4. **Code Quality at Scale** — Test coverage, strict TypeScript, error handling ✓
5. **Complete Core Features** — Entity editing, mind map, graph layouts ✓
6. **Performance for Large KBs** — Pagination, batch queries, lazy loading ✓
7. **Rich Export Formats** — PNG, PDF, DOCX with shared export core ✓
8. **Data Integrity** — Zod validation at all boundaries (Plan 072) ✓
9. **Honest Product Surface** — Accurate labels, no false-success controls (Plan 072) ✓

## Remaining Work

**Refreshed 2026-11-13.** The previous list was written 2026-10-05 and had gone
stale: six of its eight items shipped without the list being updated, which made
this file — the stated authoritative open-work list — direct the next agent at
finished work. Each item below was re-checked against `main` at `3b2cadd`, with
the evidence named.

### Shipped since the 2026-10-05 list (do not re-open)

| Item | Status | Evidence |
| --- | --- | --- |
| Recovery reachability and backup outcome | Shipped | Plan 162's own remediation; `restoreFromRecovery` now has a production caller and import reports a durable backup |
| Deletion/export integrity | Shipped | `deleteEntity` routes through `removeCanvasRefs` (graph, mind map, links) and strips entity links, claims and selection (`slices/entities-slice.ts`) |
| Sync join/rejoin | Shipped | `src/lib/sync/doc-rejoin.test.ts` covers leave→rejoin; tombstones are room-scoped across rejoin and long offline intervals |
| Heavy-leaf deferral (editor→Yjs, PDF/DOCX/fflate) | Shipped | The editor view imports no sync module; `export-documents.ts` (`jsPDF`) is reached only through `await import(...)` inside `use-export-handlers.ts`, behind a lazy `ExportView` |
| Plan 161 reduced-motion follow-on | Recorded tradeoff, closed | Plan 161 §Follow-on 1: first paint must match the server for hydration; `e2e/hydration-mismatch.spec.ts` covers it |
| URL deep links (ADR 037) | Shipped | `src/lib/studio/view-hash.ts` + `view-hash-sync.ts`, wired from `app-shell.tsx` |
| Pointer/touch graph and mind-map interaction | Shipped (mandatory scope) | Plans 169/198; `e2e/graph-gestures.spec.ts`, `e2e/mobile-touch-gestures.spec.ts` |
| Graph revision comparison | Shipped | Plan 170 (#974) |
| Synthesis Inbox | Shipped | `synthesis-inbox-panel.tsx` plus `src/lib/i18n/messages/synthesis.ts`; candidate list in Plan 162 is out of date |

### Open work, in order

1. **Graph frame rate on GPU hardware** — the 30 fps pan/zoom target from #1053
   is measured at 15–20 fps only because every runner available here renders in
   software (Plan 207, `perf-baselines.md`). What is missing is a GPU
   measurement, not a tightened threshold: no check in the repo can currently
   say whether the SVG path meets the target on real hardware, and ADR 052's
   "keep SVG" decision rests on that unmeasured question.
2. **Visual Query Builder** (Plan 11.6) — the only feature candidate never
   built: no `QueryBuilder` symbol exists under `src/` or `e2e/`. Plan 197
   shipped the structured query panel and saved views, so this is a UI layer over an existing model: ADR 018 retired its original SQLite/Orama target, and there is no SQLite in the current architecture, so the plan needs retargeting and an ADR before implementation.
3. **Skills and documentation maintenance** — generated skill catalogs,
   `agent-surface.py` doc truth, `SCRIPTS.md` drift, nonexistent `SKIP_LINKS`,
   README claims. Ongoing; no tracked issue.

### Not tracked here

Optional Mind Map swipe actions and verified-only graph filtering remain
spec-optional per Plan 166; they are not commitments.

### Coverage: configured floors vs measured history

These are different things and are kept separate:

- **Configured floors** (`vitest.config.ts:49-53`, current): branches 75, functions
  78, lines 84, statements 85. These are thresholds the gate enforces.
- **Measured coverage figures** in the historical list below are **records from
  the sessions named**, not live metrics. Nothing was measured by this refresh.

### Historical completed milestones (2026-07 records)

- Coverage target 55% — DONE (current: 57% lines)
- Full accessibility audit — DONE. E2E suite added in Plan 093 (keyboard, zoom, reflow, touch targets). Color-contrast violations fixed in Plan 095 (58+ serious violations resolved via CSS token adjustments). Strict axe-core assertions now applied to all 10 views.
- Error boundary test coverage — DONE. 14 tests for ErrorBoundary + ViewErrorBoundary (PR #551). Per-view isolation via ViewErrorBoundary wrapping each view in app-shell.tsx.
- AI Harness E2E coverage — DONE. 13 E2E tests for the only untested view (PR #555). All views now have E2E coverage.
- Untested component unit tests — DONE. 81 unit tests for 6 previously untested components: ai-harness-chat (20), ai-harness-settings (12), ai-harness-settings-panel (19), backup-tips (7), import-dropzone (10), reset-confirm-dialog (13) (PR #555).
- Studio component branch coverage — DONE. 74 unit tests for 4 low-coverage components: sidebar (21), topbar (19), voice-input (17), command-palette (17) (PR #557). Branch coverage improved from 54.46% to 57%.
- Coverage thresholds raised — DONE (PR #554). Thresholds raised to 55%/48%/50%/55% with current levels at 66.93%/57%/60.23%/67.99%.
- Studio component tests round 2 — DONE. 45 unit tests for theme-provider (5), presence-indicator (12), conflict-ui (19), shortcuts-dialog (9) (PR #559). Coverage improved to 67.8%/58.45%/61.46%/68.79%.
- Studio component tests round 3 — DONE. 71 unit tests for remote-cursors (13), voice-capture (20), qr-pairing (13), app-shell (25) (PR #560).
- Studio component tests round 4 — DONE. 51 unit tests for mobile-drawer (23), right-panel (28) (PR #561). **Milestone: all 17 studio components now have unit test coverage (255 total tests).**
- Version reconciled to 0.1.0 — DONE (PR #546). VERSION file, package.json, MIGRATION.md badge all aligned.
- Release policy clarified — DONE (PR #545). AGENTS.md and VERSION.md explicitly prohibit autonomous release creation.
- Branch coverage round 1 — DONE. 51 targeted tests for shortcuts-dialog.tsx keyboard handler (33 tests, 8.95% → ~65% branches) and bridge.ts conflict resolution (18 tests, 47.22% → ~65% branches) (PR #563). Discovered dead code in shortcuts-dialog (`else if (key === 'g')` branch unreachable because 'g' is in G_SEQ_MAP).
