# GOAP — Next.js Feature Implementation & Improvement Plan (2026-07-09)

**Generated**: 2026-07-09
**Source**: Live code audit of the Next.js redesign (`src/app`, `src/components/studio`, `src/lib/studio`) + plan `048-nextjs-cleanup-and-deprecation-audit-2026-07-09.md`
**Method**: Goal-Oriented Action Planning
**Scope**: UI, new features, missing implementation, and improvements
**Companion ADRs**: `plans/ADRs/018`–`plans/ADRs/022`

> This plan is recommendations only. It assumes the cleanup in plan 048
> (dead deps, stale `dist/`, docs drift, Prisma/next-auth decision) is done
> first, since several actions here depend on that baseline.

---

## 1. Task Analysis

**Primary Goal**: Turn the demo-grade Next.js shell into a coherent, functional
local-first knowledge studio, closing the gap between what the UI *advertises*
and what it *does*, while keeping the "Editorial Paper & Saffron" design intact.

**Constraints** (from AGENTS.md):
- Local-first only — no required backend.
- Strict TypeScript — no `any`; validate at boundaries.
- No magic numbers; use design tokens (`src/app/globals.css` `@theme`).
- Max 500 LOC per source file — `export-view.tsx` (712) and `editor-view.tsx`
  (581) already violate this and must be split before extending.
- Never modify eslint/lint config without explicit approval.
- All planning artifacts in `plans/`; `pnpm` only.

**Complexity**: **High** — several views are UI-only stubs; core value
propositions (AI, search, encryption, rich text) are not implemented.

---

## 2. Current-state ground truth (verified in code)

| Area            | File                                   | Reality                                                                 |
|-----------------|----------------------------------------|-------------------------------------------------------------------------|
| Chat ("Ask")    | `store.ts` `sendMessage`               | Simulated RAG: word-overlap scoring + `setTimeout(700)`. No embeddings.  |
| AI Harness      | `views/ai-harness-view.tsx` `handleSend` | **100% demo** — returns hardcoded "(Demo response.)". Never calls a provider. |
| API key         | `ai-harness-view.tsx`                   | `useState` only — **not persisted**, though UI says "stored locally".    |
| Editor          | `views/editor-view.tsx`                 | Plain `<textarea>`; no markdown render/preview/rich text.               |
| Export: JSON/MD/HTML | `views/export-view.tsx`            | ✅ Real `Blob` download.                                                |
| Export: PDF/DOCX | `views/export-view.tsx`                | ❌ `toast.info('… coming soon')`.                                        |
| Export: Encrypted | `views/export-view.tsx`               | ⚠️ "DEMO-GRADE OBFUSCATION ONLY — NOT real encryption."                 |
| Import          | `views/export-view.tsx`                | `JSON.parse` with **no schema validation** (`zod` shipped but 0 usages). |
| Graph / MindMap | `views/graph-view.tsx`, `mindmap-view.tsx` | Interactive layouts; no drag/zoom/pan.                              |
| Persistence     | `store.ts`                             | Zustand + `localStorage` (single JSON blob).                            |
| Tests           | —                                      | None (see plan 048).                                                    |

**Headline gap:** the three "AI/search" surfaces (AI Harness, Chat, semantic
search) and "encrypted export" promise capabilities the code does not deliver.
This is both a UX-trust and a security-messaging problem.

---

## 3. Goal Hierarchy

```
G-BASELINE (P0 — from plan 048; unblocks everything)
  ├── remove dead deps / stale dist / doc drift
  ├── resolve Prisma + next-auth (see ADR 018)
  ├── restore green lint + add store tests
  └── split oversized files (export-view 712, editor-view 581)
        │
        ▼
G-TRUTH (P0 — stop the UI from lying)
  ├── T1  Persist AI Harness API key (localStorage, per ADR 019)
  ├── T2  Wire real provider calls OR clearly label "Demo" (ADR 019)
  ├── T3  Real WebCrypto AES-GCM encrypted export (ADR 021)
  └── T4  Validate imports with zod at the boundary
        │
        ▼
G-CORE-FEATURES (P1 — deliver the promised value)
  ├── C1  Client-side retrieval engine for Chat + search (ADR 022)
  ├── C2  Rich-text / markdown editor (ADR 020)
  ├── C3  PDF export (client-side) + drop/gate DOCX
  └── C4  Entity relationship editing (links) surfaced in Editor + Graph
        │
        ▼
G-UI-POLISH (P1/P2 — independent tracks)
  ├── U1  a11y pass (chat/export/library have 1–2 aria hooks only)
  ├── U2  Empty/loading/error states across views
  ├── U3  prefers-reduced-motion for Framer Motion
  ├── U4  Keyboard nav + focus management audit
  └── U5  Design-token doc sync (DESIGN-SYSTEM.md ↔ globals.css)
        │
        ▼
G-NEW-FEATURES (P2 — growth)
  ├── N1  Backlinks / "referenced by" panel
  ├── N2  Saved views & filters
  ├── N3  Multi-device sync (opt-in) — only if ADR 018 chooses a backend
  └── N4  Command-palette actions beyond navigation (create, export, theme)
```

---

## 4. Action Table (atomic, prioritized)

| ID | Action | Priority | Effort | Files | ADR |
|----|--------|----------|--------|-------|-----|
| T1 | Persist AI Harness provider/model/key to `localStorage` (encrypted at rest via WebCrypto, or clearly "plaintext in this browser") | P0 | 3–5h | `ai-harness-view.tsx`, new `lib/studio/ai-settings.ts` | 019 |
| T2 | Replace demo `handleSend` with real client-side `fetch` to the selected provider (BYO key), streaming optional; keep offline fallback | P0 | 8–12h | `ai-harness-view.tsx`, new `lib/ai/providers.ts` | 019 |
| T3 | Replace obfuscation export with WebCrypto AES-GCM + PBKDF2; self-contained decrypting HTML reader | P0 | 6–10h | split `export-view.tsx` → `lib/export/encrypt.ts` | 021 |
| T4 | Add zod schemas for `Entity`/`Claim`; validate on import + persisted-state rehydrate | P0 | 4–6h | new `lib/studio/schema.ts`, `export-view.tsx`, `store.ts` | — |
| B1 | Split `export-view.tsx` (712) and `editor-view.tsx` (581) under 500 LOC | P0 | 4–6h | those two views | — |
| C1 | Client-side retrieval engine (BM25/TF-IDF over entities+claims) powering Chat + a real semantic-ish search; replace `setTimeout` fake | P1 | 10–16h | `store.ts`, new `lib/search/retrieval.ts` | 022 |
| C2 | Markdown rendering + optional rich-text editing (use `react-markdown` for preview; decide on `@mdxeditor/editor`) | P1 | 8–14h | `editor-view.tsx`, `chat-view.tsx` (render replies) | 020 |
| C3 | Client-side PDF export (`@react-pdf` or print-to-PDF); remove or feature-gate DOCX | P1 | 6–10h | `export-view.tsx` | — |
| C4 | Surface `Entity.links` editing in Editor; make Graph reflect edits live | P1 | 8–12h | `editor-view.tsx`, `graph-view.tsx`, `store.ts` | — |
| U1 | a11y pass: aria labels/roles, dialog semantics, list markup on all 9 views | P1 | 10–14h | all `views/*`, studio shell | — |
| U2 | Consistent empty / loading / error states (extract `EmptyState`, `Skeleton`) | P1 | 6–10h | new `components/studio/states/*` | — |
| U3 | `prefers-reduced-motion` gate for Framer Motion (9 files use it) | P2 | 3–5h | shared motion helper | — |
| U4 | Keyboard/focus audit: command palette, drawers, dialogs, graph | P2 | 6–8h | shell + views | — |
| U5 | Reconcile DESIGN-SYSTEM.md (says `src/styles/tokens.css`) with real tokens in `globals.css` | P2 | 1–2h | docs | — |
| N1 | Backlinks panel ("referenced by") from `links` graph | P2 | 5–8h | `right-panel.tsx`, `store.ts` | — |
| N2 | Saved views/filters persisted per user | P2 | 5–8h | `library-view.tsx`, `store.ts` | — |
| N4 | Command palette: create entity, export, toggle theme, jump-to-view | P2 | 4–6h | `command-palette.tsx` | — |
| N3 | Opt-in multi-device sync | P3 | 30h+ | new module | 018 |

---

## 5. Execution Waves

```diagram
╭─ Wave 0: Baseline (plan 048) ───────────────────────────────╮
│ dead deps · stale dist · docs · Prisma decision · tests     │
╰──────────────────────────────┬──────────────────────────────╯
                               ▼
╭─ Wave 1: Stop the UI from lying (P0) ───────────────────────╮
│ T1 T2 T3 T4 · B1 (split files first)                        │
╰──────────────────────────────┬──────────────────────────────╯
                               ▼
╭─ Wave 2: Core value (P1) ───────────────────────────────────╮
│ C1 retrieval · C2 editor · C3 PDF · C4 links   (parallel)   │
╰──────────────────────────────┬──────────────────────────────╯
                               ▼
╭─ Wave 3: Polish + growth (P1/P2) ───────────────────────────╮
│ U1 U2 U3 U4 U5 · N1 N2 N4    (parallel tracks)             │
╰─────────────────────────────────────────────────────────────╯
```

Wave 1 items are largely independent and can be parallelized across agents
once B1 (file splits) lands. Wave 2 tracks are independent (search, editor,
export, graph) and map cleanly to separate sub-agents.

---

## 6. Success Criteria

- No view promises a capability it doesn't deliver (AI Harness either calls a
  real provider or is unambiguously labeled a demo; "encrypted" export is real).
- `pnpm run build && typecheck && lint && test` all green; store + retrieval +
  encrypt + schema covered by Vitest.
- All source files ≤ 500 LOC.
- Imports rejected with a helpful error when malformed (zod).
- a11y: every interactive control reachable by keyboard with a name; dialogs
  trap focus; motion respects `prefers-reduced-motion`.

## 7. Risks & Notes

- **BYO-key in the browser (T2)**: keys live client-side. Document the trust
  model in ADR 019; never proxy through a server unless ADR 018 adds a backend.
- **File splits before feature work**: extending `export-view.tsx`/`editor-view.tsx`
  without splitting will breach the 500-LOC rule and complicate review.
- **Encryption messaging (T3)**: until real crypto lands, the current
  "DEMO-GRADE" labeling must stay visible — do not soften it.
- **Retrieval scope (C1)**: keep it in-browser to preserve local-first; a WASM
  vector index is possible later but BM25/TF-IDF is enough for v1.
