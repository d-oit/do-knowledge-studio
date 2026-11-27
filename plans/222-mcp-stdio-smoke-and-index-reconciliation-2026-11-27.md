# Plan 222: MCP stdio smoke test, ADR register backfill, and at-rest WebKit evidence (2026-11-27)

**Goal**: Close the three follow-ups offered after PR #1201 without widening any
contract: prove the shipped `dks-mcp` binary speaks MCP on a real process, make
`plans/INDEX.md` true again, and replace the "WebKit is blocked" note with the CI
evidence that already exists.

## Waves

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| 1 | Prove the published `dks-mcp` entrypoint speaks MCP on a real child-process stdio | Done | New `packages/dks-mcp/src/stdio-smoke.test.ts` compiles the package, spawns `dist/cli.js`, and asserts the handshake, `tools/list`, a served search hit, and both fail-closed exits (missing argument → 2, unreadable bundle → 1) |
| 2 | Make `plans/INDEX.md` true again | Done | ADR register backfilled for 041–057 with the status each ADR records; plan 184 moved out of "In review" into the completed table at PR #1048 (`5353cfce`), all six issues closed |
| 3 | Replace the "WebKit is environment-blocked" note with CI evidence | Done | Nightly run 45813183285 (2026-11-26) executed both at-rest specs under the WebKit projects `mobile` and `tablet`, 8 instances each, all green. No CI change was needed; the local block is environmental only |

## Wave 1 — why an in-memory contract test was not enough

`src/contract.test.ts` drives the handlers through `InMemoryTransport`, so the
whole entrypoint is invisible to it: argv parsing, the process exit codes, and
the fact that `dist/cli.js` really speaks MCP on its own stdin/stdout. A
packager, shebang or transport regression would leave that suite green.

The smoke test closes that gap and stays honest about its cost: it compiles the
package once (incremental) rather than trusting a possibly stale `dist/`, then
talks to the real binary. It covers three cases:

- handshake + `tools/list` returns exactly the six read-only tools, and a
  `search` call returns the concept from the served bundle;
- no arguments exits 2 with the usage line;
- an unreadable bundle exits 1 with a `dks-mcp:` message and writes nothing to
  stdout (fail-closed, never a partial serve).

**Guard observed failing**: reverting `process.argv.slice(2)` to `slice(3)` in
`cli.ts` made the handshake case and the unreadable-bundle case fail (2 failed,
20 passed); restoring it returned 22/22 green.

One injected change did *not* fail the test on purpose: replacing
`await serveStdio(...)` with a fire-and-forget call still serves, because the
stdio transport keeps the event loop alive. That is recorded here so the test is
not credited with covering a behaviour it does not.

## Wave 2 — what was actually stale

- The "ADRs recorded since the 2026-07-25 reconciliation" table stopped at 040
  (plus 028 and 034), so every decision from ADR 041 through 057 — the storage,
  sync, backup, at-rest and MCP records the current code rests on — was absent.
- Plan 184 said "In review" although [PR #1048](https://github.com/d-oit/do-knowledge-studio/pull/1048)
  merged on 2026-10-31 at `5353cfce` and issues #1035, #1036, #1037, #1040,
  #1041 and #1042 are all closed.

Both were corrected in `plans/INDEX.md`; the completed table keeps one row per
landed plan, as its own header promises.

## Wave 3 — the WebKit question was already answered

Plan 214 and the INDEX row said WebKit was environment-blocked. That was true
*locally* (no root; Playwright's WebKit build needs `libjxl` and `libbacktrace`),
but the CI nightly schedules the four-project sweep, and neither at-rest spec is
excluded from the `mobile` or `tablet` projects. The 2026-11-26 nightly run
proves it: 8 at-rest instances under each WebKit project, all green, alongside
`chromium` and `desktop-xl`.

Adding WebKit to pull-request runs was considered and rejected: the repo
deliberately keeps PRs Chromium-only (plans/148 §6.2, plans/149) and pays the
~10-minute four-project cost once a night. The record now states the coverage and
the distinction instead of implying it does not exist.

## Checks run

- `pnpm --filter dks-mcp test` — 22 tests (4 files) green, including the new
  spawned-stdio smoke test.
- `pnpm --filter dks-mcp typecheck`, `pnpm run lint`,
  `pnpm run docs:check`, markdownlint on the changed Markdown.
- `gh run view 45813183285 --log` for the WebKit evidence quoted above.
