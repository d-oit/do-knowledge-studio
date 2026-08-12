# Plan 120 — Open Items Resolution Session (2026-08-12)

Date: 2026-08-12
Status: COMPLETE

## Purpose

Resolve all open PRs, GitHub issues, and actionable tasks in plans/ folder using GOAP orchestration.

## Session Summary

### Issue #622 — Subprocess Call Vulnerability (CLOSED)

**Finding**: OwlWatch flagged `subprocess.run` calls in `.agents/skills/do-web-doc-resolver/scripts/providers_impl.py:333-335` as potential SSRF/command injection (ruff S603).

**Analysis**: False positive. The subprocess calls in `resolve_with_docling` and `resolve_with_ocr` are already protected by `is_safe_url(url)` validation before being passed to subprocess (lines 456, 491).

**Resolution**: Closed as false positive with explanation that `is_safe_url()` performs comprehensive SSRF protection:
- Scheme validation (blocks file/javascript/data/vbscript)
- Localhost/private IP blocking
- Private network range blocking (10.x, 172.16.x, 192.168.x)
- DNS resolution checks

### PR #663 — BATS Tests for validate-skills and self-fix-loop (MERGED)

**Final Status**: Merged via squash (b3de0a7).

**OwlWatch Finding**: LOW severity — "Repetitive test code in Shell test coverage suite" in `src/lib/__tests__/workflows.test.ts`.

**Fix Applied**: Refactored 8 individual test cases to use `it.each` with a parameterized `scriptsWithBats` array (commit 7e88219). Eliminates duplicated pattern while preserving same assertions.

**Resolution Steps**:
1. Refactored repetitive test code to use parameterized tests
2. Committed and pushed fix (7e88219)
3. Replied to OwlWatch review comment explaining the fix
4. Resolved OwlWatch review thread via GraphQL
5. Waited for all CI checks to pass (22/22 green)
6. Merged PR via squash (--delete-branch)

### Plans/ Folder — Open Tasks

**Analysis**: Scanned all plans for open tasks (`- [ ]`). Found:
- Historical plans (001, 03, 040, 041, 042, 05, 13, 14, 16, 17, 18, 19) have open checkboxes
- Recent plans (100-119) are all marked DONE
- INDEX.md confirms all recent work is complete

**Resolution**: No actionable open tasks in recent plans. Historical plan checkboxes are documented but not actionable (superseded by later work).

## Quality Gates

- ✅ Lint: clean
- ✅ Typecheck: clean
- ✅ Build: successful (Next.js 16.2.12, Turbopack)

## Files Changed

- `src/lib/__tests__/workflows.test.ts` — Refactored repetitive test code to use parameterized tests

## Follow-up

None — all items resolved.
