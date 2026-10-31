# Architecture: do-knowledge-studio

> Local-first knowledge studio. No required backend. Browser-only persistence.
> All state lives in the client; sync and AI are opt-in extensions.

## Overview

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 / React 19 / Tailwind 4 / shadcn |
| State & Persistence | Zustand 5 + IndexedDB canonical corpus, localStorage metadata/recovery envelope (Zod-validated) |
| Sync (opt-in) | Yjs + y-webrtc (WebRTC P2P) |
| Deployment | Vercel (Node >= 22, pnpm) — `package.json` `engines.node: ">=22.0.0"` |

No SQLite, no OPFS, no required server. ADR 018 establishes the baseline;
ADR 028 defines validated persistence boundaries; ADR 046 moves the canonical
corpus to IndexedDB. Historical Vite/SQLite-era records remain in `plans/PHASES.md`
and are labelled historical, not current architecture.

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

- Canonical corpus: one validated Zustand envelope in IndexedDB
  (`dks-canonical`), written through an async adapter and structured clone.
- Small localStorage metadata envelope (`do-knowledge-studio-store-meta`):
  schema version, record counts, update timestamp. Recovery snapshots and
  quarantine copies are separate localStorage records.
- Legacy migration: read the old `do-knowledge-studio-store` envelope, write it
  to IndexedDB, read it back, verify equality, and only then remove the live
  legacy key. Any failure leaves the legacy copy untouched and uses it for the
  session. Future-version envelopes are never migrated eagerly; the store's
  refusal path decides first.
- Hydration: read envelope -> validate version -> apply migrations ->
  validate current schema -> atomic commit (ADR 028). Refused or unreadable
  payloads block writes for the page session, stay on disk, and are surfaced.
- All external boundaries (IndexedDB, legacy localStorage, import, backup,
  sync, AI responses) are Zod-parsed before mutation.
- Imports are atomic and fail-closed: complete valid candidate or structured
  error list. No silent record dropping.
- Pre-import snapshots enable atomic replacement with undo. Recovery snapshots
  are localStorage-backed, expire after 24 hours, and are not a durable backup.
- **Fail-closed hydration** (ADR 028, Plan 159): a page-scoped refusal status
  stops the persist writer, cross-tab traffic, and the Yjs/Sync gates for the
  rest of the page session; the refused payload is preserved under a key the
  store never writes and surfaced as a dismissible banner. The refusal status —
  not the presence of a quarantine record — is the single source of truth for
  "this workspace is temporary".
- **Backup** (Issue #1040): a `.dksb` archive with a versioned manifest,
  per-file SHA-256 hashes, optional PBKDF2/AES-256-GCM encryption, preview
  validation, and replace/merge restore through the atomic import action.

---

## AI Harness

Client-side, bring-your-own-key (ADR 019, ADR 025).

| Provider | Transport | Notes |
|----------|----------|-------|
| **OpenRouter** | OpenAI-compatible fetch | Single key, hundreds of models |
| **Ollama** | localhost fetch | CPU-only by default (`ollamaCpuOnly`), configurable URL |
| **Local (in-browser)** | transformers.js + ONNX Runtime WASM | CPU-first invariant default (ADR 040); WebGPU opt-in; runtime lazily imported on first local send, so it is never in the eager bundle |

- Prompt augmentation via BM25-retrieved local context (top-k), with a semantic
  mode available via the embedding-backed vector store.
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
- **Encryption** (ADR 045): y-webrtc derives an AES-256-GCM key from
  PBKDF2-HMAC-SHA256(password, room name, 100000 iterations) and encrypts
  signaling payloads and BroadcastChannel messages. WebRTC data channels use
  DTLS; the password does not add a second application-layer cipher there.
  Signaling still sees the room topic, timing, sizes, and peer IPs. A password
  is room membership, **not** peer identity. Invitations carry only the room id;
  rotate access by leaving and creating a new random room id.

---

## Search

Client-side retrieval with two modes, both fully offline-capable
(`src/lib/search/retrieval.ts`, ADR 022):

- **Lexical** — BM25/TF-IDF ranking over entities and claims.
- **Semantic** — embedding-backed vector store (`src/lib/search/vector-store.ts`)
  with bounded cooperative embedding batches, progress/cancellation, and an
  explicit fallback to the lexical path when the embedder is unavailable or the
  corpus exceeds the 64 MiB index budget.
- Indexes entity names, descriptions, content, tags, claim statements.
- Incremental: a document fingerprint identifies added/changed/deleted records;
  unchanged vectors are reused, deleted ids disappear immediately, and changed
  vectors commit only after every batch succeeds. A cancelled or failed build
  keeps the previous valid index.
- Derived vectors persist in IndexedDB (`dks-semantic-cache`) only with the
  model id, dtype/device/preprocessing fingerprint, dimensions, and SHA-256
  corpus digest; a mismatch deletes and rebuilds.
- Powers Library search and Chat citations. Fully offline.

---

## Export

| Format | Library | Notes |
|--------|---------|-------|
| JSON | Native | Versioned schema v1.0, Zod-validated, round-trip |
| Markdown | Custom | Frontmatter metadata + entity body |
| HTML | Custom | Self-contained static site |
| PDF | jspdf | Client-side generation |
| DOCX | docx | **Static import** inside the lazy Export subtree — `use-export-handlers.ts:11` → `export-documents.ts:2-11`. The Export *view* is lazy (`app-shell.tsx:34`); the DOCX/PDF builders it pulls in are not ([Plan 162](162-roadmap-progress-and-next-work-2026-10-05.md) #4) |
| Encrypted | WebCrypto AES-256-GCM | PBKDF2 derivation, self-contained HTML reader |
| OKF | Custom | Knowledge-bundle format, `ExportFormatId` member (`export-types.ts`, ADR 031) |
| Verified backup | WebCrypto + SHA-256 | `.dksb` JSON archive: versioned manifest, per-file checksums, optional PBKDF2/AES-256-GCM passphrase, previewed replace/merge restore (ADR 047) |

ADR 010 (schema), ADR 021 (encryption), ADR 012 (PDF), ADR 047 (backup).

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
| Home | Overview dashboard, metrics, recent activity |
| Editor | Entity/claim authoring |
| Library | Entity list, filtering, search |
| Graph | Interactive knowledge graph |
| Mind Map | Hierarchical organization |
| Timeline | Chronological entity/claim view |
| Chat | Retrieval-augmented synthesis |
| AI Harness | Provider config + augmented chat |
| TRIZ | Contradiction analysis |
| Export | Multi-format export, verified backup, import |
| Sync | P2P pairing, presence, conflicts |

---

## Testing & CI

| Layer | Tool |
|-------|------|
| Unit | Vitest + v8 coverage |
| Component | @testing-library/react |
| E2E | Playwright |
| Lint | ESLint 10 + typescript-eslint + jsx-a11y (`package.json` devDependencies) |
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
| 045 | Sync Threat Model and Room Membership | Implemented |
| 046 | IndexedDB Canonical Persistence | Implemented |
| 047 | Verifiable Backup Archive | Implemented |
