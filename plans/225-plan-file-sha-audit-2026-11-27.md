# Plan 225: SHA citations across plan records, ADR status and plan-file guards (2026-11-27)

**Goal**: The three follow-ups offered after Plan 224: audit the SHAs cited inside
`plans/*.md` the way the INDEX was audited, keep the ADR register's status column
honest, and fail `docs:check` when a landed row points at a plan file that is not
there.

## Waves

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| 1 | Check every SHA cited in every plan record | Done | 178 backticked citations; 63 do not resolve, of which 8 are not SHAs at all, 7 record a known-missing SHA, and 48 are PR-branch commits erased by squash merges |
| 2 | Make the register's status column agree with the record | Done | ADR 034 said "Done" against the record's "Implemented"; the check now compares the leading status word in both `**Status**:` and `- Status:` forms |
| 3 | Fail when an index row names a plan file that does not exist | Done | All 113 references (29 links, 84 paths) already resolve; the check keeps it that way |

## Wave 1 — method and findings

Method: extract every backticked token of 7–40 characters from `plans/**/*.md`,
then `git cat-file -e <token>^{commit}`. The pattern over-matched, which is itself
a finding about how the records are written.

| Class | Count | Example | Verdict |
| --- | --- | --- | --- |
| Resolves | 115 | — | fine |
| GitHub Actions run id | 5 | `35986156948` | not a commit; correct in context |
| Fast-check seed / short numeral | 3 | `10622026` | not a commit; correct in context |
| PR-branch commit, unreachable | 48 | `e2ee5a6` | the claim is usually right, the SHA is gone |
| Already documented in Plan 224 | 7 | `786250d` | intentional: they record that the SHA is missing |

The 48 unreachable citations sit in 18 records — the sweeps (110, 111×2, 112,
113, 137, 163, 171, 179), the audits (098, 105, 136, 162), and 115, 138, 144,
146, 159. They are not typos: each names a commit that existed on a pull request
branch and was collapsed by a squash merge, most visibly in the 111 sweep (twelve
citations) and the 171 drain (eight). `git show` on any of them fails, so a reader
trying to verify a claim is told the commit never existed.

Rewriting all 43 would replace a true statement about a branch with a true
statement about a squash commit at the cost of implying that commit did the work
alone. Two records were corrected because they duplicate claims already fixed in
the INDEX, and the rest are left as written:

- `plans/162-roadmap-progress-and-next-work-2026-10-05.md` — four rows now cite
  `1f1fc50`;
- `plans/166-codebase-improvement-audit-2026-10-13.md` — one row now cites
  `1f1fc50`.

The recurrence is addressed where it starts: `plans/INDEX.md` now states that a
SHA citation names the commit reachable from `main`, and a squash-merged pull
request is cited by its squash commit.

A resolution guard is deliberately **not** in `docs:check`: CI's Quality Gate
does fetch full history, but `docs:check` also runs on shallow clones and in
`--fast` gates, where `git cat-file` cannot answer and every old citation would
fail. A check that has to be skipped on some machines is not worth the noise;
the convention plus this record is what a future author reads.

## Wave 2 — status drift

Comparing the register's status cell with the ADR's own status line found one
mismatch and one parsing gap:

| ADR | Register said | Record says | Action |
| --- | --- | --- | --- |
| 034 | Done | Implemented — delivered via PRs #694 and #695 | register corrected |
| 051–053 | Accepted | `- Status: Accepted` | parser widened; no record change needed |

Only the leading word is compared. The prose after it legitimately differs — the
register condenses "#1035; TURN section from #1052" into one cell — and demanding
equality would force the index to restate the record or the record to shrink.

## Wave 3 — plan-file references

Every landed plan row names a plan file. Checked and guarded in both forms the
INDEX uses: `plans/NNN-slug.md` in cells and prose (84 distinct) and
`NNN-slug.md` as a link target (29 distinct). None were missing; the check exists
so a rename cannot leave a row pointing at nothing.

## Guard proofs

Each new failure path was injected and observed:

1. changed ADR 034's register status back to `Done` → `✗ plans/INDEX.md calls ADR
   034 "done" but the record says "implemented"`;
2. pointed a landed row at `plans/999-missing.md` → `✗ plans/INDEX.md references a
   missing plan file`;
3. deleted the `**Status**:` line from a copied record → `✗ ... has no "**Status**:"
   or "- Status:" line` (probe file removed afterwards).

## Codacy finding on the first push

Codacy reported one High issue against the status read:
`ESLint8_security_detect-non-literal-fs-filename` on
`readFileSync(path, 'utf8')`, where `path` came from a Markdown table. The rule is
syntactic — it cannot see that the path was already matched against the directory
listing — but the finding is right in substance: an index-derived path should be
validated by shape and containment before any read, exactly as the lesson links
are.

The fix follows the file's own rule rather than suppressing the check: register
paths must match `plans/ADRs/NNN-slug.md`, must resolve inside `plans/ADRs`, and
are read through `readTextFile`, the reviewed reader that exists because a bare
fs call cannot satisfy the rule. Directory enumeration now also refuses symlinked
entries. A row whose path escapes the directory fails the check instead of being
read.

## Checks run

- `pnpm run docs:check` after each injection and after restore.
- `pnpm run lint`, markdownlint on every changed Markdown file.
