### LESSON-055: A documented "finding" is a hypothesis until a command proves it

**Date**: 2026-11-01
**Component**: Benchmarks / Documentation / Agent discipline
**Severity**: Medium

**Issue**: `plans/perf-baselines.md` recorded, as a finding, that the repository's
`bench()` blocks "never execute". The mechanism it described was real, but the
premise was not: the files contained no `bench()` calls at all.

**Symptoms**:
- A plan and a baseline document both asserted eight inert benchmark files.
- `vitest bench` reported no files, which looked like confirmation of the claim.
- Nobody could point at a `bench()` call, because there was none.

**Root Cause**:
`vitest bench` matching nothing was taken as evidence that `bench()` blocks
existed and were being skipped. That inference is invalid in both directions:
an empty collection result is consistent with "the blocks are invisible" *and*
with "there are no blocks". The claim was never tied to a command whose output
could distinguish the two, and the file name (`*.bench.test.ts`) was treated as
proof of contents.

**Solution**:
```bash
# What the claim needed, and did not have:
grep -c "bench(" src/lib/search/*.bench.test.ts src/lib/**/*.bench.test.ts
# -> 0 for every file
```
The correction went into `plans/perf-baselines.md` as a *Correction* section
that states what was wrong, not a silent edit, and the real gap (nothing ran
under bench mode) was closed with an actual `*.bench.ts` file.

**Prevention**:
- Every "X never happens" claim must name the command that shows it happening
  when it does. If no such command exists, the claim is not a finding.
- Distinguish *absence of evidence* from *evidence of absence* when a tool
  reports an empty collection.
- When correcting a recorded finding, leave the correction visible. A silently
  rewritten document teaches nobody, and the original error recurs.

**Files Modified**:
- `plans/perf-baselines.md` - Correction section replacing the false finding
- `src/lib/search/fusion.bench.ts` - real `bench()` blocks
- `plans/191-proposal-triage-2026-10-31.md` - records the corrected premise

---
