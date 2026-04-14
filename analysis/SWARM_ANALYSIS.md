# Swarm Analysis Report

> Generated: 2026-04-04
> Repository: github-template-ai-agents
> Personas: RYAN (Methodical Analyst), FLASH (Rapid Innovator), SOCRATES (Questioning Facilitator)

## Executive Summary

This repository is a production-ready template for AI agent-powered development, providing a unified harness across 6+ AI coding CLI tools (Claude Code, Gemini CLI, OpenCode, Qwen Code, Windsurf, Cursor). It features a skills system with 34 canonical skills in `.agents/skills/`, a multi-language quality gate, GitHub Actions CI/CD, and extensive documentation in `agents-docs/`.

The analysis identified **47 distinct gaps** across six categories. The most critical findings are: (1) two scripts exceed the repository's own 500-line limit (`run-evals.py` at 748 lines, `swarm-worktree-web-research.sh` at 692 lines), (2) tests are effectively disabled in CI via `SKIP_TESTS=true`, (3) the README.md skill table is severely stale (8 of 34 skills listed) with stray text at the end, (4) `scripts/health-check.sh` has an incorrect shebang (`#!/usr/bash`), and (5) `scripts/validate-skills.sh` fails to validate `.qwen/skills` symlinks despite `setup-skills.sh` creating them. The test coverage gap is the most systemic issue — only 2 BATS test files exist for 17 scripts, and the CI pipeline explicitly skips test execution.

The codebase is architecturally sound with good progressive disclosure patterns, but has accumulated technical debt from rapid feature addition. Several scripts duplicate functionality, and the atomic-commit scripts referenced in the changelog have been relocated without updating documentation.

## Repository Overview

**What it is:** A unified harness template for AI coding agents providing consistent workflows, quality gates, skills, and sub-agent patterns across multiple CLI tools.

**Primary stack:** Bash scripts, Markdown documentation, GitHub Actions CI/CD, Python eval runner.

**Key components:**
- 34 skills in `.agents/skills/` (canonical source)
- 17 scripts in `scripts/`
- 7 GitHub Actions workflows
- 17 documentation files in `agents-docs/`
- 2 BATS test files
- 1 Python evaluation framework (`run-evals.py`)

**Version:** 0.2.1

---

## 1. Feature Gaps

### FG-01: No Template Initialization / Scaffolding Script

**What:** No script to help users customize the template after forking (rename repo references, update badges, remove template-specific content).

**Why it matters:** Users who "Use this template" on GitHub get placeholder URLs (`github.com/your-org/your-project`) in README.md, CHANGELOG.md, and workflows. Without guidance, these remain broken, hurting discoverability and professional appearance.

**Priority:** High

**Suggested fix:** Create `scripts/init-template.sh` that prompts for org/repo name, updates all placeholder URLs, removes template-specific sections, and runs quality gate to verify.

### FG-02: No Onboarding / Good-First-Issues Workflow

**What:** No CONTRIBUTING.md section or script that surfaces good-first-issues for new contributors.

**Why it matters:** Template adoption depends on contributor experience. Without clear entry points, potential contributors abandon the project.

**Priority:** Medium

**Suggested fix:** Add a "Good First Issues" section to CONTRIBUTING.md with label-based filtering instructions. Consider a `scripts/list-good-first-issues.sh` using `gh issue list --label "good first issue"`.

### FG-03: No Benchmarking / Performance Tracking

**What:** No mechanism to track quality gate execution time, skill loading performance, or context window usage across versions.

**Why it matters:** As the template grows, performance regressions in the quality gate or skill system could silently degrade developer experience. The `agents-docs/CONTEXT.md` discusses context budget but nothing measures it.

**Priority:** Medium

**Suggested fix:** Add a `scripts/benchmark-quality-gate.sh` that times each phase of the quality gate and outputs a report. Track in CI as a non-blocking metric.

### FG-04: No Rollback / Version Pinning for Skills

**What:** No mechanism to pin skill versions or rollback to previous skill definitions.

**Why it matters:** If a skill update breaks workflows, users have no clean rollback path. The template has no versioning strategy for individual skills.

**Priority:** Low

**Suggested fix:** Add optional `version:` field to SKILL.md frontmatter. Create `scripts/pin-skill.sh` to snapshot current skill state.

### FG-05: No Multi-Repo / Monorepo Support Script

**What:** AGENTS.md mentions nested AGENTS.md for monorepos but provides no tooling to scaffold or validate them.

**Why it matters:** Teams adopting this template for monorepos must manually create nested configurations, increasing error risk.

**Priority:** Low

**Suggested fix:** Create `scripts/init-monorepo.sh` that scaffolds nested AGENTS.md files with proper inheritance patterns.

---

## 2. Implementation Completeness

### IC-01: `scripts/run-evals.py` Exceeds 500-Line Limit (748 lines)

**What:** The Python evaluation runner is 748 lines, 49% over the repository's own `MAX_LINES_PER_SOURCE_FILE=500` limit defined in AGENTS.md and `.agents/config.sh`.

**Why it matters:** The repository enforces this limit for all source files but violates it in its own codebase. This undermines the quality gate's credibility and makes the file harder to maintain.

**Priority:** High

**Suggested fix:** Split into modules: `evals/discovery.py` (skill discovery), `evals/runner.py` (execution logic), `evals/validators.py` (structure/file/command checks), `evals/reporter.py` (text/JSON output). Keep main entry point under 100 lines.

### IC-02: `scripts/swarm-worktree-web-research.sh` Exceeds 500-Line Limit (692 lines)

**What:** This script is 692 lines, 38% over the 500-line limit.

**Why it matters:** Same as IC-01. Additionally, this script has complex multi-phase logic (environment validation, worktree management, web research, swarm analysis, GitHub Actions validation) that would benefit from modularization.

**Priority:** High

**Suggested fix:** Extract phases into separate scripts in `scripts/lib/`: `worktree-manager.sh`, `web-research.sh`, `swarm-analysis.sh`, `github-validation.sh`. Main script becomes orchestration layer under 150 lines.

### IC-03: `scripts/health-check.sh` Has Wrong Shebang (`#!/usr/bash`)

**What:** Line 1 uses `#!/usr/bash` which is an invalid path on most systems. Should be `#!/usr/bin/env bash` or `#!/bin/bash`.

**Why it matters:** The script will fail to execute on any system where `/usr/bash` doesn't exist (most Linux distributions, all macOS). This is a critical bug for a health-check script meant to verify environment setup.

**Priority:** Critical

**Suggested fix:** Change line 1 to `#!/usr/bin/env bash`.

### IC-04: `scripts/validate-skills.sh` Doesn't Validate `.qwen/skills` Symlinks

**What:** The `CLI_SKILL_DIRS` array only includes `.claude/skills` and `.gemini/skills`, but `setup-skills.sh` also creates `.qwen/skills` symlinks.

**Why it matters:** Broken or missing Qwen Code symlinks go undetected by the quality gate. Qwen Code users get a degraded experience with no validation feedback.

**Priority:** High

**Suggested fix:** Add `.qwen/skills` to the `CLI_SKILL_DIRS` array in `validate-skills.sh`.

### IC-05: `scripts/validate-skill-format.sh` Doesn't Check Line Count

**What:** This validator checks frontmatter and name/description fields but skips the 250-line limit that `validate-skills.sh` enforces.

**Why it matters:** Skills can pass format validation while exceeding the line limit, creating inconsistency between the two validators.

**Priority:** Medium

**Suggested fix:** Add line count check using `wc -l` with the `MAX_SKILL_LINES` variable (shared with `validate-skills.sh`).

### IC-06: `scripts/minimal_quality_gate.sh` Appears to Be a Debug Stub

**What:** This 29-line script only validates skills and checks directory existence. It's labeled "Minimal test script for CI debugging" but is included in the main scripts directory alongside production scripts.

**Why it matters:** Confusion about whether this is production code or a debug artifact. If production, it's incomplete; if debug, it shouldn't be in the main scripts directory.

**Priority:** Medium

**Suggested fix:** Either complete it as a legitimate "fast path" quality gate option with documentation, or move it to a `scripts/debug/` directory with clear labeling.

### IC-07: `scripts/docs-sync.sh` Is Essentially a No-Op

**What:** This 16-line script only echoes changed markdown file names. It doesn't actually sync, update, or transform any documentation.

**Why it matters:** Misleading name suggests functionality that doesn't exist. Users or agents invoking this script expect actual documentation synchronization.

**Priority:** Medium

**Suggested fix:** Either implement actual sync logic (e.g., update cross-references, regenerate tables of contents) or rename to `scripts/list-changed-docs.sh` to accurately reflect its behavior.

### IC-08: `CHANGELOG.md` References Non-Existent `scripts/atomic-commit/`

**What:** The changelog for v0.1.0 lists scripts under `scripts/atomic-commit/` (run.sh, atomic-commit.sh, pre-commit-check.sh, etc.), but these files now live in `.agents/skills/atomic-commit/`.

**Why it matters:** Historical documentation is inaccurate, making it harder to trace the evolution of the atomic-commit feature. New contributors following the changelog will be confused.

**Priority:** Low

**Suggested fix:** Add a note in the changelog about the migration: "Atomic commit scripts moved from `scripts/atomic-commit/` to `.agents/skills/atomic-commit/`."

### IC-09: `README.md` Has Stray `# Test` Text at End

**What:** Line 174 of README.md contains just `# Test` — clearly leftover from editing or testing.

**Why it matters:** Unprofessional appearance for a production-ready template. Appears in rendered GitHub page.

**Priority:** High

**Suggested fix:** Remove the stray `# Test` line.

### IC-10: Atomic Commit Scripts Have No Tests (LESSON-004 Unresolved)

**What:** The atomic-commit skill has 6 scripts (run.sh, commit.sh, push.sh, validate.sh, create-pr.sh, verify.sh) totaling ~2,800+ lines with zero test coverage. This was flagged as Critical in LESSON-004 but remains unfixed.

**Why it matters:** These scripts handle git operations, PR creation, and CI monitoring — high-risk operations that need validation. Without tests, regressions are likely.

**Priority:** Critical

**Suggested fix:** Create BATS test suite with mocked `gh` and `git` commands. Test each phase independently. Add to CI pipeline.

---

## 3. Documentation Gaps

### DG-01: `README.md` Skill Table Is Severely Stale (8 of 34 Skills Listed)

**What:** The README lists only 8 skills in its "Available Skills" section, but the repository has 34 skills. Missing 26 skills including: accessibility-auditor, anti-ai-slop, api-design-first, architecture-diagram, atomic-commit, cicd-pipeline, code-review-assistant, codeberg-api, database-devops, docs-hook, do-web-doc-resolver, git-github-workflow, github-workflow, intent-classifier, migration-refactoring, privacy-first, security-code-auditor, self-fix-loop, skill-creator, skill-evaluator, swarm-worktree-web-research, triz-solver, ui-ux-optimize, web-search-researcher.

**Why it matters:** The README is the first thing users see. An outdated skill table dramatically understates the template's capabilities and misleads users about what's available.

**Priority:** Critical

**Suggested fix:** Run `scripts/update-agents-md.sh` to regenerate the skill table, then copy the full table to README.md. Alternatively, add a script `scripts/update-readme-skills.sh` that syncs the README skill table from the canonical source.

### DG-02: No API Documentation for Scripts

**What:** None of the 17 scripts have formal API documentation (usage, arguments, exit codes, environment variables). The `--help` flag is not implemented in most scripts.

**Why it matters:** Users and AI agents must read source code to understand script interfaces. This increases cognitive load and error risk.

**Priority:** High

**Suggested fix:** Add `--help`/`-h` handling to all scripts. Create `agents-docs/SCRIPTS.md` as a reference for all script interfaces.

### DG-03: `agents-docs/LESSONS.md` Is 608 Lines (No Progressive Disclosure)

**What:** The lessons document is 608 lines, far exceeding any reasonable single-file limit. It contains 12 detailed lessons with full root cause analysis.

**Why it matters:** Loading this entire document into an agent's context window wastes tokens. The progressive disclosure principle (from `agents-docs/CONTEXT.md`) is violated.

**Priority:** Medium

**Suggested fix:** Keep only lesson summaries (1-2 lines each) in LESSONS.md. Move full lesson details to `agents-docs/lessons/LESSON-001.md` through `LESSON-012.md`. Add index table to main file.

### DG-04: `agents-docs/MIGRATION.md` Is 793 Lines

**What:** The migration guide is 793 lines — the longest file in the repository.

**Why it matters:** Same progressive disclosure violation as DG-03. Agents loading this file consume excessive context budget.

**Priority:** Medium

**Suggested fix:** Split into `agents-docs/migration/quick-start.md` (first 3 steps), `agents-docs/migration/advanced.md` (remaining steps), `agents-docs/migration/troubleshooting.md`. Keep main file under 100 lines with links.

### DG-05: No Script Dependency Map

**What:** No documentation shows which scripts depend on which other scripts, or the execution order for common workflows.

**Why it matters:** Understanding script relationships is essential for debugging and extending the template. Currently requires reading all 17 scripts to understand dependencies.

**Priority:** Medium

**Suggested fix:** Create `agents-docs/SCRIPT_DEPENDENCIES.md` with a dependency graph (mermaid diagram) showing relationships between scripts.

### DG-06: `README.md` Community Links Use Relative Paths That Break on GitHub

**What:** `README.md` uses `../../issues` and `../../discussions` for community links. These only work when the README is viewed in the repository context, not when rendered from forks or documentation sites.

**Why it matters:** Broken links in rendered README reduce credibility and hinder community engagement.

**Priority:** Low

**Suggested fix:** Use full GitHub URLs or the `{{org}}/{{repo}}` pattern that gets replaced during template initialization.

### DG-07: No `agents-docs/SCRIPTS.md` Reference

**What:** Despite having 17 scripts, there is no centralized documentation file describing what each script does, its arguments, exit codes, and dependencies.

**Why it matters:** Agents and users must discover script capabilities by reading source code or guessing from filenames.

**Priority:** High

**Suggested fix:** Create `agents-docs/SCRIPTS.md` with a table of all scripts, their purpose, usage, arguments, exit codes, and dependencies.

---

## 4. Test Coverage

### TC-01: Only 2 BATS Test Files for 17 Scripts (12% Coverage)

**What:** Only `quality-gate.bats` (153 lines) and `validate-skills.bats` (51 lines) exist. The following 15 scripts have zero tests: `docs-sync.sh`, `gh-labels-creator.sh`, `health-check.sh`, `install-hooks.sh`, `minimal_quality_gate.sh`, `run-evals.py`, `self-fix-loop.sh`, `swarm-worktree-web-research.sh`, `update-agents-md.sh`, `update-agents-registry.sh`, `validate-git-hooks.sh`, `validate-links.sh`, `validate-skill-format.sh`, `validate-skills.sh` (only indirectly tested), and the atomic-commit scripts.

**Why it matters:** The vast majority of the codebase is untested. Any refactoring or change risks silent regressions.

**Priority:** Critical

**Suggested fix:** Prioritize tests for: (1) `validate-links.sh` (354 lines, complex), (2) `update-agents-md.sh` (doc generation), (3) `validate-git-hooks.sh` (security), (4) `install-hooks.sh` (git integration). Use BATS with mock filesystems.

### TC-02: CI Explicitly Disables Tests (`SKIP_TESTS=true`)

**What:** The CI workflow runs `SKIP_TESTS=true SKIP_GLOBAL_HOOKS_CHECK=true ./scripts/quality_gate.sh`, which means BATS tests never execute in CI. This was noted as Critical in LESSON-005 but remains unresolved.

**Why it matters:** Tests that don't run in CI provide no safety net. The quality gate's test execution is effectively dead code in the CI pipeline.

**Priority:** Critical

**Suggested fix:** Remove `SKIP_TESTS=true` from CI. Ensure BATS is installed and tests pass. Add a BATS recursion guard (already present in quality_gate.sh via `BATS_TEST_FILENAME` check).

### TC-03: No Integration Tests

**What:** All existing tests are unit-level (testing individual scripts in isolation). No tests verify end-to-end workflows like: setup-skills → quality_gate → commit → PR creation.

**Why it matters:** Integration failures between scripts are the most common source of bugs in CI/CD pipelines. Unit tests alone cannot catch these.

**Priority:** High

**Suggested fix:** Create `tests/integration/` directory with BATS tests that exercise multi-script workflows. Use temporary directories and mock git repositories.

### TC-04: No Test Coverage Reporting

**What:** No tool measures or reports test coverage for shell scripts or Python code. The `MIN_TEST_COVERAGE_PERCENT=80` constant exists in `.agents/config.sh` but is never enforced.

**Why it matters:** Without coverage metrics, there's no objective measure of testing completeness. The 80% target is aspirational, not enforced.

**Priority:** Medium

**Suggested fix:** Integrate `bashcov` or `kcov` for shell script coverage. Add `coverage.py` for Python. Report in CI as a non-blocking metric initially, then enforce.

### TC-05: No Mock Infrastructure for External Dependencies

**What:** Scripts that call `gh`, `git push`, or external APIs have no mock infrastructure for testing. The `self-fix-loop.sh` script (483 lines) interacts with GitHub CLI extensively but cannot be tested without a real repository.

**Why it matters:** Testing scripts with external dependencies requires either real infrastructure (expensive, flaky) or sophisticated mocks (not yet built).

**Priority:** Medium

**Suggested fix:** Create `tests/mocks/` directory with mock implementations of `gh`, `git`, and other external tools. Use BATS `PATH` manipulation to inject mocks.

### TC-06: `quality-gate.bats` Tests Are Superficial

**What:** Most tests in `quality-gate.bats` only check exit codes (0 or 2) rather than validating specific behavior. For example, the "detects shell scripts" test only checks if "Shell" appears in output.

**Why it matters:** These tests can pass even when the quality gate is broken. They verify the script runs, not that it works correctly.

**Priority:** Medium

**Suggested fix:** Add assertions that verify specific quality gate behaviors: language detection accuracy, skip flag effectiveness, failure aggregation, output format.

### TC-07: `run-evals.py` Has No Tests

**What:** The 748-line Python evaluation framework has zero tests despite having complex logic for eval discovery, execution, validation, and reporting.

**Why it matters:** Python code with no tests is a regression risk. The eval framework is critical for skill quality assurance.

**Priority:** High

**Suggested fix:** Add `tests/test_run_evals.py` with pytest tests covering: eval discovery, format validation, structure checks, file validation, report generation (text and JSON), error handling.

---

## 5. Architecture & Patterns

### AP-01: Duplicated Validation Logic Between `validate-skills.sh` and `validate-skill-format.sh`

**What:** Both scripts check for SKILL.md existence, `name:` field, and `description:` field in frontmatter. `validate-skills.sh` also checks line count, circular symlinks, and symlink integrity. `validate-skill-format.sh` checks frontmatter start (`---`) and field presence.

**Why it matters:** DRY violation. Changes to validation rules must be applied in two places. Inconsistency already exists (line count check missing from format validator).

**Priority:** Medium

**Suggested fix:** Create `scripts/lib/skill-validation.sh` with shared functions. Have both validators source this library. Remove duplicate checks.

### AP-02: No Shared Library for Common Script Patterns

**What:** `.agents/config.sh` exists with constants and utility functions, but it's not sourced by most scripts. Color handling, REPO_ROOT detection, and error tracking patterns are duplicated across 10+ scripts.

**Why it matters:** Every script reinvents the wheel for basic patterns. Inconsistencies creep in (e.g., different color code definitions, different REPO_ROOT detection methods).

**Priority:** Medium

**Suggested fix:** Expand `.agents/config.sh` to be a proper shared library. Source it in all scripts. Move common patterns (color setup, REPO_ROOT, error accumulation) into library functions.

### AP-03: `scripts/` Directory Lacks Sub-Organization

**What:** All 17 scripts are flat in `scripts/`. No distinction between core scripts (quality_gate, setup-skills), utility scripts (validate-*, update-*), and advanced scripts (self-fix-loop, swarm-worktree-web-research).

**Why it matters:** As the script count grows, discoverability decreases. Users can't easily find what they need.

**Priority:** Low

**Suggested fix:** Organize into `scripts/core/` (essential), `scripts/validate/` (validation), `scripts/update/` (doc generation), `scripts/advanced/` (complex workflows). Maintain backward compatibility with symlinks or wrapper scripts.

### AP-04: `install-hooks.sh` Duplicates `pre-commit-hook.sh` Content

**What:** `install-hooks.sh` generates a pre-commit hook via heredoc that is nearly identical to the standalone `pre-commit-hook.sh` file. Two sources of truth for the same hook logic.

**Why it matters:** If one is updated and the other isn't, users get different behavior depending on how they installed the hook.

**Priority:** Medium

**Suggested fix:** Have `install-hooks.sh` copy `pre-commit-hook.sh` directly instead of embedding a heredoc. Or have the heredoc source the standalone script.

### AP-05: Quality Gate Uses String Matching for CI Status Detection

**What:** `self-fix-loop.sh` detects CI failures by grepping output for keywords like "fail", "error", "✗". This is fragile and produces false positives/negatives.

**Why it matters:** Keyword matching can miss failures (different error messages) or flag non-errors (words like "failure" in commit messages).

**Priority:** Medium

**Suggested fix:** Use `gh pr checks --json` for structured status data. Parse JSON instead of grepping text output.

### AP-06: No Plugin/Extension Mechanism for Quality Gate

**What:** The quality gate has hardcoded language detection and checks. Adding a new language (e.g., Ruby, Java) requires modifying the core script.

**Why it matters:** The template claims to be language-agnostic but the quality gate is not extensible without code changes.

**Priority:** Low

**Suggested fix:** Create a plugin system where language-specific checks are defined in `.agents/skills/<language>-quality/` and discovered at runtime. Quality gate loads plugins dynamically.

### AP-07: `swarm-worktree-web-research.sh` References Non-Existent Skill Script

**What:** Line 69 checks for `.agents/skills/do-web-doc-resolver/scripts/resolve.py`, but this file may not exist (the skill directory exists but the script path is unverified).

**Why it matters:** The script warns about missing resolver but continues execution, potentially producing empty or invalid results.

**Priority:** Medium

**Suggested fix:** Verify the resolve.py script exists. If not, fail gracefully with a clear error message. Add this check to the quality gate.

---

## 6. Security & Quality

### SQ-01: `scripts/health-check.sh` Has Wrong Shebang (`#!/usr/bash`)

**What:** Same as IC-03. The shebang `#!/usr/bash` is invalid on virtually all systems.

**Why it matters:** This is a health-check script meant to verify the environment is correctly set up. If it can't even run, it fails at its primary purpose. Additionally, it displays the user's git config globally (user.name, user.email) which could leak personal information in shared environments.

**Priority:** Critical

**Suggested fix:** Fix shebang to `#!/usr/bin/env bash`. Consider adding a `--no-personal-info` flag to suppress git config display.

### SQ-02: `scripts/gh-labels-creator.sh` Deletes All Labels in Interactive Mode

**What:** In interactive mode (default), the script prompts to delete ALL existing labels before creating new ones. This is destructive and irreversible.

**Why it matters:** A user running this script accidentally could lose carefully curated labels from their repository. The `--ci` flag skips deletion, but the default behavior is dangerous.

**Priority:** High

**Suggested fix:** Make `--ci` the default behavior. Only delete labels with an explicit `--force-delete` flag. Add a confirmation that lists exactly which labels will be deleted.

### SQ-03: `scripts/install-hooks.sh` Runs `git commit --amend` in Post-Commit Hook

**What:** The post-commit hook template generated by `install-hooks.sh` runs `git commit --amend --no-edit` to include updated docs. This rewrites commit history silently.

**Why it matters:** Silent history rewriting can cause issues with force-push requirements, break CI pipelines that track commit hashes, and confuse collaborators. If the amend fails, the warning is suppressed.

**Priority:** High

**Suggested fix:** Make the amend behavior opt-in via configuration. Add a clear warning when installing hooks. Consider using a separate commit for doc updates instead of amending.

### SQ-04: Multiple Scripts Use Non-Portable `#!/bin/bash` Shebang

**What:** Four scripts use `#!/bin/bash` instead of `#!/usr/bin/env bash`: `gh-labels-creator.sh`, `minimal_quality_gate.sh`, `validate-skill-format.sh`, and `health-check.sh` (which uses the even worse `#!/usr/bash`).

**Why it matters:** On some systems (NixOS, some BSD variants), bash is not at `/bin/bash`. This causes "interpreter not found" errors.

**Priority:** Medium

**Suggested fix:** Standardize all scripts to `#!/usr/bin/env bash`. Add a shebang check to the quality gate.

### SQ-05: `scripts/self-fix-loop.sh` Has No Rate Limiting for GitHub API

**What:** The self-fix loop can create PRs, push branches, and poll CI in a tight retry loop (up to 5 iterations) without any rate limiting or backoff between iterations.

**Why it matters:** GitHub API rate limits could be exceeded, causing the entire loop to fail. Aggressive polling could also trigger abuse detection.

**Priority:** Medium

**Suggested fix:** Add exponential backoff between iterations. Check rate limit headers from GitHub API responses. Add a minimum delay between PR creation attempts.

### SQ-06: `scripts/run-evals.py` Imports `time` Inside Function

**What:** Line 218 has `import time` inside `run_command_check()` instead of at the top of the file.

**Why it matters:** While functionally correct, this violates Python style conventions (PEP 8) and the repository's own code quality standards. It also means the import happens on every function call.

**Priority:** Low

**Suggested fix:** Move `import time` to the top-level imports section.

### SQ-07: `scripts/validate-skills.sh` Uses `set +e` Without Clear Error Accumulation

**What:** The script disables errexit with `set +e` but uses a `FAILED=1` pattern for error accumulation. However, some error paths don't properly set FAILED before continuing.

**Why it matters:** If an error occurs in an unguarded code path, the script might exit with 0 (success) despite failures.

**Priority:** Medium

**Suggested fix:** Audit all code paths to ensure FAILED is set on every error. Consider using a trap-based approach for more reliable error tracking.

### SQ-08: No Secret Scanning in Pre-Commit Hook

**What:** The pre-commit hook runs the quality gate but doesn't scan for secrets, API keys, or credentials before allowing commits.

**Why it matters:** A developer could accidentally commit secrets that pass the quality gate (which doesn't check for secrets). The CI has Trivy and GitLeaks, but these run after the commit is already in history.

**Priority:** High

**Suggested fix:** Add a lightweight secret scan to the pre-commit hook using `grep` for common patterns (AWS keys, private keys, passwords). Integrate with the existing security-scan.yml workflow results.

### SQ-09: `scripts/swarm-worktree-web-research.sh` Uses `eval`-Like Pattern with Heredoc

**What:** The script uses heredocs to generate JSON with interpolated variables (lines 169-177), which could be problematic if query strings contain special characters.

**Why it matters:** If a research query contains quotes, backticks, or dollar signs, the generated JSON could be malformed or execute unintended commands.

**Priority:** Low

**Suggested fix:** Use `jq` or Python for JSON generation instead of heredoc interpolation. This ensures proper escaping.

### SQ-10: `scripts/update-agents-md.sh` and `scripts/update-agents-registry.sh` Duplicate Frontmatter Parsing

**What:** Both scripts implement similar `sed`-based frontmatter extraction logic independently.

**Why it matters:** DRY violation. If the frontmatter format changes, both scripts must be updated. The parsing logic is fragile (sed-based) and duplicated.

**Priority:** Medium

**Suggested fix:** Extract frontmatter parsing into `scripts/lib/frontmatter.sh` or a Python utility. Both scripts source/use the shared implementation.

---

## Quick Wins

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | Remove stray `# Test` from README.md | 1 minute | High — professional appearance |
| 2 | Fix `#!/usr/bash` shebang in health-check.sh | 1 minute | Critical — script won't run |
| 3 | Add `.qwen/skills` to validate-skills.sh CLI_SKILL_DIRS | 1 minute | High — Qwen validation gap |
| 4 | Standardize `#!/bin/bash` → `#!/usr/bin/env bash` in 3 scripts | 5 minutes | Medium — portability |
| 5 | Move `import time` to top of run-evals.py | 1 minute | Low — code quality |
| 6 | Add `--help` flag to quality_gate.sh | 10 minutes | Medium — usability |
| 7 | Rename docs-sync.sh to list-changed-docs.sh | 1 minute | Low — clarity |
| 8 | Move minimal_quality_gate.sh to scripts/debug/ | 1 minute | Low — clarity |
| 9 | Add CHANGELOG.md note about atomic-commit relocation | 2 minutes | Low — accuracy |
| 10 | Make gh-labels-creator.sh default to --ci mode | 5 minutes | High — safety |

## Cross-Validated Issues

These issues were confirmed by multiple personas (RYAN, FLASH, and SOCRATES):

| Issue | RYAN | FLASH | SOCRATES | Consensus |
|-------|------|-------|----------|-----------|
| README.md stale skill table (8/34) | ✓ Security risk (misleading) | ✓ Blocks adoption | ✓ What evidence supports the table? | **Critical — fix first** |
| Tests disabled in CI (SKIP_TESTS=true) | ✓ No safety net | ✓ Wasted CI resources | ✓ Why disable tests? | **Critical — enable tests** |
| Scripts exceed 500-line limit | ✓ Maintenance burden | ✓ Slows development | ✓ Why the limit if not enforced? | **High — enforce or refactor** |
| health-check.sh wrong shebang | ✓ Script won't run | ✓ Blocks onboarding | ✓ How does this pass quality gate? | **Critical — immediate fix** |
| validate-skills.sh misses .qwen/skills | ✓ Undetected breakage | ✓ Qwen users affected | ✓ Why the discrepancy? | **High — add to array** |
| validate-skill-format.sh duplicates validate-skills.sh | ✓ Maintenance burden | ✓ Wasted validation time | ✓ Why two validators? | **Medium — consolidate** |
| No tests for 15 of 17 scripts | ✓ Regression risk | ✓ Slows refactoring | ✓ What prevents adding tests? | **Critical — add tests** |
| README.md stray `# Test` | ✓ Unprofessional | ✓ Blocks credibility | ✓ Why wasn't this caught? | **High — remove immediately** |
| install-hooks.sh duplicates pre-commit-hook.sh | ✓ Two sources of truth | ✓ Confusing installation | ✓ Which one is authoritative? | **Medium — single source** |
| CHANGELOG.md references non-existent paths | ✓ Historical inaccuracy | ✓ Confuses contributors | ✓ When did the move happen? | **Low — add note** |

## Dependency Map

```
Phase 1: Immediate Fixes (no dependencies)
├── SQ-01/IC-03: Fix health-check.sh shebang
├── IC-09: Remove stray # Test from README.md
├── IC-04: Add .qwen/skills to validate-skills.sh
├── SQ-04: Standardize shebangs across scripts
├── SQ-06: Move import time in run-evals.py
├── DG-09 (Quick Win #10): Make gh-labels-creator.sh default to --ci

Phase 2: Documentation Fixes (depends on Phase 1)
├── DG-01: Update README.md skill table (needs accurate skill count)
├── DG-07: Create agents-docs/SCRIPTS.md
├── DG-02: Add --help to scripts
├── IC-08: Update CHANGELOG.md atomic-commit reference

Phase 3: Code Quality (depends on Phase 2)
├── IC-01: Split run-evals.py (needs SCRIPTS.md for reference)
├── IC-02: Split swarm-worktree-web-research.sh
├── AP-01: Consolidate validate-skills.sh and validate-skill-format.sh
├── AP-02: Expand .agents/config.sh as shared library
├── AP-04: Fix install-hooks.sh duplication
├── SQ-10: Extract shared frontmatter parsing

Phase 4: Testing (depends on Phase 3)
├── TC-02: Enable tests in CI (needs passing tests first)
├── TC-01: Add BATS tests for untested scripts
├── TC-07: Add pytest tests for run-evals.py
├── TC-03: Add integration tests
├── TC-05: Create mock infrastructure
├── TC-04: Add coverage reporting

Phase 5: Features (depends on Phase 4)
├── FG-01: Create init-template.sh
├── FG-03: Add benchmarking
├── FG-04: Add skill versioning
├── AP-06: Plugin system for quality gate
```

## Recommended Action Plan

### Sprint 1: Critical Fixes (Day 1)
1. **Fix `scripts/health-check.sh` shebang** — `#!/usr/bash` → `#!/usr/bin/env bash`
2. **Remove stray `# Test` from README.md** — one-line fix, high visibility
3. **Add `.qwen/skills` to validate-skills.sh** — one-line array addition
4. **Standardize shebangs** — 3 scripts from `#!/bin/bash` to `#!/usr/bin/env bash`
5. **Move `import time` in run-evals.py** — one-line fix

### Sprint 2: Documentation & Safety (Day 2-3)
6. **Update README.md skill table** — run `update-agents-md.sh` and sync to README
7. **Create `agents-docs/SCRIPTS.md`** — document all 17 scripts
8. **Make gh-labels-creator.sh default to --ci** — prevent accidental label deletion
9. **Add `--help` to quality_gate.sh** — improve usability
10. **Fix install-hooks.sh duplication** — single source for pre-commit hook

### Sprint 3: Code Quality (Day 4-5)
11. **Split run-evals.py** — into discovery, runner, validators, reporter modules
12. **Split swarm-worktree-web-research.sh** — extract phases into lib scripts
13. **Consolidate validators** — merge validate-skills.sh and validate-skill-format.sh logic
14. **Expand .agents/config.sh** — make it the actual shared library

### Sprint 4: Testing (Day 6-8)
15. **Add BATS tests** for validate-links.sh, update-agents-md.sh, validate-git-hooks.sh
16. **Add pytest tests** for run-evals.py
17. **Enable tests in CI** — remove SKIP_TESTS=true
18. **Add integration tests** for multi-script workflows
19. **Add coverage reporting** — bashcov for shell, coverage.py for Python

### Sprint 5: Features & Polish (Day 9-10)
20. **Create init-template.sh** — template initialization wizard
21. **Add secret scanning to pre-commit hook** — lightweight grep-based check
22. **Create script dependency map** — agents-docs/SCRIPT_DEPENDENCIES.md
23. **Add rate limiting to self-fix-loop.sh** — exponential backoff

### Validation Criteria
- [ ] All scripts use `#!/usr/bin/env bash`
- [ ] No script exceeds 500 lines
- [ ] README.md skill table lists all 34 skills
- [ ] All 17 scripts have `--help` support
- [ ] BATS tests cover at least 80% of scripts
- [ ] CI runs tests without SKIP_TESTS=true
- [ ] No duplicate validation logic between scripts
- [ ] agents-docs/SCRIPTS.md exists and is complete
- [ ] health-check.sh runs successfully
- [ ] validate-skills.sh checks .qwen/skills

### Monitoring Plan
- Track CI pass rate weekly (target: 100%)
- Monitor quality gate execution time (target: <60 seconds)
- Track test coverage percentage (target: 80%+)
- Review skill table accuracy monthly
- Audit shebang consistency in pre-commit hook
- Log any new scripts exceeding line limits
