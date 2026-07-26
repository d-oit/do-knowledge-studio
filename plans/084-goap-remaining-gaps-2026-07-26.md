# Plan 084 — GOAP: Address Remaining Implementation Gaps

**Date**: 2026-07-26
**Status**: DONE (verified 2026-07-26, PR #519 created)
**Method**: GOAP with hybrid execution
**Orchestrator**: `goap-agent` skill with `parallel-execution`
**Branch**: `feat/084-remaining-gaps`
**PR**: [#519](https://github.com/d-oit/do-knowledge-studio/pull/519)

## Context

Analysis of plans/ folder identified 3 remaining gaps that need implementation:

1. **ADR 029 validator incomplete** — agent-surface.py only validates SKILL.md length and AGENTS.md sections, missing full validation requirements (P1)
2. **ADR 012 status mismatch** — Status says "PROPOSED" but PDF export is implemented via jsPDF (P2)
3. **Full accessibility audit** — Deferred from Plan 071, partially done in Plans 073-076 but not complete (P0)

## Goals

| ID | Goal | Priority | Effort |
|----|------|----------|--------|
| G1 | Complete ADR 029 validator implementation | P1 | 2h |
| G2 | Update ADR 012 status to "Implemented" | P2 | 5min |
| G3 | Complete accessibility audit (axe-core, keyboard, zoom) | P0 | 3h |
| G4 | Create PR, verify CI, address feedback | P0 | 1h |

## Wave Structure

### Wave 1 — Documentation Fixes (parallel, 2 agents)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W1.1 | Update ADR 012 status to "Implemented" | G2 | plans/ADRs/012-pdf-export-strategy.md |
| W1.2 | Update ADR 012 to reflect jsPDF implementation | G2 | plans/ADRs/012-pdf-export-strategy.md |

### Wave 2 — ADR 029 Validator Enhancement (sequential)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W2.1 | Add broken symlink detection | G1 | scripts/agent-surface.py |
| W2.2 | Add SKILL.md frontmatter validation | G1 | scripts/agent-surface.py |
| W2.3 | Add skill name/directory mismatch detection | G1 | scripts/agent-surface.py |
| W2.4 | Add eval JSON validation | G1 | scripts/agent-surface.py |
| W2.5 | Add duplicate canonical name detection | G1 | scripts/agent-surface.py |

### Wave 3 — Accessibility Audit (parallel swarm, 3 agents)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W3.1 | Run axe-core scan on all views | G3 | accessibility-report.md |
| W3.2 | Test keyboard navigation across all interactive elements | G3 | a11y-keyboard-report.md |
| W3.3 | Test 200% zoom and 400% reflow | G3 | a11y-zoom-report.md |

### Wave 4 — Quality Gate + PR

| ID | Action | Goal | Agent |
|----|--------|------|-------|
| W4.1 | Run lint, typecheck, test, build | ALL | test-runner |
| W4.2 | Run quality gate | ALL | quality-agent |
| W4.3 | Update INDEX.md with Plan 084 | G4 | docs-agent |
| W4.4 | Create branch, commit, push, create PR | G4 | git-agent |
| W4.5 | Monitor CI — all checks must pass | G4 | ci-agent |

## Key Files

| File | Action |
|------|--------|
| plans/ADRs/012-pdf-export-strategy.md | Edit: status to "Implemented", update implementation notes |
| scripts/agent-surface.py | Edit: add full validation logic |
| plans/084-remaining-gaps-a11y-report.md | Create: accessibility audit findings |
| plans/INDEX.md | Edit: add Plan 084 entry |

## Success Criteria

- [x] ADR 012 status updated to "Implemented"
- [x] ADR 029 validator completes all validation requirements
- [x] Accessibility audit completed with findings documented
- [x] All existing tests pass
- [x] Lint, typecheck, build pass
- [x] PR created with all CI checks passing
- [ ] All PR feedback addressed (pending review)

---

**This is a planning artifact. No source code is modified by this document.**
