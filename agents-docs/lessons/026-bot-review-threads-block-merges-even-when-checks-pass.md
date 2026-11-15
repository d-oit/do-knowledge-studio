## LESSON-026: Bot review threads block merges even when checks pass

**Issue**: PRs showed `BLOCKED` with all checks green; the branch rule
`required_review_thread_resolution: true` gates merges on unresolved
review threads, and OwlWatch posts LOW-severity threads on every PR.

**Root Cause**: `mergeStateStatus` reflects review-thread resolution,
not just CI. Unresolved bot threads (owl-watch, DeepSource) block
merges regardless of severity.

**Solution**:

- Before merging, query unresolved threads: GraphQL
  `pullRequest.reviewThreads(isResolved == false)`
- Resolve or address each: `resolveReviewThread(input: {threadId})`
  mutation
- Treat bot threads as merge gates, not noise

**Tags**: #review-threads #github #branch-protection #merge #owl-watch

---
