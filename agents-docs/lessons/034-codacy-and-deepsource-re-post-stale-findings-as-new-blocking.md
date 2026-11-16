## LESSON-034: Codacy and DeepSource re-post stale findings as NEW blocking threads

**Date**: 2026-09-08
**Component**: CI / static analysis
**Severity**: High

**Issue**: A PR with all checks green stays blocked because Codacy or
DeepSource re-posts findings from an earlier head as NEW review threads
after a push, even when the underlying code was already fixed or the
finding was already suppressed with a documented reason.

**Root Cause**: The re-posted thread is a new thread object, so the
staleness ladder (LESSON-028/031/032) does not clear it — only an explicit
fix, reply, and resolve cycle does. Stopping after the push leaves the
PR blocked with no failing check to explain it.

**Solution**:
- Fix the finding (or re-confirm the suppression reason), reply on the
  thread, resolve it via GraphQL `resolveReviewThread`, then stop pushing
  — each extra push risks another re-post round.
- A test claimed as evidence must have been seen failing for the stated
  reason first (LESSON-041); otherwise the "fix" may silence the thread
  without fixing the defect.

**Tags**: #codacy #deepsource #review-threads #merge-gate #stale-findings

---
