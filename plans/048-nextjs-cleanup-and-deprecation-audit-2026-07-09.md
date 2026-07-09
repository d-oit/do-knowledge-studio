# 048 — Next.js Migration Cleanup & Deprecation Audit (2026-07-09)

Recommendations-only audit. No source changes were made; this document records
findings and a prioritized action plan. Author task: verify the current layout
compiles (`pnpm run dev`), check `.md` docs for deprecated/old-architecture
guidance, and surface missing implementation / lint / build / config / test
gaps.

## Verification snapshot (what actually runs today)

| Check              | Command                | Result                                                        |
|--------------------|------------------------|---------------------------------------------------------------|
| Dev server         | `pnpm run dev`         | ✅ Ready in ~0.5s; `GET /` → **200**                          |
| Typecheck          | `pnpm run typecheck`   | ✅ Passes (`tsc --noEmit -p tsconfig.app.json`)              |
| Production build    | `pnpm run build`       | ✅ Compiles in ~11s; routes `/`, `/_not-found`, `/api`       |
| Unit tests         | `pnpm run test`        | ⚠️ **No test files found** — passes vacuously (exit 0)        |
| Lint               | `pnpm run lint`        | ❌ **8399 problems (92 errors, 8307 warnings)** — see below   |

The app compiles and runs. The failures/gaps are almost entirely **stale
artifacts and drift** from the previous Vite + SQLite-WASM architecture, not the
live Next.js code.

## Root cause: architecture drift (Vite/SQLite-WASM → Next.js)

Commit `4303290 feat: complete UI/UX redesign — Next.js 'Editorial Paper &
Saffron'` replaced the original Vite + React SPA (SQLite WASM + OPFS + Orama)
with a **Next.js 16 / React 19** app. The new app is a single-shell SPA
(`src/app/page.tsx` → `AppShell`) with **Zustand + `localStorage` persistence**
(`src/lib/studio/store.ts`) and seed data. It has **no backend and no SQLite**.

Most issues below are leftovers that were never removed after that migration.

---

## Findings & recommendations

### P0 — Correctness / trust-eroding

**1. `next.config.ts` hides type errors during build**
- `typescript.ignoreBuildErrors: true` masks real type regressions. Typecheck
  currently passes, so this flag provides no benefit and only hides future bugs.
- **Recommendation:** remove `ignoreBuildErrors` (and add an `eslint` block only
  if needed). Keep `pnpm run typecheck` in the quality gate regardless.

**2. Lint is red purely from stale/generated files**
- All 92 errors (`@typescript-eslint/no-this-alias`) and the 8k warnings come
  from minified files in `dist/`, `coverage/`, and
  `.agents/skills/**/*.umd.js` — none of which are source.
- `eslint.config.mjs` `ignores` only lists
  `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`, `examples`, `skills`.
  It does **not** ignore `dist/`, `coverage/`, `test-results/`,
  `playwright-report/`, `.agents/`.
- **Recommendation (config change — requires approval per AGENTS.md):** add
  `dist/**`, `coverage/**`, `test-results/**`, `playwright-report/**`,
  `.agents/**` to eslint `ignores`. Better: **delete the stale `dist/` build
  entirely** (see #6) so lint reflects real source only. After that, `pnpm run
  lint` should be clean or near-clean.

**3. Tests do not cover the new app at all**
- `pnpm run test` reports "No test files found." There are zero `.test.`/`.spec.`
  files under `src/`. `src/test/setup.ts` exists but is unused. CI's "Unit Tests"
  job (`pnpm test`) passes vacuously, giving false confidence.
- **Recommendation:** add Vitest + React Testing Library coverage for the store
  (`src/lib/studio/store.ts`) first — it holds all CRUD, filter/sort, chat, and
  import/reset logic and is pure/deterministic. Then cover key views
  (library filter/sort, editor save, export). Wire `test:coverage` and re-enable
  the disabled CI coverage job (currently `if: false`).

### P1 — Documentation deprecation (the `.md` task)

**4. `AGENTS.md` describes the wrong stack and non-existent commands**
- Claims "Local-first only… SQLite WASM + OPFS is the primary storage layer…
  Vite," and its Repository Shape references `src/db`, `src/features`, `cli/`,
  `export/`, `tests/` — none of which match the current tree
  (`src/app`, `src/components/studio`, `src/lib/studio`, `prisma/`).
- Lists commands that **do not exist** in `package.json`: `pnpm run preview`,
  `pnpm run test:coverage`, `pnpm run test:e2e`, `pnpm run test:e2e:ci`,
  `pnpm run cli`, `pnpm run design:validate`, plus scripts like
  `minimal_quality_gate.sh`, `validate-skills.sh`.
- **Recommendation:** rewrite `AGENTS.md` to reflect Next.js 16 / React 19 /
  Tailwind 4 / shadcn / Zustand + localStorage. Fix Repository Shape, Setup,
  Development Commands, and Testing Expectations to match the real scripts
  (`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:*`). Decide whether
  Prisma is in or out (see #5) and document accordingly.

**5. Duplicate agent docs drift the same way**
- `CLAUDE.md`, `GEMINI.md`, `QWEN.md` mirror `AGENTS.md`. `README.md` is mostly
  accurate (correctly says "Next.js 16… no backend required") but still contains
  the Vite/SQLite origin story and a Tech-stack list that omits Prisma/next-auth
  it ships with.
- `src/lib/studio/seed-data.ts` contains a **factually wrong** in-app claim:
  "The studio uses Orama in-browser for both, with SQLite FTS5 as the persistent
  layer." Persistence is `localStorage`; there is no Orama or SQLite.
- **Recommendation:** collapse the four agent docs to a single source of truth
  (keep `AGENTS.md`, make the others thin pointers) to stop future drift. Fix or
  reword the seed-data string so shipped content isn't misleading.

### P1 — Dead dependencies & dead code

**6. Stale build artifacts and old-architecture files still in the repo**
- `dist/` (5.1M — old Vite output), `coverage/` (5.2M), plus root configs
  `vite.config.ts`, `vitest.config.ts` (referencing `tests/e2e`),
  `playwright.config.ts` from the removed SPA.
- **Recommendation:** delete `dist/` and `coverage/` and ensure both are in
  `.gitignore`. Remove `vite.config.ts` (the app is Next/Turbopack). Keep
  `vitest.config.ts`/`playwright.config.ts` only once tests are re-added, and
  update their `include`/`exclude` to the current `src/` layout.

**7. Dependencies with zero source usage (dead weight + install cost)**
Confirmed via `grep -rl … src` (0 matching files each):
- `next-auth` — 0 usages (contradicts "no backend required")
- `next-intl` — 0 usages
- `@tanstack/react-query` — 0 usages
- `z-ai-web-dev-sdk` — 0 usages
- `@mdxeditor/editor` — 0 usages (a full rich-text editor bundle)
- `react-syntax-highlighter` — 0 usages
- **Recommendation:** remove these from `package.json` unless a documented
  near-term feature needs them. This trims install size and the dependency
  attack surface. Re-run `pnpm run build` after removal to confirm.

**8. Prisma is wired but never imported (backend contradiction)**
- `src/lib/db.ts` instantiates `PrismaClient`, but nothing imports `@/lib/db`.
  `prisma/schema.prisma`, the `db:push/generate/migrate/reset` scripts, and the
  `postinstall: "prisma generate"` hook all exist for an unused layer.
  `postinstall` runs `prisma generate` on **every install** — slow and pointless
  if unused, and it conflicts with the local-first "no backend" positioning.
- **Recommendation:** decide the product direction:
  - If staying local-first: delete `src/lib/db.ts`, `prisma/`, the `db:*`
    scripts, the `postinstall` hook, and `prisma` + `@prisma/client` deps.
  - If a backend is planned: record it in a new `plans/ADRs/` entry (this
    reverses ADR `001-sqlite-wasm` and the "no required backend" hard rule) and
    actually wire `db.ts` into a route/handler.

### P2 — Config hygiene

**9. Multiple lockfiles → wrong Turbopack workspace root**
- Dev/build warn: Next inferred root from `/home/doit/pnpm-lock.yaml` because it
  detects both a parent lockfile and `bun.lock` + `pnpm-lock.yaml` in-repo.
- AGENTS.md mandates **pnpm only**, yet `bun.lock` (328 KB) is committed.
- **Recommendation:** delete `bun.lock`, add it to `.gitignore`, and set
  `turbopack: { root: __dirname }` (or `import.meta.dirname`) in `next.config.ts`
  to silence the warning and pin the root deterministically.

**10. CI reflects the same drift**
- `.github/workflows/ci-and-labels.yml`: the coverage job is disabled
  (`if: false  # no test:coverage script yet`); the unit-tests job runs
  `pnpm test` which passes with no tests. Quality gate calls
  `./scripts/quality_gate.sh --changed`.
- **Recommendation:** after #3, re-enable coverage and add a `build` +
  `typecheck` + `lint` gate that fails on real errors. Audit
  `scripts/quality_gate.sh` for references to removed `cli/`, `export/`,
  `design:validate`, and e2e scripts.

### P2 — Missing feature implementation

**11. Export view advertises unimplemented formats**
- `src/components/studio/views/export-view.tsx` shows `toast.info('PDF export
  coming soon')` and `'DOCX export coming soon'`. Markdown/JSON/encrypted paths
  appear implemented.
- **Recommendation:** either implement PDF/DOCX (client-side, to preserve
  local-first) or hide those options behind a feature flag / disabled state so
  the UI doesn't promise absent functionality. Track as a follow-up feature
  plan.

---

## Prioritized action plan

```diagram
╭──────────────────────────────────────────────────────────────╮
│ P0  (do first — restores trust in the pipeline)                │
│  • Remove next.config ignoreBuildErrors (#1)                   │
│  • Delete dist/ + coverage/; fix eslint ignores → green lint(#2,6)│
│  • Add store unit tests; re-enable coverage CI (#3)            │
├──────────────────────────────────────────────────────────────┤
│ P1  (stop the drift)                                          │
│  • Rewrite AGENTS.md for Next.js stack (#4)                    │
│  • Dedupe CLAUDE/GEMINI/QWEN; fix seed-data claim (#5)         │
│  • Remove 6 unused deps (#7)                                   │
│  • Resolve Prisma: delete or ADR + wire (#8)                   │
├──────────────────────────────────────────────────────────────┤
│ P2  (hygiene & features)                                      │
│  • Delete bun.lock; set turbopack.root (#9)                    │
│  • Align CI + quality_gate.sh (#10)                            │
│  • Implement or gate PDF/DOCX export (#11)                     │
╰──────────────────────────────────────────────────────────────╯
```

## Notes / constraints for the implementer

- Per AGENTS.md, **do not modify `eslint.config.mjs` or lint ignores without
  explicit approval** — items #1, #2 config edits must be confirmed first.
- Per AGENTS.md, **never create GitHub releases manually**; version changes go
  through `VERSION` + `version-propagation.yml`.
- If Prisma/backend is kept, add a new ADR (it supersedes
  `plans/ADRs/001-sqlite-wasm.md` and the "no required backend" hard rule).
- Verify each cleanup with `pnpm run build && pnpm run typecheck && pnpm run
  lint && pnpm run test` before committing.

## Deprecated-API scan result

No deprecated framework API usage was found in `src/` (no legacy `next/image`
config, no removed `i18n` key, no `next-intl` plugin, strict TS on). The
"deprecation" risk in this repo is **documentation and dependency drift**, not
runtime API deprecations — addressed by items #4–#8 above.
```
