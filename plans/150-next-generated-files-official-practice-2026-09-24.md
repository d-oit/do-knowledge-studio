# Plan 150 — Next.js Generated Files: Official Practice for the Agent Block and `next-env.d.ts` (2026-09-24)

**Type**: tooling hygiene (vendor-documented), no product change
**Scope**: `AGENTS.md`, `.gitignore`, `package.json` (`typecheck`), `next-env.d.ts` (untracked)
**Source**: Next.js 16.3 documentation, verified against the installed package

## 1. Problem

Two tracked files churn on every development command, so the tree is dirty after
any `pnpm dev` or `pnpm build`:

| File | What happens | How often |
|---|---|---|
| `AGENTS.md` | `next dev` appends its managed agent-rules block when it detects an agent and none is present | every `next dev` start |
| `next-env.d.ts` | import path flips between `.next/dev/types/…` (dev) and `.next/types/…` (build) | every regenerating command |

Both are files Next.js owns, so the question is what Next.js actually recommends —
not what looks tidy.

## 2. What the official docs say

### Agent rules block — commit it

[`nextjs.org/docs/app/guides/ai-agents`](https://nextjs.org/docs/app/guides/ai-agents):

> On Next.js 16.3 or later, run `next dev`. When an AI coding agent is detected in
> the environment and no managed block is present, Next.js auto-generates
> `AGENTS.md` and `CLAUDE.md` at the project root. Existing `AGENTS.md` or
> `CLAUDE.md` files are upserted, so content outside the managed block is
> preserved. … Add your own project-specific instructions outside the markers, and
> they're preserved when Next.js updates the managed block.

The block's own text states the recommendation: *"Removing it from a diff only
re-creates the uncommitted change; committing it with your work keeps the tree
clean."*

There is an opt-out — `agentRules: false` in `next.config.ts` — but the docs argue
against it: *"We believe leaving auto-generation on is a good default. Benchmark
results on nextjs.org/evals show agents do better when they read the bundled
docs."* This repository relies on agents reading version-matched guidance, so the
block stays.

### `next-env.d.ts` — gitignore it, generate it on demand

[`nextjs.org/docs/app/api-reference/config/typescript`](https://nextjs.org/docs/app/api-reference/config/typescript):

> `next-env.d.ts` is managed by Next.js. Its contents are an implementation detail
> and may change over time. Add it to `.gitignore`.

[`nextjs.org/docs/app/api-reference/cli/next`](https://nextjs.org/docs/app/api-reference/cli/next):

> Additionally, `next typegen` generates a `next-env.d.ts` file. We recommend
> adding `next-env.d.ts` to your `.gitignore` file. … To ensure `next-env.d.ts` is
> present before type-checking run `next typegen`.

The Next.js team confirmed the same in
[vercel/next.js#58877](https://github.com/vercel/next.js/issues/58877), including
this exact dev-vs-production flip: *"Because `next-env.d.ts` depends on the last
ran command, I added it to `.gitignore`. Doing so was impractical in the past
because `next typegen` did not exist."*

## 3. Change

1. **`AGENTS.md`** — the managed block is committed, byte-identical to what the
   generator writes. It was produced by calling Next's own `writeAgentFiles()`
   (the function `next dev` calls) rather than transcribed, so
   `hasCurrentAgentRules()` returns `true` and `next dev` skips the write
   entirely.
2. **`.gitignore`** — `next-env.d.ts` added, with the doc citation in a comment.
3. **`next-env.d.ts`** — untracked (`git rm --cached`); still generated on demand
   by `next dev`, `next build`, and `next typegen`.
4. **`package.json`** — `typecheck` becomes `next typegen && tsc --noEmit -p
   tsconfig.app.json`, per the CLI reference. It also keeps `.next/types` route
   types fresh for editors, which the root `tsconfig.json` includes.

Deliberately **not** changed: `agentRules: false` (docs recommend against), and the
`lint`/`test` scripts (neither needs the generated file — verified by deleting it
and running both).

## 4. Verification

| Check | Result |
|---|---|
| `hasCurrentAgentRules(repo)` before / after committing the block | `false` → `true` |
| `writeAgentFiles(repo)` | `{"agentsMd":"updated","claudeMd":"skipped"}` — then a re-run reports `unchanged` |
| `git status` after `next dev` writes nothing | clean (no `AGENTS.md`, no `next-env.d.ts`) |
| `git check-ignore -v next-env.d.ts` | `.gitignore:78` |
| `pnpm run typecheck` with the file deleted | regenerates via `next typegen` (0.95 s), tsc exit 0 |
| `pnpm run lint` with the file deleted | exit 0 (eslint does not need it) |
| `pnpm exec vitest run` type-tested files without the file | 146 passed, no type errors |
| **Fresh-checkout simulation** (`git worktree add`, shared `node_modules`, no `.next`, no `next-env.d.ts`) | `typecheck` ✓, `lint` ✓, `hasCurrentAgentRules` ✓, full gate ✓ |
| `./scripts/quality_gate.sh`, `pnpm run build` | ✓ green |

The fresh-checkout run is the one that matters for CI: the quality-gate job starts
from a clone with neither file present, and it now regenerates what it needs
instead of relying on a committed artifact.

## 5. Follow-ups

1. **Vercel** runs `next build`, which writes its own `next-env.d.ts` — no change
   needed, but the next production deploy is the confirmation (plans/098's
   staleness lesson applies: verify the deployed commit, not the PR).
2. **`semantic-search.spec.ts` load sensitivity** (plans/149 §6.1) — unchanged.
3. **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
4. **ESLint 10 workaround** (plans/140 §2) — blocked upstream.
