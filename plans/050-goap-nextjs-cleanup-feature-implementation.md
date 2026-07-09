# GOAP Swarm: Next.js Cleanup & Feature Implementation

**Created**: 2026-07-09
**Supersedes**: Plans 048 (audit) and 049 (feature plan) — this plan incorporates both
**Scope**: Wave 0 + Wave 1 as primary PR; Wave 2 as stretch within session
**Branch strategy**: Single branch `feat/nextjs-cleanup-and-features`, single PR to `main`

---

## 1. Verified Current State

| Area | Reality |
|------|---------|
| Structure | No `src/features/` or `src/db/` — actual layout: `src/components/studio/views/`, `src/lib/studio/` |
| Tests | ZERO test files under `src/`; vitest `passWithNoTests: true` masks this |
| AI Harness | `ai-harness-view.tsx:66-77` — hardcoded "(Demo response.)" with `setTimeout(700)`, no network call |
| API Key | `ai-harness-view.tsx:42` — `useState('')` only, lost on reload |
| Editor | `editor-view.tsx:283-289` — plain `<textarea>`, fake toolbar buttons (`toast.info`) |
| Encrypted Export | `export-view.tsx:247-261` — XOR cipher + btoa, not real encryption |
| PDF/DOCX | `export-view.tsx:421-433` — `toast.info` stubs |
| Search | `store.ts:134-180` — word-overlap scoring in chat; `.includes()` in library filter |
| Zod | `zod` in deps but zero imports anywhere in `src/` |
| Stale artifacts | `dist/`, `coverage/`, `bun.lock`, `vite.config.ts`, `index.html`, `prisma/`, `src/lib/db.ts` |
| Config | `next.config.ts` ignoreBuildErrors: true; `eslint.config.mjs` 20+ rules off, missing ignores |
| AGENTS.md | Describes old Vite/SQLite stack, lists nonexistent commands/paths |
| Seed data | `seed-data.ts:119` references "Orama in-browser" and "SQLite FTS5" — neither exists |
| File sizes | `export-view.tsx` 712 LOC, `editor-view.tsx` 581 LOC (both over 500 limit) |

---

## 2. Task Dependency Graph

```
Wave 0 (Baseline — no feature dependencies)
├── T0.1: Remove stale artifacts (dist/, coverage/, bun.lock, vite.config.ts, index.html)
├── T0.2: Remove Prisma/next-auth (prisma/, src/lib/db.ts, postinstall, db:* scripts)
├── T0.3: Fix next.config.ts (remove ignoreBuildErrors)
├── T0.4: Fix eslint ignores (add dist/, coverage/, .agents/)
├── T0.5: Rewrite AGENTS.md (match actual Next.js structure)
├── T0.6: Fix seed-data.ts (remove Orama/SQLite FTS references)
├── T0.7: Add store unit tests (src/lib/studio/store.test.ts)
└── T0.8: Remove unused deps (next-auth, next-intl, @tanstack/react-query, z-ai-web-dev-sdk, @mdxeditor/editor, react-syntax-highlighter, prisma, bun-types, @vitejs/plugin-react, vite)

Wave 1 (Features — depends on Wave 0 for clean base)
├── T1.1: Create Zod schemas (src/lib/studio/schemas.ts)
│   └── depends on: T0.1 (clean base)
├── T1.2: Persist AI settings to localStorage (ai-settings store slice)
│   └── depends on: T1.1 (Zod for validation)
├── T1.3: Wire real AI provider calls (src/lib/ai/providers.ts)
│   └── depends on: T1.2 (persisted settings)
├── T1.4: Split export-view.tsx → export-view + export-formats + encrypted-export
│   └── depends on: T0.1 (clean base)
├── T1.5: WebCrypto AES-GCM encrypted export (src/lib/export/encrypt.ts)
│   └── depends on: T1.4 (split export view)
└── T1.6: Split editor-view.tsx → editor-view + editor-toolbar + claims-panel
    └── depends on: T0.1 (clean base)

Wave 2 (Stretch — depends on Wave 1)
├── T2.1: BM25 retrieval engine (src/lib/search/retrieval.ts)
│   └── depends on: T1.1 (Zod schemas for entity validation)
├── T2.2: Markdown rendering in editor (react-markdown preview pane)
│   └── depends on: T1.6 (split editor)
├── T2.3: PDF export via print-to-PDF (client-side)
│   └── depends on: T1.4 (split export view)
└── T2.4: Entity link editing in editor
    └── depends on: T1.6 (split editor)
```

### Parallelism Map

```
Wave 0 (all independent — run all in parallel):
  [T0.1] [T0.2] [T0.3] [T0.4] [T0.5] [T0.6] [T0.7] [T0.8]

Wave 1 (two parallel tracks):
  Track A: [T1.1] → [T1.2] → [T1.3]   (Zod → settings → providers)
  Track B: [T1.4] → [T1.5]             (split export → WebCrypto)
  Track C: [T1.6]                       (split editor)

Wave 2 (all independent after Wave 1):
  [T2.1] [T2.2] [T2.3] [T2.4]
```

---

## 3. Agent Assignments Per Wave

### Wave 0 Agents (8 parallel agents)

| Agent | Task | Prompt Summary |
|-------|------|----------------|
| **cleanup-agent** | T0.1 + T0.8 | Delete `dist/`, `coverage/`, `bun.lock`, `vite.config.ts`, `index.html`. Remove 10 unused deps from package.json. Run `pnpm install`. |
| **prisma-agent** | T0.2 | Delete `prisma/` dir, `src/lib/db.ts`. Remove `postinstall` script and all `db:*` scripts from package.json. Remove `prisma` from deps. |
| **config-agent** | T0.3 + T0.4 | Edit `next.config.ts` to remove `ignoreBuildErrors`. Edit `eslint.config.mjs` to add `dist/`, `coverage/`, `.agents/` to ignores. **Do NOT change any rules**. |
| **docs-agent** | T0.5 + T0.6 | Rewrite AGENTS.md to reflect actual Next.js 16/React 19/Tailwind/Zustand stack. Fix `seed-data.ts:119` to remove Orama/SQLite FTS reference. |
| **test-agent** | T0.7 | Create `src/lib/studio/store.test.ts` covering: entity CRUD, claim add, search filter, sort, reset. Use existing vitest setup. |

### Wave 1 Agents (5 parallel agents)

| Agent | Task | Prompt Summary |
|-------|------|----------------|
| **zod-agent** | T1.1 | Create `src/lib/studio/schemas.ts` with Zod schemas for Entity, Claim, ChatMessage, ExportPayload. Export inferred types. |
| **ai-settings-agent** | T1.2 | Add `aiSettings` slice to Zustand store: `{ provider, model, apiKey, augment }`. Persist via zustand/persist. Create `src/lib/ai/types.ts`. |
| **ai-provider-agent** | T1.3 | Create `src/lib/ai/providers.ts` with fetch-based OpenAI-compatible, Anthropic, Ollama adapters. Update `ai-harness-view.tsx` to use real calls. Update `store.ts` chat to use retrieval engine if augment is on. |
| **export-split-agent** | T1.4 + T1.5 | Split `export-view.tsx` into: `export-view.tsx` (~200 LOC shell), `export-formats.tsx` (builders), `encrypted-export.tsx` (password modal). Create `src/lib/export/encrypt.ts` with WebCrypto AES-GCM + PBKDF2. Replace XOR with real crypto. |
| **editor-split-agent** | T1.6 | Split `editor-view.tsx` into: `editor-view.tsx` (~250 LOC), `editor-toolbar.tsx` (toolbar + formatting), `claims-panel.tsx` (claims section). |

### Wave 2 Agents (4 parallel agents — stretch)

| Agent | Task | Prompt Summary |
|-------|------|----------------|
| **retrieval-agent** | T2.1 | Create `src/lib/search/retrieval.ts` — BM25/TF-IDF index over entities. Rebuild from store on change. Feed chat citations. Replace word-overlap in `store.ts:134-180`. |
| **markdown-agent** | T2.2 | Add `react-markdown` preview pane to editor. Split view: textarea on left, rendered markdown on right. |
| **pdf-agent** | T2.3 | Implement PDF export via `window.print()` with print-specific CSS. Replace `toast.info` stub. |
| **link-agent** | T2.4 | Add entity link editing UI in editor. Allow adding/removing links to other entities. |

---

## 4. Quality Gates Between Waves

### Gate 0→1: Baseline Validation

```bash
# Must ALL pass before Wave 1 begins
pnpm install                    # Clean install after dep removal
pnpm run lint                   # ESLint passes (with fixed ignores)
pnpm run typecheck              # TypeScript compiles (ignoreBuildErrors removed)
pnpm run test                   # Store tests pass
pnpm run build                  # Next.js build succeeds
```

**Exit criteria**: Zero lint errors, zero type errors, ≥3 store test cases passing, clean build.

### Gate 1→2: Feature Validation

```bash
pnpm run lint                   # No new lint errors
pnpm run typecheck              # No new type errors  
pnpm run test                   # All tests pass (store + new schema tests)
pnpm run build                  # Clean build
# Manual verification:
# - AI harness: settings persist across reload
# - Export: encrypted HTML opens with correct password, rejects wrong
# - Editor: split components render correctly
```

**Exit criteria**: All automated checks pass. Export-view and editor-view both under 500 LOC. No `any` types introduced.

### Gate 2→PR: Final Validation

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
# File size audit:
find src/components/studio -name '*.tsx' -exec wc -l {} + | sort -rn | head -5
# All must be ≤500 LOC (excluding shadcn/ui)
```

---

## 5. File-Level Change Specifications

### Wave 0

#### T0.1: Remove Stale Artifacts + T0.8: Remove Unused Deps

**Files to delete:**
- `dist/` (entire directory — stale build artifact)
- `coverage/` (entire directory — stale test coverage)
- `bun.lock` (conflicts with pnpm)
- `vite.config.ts` (stale Vite config)
- `index.html` (stale Vite entry point)

**Files to modify:**
- `package.json`:
  - Remove from `dependencies`: `next-auth`, `next-intl`, `@tanstack/react-query`, `z-ai-web-dev-sdk`, `@mdxeditor/editor`, `react-syntax-highlighter`, `prisma`
  - Remove from `devDependencies`: `bun-types`, `@vitejs/plugin-react`, `vite`
  - Remove `postinstall` script
  - Remove `db:push`, `db:generate`, `db:migrate`, `db:reset` scripts

**Verification**: `pnpm install && pnpm run build` succeeds.

#### T0.2: Remove Prisma/NextAuth

**Files to delete:**
- `prisma/schema.prisma`
- `prisma/` directory
- `src/lib/db.ts` (PrismaClient import, contradicts local-first)

**Files to modify:**
- `package.json` — remove `prisma` from deps, remove `postinstall`, remove `db:*` scripts (same as T0.8 — consolidated)

**Verification**: No imports of `prisma`, `@prisma/client`, or `next-auth` in `src/`.

#### T0.3: Fix next.config.ts

**Files to modify:**
- `next.config.ts`:
  ```ts
  import type { NextConfig } from "next";
  const nextConfig: NextConfig = {
    reactStrictMode: true,
  };
  export default nextConfig;
  ```
  Remove `typescript: { ignoreBuildErrors: true }`. Set `reactStrictMode: true`.

**Verification**: `pnpm run typecheck` passes with strict type checking.

#### T0.4: Fix eslint.config.mjs Ignores

**Files to modify:**
- `eslint.config.mjs`:
  - Add `dist/**`, `coverage/**`, `.agents/**` to the `ignores` array
  - Do NOT change any rule settings (AGENTS.md rule: no rule changes without approval)

**Verification**: `pnpm run lint` no longer reports errors from stale artifacts.

#### T0.5: Rewrite AGENTS.md

**Files to modify:**
- `AGENTS.md` — full rewrite reflecting:
  - Actual stack: Next.js 16, React 19, Tailwind 4, shadcn/ui, Zustand + localStorage
  - Actual repo shape: `src/app/`, `src/components/studio/`, `src/lib/studio/`, `src/hooks/`
  - Actual commands: `dev`, `build`, `lint`, `typecheck`, `test`
  - Remove references to nonexistent: `src/features/`, `src/db/`, `cli/`, `export/`, `test:e2e`, `test:coverage`, `preview`, `design:validate`
  - Keep hard rules: local-first, no `any`, max 500 LOC, conventional commits
  - Add note: eslint.config.mjs changes require approval

**Verification**: All paths and commands in AGENTS.md match actual repo.

#### T0.6: Fix seed-data.ts

**Files to modify:**
- `src/lib/studio/seed-data.ts:119` — change entity content from:
  > "The studio uses Orama in-browser for both, with SQLite FTS5 as the persistent layer."
  to:
  > "The studio uses an in-browser BM25/TF-IDF retrieval engine for full-text search."

**Verification**: No references to "Orama" or "SQLite FTS5" remain in `src/`.

#### T0.7: Add Store Unit Tests

**Files to create:**
- `src/lib/studio/store.test.ts` (~120 LOC)

**Test cases:**
1. Initial state loads seed data
2. `saveEntity` — creates new entity
3. `saveEntity` — updates existing entity
4. `deleteEntity` — removes entity and its claims
5. `addClaim` — adds claim to entity
6. `useFilteredEntities` — filters by search query
7. `useFilteredEntities` — filters by type
8. `useFilteredEntities` — sorts by name/date
9. `resetStore` — restores seed data
10. `sendMessage` — adds user message to chat

**Verification**: `pnpm run test` passes with ≥10 test cases.

---

### Wave 1

#### T1.1: Zod Schemas

**Files to create:**
- `src/lib/studio/schemas.ts` (~80 LOC)

**Schemas:**
```ts
import { z } from 'zod'

export const EntitySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(['note', 'concept', 'person', 'project']),
  description: z.string(),
  content: z.string(),
  sourceUrl: z.string().url().optional(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  links: z.array(z.object({
    targetId: z.string(),
    relation: z.string(),
  })),
})

export const ClaimSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  statement: z.string().min(1),
  evidence: z.string().optional(),
  confidence: z.number().min(0).max(1),
  verification: z.enum(['unverified', 'verified', 'disputed']),
  source: z.string().optional(),
})

export const ExportPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
})

export const AISettingsSchema = z.object({
  provider: z.string(),
  model: z.string(),
  apiKey: z.string(),
  augment: z.boolean(),
})

export type Entity = z.infer<typeof EntitySchema>
export type Claim = z.infer<typeof ClaimSchema>
```

**Note**: Keep existing `types.ts` as-is for now; schemas provide runtime validation. Types can be unified in a follow-up.

#### T1.2: Persist AI Settings

**Files to create:**
- `src/lib/ai/types.ts` (~20 LOC) — AIProvider interface, provider configs

**Files to modify:**
- `src/lib/studio/store.ts` — add `aiSettings` state + actions:
  ```ts
  aiSettings: { provider: 'openrouter', model: 'gemini-2.0-flash-lite', apiKey: '', augment: true }
  setAiSettings: (settings) => set({ aiSettings: settings })
  ```
  Add to `partialize` for persistence.

**Files to modify:**
- `src/components/studio/views/ai-harness-view.tsx` — replace `useState` for apiKey/provider/model with store's `aiSettings`. Remove local state for these fields.

#### T1.3: Wire Real AI Provider Calls

**Files to create:**
- `src/lib/ai/providers.ts` (~120 LOC)

**Provider adapters:**
```ts
interface ProviderAdapter {
  chat(params: { model: string; apiKey: string; messages: {role: string; content: string}[] }): Promise<string>
}

// OpenAI-compatible (OpenRouter, etc.)
async function openaiCompatibleChat(params): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
    }),
  })
  if (!res.ok) throw new Error(`Provider error: ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}

// Anthropic
async function anthropicChat(params): Promise<string> { /* Anthropic Messages API */ }

// Ollama (local)
async function ollamaChat(params): Promise<string> { /* http://localhost:11434/api/chat */ }
```

**Files to modify:**
- `src/components/studio/views/ai-harness-view.tsx` — replace `setTimeout` demo with real `provider.chat()` call. Show streaming or loading state. Handle errors gracefully.
- `src/lib/studio/store.ts` — replace word-overlap scoring in `sendMessage` with retrieval engine call (if T2.1 done) or keep as fallback.

#### T1.4 + T1.5: Split Export View + WebCrypto

**Files to create:**
- `src/lib/export/encrypt.ts` (~80 LOC) — WebCrypto AES-GCM + PBKDF2:
  ```ts
  async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey('raw',
      new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  }

  export async function encryptJson(json: string, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(password, salt)
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv },
      key, new TextEncoder().encode(json))
    // Pack salt + iv + ciphertext as base64
    const packed = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
    packed.set(salt, 0)
    packed.set(iv, salt.length)
    packed.set(new Uint8Array(encrypted), salt.length + iv.length)
    return btoa(String.fromCharCode(...packed))
  }

  export async function decryptJson(base64: string, password: string): Promise<string> {
    // Unpack, derive key, decrypt, return JSON string
  }
  ```
- `src/lib/export/encrypt.test.ts` (~60 LOC) — round-trip test + wrong-password rejection

**Files to create (split from export-view.tsx):**
- `src/components/studio/views/export-formats.tsx` (~100 LOC) — `buildJsonExport`, `buildMarkdownExport`, `buildHtmlExport`, `escapeHtml`, `todayStamp`, `downloadFile`
- `src/components/studio/views/encrypted-export-modal.tsx` (~120 LOC) — password modal + encrypted export logic using WebCrypto
- `src/components/studio/views/export-view.tsx` (~200 LOC) — shell that imports format cards + import section + encrypted modal

**Files to modify:**
- `src/components/studio/views/export-view.tsx` — remove all builder functions and XOR cipher, import from new modules

**Verification**: `export-view.tsx` ≤ 250 LOC. Encrypted export round-trips with WebCrypto.

#### T1.6: Split Editor View

**Files to create (split from editor-view.tsx):**
- `src/components/studio/views/editor-toolbar.tsx` (~80 LOC) — toolbar buttons, formatting actions
- `src/components/studio/views/claims-panel.tsx` (~180 LOC) — `ClaimsPanel` component + `VerificationBadge`
- `src/components/studio/views/editor-view.tsx` (~280 LOC) — shell with name/description/type/content fields, imports toolbar + claims

**Verification**: `editor-view.tsx` ≤ 300 LOC. All components render correctly.

---

### Wave 2 (Stretch)

#### T2.1: BM25 Retrieval Engine

**Files to create:**
- `src/lib/search/retrieval.ts` (~150 LOC) — BM25 scoring over entity name + description + tags + content
- `src/lib/search/retrieval.test.ts` (~80 LOC)

**Implementation:**
- Tokenize with simple whitespace + lowercase (no stemming needed for v1)
- IDF calculation over entity corpus
- BM25 scoring with k1=1.5, b=0.75
- Rebuild index from store entities on data change
- Export `searchEntities(query: string, entities: Entity[]): RankedResult[]`

**Files to modify:**
- `src/lib/studio/store.ts` — replace word-overlap in `sendMessage` with `searchEntities()` call
- `src/components/studio/command-palette.tsx` — replace `.includes()` with `searchEntities()`

#### T2.2: Markdown Rendering

**Files to modify:**
- `src/components/studio/views/editor-view.tsx` — add `react-markdown` preview pane (split view or toggle)

#### T2.3: PDF Export

**Files to modify:**
- `src/components/studio/views/export-view.tsx` — replace `toast.info` with `window.print()` + print CSS

#### T2.4: Entity Link Editing

**Files to modify:**
- `src/components/studio/views/editor-view.tsx` — add link management UI (add/remove entity links)

---

## 6. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Breaking build after dep removal** | P0 — blocks all waves | Run `pnpm install && pnpm run build` after every dep change. T0.1+T0.2+T0.8 must all complete before build verification. |
| **WebCrypto unavailable in test env** | P1 — tests fail | Use `vitest` with `jsdom` which provides `crypto.subtle`. If not, mock in test setup. |
| **ESLint config change breaks CI** | P1 — CI fails | Only add ignores, never change rules. Test locally with `pnpm run lint` before commit. |
| **Zustand store migration breaks persisted data** | P1 — users lose data | Use Zustand `migrate` with version bump. Default to seed data if migration fails. |
| **AI provider API errors in production** | P1 — bad UX | Wrap all fetch calls in try/catch. Show error toast with provider-specific message. Never log API keys. |
| **File splits introduce import cycles** | P2 — type errors | Verify with `pnpm run typecheck` after each split. Keep dependency direction: views → lib, never lib → views. |
| **Seed data entity IDs change** | P2 — broken links | Preserve existing seed entity IDs. Only update content text, not structure. |
| **Next.js build fails without ignoreBuildErrors** | P0 — reveals pre-existing type errors | Run `pnpm run typecheck` BEFORE removing ignoreBuildErrors. Fix any pre-existing errors first. |

### Pre-existing Type Error Strategy

Before removing `ignoreBuildErrors`, run typecheck to see how many errors exist. If >10:
1. Fix critical errors only (files we're modifying anyway)
2. Add targeted `// @ts-expect-error` for pre-existing issues we're not addressing in this PR
3. File follow-up issues for each suppressed error

If ≤10: fix all of them.

---

## 7. PR Strategy

### Single PR Approach

**Branch**: `feat/nextjs-cleanup-and-features`
**Target**: `main`
**Scope**: Wave 0 + Wave 1 (Wave 2 if completed)

### PR Description Template

```markdown
## Summary

- Remove stale artifacts (dist/, coverage/, bun.lock, vite.config.ts)
- Remove unused deps (Prisma, next-auth, 8 others)
- Fix build config (ignoreBuildErrors, eslint ignores)
- Add Zod validation schemas
- Persist AI settings to localStorage
- Wire real AI provider calls (OpenAI-compatible, Anthropic, Ollama)
- Replace XOR obfuscation with WebCrypto AES-GCM encrypted export
- Split oversized files (export-view 712→250, editor-view 581→280 LOC)
- Add store unit tests (10+ test cases)
- Rewrite AGENTS.md to match actual stack

## Breaking Changes

None. All changes are internal cleanup and feature improvements.

## Testing

- [x] `pnpm run lint` passes
- [x] `pnpm run typecheck` passes
- [x] `pnpm run test` passes (10+ store tests)
- [x] `pnpm run build` passes
- [x] Manual: AI harness settings persist across reload
- [x] Manual: Encrypted export round-trips with WebCrypto
- [x] Manual: Export view and editor view render correctly
```

### Commit Strategy

Use conventional commits per wave:

```
chore(wave0): remove stale artifacts and unused deps
fix(wave0): remove ignoreBuildErrors and fix eslint ignores
docs(wave0): rewrite AGENTS.md for Next.js stack
test(wave0): add store unit tests
feat(wave1): add Zod validation schemas
feat(wave1): persist AI settings to localStorage
feat(wave1): wire real AI provider calls
feat(wave1): replace XOR with WebCrypto AES-GCM encryption
refactor(wave1): split export-view.tsx into focused modules
refactor(wave1): split editor-view.tsx into focused modules
```

---

## 8. Session Execution Plan

### Parallel Agent Dispatch (Wave 0)

```
┌─────────────────────────────────────────────────┐
│ Wave 0 — 5 agents in parallel                    │
│                                                   │
│ Agent 1: cleanup-agent (T0.1 + T0.8)             │
│   → Delete dist/, coverage/, bun.lock, etc.       │
│   → Remove 10 unused deps from package.json       │
│   → Run pnpm install                              │
│                                                   │
│ Agent 2: prisma-agent (T0.2)                      │
│   → Delete prisma/, src/lib/db.ts                 │
│   → Remove postinstall, db:* scripts              │
│                                                   │
│ Agent 3: config-agent (T0.3 + T0.4)              │
│   → Fix next.config.ts                            │
│   → Add ignores to eslint.config.mjs              │
│                                                   │
│ Agent 4: docs-agent (T0.5 + T0.6)                │
│   → Rewrite AGENTS.md                             │
│   → Fix seed-data.ts Orama reference              │
│                                                   │
│ Agent 5: test-agent (T0.7)                        │
│   → Create store.test.ts                          │
└─────────────────────────────────────────────────┘
         │
         ▼ GATE 0→1: lint + typecheck + test + build
         │
┌─────────────────────────────────────────────────┐
│ Wave 1 — 5 agents in parallel                    │
│                                                   │
│ Agent 6: zod-agent (T1.1)                        │
│   → Create schemas.ts                             │
│                                                   │
│ Agent 7: ai-settings-agent (T1.2)                │
│   → Add aiSettings to store                       │
│   → Create ai/types.ts                            │
│   → Update ai-harness-view.tsx                    │
│                                                   │
│ Agent 8: ai-provider-agent (T1.3)                │
│   → Create providers.ts                           │
│   → Wire real fetch calls in ai-harness-view      │
│                                                   │
│ Agent 9: export-split-agent (T1.4 + T1.5)        │
│   → Create encrypt.ts + tests                     │
│   → Split export-view into 3 files                │
│   → Replace XOR with WebCrypto                    │
│                                                   │
│ Agent 10: editor-split-agent (T1.6)              │
│   → Split editor-view into 3 files                │
└─────────────────────────────────────────────────┘
         │
         ▼ GATE 1→2: lint + typecheck + test + build
         │
┌─────────────────────────────────────────────────┐
│ Wave 2 — 4 agents in parallel (stretch)          │
│                                                   │
│ Agent 11: retrieval-agent (T2.1)                  │
│ Agent 12: markdown-agent (T2.2)                   │
│ Agent 13: pdf-agent (T2.3)                        │
│ Agent 14: link-agent (T2.4)                       │
└─────────────────────────────────────────────────┘
         │
         ▼ GATE 2→PR: full validation + commit
```

### Estimated Effort

| Wave | Agents | LOC Changed | Time Estimate |
|------|--------|-------------|---------------|
| Wave 0 | 5 | ~200 (tests) + deletions | 15 min |
| Wave 1 | 5 | ~800 new + ~1200 modified | 30 min |
| Wave 2 | 4 | ~500 new + ~200 modified | 20 min |
| Quality gates | — | — | 10 min |
| **Total** | **14** | | **~75 min** |

---

## 9. Constraints Checklist

- [x] Branch from main, PR to main
- [x] All CI must pass (lint, typecheck, test, build)
- [x] No `any` types
- [x] Max 500 LOC per file
- [x] pnpm only (bun.lock removed)
- [x] eslint.config.mjs: only add ignores, no rule changes
- [x] Local-first only (no backend introduced)
- [x] Conventional commits
- [x] Design tokens from tokens.css (no hardcoded hex)
- [x] No manual GitHub releases
