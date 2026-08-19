# GOAP Improvement Plan — do-knowledge-studio (Next.js redesign)

**Orchestrator**: `goap-agent` skill
**Strategy**: Swarm analysis (parallel multi-perspective investigation) → GOAP decomposition
**Date**: 2026-08-18
**Baseline verified**:
- `pnpm run typecheck` → passes
- `pnpm run lint` → 78 warnings, all from `.agents/skills/impeccable/scripts/modern-screenshot.umd.js` (a vendored minified bundle being linted)
- `pnpm test` → "passes" only because `vitest.config.ts` sets `passWithNoTests: true`; there are **0 test files**
- Working tree clean, branch `main`

---

## 1. Task Analysis

**Primary goal**: Identify the highest-leverage improvements to the redesigned
Next.js knowledge studio and lay out a dependency-ordered, agent-assignable plan.

**Constraints**:
- Local-first only; no required backend (AGENTS.md hard rule).
- Strict TypeScript, no `any`, ≤500 LOC/source file (AGENTS.md).
- `eslint.config.mjs` is protected — any change requires explicit user approval.
- Do not rewrite history or use destructive git commands.

**Complexity**: Complex. Cross-cutting findings span build integrity, security,
product functionality, performance, quality, and documentation.

**Reality check discovered during analysis**: the repository contains two
generations of the product. The **documentation** (`AGENTS.md`, `plans/`,
`agents-docs/`, `.env.example`, `vite.config.ts`, CI comments) describes a
Vite + SQLite-WASM + Orama + CLI + export-engine app. The **actual code**
(`src/`, `package.json`) is a Next.js 16 + Zustand + localStorage redesign with
mock/seed data. This divergence is itself a P0 finding.

---

## 2. Swarm Investigation (synthesized)

Six perspectives were investigated in parallel against the same codebase. The
synthesis below is the merged output.

### 2.1 Integrity / build engineer

- **Broken quality gate (P0).** `scripts/quality_gate.sh` unconditionally calls
  `./scripts/agent-surface.py validate` and (unless `SKIP_GLOBAL_HOOKS_CHECK`
  is set) `./scripts/validate-git-hooks.sh`. **Neither file exists.** The
  required pre-commit/CI gate therefore fails before doing anything.
- **`next.config.ts` disables build type-safety.** `typescript.ignoreBuildErrors:
  true` and `reactStrictMode: false`. `next build` will silently ship type
  errors, and StrictMode double-render checks are off. Contradicts the project's
  strict-TypeScript ethos.
- **Package-manager ambiguity.** `package.json` declares `pnpm@10.30.3`,
  `pnpm-lock.yaml` and CI use pnpm, but `bun.lock` also exists and `README.md`
  says `bun install` / `bun run dev`. Two lockfiles → drift and confused agents.
- **Dead Prisma scaffold.** `src/lib/db.ts` imports `@prisma/client` but nothing
  imports `db.ts` (verified by search). `prisma/schema.prisma` is the default
  Next starter `User`/`Post` schema, unrelated to entities/claims. `postinstall:
  prisma generate` + four `db:*` scripts are dead weight with no data layer.
- **Stale Vite artifacts.** `vite.config.ts` references `sigma`, `graphology`,
  `mind-elixir`, `@tiptap`, `@sqlite.org/sqlite-wasm`, `@orama` — none are
  dependencies anymore. Root `index.html` is a leftover Vite entry.
  `.env.example` is Vite-era (`VITE_*`, references `src/features/ai/`,
  `src/lib/resolver.ts`, which no longer exist).
- **Stale `vitest.config.ts`.** Exclusions reference nonexistent paths
  (`src/db/client.ts`, `src/db/db-worker.ts`, `cli/commands/**`,
  `src/features/export/pdf-documents.tsx`, `src/features/export/pdf-styles.ts`).
  Coverage thresholds (lines: 57) are unreachable with zero tests.
- **Committed build artifacts.** `tsconfig.tsbuildinfo` (≈325 KB), `.next/`,
  `dist/` present in the working tree.

### 2.2 Security auditor

- **Stored XSS via import → HTML export (P0 for export path).**
  `export-view.tsx#buildHtmlExport` interpolates `e.type` and `c.verification`
  **unescaped** into the HTML. `parseImportFile` only checks those fields are
  `string`; it does not constrain them to the `EntityType` /
  `VerificationStatus` enums. A crafted JSON import can set `type` or
  `verification` to `<img src=x onerror=…>` and it executes when the exported
  `.html` is opened. `escapeHtml()` is applied to name/description/content/tags/
  statement but **not** to `type` or `verification`.
- **"Encrypted HTML" is not encryption.** `xorCipher` + base64 is demo-grade
  obfuscation (the code says so). The UI frames it as "Secure" and "safe to
  email". False-security labeling. Recommend WebCrypto AES-GCM + PBKDF2, or drop
  the "encrypted/secure" framing entirely.
- **API-key copy is misleading.** The AI Harness says the key is "Stored locally
  only", but it is never stored or used anywhere (no request is ever made).
- **Latent Markdown XSS.** Entity `content` is stored raw; there is currently no
  markdown rendering, so no sink exists yet — but adding a renderer without
  sanitization (DOMPurify) will introduce one.

### 2.3 Product / feature auditor

The redesign is a **polished demo shell, not a functioning knowledge studio**.
The following user-facing features are stubs:

- **AI Harness (`ai-harness-view.tsx`)** — `handleSend` returns a hardcoded
  "(Demo response.)" after a 700 ms `setTimeout`. Provider/model selects, the
  "Connect Local Database" button, and the "1/15 req/min" status are cosmetic.
  No LLM call, no RAG, no persisted settings.
- **Chat (`store.ts#sendMessage`)** — naive word-overlap scoring + a canned
  reply. The "Local search active" badge is hardcoded. Not real search, not an
  LLM. No `clearChat` action (the Chat "Clear" button is dead).
- **TRIZ (`triz-view.tsx`)** — `suggestedPrinciples` is a deterministic hash
  `(improving*7 + worsening*13) % list.length`, **not** the real 39×39
  contradiction matrix. Only 14 of 40 principles exist. The `matrix` view state
  is never rendered. Results are arbitrary.
- **Editor (`editor-view.tsx`)** — every toolbar button (bold/italic/headings/
  lists/quote/code/link/undo/redo) is a `toast.info("… would apply formatting")`.
  "AI Extract" is a toast. Content is a plain `<textarea>`; no markdown
  rendering or preview despite the "rich text" pitch.
- **Graph (`graph-view.tsx`)** — Undo/Redo/Snapshot/Export-PNG are toasts; the
  "force" layout is seed/random positions, not a force simulation; the zoom
  button is inert; no drag interactions.
- **Mind Map (`mindmap-view.tsx`)** — Add/Rename/Delete/Undo/Redo/Sync/Export
  are toasts; the displayed `Tab`/`F2`/`Del` shortcuts are not implemented; the
  `compact` toggle is unused in rendering.
- **Export (`export-view.tsx`)** — PDF and DOCX are "coming soon" toasts.
- **Editor data loss** — unsaved edits are silently lost when navigating
  (no beforeunload/confirm guard); `isDirty` ignores `sourceUrl`, `tags`, and
  `links`.

### 2.4 Performance optimizer

- **Suspected unused dependencies** (confirm with `pnpm dlx depcheck`):
  `@mdxeditor/editor`, `@tanstack/react-table`, `recharts`,
  `react-syntax-highlighter`, `react-day-picker`, `next-intl`, `input-otp`,
  `react-hook-form`, `@hookform/resolvers`, `zod`, `uuid`, `z-ai-web-dev-sdk`,
  `@dnd-kit/*`, `next-auth` (no auth implemented), `date-fns`,
  `embla-carousel-react`, `react-resizable-panels`, `react-markdown`, `vaul`,
  plus multiple vendored-but-unused shadcn primitives.
- **Unmanaged timers** — `store.ts#sendMessage` and `ai-harness-view.tsx#handleSend`
  use `setTimeout` without cleanup (post-unmount `setState` risk).
- **Non-deterministic graph layout** — `graph-view.tsx` uses `Math.random()` for
  missing seed positions, so nodes jump on any entity change.
- **Unmemoized selectors** — `useFilteredEntities()`/`useStats()` re-filter and
  re-sort on every render; components subscribe to the whole store (no
  selector-based subscriptions), so any state change re-renders broadly.

### 2.5 Code quality / architecture reviewer

- **Over-500-LOC files** (violates AGENTS.md): `export-view.tsx` (712),
  `editor-view.tsx` (581), `mobile-drawer.tsx` (447).
- **Mixed-responsibility store** — `store.ts` bundles navigation, domain state,
  chat/RAG simulation, import/reset, and selectors.
- **Two sources of graph truth** — `seed-data.ts` holds both `entities[].links`
  and a parallel `seedGraph` (nodes + edges); graph edges are re-derived from
  entity links but positions come from `seedGraph`.
- **`as unknown as` casts** — `store.ts#migrate`, `db.ts` global caching. The
  persist `version: 1` has no real migration logic.
- **Lint rules disabled** — `eslint.config.mjs` turns off the exact rules
  AGENTS.md says to enforce (`no-explicit-any`, `no-unused-vars`,
  `react-hooks/exhaustive-deps`, etc.). *Protected file — needs approval to
  touch.*
- **Magic numbers** — stopword list inline in `store.ts`, 700 ms delays,
  `*7/+13` hash, `Math.random()*600+100`.
- **No error boundaries**; `src/app/api/route.ts` is a "Hello, world!" stub.

### 2.6 Documentation auditor

- **`AGENTS.md` describes the wrong app.** It mandates SQLite WASM + OPFS +
  FTS5 + Orama, `src/features`, `src/db`, `cli/`, `export/`, `tests/`,
  `src/styles/tokens.css`, emerald accent, `data-theme`, Inter font, and 44 px
  targets — none of which match the actual Next.js/saffron/`.dark`/Newsreader
  codebase.
- **Referenced scripts are missing**: `minimal_quality_gate.sh`,
  `setup-skills.sh`, `self-fix-loop.sh`, `verify.sh`, `docs-sync.sh`,
  `validate-git-hooks.sh`, `agent-surface.py`. Dev scripts `test:coverage`,
  `test:e2e`, `test:e2e:ci`, `cli`, `preview`, `design:validate` don't exist in
  `package.json`.
- **`README.md` vs `package.json`** disagree on the package manager (bun vs
  pnpm).
- **Legacy planning artifacts** (`plans/GOAP.md`, `plans/GOAP_SWARM_IMPLEMENTATION.md`,
  most `analysis/*`) describe the pre-redesign Vite/SQLite architecture and are
  now misleading to future agents.

---

## 3. GOAP Goal Hierarchy

```
G0-INTEGRITY (P0) ─┬─→ G0-SECURITY (P0) ──→ G1-PRODUCT (P1) ──→ G2-QUALITY (P2)
                   └─→ G1-DOCS (P1)
```

| ID | Goal | Priority | Est. effort |
|----|------|----------|-------------|
| G0-INTEGRITY | Build, CI, and quality gate actually work and match reality | **P0** | 4–6h |
| G0-SECURITY | Export/import path has no XSS; no false-security labels | **P0** | 3–4h |
| G1-PRODUCT | Remove demo stubs; wire real local-first behavior | **P1** | 20–30h |
| G1-DOCS | Docs/scripts/CI describe the actual Next.js app | **P1** | 4–6h |
| G2-QUALITY | Tests, coverage, lint hygiene, file-size, deps | **P2** | 12–20h |

---

## 4. Actions

### G0-INTEGRITY — make the repo build/verify honestly

| # | Action | Agent | Effort |
|---|--------|-------|--------|
| I1 | Fix `scripts/quality_gate.sh` to stop calling `validate-git-hooks.sh` and `agent-surface.py`, or restore those files | debugger | 1h |
| I2 | Remove `typescript.ignoreBuildErrors` and re-enable `reactStrictMode` in `next.config.ts`; fix surfaced errors | debugger | 1–2h |
| I3 | Pick one package manager (pnpm per AGENTS.md/CI); delete `bun.lock`; align `README.md` | refactorer | 0.5h |
| I4 | Remove dead Prisma layer (`src/lib/db.ts`, `prisma/schema.prisma`, `db:*` scripts, `@prisma/client`+`prisma` deps, `postinstall`) unless a real data layer is planned | refactorer | 1h |
| I5 | Delete stale Vite artifacts (`vite.config.ts`, root `index.html`) and rewrite `.env.example` for the Next.js app | refactorer | 0.5h |
| I6 | Fix `vitest.config.ts` exclusions/thresholds to reference only existing paths; remove `passWithNoTests: true` once tests exist (see G2) | test-runner | 0.5h |
| I7 | Add `tsconfig.tsbuildinfo`, `.next/`, `dist/`, `dev.log` to `.gitignore` (if not already) | refactorer | 0.5h |

**Gate I**: `pnpm run lint && pnpm run typecheck && pnpm run build` pass with no
silently-ignored errors; `./scripts/quality_gate.sh` runs end-to-end.

### G0-SECURITY — close the export/import XSS and honest encryption

| # | Action | Agent | Effort |
|---|--------|-------|--------|
| S1 | Escape `e.type` and `c.verification` in `buildHtmlExport` (and any other unescaped interpolations) | security-auditor | 0.5h |
| S2 | Tighten `parseImportFile` to validate against `EntityType`/`VerificationStatus` enums, array shapes (`tags`, `links`), and `confidence` range; reject or coerce invalid fields | security-auditor | 1h |
| S3 | Replace XOR "encryption" with WebCrypto AES-GCM + PBKDF2, or remove the "Secure"/"Encrypted" framing if not shipped | security-auditor | 2h |
| S4 | Sanitize Markdown with DOMPurify before any future rendering; store the sanitizer config once | security-auditor | 1h |
| S5 | Add tests: XSS import payload must not execute in HTML export; wrong password fails decryption | test-runner | 1h |

**Gate S**: `pnpm test` passes for the new security cases; HTML export escapes all
user-controlled fields.

### G1-PRODUCT — replace stubs with real local-first behavior

Prioritize the features that are currently advertised but non-functional:

| # | Action | Agent | Effort |
|---|--------|-------|--------|
| P1 | Wire the Editor toolbar to real markdown operations (bold/italic/headings/lists/quote/code/link) over the textarea, plus a sanitized Markdown preview | feature-implementer | 4h |
| P2 | Implement undo/redo for the editor (per-entity history) | feature-implementer | 2h |
| P3 | Add unsaved-changes guard (beforeunload + route/view-change confirm); include `tags`/`sourceUrl` in `isDirty` | feature-implementer | 1h |
| P4 | Replace the TRIZ pseudo-hash with the real 39×39 contradiction matrix data (or clearly label the view "experimental heuristic") | feature-implementer | 3h |
| P5 | Replace chat word-overlap with real in-browser search over entities/claims (and connect the AI Harness to a real provider via an API route or client SDK, keeping keys out of the bundle) | feature-implementer | 4–6h |
| P6 | Implement real graph interactions: drag nodes, zoom, and a PNG export (e.g., serialize the SVG to canvas) | feature-implementer | 3h |
| P7 | Implement mind-map node CRUD (add/rename/delete) and the advertised `Tab`/`F2`/`Del` shortcuts | feature-implementer | 3h |
| P8 | Implement PDF and DOCX export (or remove the buttons until shipped) | feature-implementer | 3–4h |
| P9 | Implement Chat "Clear" action and a store `clearChat` | feature-implementer | 0.5h |

**Gate P**: Each advertised interaction either works or is removed/relabeled; no
`toast.info("… coming soon")` stubs remain in shipped views.

### G1-DOCS — make docs describe reality

| # | Action | Agent | Effort |
|---|--------|-------|--------|
| D1 | Rewrite `AGENTS.md` Repository Shape, Hard Rules, dev commands, and UI guardrails to match Next.js 16 + Zustand + `src/app/globals.css` + saffron tokens (keep the hard rules that still apply) | docs-writer | 2h |
| D2 | Reconcile `README.md`/`CONTRIBUTING.md` package-manager and script references | docs-writer | 1h |
| D3 | Add an ADR documenting the Vite→Next.js migration and the mock-data state, so future agents aren't misled by legacy `plans/`/`analysis/` | docs-writer | 1h |
| D4 | Restore or remove references to missing scripts; keep only scripts that exist | docs-writer | 0.5h |

**Gate D**: A fresh agent reading `AGENTS.md` + `README.md` can build and
navigate the code without encountering the Vite/SQLite architecture.

### G2-QUALITY — tests, coverage, lint, size

| # | Action | Agent | Effort |
|---|--------|-------|--------|
| Q1 | Add Vitest tests for the store (entity CRUD, claim creation, import/export validation, chat scoring) | test-runner | 4h |
| Q2 | Add component tests for editor save/validation and library filtering/sorting | test-runner | 3h |
| Q3 | Split `export-view.tsx`, `editor-view.tsx`, `mobile-drawer.tsx` below 500 LOC | refactorer | 4h |
| Q4 | Extract chat/RAG and selectors out of `store.ts`; add selector-based subscriptions | refactorer | 3h |
| Q5 | Remove unused dependencies (after `depcheck`) | refactorer | 1h |
| Q6 | Re-enable the disabled eslint rules **with user approval**, and fix findings | code-reviewer | 3h |
| Q7 | Add error boundaries around each view | feature-implementer | 1h |

**Gate Q**: `pnpm run test:coverage` reports real coverage; no source file
exceeds 500 LOC; lint is clean (vendored `.agents/` assets ignored).

---

## 5. Dependency Graph

```
G0-INTEGRITY ──┬─→ G0-SECURITY ──→ G1-PRODUCT ──→ G2-QUALITY
               └─→ G1-DOCS (independent, can run in parallel)
```

- G0-INTEGRITY first: nothing downstream can be validated while the quality gate
  is broken and the build ignores type errors.
- G0-SECURITY and G1-DOCS can run in parallel after G0-INTEGRITY.
- G1-PRODUCT unblocks only after security fixes (markdown rendering needs the
  sanitizer from S4).
- G2-QUALITY (splits + tests) is safest after the product surface stabilizes.

---

## 6. Execution Strategy (waves)

| Wave | Goals | Strategy | Estimated |
|------|-------|----------|-----------|
| 1 | G0-INTEGRITY | Parallel swarm (I1–I7 are mostly independent files) | 1–2 days |
| 2 | G0-SECURITY + G1-DOCS | Parallel (different file sets) | 1–2 days |
| 3 | G1-PRODUCT | Hybrid: P1→P2→P3 sequential (editor), P4/P6/P7/P8 parallel | 1–2 weeks |
| 4 | G2-QUALITY | Hybrid: Q3/Q4 first (so tests have stable modules), then Q1/Q2 parallel | 1 week |

**Total estimated effort**: ~45–70 hours.

---

## 7. Risks

| Risk | Mitigation |
|------|-----------|
| Removing Prisma/dead deps breaks something hidden | Grep before removal; only remove the confirmed-unused `db.ts` + starter schema |
| Re-enabling `ignoreBuildErrors` surfaces many errors | Land in the G0-INTEGRITY wave when capacity exists to fix them |
| Real TRIZ matrix data is large | Ship as a generated static JSON module, not hand-edited |
| LLM wiring reintroduces a backend | Keep keys client-side or behind a Next.js route handler that proxies — no required server for local-first use |
| eslint re-enable is blocked by the protected-file rule | Ask the user before editing `eslint.config.mjs` (AGENTS.md requirement) |

---

## 8. Success Criteria

- [ ] `./scripts/quality_gate.sh` runs end-to-end without referencing missing files.
- [ ] `next build` no longer silently ignores TypeScript errors; `reactStrictMode` on.
- [ ] One package manager + one lockfile; docs agree.
- [ ] No dead Prisma/Vite scaffolding; `.env.example` matches the Next.js app.
- [ ] Import → HTML export is XSS-safe (type/verification escaped and validated).
- [ ] "Encrypted" export uses real encryption or drops the security claim.
- [ ] No user-facing "coming soon"/"would apply formatting"/"Demo response" stubs in shipped views.
- [ ] `AGENTS.md`, `README.md`, and CI describe the actual Next.js architecture.
- [ ] Real Vitest coverage exists; no source file > 500 LOC; lint clean (vendored assets ignored).

---

## 9. Immediate next actions (this turn's recommendations)

1. **G0-INTEGRITY** is the unblock: fix `quality_gate.sh`, `next.config.ts`, the
   lockfile split, and the dead Prisma/Vite scaffolding first.
2. **G0-SECURITY** has the only actual vulnerability found: the import→export
   XSS (`S1`+`S2`), which is small and can be fixed immediately.
3. **Decision needed from user**: whether the AI Harness / real chat / real TRIZ
   (G1-PRODUCT P4/P5) should be wired to a real LLM provider now, or kept
   local-only/demo for the MVP.
