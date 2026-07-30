# Goal: do-knowledge-studio

Build a local-first, structured knowledge engine that empowers users to capture, connect, and synthesize information without relying on cloud-based LLMs.

## Core Values
- **Local Sovereignty**: User data is stored in Zustand + localStorage and never leaves the device.
- **Structural Depth**: Moving beyond flat text to Entities, Claims, and relational Links.
- **Visual Intelligence**: Multiple perspectives on the same data (Graph, Mind Map, Chat).
- **Offline First**: Zero latency, zero dependency on external APIs for core functionality.
- **Security First**: All user content is sanitized before export; API keys are session-only.

## Current Architecture (as of 2026-07-27)
- Next.js 16 / React 19 / Tailwind 4 / shadcn / Zustand
- Persistence: Zustand + localStorage (validated with Zod schemas)
- Search: BM25 keyword ranking (not semantic/vector)
- AI: OpenRouter and Ollama providers via AI Harness
- Sync: Yjs/WebRTC infrastructure (opt-in, bidirectional sync bridge per ADR 027)
- Export: JSON, Markdown, HTML, PDF, DOCX, Encrypted HTML

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
