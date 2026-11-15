## LESSON-030: Check pullRequest.reviewThreads before declaring merge-state staleness

**Date**: 2026-08-13
**Component**: GitHub / Merge Workflow
**Severity**: High

**Issue**: PR #670 sat `BLOCKED` for 1.5+ hours with every check green
(Codacy, Vercel, CodeQL, Quality Gate, Unit Tests) and survived the full
plans/098 unblock ladder (re-arm auto-merge, empty-commit nudge,
close/reopen, label toggle). It looked exactly like LESSON-028's staleness
case and the only apparent lever was `--admin`. The real blocker was an
**unresolved OwlWatch review thread** on `warm_cache.py:36` — the ruleset's
`required_review_thread_resolution: true` gate (LESSON-026).

**Root Cause**:

- Threads were missed because the wrong endpoints were queried: issue
  comments (`gh pr view --json comments`) and `reviewDecision` were both
  empty, and `gh pr checks` reported all SUCCESS. The thread is only
  visible via the review-comments API (`pulls/{n}/comments`) or GraphQL
  `pullRequest.reviewThreads` — a review exists (state `COMMENTED`) even
  when `reviewDecision` is null.
- The OwlWatch review landed minutes after the first push and never
  re-triggered CI, so every subsequent check run was green while the gate
  stayed closed — indistinguishable from staleness without the thread
  query. The diagnoser workflow only reports check-run state, not threads.

**Solution**:

- Query threads before escalating: GraphQL
  `pullRequest.reviewThreads(first: 10) { nodes { id isResolved } }`.
- Reply with the rationale (REST
  `POST /pulls/{n}/comments/{comment_id}/replies`), then resolve:
  `mutation { resolveReviewThread(input: {threadId}) { thread { isResolved } } }`.
- Resolution flipped `mergeStateStatus` `BLOCKED` → `CLEAN` instantly; the
  armed auto-merge (squash) merged within seconds. No `--admin` needed.

**Prevention**:

- Before declaring staleness (LESSON-028) or escalating to `--admin`, run
  the reviewThreads query — treat every unresolved bot thread (owl-watch,
  DeepSource) as a merge gate (LESSON-026).
- `reviewDecision` and issue comments do not reveal threads; always check
  `pulls/{n}/comments` / GraphQL `reviewThreads`.

**Tags**: #review-threads #merge-state #staleness #owl-watch #graphql #merge-gate
