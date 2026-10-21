# Plan 181 — Quality gate Markdown enumeration asks git, not `find`

**Date:** 2026-10-21
**Status:** Done — verified in a real repository with the reproduction case
**Owner:** integration owner for this sweep
**Found during:** post-merge production verification of the Plan 179 Dependabot drain
**Approved by:** the maintainer, explicitly, as required by AGENTS.md for changes to lint ignore settings

## Problem

`scripts/quality_gate.sh` enumerated the Markdown files to lint with `find`
plus a hand-maintained denylist:

```bash
MD_FILES=$(find . -name "*.md" \
  -not -path "./node_modules/*" -not -path "./target/*" -not -path "./.git/*" \
  -not -path "./.agents/*" -not -path "./.claude/*" -not -path "./.gemini/*" \
  -not -path "./.qwen/*" -not -path "./.opencode/*")
```

Every ignored output directory the repository gained later was a hole in that
list. `playwright-report/` and `test-results/` were exactly such a hole: the
e2e suite writes Markdown into both, so running e2e and then the gate failed on
Playwright's own artifacts.

```
✗ markdownlint failed: ./test-results/error-boundaries-…/error-context.md
  error MD047/single-trailing-newline Files should end with a single newline character
✗ markdownlint failed: ./playwright-report/data/edf5027ce….md
  error MD047/single-trailing-newline Files should end with a single newline character
```

The denylist is also open-ended by construction: the next ignored output
directory would be the next hole, and nothing would flag it.

## Approach

Enumeration is delegated to **git**, which already knows what the repository
ignores:

```bash
git ls-files --cached --others --exclude-standard -- '*.md' \
  ':(exclude).agents/**' ':(exclude).claude/**' ':(exclude).gemini/**' \
  ':(exclude).qwen/**' ':(exclude).opencode/**'
```

Three properties fall out of this, each of which the old `find` sweep did not
have:

1. **Ignored output is excluded by the repository's own `.gitignore`.** No
   denylist to maintain, and no new hole when a new output directory appears.
2. **Untracked-but-not-ignored files are still linted.** `--others
   --exclude-standard` adds files that are not yet committed but are not
   ignored, so a newly written Markdown file is checked before it is
   committed. The gate never silently skips work in progress.
3. **The vendor exclusions are pathspecs on the same command**, so the file
   list and the exclusions cannot drift apart.

The vendor directories stay excluded because their prose is vendored content
the skill authors own, not this project's prose. `.agents/skills/` is the
canonical copy and the other tool directories are symlinks into it.

### Why not `.markdownlintignore`

markdownlint-cli does support `.markdownlintignore` (verified: it suppresses
even an explicitly passed path). It was rejected because it is a *second*
source of truth that must be kept in sync with `.gitignore`, and because it
would not cover the untracked-file case — a new Markdown file would still be
linted by the explicit per-file loop, but the ignore file would then need to
know about it. Asking git once is simpler and has one source of truth.

### Why not `git ls-files --cached` alone

Tracked files only. That would silently skip a Markdown file written but not
yet staged — the exact work-in-progress case the gate exists to catch.

### The non-git fallback

Outside a git repository there is no index to ask. `list_markdown_files`
falls back to the old `find` sweep, extended with the output directories, so
the behaviour outside a checkout stays equivalent. The same assumption
`scripts/lib/lint_cache.sh` already makes about its cache directory.

### Where the rule lives

The enumeration is a library, `scripts/lib/markdown-files.sh`, not a function
inlined in the gate. `scripts/quality_gate.sh` was already 804 lines — over
this repository's 500-LOC limit for source files — and AGENTS.md says to
refactor before extending an oversized file. Putting the rule in
`scripts/lib/` keeps the gate's own growth to 32 lines instead of 64, gives
the rule its own BATS coverage, and follows the convention the repository
already established with `scripts/lib/lint_cache.sh` (see
`scripts/lib/README.md`).

The gate falls back to a filesystem sweep if the library is missing, with a
warning. A missing enumeration would otherwise leave `list_markdown_files`
undefined and the Markdown section would lint nothing — a gate that reports
success without checking anything. That failure mode is pinned by a test.

## Verification

### The reproduction case

With `playwright-report/data/report.md` and
`test-results/run/error-context.md` present — the artifacts that used to fail
the gate — the gate now passes:

```
Running Markdown checks...
  ✓ markdownlint passed
```

Verified with the real artifacts a full `pnpm run test:e2e --project=chromium`
run leaves behind, not a hand-made fixture.

### The gate still fails on real findings

A deliberately broken Markdown file still fails the gate:

```
✗ markdownlint failed: plans/zz-broken-check.md
│ ✗ Quality Gate FAILED                                         │
```

Both tracked and untracked files are caught.

### The file list is unchanged for repository content

The git enumeration with the vendor pathspecs produces a list **byte-identical**
to the old `find` sweep for repository content — 312 files, `diff` empty. The
only difference is the exclusion of gitignored output.

### Failing closed

`git ls-files` is allowed to fail — index lock, corrupt repository, argument
error. Swallowing that error and returning an empty list would be fail-open:
the caller sees no files, lints nothing, and reports success. The enumeration
therefore only returns the git list when the command **succeeds**, and
otherwise falls through to the filesystem sweep.

The same reasoning applies to the library being missing: without it the gate
would have no file list at all. It falls back to a filesystem sweep and says
so on stderr.

### Regression coverage

`tests/quality-gate-markdown-files.bats` (new, 10 tests) pins the contract
against a stub linter that records the paths it was asked to lint:

| Test | Asserts |
|---|---|
| does not lint Markdown inside ignored output directories | the generated artifacts never reach the linter |
| fails on a genuine finding in a tracked Markdown file | a finding still fails the gate |
| fails on a finding in an untracked Markdown file | work in progress is still checked |
| ignores vendor agent and skill library Markdown | the vendored prose stays excluded, and the gate passes |
| still reports a finding when an ignored artifact sits beside a broken file | the exclusion may not swallow the whole run |
| the enumeration library is idempotent when sourced twice | double-sourcing does not break the rule |
| the gate still lints Markdown when the enumeration library is missing | a missing library cannot make the gate skip its checks |
| the enumeration falls back to a filesystem sweep outside a git repository | the fallback excludes build output and dependencies too |
| a failing git ls-files falls back instead of returning an empty list | the enumeration fails closed |
| skips tracked files deleted from the working tree without failing | a file git still lists but disk no longer has is not handed to the linter |

Verified to **fail on the old implementation and pass on the new one** —
against the `find`-based gate from `main`:

| Test | Old (`find`) | New (git) |
| --- | --- | --- |
| does not lint Markdown inside ignored output directories | **fail** — artifacts reach the linter | pass |
| still reports a finding when an ignored artifact sits beside a broken file | **fail** — artifacts reach the linter | pass |
| the gate still lints Markdown when the enumeration library is missing | **fail** — no fallback existed | pass |
| fails on a genuine finding in a tracked Markdown file | pass | pass |
| fails on a finding in an untracked Markdown file | pass | pass |
| ignores vendor agent and skill library Markdown | pass | pass |
| the enumeration library is idempotent when sourced twice | pass | pass |

The fail-closed test was checked in the same way: reverting the
`git ls-files` guard makes it fail (`not ok 9`), and restoring it makes it
pass. The deleted-file test was checked the same way: removing the
`[ -f "$md_file" ]` guard makes it fail (`not ok 10`), and restoring it makes
it pass.

### The fallback excludes what the git path excludes

The filesystem fallback cannot ask git for the file list, but it can still
ask git whether a path is ignored — `git check-ignore` answers per path and
works even when the index cannot be read, which is exactly the case the
fallback exists for. The fallback therefore excludes the same directories the
git path does, instead of keeping a second hand-maintained list that would
become the next hole.

The explicit output-directory exclusions are kept as well, so the fallback
still excludes build output when git cannot answer at all.

## Code review outcome

`code-review-assistant` on PR #1007 found no P1. Its findings and how each
was handled:

| Finding | Severity | Resolution |
|---|---|---|
| `git ls-files` failure returned an empty list — the gate would pass without linting anything | P2 | **Fixed.** The enumeration only returns the git list when the command succeeds; otherwise it falls through to the filesystem sweep. Pinned by a new test that was verified to fail against the unguarded version. |
| `scripts/quality_gate.sh` exceeds the 500-LOC rule and the addition was inline | P2 | **Fixed** by extracting the rule into `scripts/lib/markdown-files.sh`, following the `scripts/lib/lint_cache.sh` precedent. The gate's own growth is 32 lines rather than 66. |
| A tracked file deleted from the working tree is still listed by git, so the linter was spawned on a path that does not exist | P3 | **Fixed** — the loop now skips paths that are not files. |
| The vendor-exclusion test did not assert that the gate passes | P3 | **Fixed** — the stub now exits 0 and the test asserts a passing gate. |
| The non-git fallback path was never exercised | P3 | **Fixed** — a test covers it. |
| The deleted-file skip had no test | P3 | **Fixed** — a test covers it, and it was verified to fail when the guard is removed. |
| A library that exists but fails to source would leave `list_markdown_files` undefined, and the Markdown section would silently lint nothing | P3 | **Fixed** — the gate checks both that the file exists *and* that `source` succeeded and defined the function. |
| The new library was committed with mode 755 while its siblings are 644 | P3 | **Fixed** — mode is now 644, matching `scripts/lib/`. |
| The fallback kept a second hand-maintained exclusion list, which would become the next hole | P3 | **Fixed** — the fallback now asks `git check-ignore` per path, so it excludes what the git path excludes. |

### Local gate

- `./scripts/quality_gate.sh` — all gates green (lint, typecheck,
  typecheck:test, test, shellcheck, bats, markdownlint)
- `shellcheck scripts/quality_gate.sh` — no new findings (the two SC1091
  "not following" infos are pre-existing and unchanged)
- `pnpm run test:e2e --project=chromium` — 215 passed, 1 skipped, 1 flaky
  (`e2e/semantic-search.spec.ts` "surfaces a lexical fallback hint", which
  passes in isolation; this change touches only the Markdown file list and
  cannot affect it)
