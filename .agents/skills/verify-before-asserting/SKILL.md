---
name: verify-before-asserting
description: Mandatory verification discipline before claiming, changing, or shipping anything. Use when about to state a fact about the code, declare a bug fixed, add a regression test, dismiss a review finding, or act on a plan, ticket, or prior session's notes. Triggers include "the bug is", "should be", "just fixed", "add a test", "looks correct", "this is a false positive", "the plan says", or any change to module structure.
category: workflow
version: 1.0.0
compatibility: Language-agnostic. Needs read access to the repo and the ability to run its test suite.
---

# Verify Before Asserting

> The rule: **an unverified claim is not a claim, it is a guess wearing a
> citation.** Everything below exists to stop a plausible-sounding statement
> from reaching a commit, a review reply, or a user.

This skill encodes the failure modes that actually cost time in real sessions:
asserting a fact from a plan instead of the code, shipping a "fix" that was
never shown to fail, and dismissing a review finding by assertion instead of by
probe.

## The trust order

When sources disagree, believe them in this order:

1. **Live code and a live run** — the only thing that cannot be stale
2. **A test that asserts the intended behavior**
3. **Generated docs/indexes** (may lag the source)
4. **Hand-written docs, plans, tickets, READMEs**
5. **Memory, prior-session notes, an agent's own earlier claim in this chat**

If a plan says X is broken but the code works, **the plan is stale** — say so
and move on. Do not "fix" working code to match a stale document.

## Gate 1 — Before you state a fact about the code

Do not write a sentence that asserts code behavior until you have looked at the
code that implements it.

- Read the symbol **and its call site**. A function named `validate` may not
  validate; a `// deprecated` comment may be wrong.
- Cite `file:line`. A claim without a location is a guess.
- If you are reasoning about data shape, types, or ordering, check the test
  that pins it before generalizing.

## Gate 2 — Before you "fix" a bug

**You cannot fix a bug you cannot make fail.**

1. Reproduce it first, and write down the exact observation (the assertion
   message, the wrong value, the missing node) — not a paraphrase.
2. Confirm the reproduction fails **for the stated reason**. A test that fails
   three lines later than expected is a different bug.
3. If you cannot reproduce it, say so. An unreproducible "fix" is a coin flip
   with a diff attached.

## Gate 3 — Before you trust a regression test

**A test you have not seen fail is not evidence.** A test that has only ever
passed proves nothing.

Prove it, cheaply:

1. Write the test.
2. Re-introduce the exact defect (invert the fix, delete the line, restore the
   old branch).
3. Run the test — it **must fail**.
4. Restore the fix; the test must pass again.

This is mutation testing aimed at one line instead of the whole suite. If the
test still passes in step 3, it does not test what you think it does — and
neither will the bug it was meant to catch. See
`testing-strategy/references/mutation-testing.md` for whole-suite versions.

> **Watch the injection itself.** A common trap: you re-inject the defect in
> the wrong place, the test passes, and you wrongly conclude the test is weak.
> If a "verified" regression test passes on a re-broken build, first prove the
> injection was real (grep the mutated line, read the diff) before touching the
> test.

## Gate 4 — Before you dismiss a review finding or a bug report

Static analysis and peer review are frequently wrong. Disagreeing is normal;
disagreeing *without evidence* is not.

- Reproduce the claim against the running system, or read the code path the
  finding names.
- If it does not reproduce, say what you measured and why it does not hold —
  do not just assert "not a bug".
- If it does reproduce, treat it as real regardless of how trivial it looks.

## Gate 5 — Before you say "fixed"

Re-run the **exact reproduction** and show the before/after. Then run the
broader suite to check you did not trade one bug for another.

A fix is proven by the failure disappearing, not by the code looking right.

## Verifying structural changes (the expensive blind spot)

A refactor can preserve every unit test and still break the app, because unit
tests mount isolated or mocked stores while the bug lives in how modules are
**composed**. If you reorganize modules, wire up new slices, move state
between files, or change an initialization order:

- A green unit suite is **not** evidence the app still boots.
- Run the end-to-end suite, or at minimum exercise the real first load in a
  browser, before calling it done.

## Reporting

State what you verified and how, in one line, next to any claim that depends
on it:

- "Verified: `pnpm test` 179 files green; fresh-module probe reads
  `len=1 idx=0 ents=8 claims=5`."
- "Not verified: pre-cache integration in a real offline boot."

Anything you could not verify, say you did not verify. An honest gap is cheap;
a wrong claim is expensive.

## Anti-patterns

- ❌ "This function name suggests validation, so it validates." → read the body
- ❌ "The plan says this is broken." → the plan may be older than the code
- ❌ "My test passes, so it covers the bug." → re-inject and watch it fail
- ❌ "That lint warning is stale." → confirm the rule and the line still exist
- ❌ "The whole unit suite is green, so the refactor is safe." → unit tests do
  not cover composition

## Related

- `test-runner` — running suites and reading failures
- `testing-strategy` — designing the suite; its
  `testing-strategy/references/mutation-testing.md` covers whole-suite runs
- `code-review-assistant` — the review pass that surfaces Gates 3 and 4
- `dogfood` / `agent-browser` — real-app evidence for Gates 4 and 5
