# Plan 224: ADR register guard, pre-squash SHA audit, #1171 close (2026-11-27)

**Goal**: The three follow-ups offered after Plan 223: stop the `plans/INDEX.md`
ADR register from silently missing a new decision record, check every SHA the
INDEX cites against git history instead of trusting the prose, and close #1171
once the automation contract it asks for actually exists.

## Waves

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| 1 | Fail a check when a decision record never reaches the register | Done | `scripts/check-doc-consistency.mjs` cross-checks `plans/ADRs/` against the register table |
| 2 | Verify every SHA the INDEX cites | Done | 44 citations; 40 resolve, four are pre-squash branches, one is a later tip of `main` |
| 3 | Close #1171 with evidence, not assertion | Done | Contract, flags, exit codes and golden tests already shipped; issue closed with the mapping |

## Wave 1 — the guard

Plan 222 backfilled the register for ADRs 041–057 because it had gone stale for
months. Nothing stopped the next ADR from missing it the same way, so `docs:check`
now reads the register table itself and fails when:

- an ADR file numbered **058 or higher** has no row (058 is the first number the
  register has never had the chance to cover — 001–057 either predate it or sit in
  the Plan 222 backfill);
- a row points at a file that does not exist (a dead link reads as a registered
  decision);
- a row's number disagrees with its file's number prefix;
- the same number is registered twice.

Proven by injection, not by assertion:

1. added `plans/ADRs/058-guard-probe.md` → `✗ plans/ADRs/058-guard-probe.md has
   no row in the plans/INDEX.md ADR register`;
2. pointed the ADR 048 row at `plans/ADRs/048-does-not-exist.md` → `✗
   plans/INDEX.md ADR register points at a missing file`;
3. restored both, `docs:check` green again.

The floor is deliberately a single named constant rather than a list of
exemptions: old gaps stay quiet, every future record must be registered, and
nothing has to be suppressed when the next ADR is written.

## Wave 2 — the SHA audit

Method: extract every backticked hex string from `plans/INDEX.md`, then
`git cat-file -e <sha>^{commit}` and print the commit subject.

| Citation | Recorded claim | Actual commit | Action |
| --- | --- | --- | --- |
| `e2ee5a6` | Plan 165 wave 1 commit | not in history | replaced with `1f1fc50` |
| `a2dcbea` | Plan 165 wave 2 commit | not in history | replaced |
| `f7d970f` | Plan 165 wave 3 commit | not in history | replaced |
| `cdbd0f3` | Plan 165 wave 4 commit | not in history | replaced (INDEX and the Plan 131 row) |
| `a395626` | Plan 194 "merged at" | Dependabot bump, 2026-11-13 | corrected to `b679116`, the #1101 merge |

The four missing commits are explained, not lost: PR #950 landed as one squash
commit, `1f1fc50`, whose body carries all four wave subjects ("prune canvas
references…", "leaving a room keeps the document…", "synchronize views with URL
hashes", "defer sync and export dependencies"). Plan 165 also cited `786250d`,
`1848da9` and `e2f908a` for its other steps — all branch commits, all gone — so
its commit column now reads `Landed in` with `1f1fc50` and a note saying why.

`a395626` was the tip of `main` when Plan 194's row was written, not a merge: all
eighteen per-issue PRs #1084–#1101 report `MERGED`, and the last one (#1101)
landed 2026-11-09 at `b679116`. The row now says that.

The other forty citations resolve to commits whose subjects match their claims,
including `e5d6571` (PR #1000's merge commit, whose subject is the sync fix it
carried) and `887541c` (PR #992).

## Wave 3 — #1171

The issue asked for a machine-readable contract. Every item is shipped and
pinned; closing it is a records act, not an implementation one.

| Requirement | Where it lives | Pinned by |
| --- | --- | --- |
| Versioned JSON envelope (success and error) | `README.md` output contract, `envelope.ts` | `envelope.test.ts` |
| Stable exit-code categories | `exit-codes.ts`, README table | `exit-codes.test.ts` |
| `--format json` on every command | `args.ts`, `cli.ts` | `cli.test.ts` |
| stdout for output, stderr for diagnostics | `cli.ts` `RunIo` | `cli.test.ts`, `streams.test.ts` |
| `--quiet`, `--verbose`, `--no-color` | `args.ts` | `cli.test.ts` |
| Pagination and bounded results | `--limit` 1–200, default 20 | `cli.test.ts` |
| Stable error codes, no secret leakage | `errors.ts`, `envelope.ts` | `cli.test.ts` (passphrase and surplus-positional cases) |
| stdin for pipeline commands | `stdin.ts`, `-` placeholder | `cli.test.ts` |
| Compatibility/versioning policy | README "Schema compatibility policy" | review |
| Golden contract tests | — | `envelope.test.ts`, `exit-codes.test.ts`, `cli.test.ts`, `cli-e2e.test.ts` |

## Checks run

- `pnpm run docs:check`, plus the two guard injections above.
- `pnpm run lint`, markdownlint on every changed Markdown file.
- `pnpm --filter dks-cli test` (unchanged behaviour, re-run for the record).
