## LESSON-022: Codacy Cloud CLI for PR issue suppression

**Issue**: Codacy Static Code Analysis check blocks PRs with ACTION_REQUIRED status. 91 issues on PR #209 were hard to triage from the web dashboard.

**Root Cause**: No local tooling to query or suppress Codacy Cloud issues programmatically.

**Solution**:
- Install `@codacy/codacy-cloud-cli` via `npm i -g @codacy/codacy-cloud-cli`
- Uses same `~/.codacy/credentials` as `codacy-analysis-cli` (shared auth)
- Query PR issues: `codacy pull-request gh org repo PR# --output json` → contains `newIssues[]` with `resultDataId` (numeric issue ID)
- Suppress: `codacy pull-request gh org repo PR# --ignore-issue <numeric-id> --ignore-reason FalsePositive`
- The Analysis CLI (`@codacy/analysis-cli`) locally runs limited tools (ESLint9, Stylelint, ShellCheck, Trivy, Agentlinter). Most Python/Ruby/Java tools fail locally. Cloud CLI is the primary tool for interacting with Codacy.

**Tags**: #codacy #static-analysis #ci-cd #quality-gate

---
