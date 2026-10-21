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

### Regression coverage

`tests/quality-gate-markdown-files.bats` (new, 5 tests) pins the contract
against a stub linter that records the paths it was asked to lint:

| Test | Asserts |
|---|---|
| does not lint Markdown inside ignored output directories | the generated artifacts never reach the linter |
| fails on a genuine finding in a tracked Markdown file | a finding still fails the gate |
| fails on a finding in an untracked Markdown file | work in progress is still checked |
| ignores vendor agent and skill library Markdown | the vendored prose stays excluded |
| still reports a finding when an ignored artifact sits beside a broken file | the exclusion may not swallow the whole run |

Verified to **fail on the old implementation and pass on the new one**:

| | Old (`find`) | New (git) |
| --- | --- | --- |
| "does not lint Markdown inside ignored output directories" | **fail** — artifacts reach the linter | pass |
| "still reports a finding when an ignored artifact sits beside a broken file" | **fail** — artifacts reach the linter | pass |
| Other three | pass | pass |

### Local gate

- `./scripts/quality_gate.sh` — all gates green (lint, typecheck,
  typecheck:test, test, shellcheck, bats, markdownlint)
- `shellcheck scripts/quality_gate.sh` — no new findings (the two SC1091
  "not following" infos are pre-existing and unchanged)
- `pnpm run test:e2e --project=chromium` — 215 passed, 1 skipped, 1 flaky
  (`e2e/semantic-search.spec.ts` "surfaces a lexical fallback hint", which
  passes in isolation; this change touches only the Markdown file list and
  cannot affect it)
