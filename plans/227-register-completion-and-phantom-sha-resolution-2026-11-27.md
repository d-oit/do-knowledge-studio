# Plan 227: Archive pointers, complete ADR register, phantom SHA resolution (2026-11-27)

**Goal**: The three follow-ups offered after Plan 226: make the branch-SHA map
findable from the records that cite the orphaned SHAs, register the last 28
decision records so the guard covers every one, and find out what the two
nonexistent SHAs were supposed to be.

## Waves

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| 1 | Point the 18 archive records at the map | Done | One blockquote under each title links Plan 226 |
| 2 | Register every decision record and drop the guard floor | Done | ADRs 001–027 plus the legacy `06` added in a new pre-reconciliation table; the guard now keys on the file, not the number, and requires a row for all 57 records |
| 3 | Resolve the two SHAs that exist nowhere | Done | `6142cfeb` is a DeepSource run id; `ff98106…` was a wrong SHA for PR #643, which merged as `c01ab3a7` |

## Wave 1 — pointers

Eighteen records cite at least one unreachable SHA. Rather than rewrite sixteen of
them (Plan 226 explains why), each now opens with:

> Commit SHAs in this record that are not reachable from `main` are mapped to the
> squash commit that carries their work in [Plan 226](226-branch-sha-map-and-register-backfill-2026-11-27.md).

That keeps the dated account intact and makes the destination one click away. The
two records that were corrected rather than annotated (Plans 162 and 166) already
cite `1f1fc50` directly.

## Wave 2 — the register now covers everything

The pre-reconciliation records live in their own table, because the existing
heading promises "since the 2026-07-25 reconciliation" and adding June decisions
under it would make the heading false:

- **001–016** carry no date line; their cells say "recorded YYYY-MM-DD" from the
  commit that added each file, rather than implying a decision date.
- **017–027** carry their own dates.
- **`06`** is the legacy two-digit record (LLM provider plugin system, 2026-04-23),
  superseded by 019 and then 025. It coexists with **ADR 006** (shared export
  core), so the register has two rows that normalise to the same number.

That collision is why the guard changed key from *number* to *file*:

| Before | After |
| --- | --- |
| `registered` was a set of numbers | a set of file paths |
| a second ADR numbered 006 was a "registered twice" failure | two rows for two files is correct; the same **file** twice is the failure |
| the number had to match the file's prefix via a 3-digit map that silently lost one of two 006s | the row number is normalised (`06` → `006`) and compared per row |
| a floor of 29 exempted everything below it | no floor: every record on disk needs a row |

The register grew from 29 rows to **57**, matching the 57 files in `plans/ADRs/` —
every one now named exactly once, with its status word agreeing with the record.

## Wave 3 — the two SHAs that exist nowhere

| SHA | What it actually is |
| --- | --- |
| `6142cfeb` | A **DeepSource run id**, not a commit: Plan 111 records "run `6142cfeb` analyzing post-rename commit `0c4a81f`". It is hex-shaped and eight characters long, so the Plan 225 extractor counted it as a SHA. Plan 226's "never pushed" reading was wrong and is corrected there |
| `ff98106e4c7b2bc287b24eaf42907196329070c7` | A fabricated or mistyped SHA: Plan 115 said PR #643 pinned `gitleaks-action` to v2.3.9 at this commit, but GitHub has no such object and PR #643 merged as `c01ab3a7` (2026-08-11). Plan 115 now cites the real merge commit |

Neither is a lost branch commit, so the "48 orphaned branch SHAs" figure is one
high: 47 branch commits, one run id, plus one wrong SHA and one superseded commit.

## Checks run

- `pnpm run docs:check` with the register at 57 rows.
- Injections: deleted the ADR 010 row → "has no row"; duplicated the 022 row →
  "registers … twice"; flipped 036's status → the status mismatch fires.
- `pnpm run lint`, markdownlint on all 20 changed Markdown files.
- Link check: every `plans/ADRs/…` path in both register tables resolves.
