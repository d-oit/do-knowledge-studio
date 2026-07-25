# Architecture: do-knowledge-studio

> Local-first knowledge studio. No required backend. Browser-only persistence.
> All state lives in the client; sync and AI are opt-in extensions.

## Overview

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 / React 19 / Tailwind 4 / shadcn |
| State & Persistence | Zustand 5 + localStorage (Zod-validated) |
| Sync (opt-in) | Yjs + y-webrtc (WebRTC P2P) |
| Deployment | Vercel (Node >= 20, pnpm) |

No SQLite, no OPFS, no required server. ADR 018 establishes the baseline;
ADR 028 defines validated persistence boundaries.

---

## Data Model

| Record | Key Fields | Notes |
|--------|-----------|-------|
| **Entity** | id, name, type, description, content (Markdown), tags | Canonical subject node |
| **Claim** | id, entityId, statement, evidence, confidence (0-1), verification, source, version history | Assertion about an entity |
| **Link** | id, sourceId, targetId, type | Directional, typed relationship |
| **Note** | id, content, tags | Unstructured context |

IDs use `crypto.randomUUID()`. Deletion resolves dependents atomically.

---

## State Management

One Zustand store (`src/lib/studio/store.ts`) with slices for entities,
claims, chat, and UI. Computed selectors derive views (graph, stats)
without unnecessary re-renders.

Editor drafts use a dedicated store/key to isolate high-frequency writes
from the canonical persistence blob (ADR 023).

---

## Persistence & Validation

- Single namespaced localStorage blob (`do-knowledge-studio-store`).
- Hydration: read envelope -> validate version -> apply migrations ->
  validate current schema -> atomic commit (ADR 028).
- All external boundaries (localStorage, import, sync, AI responses) are
  Zod-parsed before mutation.
- Imports are atomic and fail-closed: complete valid candidate or structured
  error list. No silent record dropping.
- Pre-import snapshot enables atomic replacement with undo.

---

## AI Harness

Client-side, bring-your-own-key (ADR 019, ADR 025).

| Provider | Transport | Notes |
|----------|----------|-------|
| **OpenRouter** | OpenAI-compatible fetch | Single key, hundreds of models |
| **Ollama** | localhost fetch | CPU-only toggle, configurable URL |

- Prompt augmentation via BM25-retrieved local context (top-k).
- All fetch calls use `AbortController`.
- Manifest-driven skill harness (ADR 029): `.agents/manifest.json`
  declares surfaces, skill directory, and validation rules.

---

## Sync (P2P)

Opt-in WebRTC sync via Yjs (ADR 026, ADR 027). Zustand remains canonical;
Yjs is a replication transport.

- **CRDT**: Yjs (~30 KB), per-field last-writer-wins.
- **Transport**: `y-webrtc` (signaling) + QR code pairing (offline).
- **Bridge**: bidirectional, validated. Outbound: Zustand transaction ->
  Yjs update. Inbound: Yjs change -> validate -> atomic Zustand commit.
- **Tombstones**: explicit deletes with device ID, timestamp, version.
  Compacted under tested retention rules.
- **Conflicts**: manual resolution produces validated canonical transactions.
  Dismissal does not mutate data.
- **Presence + cursors**: Yjs awareness protocol.

---

## Search

Client-side BM25 retrieval (`src/lib/search/retrieval.ts`, ADR 022).

- Indexes entity names, descriptions, content, tags, claim statements.
- Rebuilt from store on data change. Returns scored results with snippets.
- Powers Library search and Chat citations. Fully offline.

---

## Export

| Format | Library | Notes |
|--------|---------|-------|
| JSON | Native | Versioned schema v1.0, Zod-validated, round-trip |
| Markdown | Custom | Frontmatter metadata + entity body |
| HTML | Custom | Self-contained static site |
| PDF | jspdf | Client-side generation |
| DOCX | docx (lazy) | Dynamic import |
| Encrypted | WebCrypto AES-256-GCM | PBKDF2 derivation, self-contained HTML reader |

ADR 010 (schema), ADR 021 (encryption), ADR 012 (PDF).

---

## Editor

Markdown-source-first with progressive enhancement (ADR 020).

- Native `<textarea>` with selection-aware formatting transactions.
- Versioned `EditorDraft` in a dedicated localStorage key, debounced,
  flushed on navigation/unmount/visibility (ADR 023).
- `Cmd/Ctrl+S` flushes draft -> validates -> commits without navigating.
- Edit / Preview / Split modes. Split requires sufficient width.
- CodeMirror 6 is the defined fallback if native approach fails
  measurable criteria (undo, IME, grapheme boundaries).

---

## Views

| View | Purpose |
|------|---------|
| Editor | Entity/claim authoring |
| Graph | Interactive knowledge graph |
| Mind Map | Hierarchical organization |
| Chat | Retrieval-augmented synthesis |
| TRIZ | Contradiction analysis |
| AI Harness | Provider config + augmented chat |
| Library | Entity list, filtering, search |
| Export | Multi-format export and import |
| Sync | P2P pairing, presence, conflicts |

---

## Testing & CI

| Layer | Tool |
|-------|------|
| Unit | Vitest + v8 coverage |
| Component | @testing-library/react |
| E2E | Playwright |
| Lint | ESLint 9 + typescript-eslint + jsx-a11y |
| Type check | TypeScript 6 (`tsc --noEmit`) |

Quality gate: lint + typecheck + test + build (`scripts/quality_gate.sh`).
CI runs on push/PR via GitHub Actions.

---

## Key ADRs

| ADR | Title | Status |
|-----|-------|--------|
| 010 | Export Schema v1.0 | Implemented |
| 018 | Next.js Architecture Baseline | Implemented |
| 020 | Rich Text Editor Strategy | Accepted |
| 021 | Encrypted Export (WebCrypto) | Implemented |
| 022 | Client-Side Retrieval Engine | Implemented |
| 023 | Editor Draft Persistence | Implemented |
| 025 | AI Provider Consolidation | Accepted |
| 026 | P2P Sync Architecture | Accepted |
| 027 | Canonical State and Sync Bridge | Accepted |
| 028 | Validated Local Data Boundaries | Accepted |
| 029 | Manifest-Driven Agent Harness | Accepted |
