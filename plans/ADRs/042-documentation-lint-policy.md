# ADR 042: Documentation Lint Policy

**Date**: 2026-10-12
**Status**: Implemented
**Related**: Plan 164, ADR 036, AGENTS.md ("Treat warnings as errors in quality gates")

## Context

`markdownlint.toml` existed, was referenced by tooling, and could not fail. Two
independent defects made it inert:

1. **Wrong format.** Rules were nested under a `[tool.markdownlint]` table — a
   convention from Python's tooling that markdownlint-cli does not read. Every
   rule therefore ran at its default, and the two rules the file intended to
   disable (line length, inline HTML) were never disabled.
2. **Wrong ids.** The comments named rules that did not match their stated
   purpose (`MD041` was described as line length; it is "first line should be a
   heading").

The resulting asymmetry is worse than either alone:

- The **pre-commit hook** installs markdownlint, so the file's intent was
  enforced there — and would have blocked a doc author with thousands of
  violations, since ~3,000 exist under stock rules.
- The **quality gate** never ran it at all: `markdownlint` is not a
  devDependency and is not on `PATH` in CI, so the step is skipped silently.

So the check that would have caught real problems was skipped, while the same
check, in its most hostile configuration, was installed in the path every human
takes to commit.

### The hazard that makes this an ADR rather than a chore

Enabling the file and running `markdownlint --fix` across the corpus **changed
documents' meaning**. Repository prose is wrapped at ~80 columns, so a sentence
enumerating issues frequently continues on a line beginning with an issue
reference:

```
**17 open issues:** #851, #852, #853, #855, #856, #858, #861, #862, #863,
#865, #870, #873, #883, #884, #885, #886, #887 — five of them claimed ...
```

Per CommonMark, a line beginning `#865` is an ordinary paragraph — an ATX heading
requires a space after the hashes. `MD018` ("no missing space after #") instead
reads it as a heading and *fixes* it to `# 865`, which renders as a real `<h1>`.
One pass did this to **43 lines across 58 files**. It was reverted, and the one
fact worth preserving is that a lint fix can silently rewrite a document's
structure: any future re-enable of `MD018` must be preceded by a corpus-wide
prose audit.

## Decision

**Enforce the mechanical and structural core; disable style and heading-shape
rules, each with its reason recorded next to the rule.**

Enforced: heading style, list indentation, trailing spaces, hard tabs, reversed
links, blank-line runs, blockquote spacing, bare URLs, spaces in
emphasis/links, empty links, proper names, and a single trailing newline.

Disabled, with reasons in the file:

| Rules | Reason |
| --- | --- |
| `MD013`, `MD024`, `MD033`, `MD036`, `MD040`, `MD041`, `MD060` | Styles this repository does not follow (prose past 80 columns, `<details>`/`<kbd>` inline HTML, repeated per-wave headings, unlabelled code fences, title comments, spaced table pipes) |
| `MD022`, `MD031`, `MD032`, `MD058` | Blank-line placement; correct as written for every renderer this repo targets, and enabling them rewrites ~2,600 lines for no reader-visible change |
| `MD018`, `MD001`, `MD025`, `MD026`, `MD028` | Misfire on the wrapped-prose form above (they read prose as headings), and on archived plans that nest headings freely |
| `MD004`, `MD007`, `MD029`, `MD030`, `MD050` | List and emphasis style variance across historical plans |
| `MD055`, `MD056` | Archived tables that do not parse as written; fixing them is an editorial decision per row (follow-up, not a silent ignore) |

The corpus was then normalized under exactly these rules — 43 markdown files,
mechanical edits only. Verified: **zero** heading lines were added by any
normalized file (`git diff -U0 | grep -cE '^\+#+ '` per file), and heading counts
were identical before and after.

## Consequences

- Verified against **v0.48.0** — the exact revision pinned by `.pre-commit-config.yaml`
  (which calls `markdownlint --config markdownlint.toml`), so the pass measured here
  is the check the hook will run, not an approximation of it.
- A doc author now passes the pre-commit hook instead of being blocked by it, and
  the rules that remain on are ones this corpus can and does satisfy.
- **Structural damage is still caught**: malformed tables, tabs, trailing
  whitespace, missing final newlines, and broken links fail the check.
- **Known gap, recorded as a follow-up**: the gate itself still skips the check
  until `markdownlint-cli` is a devDependency invoked via `pnpm exec`. Until then
  enforcement lives in the pre-commit hook only.
- **Known gap, recorded as a follow-up**: the 16 table rows `MD055`/`MD056` would
  flag (4 in `DESIGN-SYSTEM.md`, 1 in `agents-docs/WEB_RESEARCH_OPTIMIZATION.md`,
  5 in `plans/112`, 3 in `plans/160` — plus rows in `plans/116`, `plans/162`) need
  per-row editorial repair before those two rules can be turned back on.
- Disabling a rule is now an explicit, documented act; a rule that is off without
  a reason beside it should be treated as a defect.
