# Plan 223: CLI binary end-to-end, index status audit, build diagnostics (2026-11-27)

**Goal**: The three follow-ups offered after Plan 222: prove the published `dks`
binary behaves as the shell sees it, re-verify `plans/INDEX.md` against code, git
history and GitHub instead of trusting its prose, and let a broken MCP package
build report its own compiler error.

## Waves

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| 1 | Run the published `dks` binary against a bundle the app's exporter wrote | Done | `packages/dks-cli/src/cli-e2e.test.ts`: builds `dist/bin.js`, exports a two-concept bundle through `buildOkfBundle` (the same function the PWA export view calls), spawns the binary, and asserts the envelope, the exit codes and the export round trip |
| 2 | Audit INDEX rows against code, git history and GitHub | Done | Four stale records corrected, three package-relative paths qualified; the rows that were still true were left alone |
| 3 | Make a failed MCP build report tsc's own error | Done | The `beforeAll` compile is wrapped; the thrown error now carries tsc's stderr |

## Wave 1 — what the in-process suite cannot see

`cli.test.ts` calls `runCli` directly, so it never exercises `dist/bin.js`, the
process exit status, or stdout as the only JSON channel. Five cases run against
the built binary:

1. `index` lists both exported concepts;
2. `search graph` returns both entity hits;
3. `entity <id-printed-by-index>` round-trips name, tags, the claim with its
   source, and the exported relation back to the target id;
4. an unknown id exits **3** with a JSON failure envelope (`entity_not_found`)
   and its hint;
5. an unreadable bundle exits **5** with `io`.

The bundle is *generated*, not checked in: a hand-written fixture would prove
only that the CLI parses Markdown written for the test, and would drift from the
exporter without anything failing. A first draft of case 3 asserted the related
id ended in `/beta`; the exporter slugs concept paths (`concepts/beta-concept`),
so the assertion was wrong — not the product. It now compares against the id the
`index` command printed, which is what a user would copy.

## Wave 2 — audit method and findings

Method: extract every relative Markdown link and backticked path from
`plans/INDEX.md` and check it resolves; confirm cited SHAs with `git cat-file`;
confirm PR and issue states through `gh`.

| Record | Claim | Verified state | Action |
| --- | --- | --- | --- |
| Plan 178 row | "PR #1000 opened and held unmerged" | #1000 **MERGED** 2026-10-20 at `e5d6571` | corrected in INDEX and in Plan 178's status line |
| Plan 177 row | "verification and PR delivery tracked in Plan 178" | delivered by #992 (`887541c`, 2026-10-19) | moved to the completed table |
| Plan 191 row | "At-rest encryption is recorded as Proposed in ADR 048" | ADR 048 is **Accepted — implemented** (#1162, Plan 214) | corrected |
| Plan 131 rows | `lib/security.ts`, `ui/shared-primitives.tsx` | both exist under `src/` | qualified to full paths |
| Plan 222 row | `src/stdio-smoke.test.ts`, `dist/cli.js` | package-relative | qualified to `packages/dks-mcp/...` |

Rows verified and deliberately left unchanged:

- **Plan 214** — wave 11 security review is genuinely open: #1162 is still open.
- **Plan 169 / 178** — "optional Mind Map swipes", "double-tap/long-press",
  "NVDA/VoiceOver", "independent-origin canary" are still unbuilt: no `swipe`,
  `longPress` or `NVDA` reference exists in `src/`, and no canary spec exists in
  `e2e/`.
- **Plan 194** — "#1050–#1065 closed" holds: the only open issues are #1162 and
  #1171.
- **Plan 213** — `graph-elements.tsx` lives at
  `src/components/studio/views/graph-elements.tsx`; the bare filename matches the
  INDEX's usual style and is not ambiguous.
- **Plan 192** — the `public/sw.js` harness claim holds
  (`src/lib/studio/pwa-service-worker.test.ts`).

Cited SHAs checked as present: `a395626`, `29c3b5f`, `5353cfce`, `90dae7f6`.

## Wave 3 — diagnostics

`stdio: 'pipe'` on the MCP package build threw away tsc's report, so a type error
surfaced as a bare "Command failed". The error now carries the compiler's stderr.

## Checks run

- `pnpm --filter dks-cli test` (200 tests) and `pnpm --filter dks-mcp test`
  (22 tests).
- Package typechecks, `pnpm run lint`, `pnpm run docs:check`, markdownlint on
  every changed Markdown file.
