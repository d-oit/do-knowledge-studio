---
name: codacy
description: Use Codacy static analysis CLIs to query PR analysis, triage issues, suppress false positives, and run local analysis. Trigger when Codacy blocks a PR, CI quality gate fails, asked to fix/suppress Codacy issues, query PR quality data, or integrate Codacy into agent workflows. Also trigger on "Codacy is failing", "static analysis check", "code quality gate", "Codacy check blocked", "Codacy findings", "Codacy issues", "suppress Codacy", "Codacy reanalysis", "fix Codacy", "Codacy PR", "code review quality gate".
version: 1.0.0
template_version: 0.1.0
license: MIT
compatibility: Node.js 18+, npm global install. Requires Codacy project access for Cloud CLI. Python 3.x recommended for JSON parsing but not required.
metadata:
  author: d-oit
---

# Codacy

Two CLIs for interacting with Codacy static analysis — local analysis and remote Cloud API.

## Quick Reference

- `codacy-analysis` — Local static analysis (bundled/on-PATH tools only)
- `codacy` — Cloud API (query PRs, suppress issues, reanalyze)
- Both share credentials at `~/.codacy/credentials`

## Setup

```bash
npm i -g @codacy/analysis-cli
npm i -g @codacy/codacy-cloud-cli

# Authenticate (once, covers both CLIs)
codacy login --token <your-api-token>
# Token: Codacy > My Account > Access Management > Account API Tokens
```

## When to Use Each CLI

| Situation | CLI | Command |
|-----------|-----|---------|
| PR is blocked by Codacy | Cloud | `codacy pull-request ... --output json` |
| Need to suppress false positives | Cloud | `codacy pull-request ... --ignore-issue` |
| Need to run analysis before push | Analysis | `codacy-analysis analyze --pr` |
| Need coverage/quality gate data | Cloud | `codacy pull-request ... --output json` |
| Trigger reanalysis | Cloud | `codacy pull-request ... --reanalyze` |

## Workflow: Triage a Codacy-Blocked PR

### Step 1: Get PR Analysis

```bash
codacy pull-request gh <org> <repo> <prNumber> --output json > /tmp/codacy-pr.json
```

Parse the results:

```bash
python3 -c "
import json
from collections import Counter
with open('/tmp/codacy-pr.json') as f:
    data = json.load(f)
issues = data.get('newIssues', [])
print(f'New issues: {len(issues)}')
print(f'Quality gate: {\"PASS\" if data[\"pullRequest\"].get(\"isUpToStandards\") else \"FAIL\"}')
by_tool = Counter(i['commitIssue']['toolInfo']['name'] for i in issues)
for t, c in by_tool.most_common():
    print(f'  {t}: {c}')
print()
by_file = Counter(i['commitIssue']['filePath'] for i in issues)
for f, c in by_file.most_common():
    print(f'  {c:3d}x {f}')
"
```

### Step 2: Categorize Issues

Classify each issue from the JSON as:

**False positives** — suppress via Cloud CLI:
- SQLite-specific syntax (VIRTUAL, PRAGMA) flagged by SQLint
- `dangerouslySetInnerHTML` with sanitizeHtml() applied before rendering
- CLI `fs` access patterns (expected for CLI tooling)
- Test fixtures with HTML in mocks
- localStorage key names flagged as "hardcoded passwords"

**Real issues** — fix in code, categorized by automation level:
- Quick fixes: missing `type="button"`, `<div role="button">` → `<button>`, unused imports
- Medium fixes: non-null assertions with proper guards, arrow function shorthands, unnecessary optionals
- Deep fixes: Generic Object Injection Sink, non-serializable expressions, unsafe computed property deletes

### Step 3: Suppress False Positives

Issue IDs are the numeric `resultDataId` field in the JSON output, NOT the hash IDs:

```bash
codacy pull-request gh <org> <repo> <prNumber> \
  --ignore-issue <resultDataId> \
  --ignore-reason FalsePositive

# Or suppress all auto-detected false positives at once:
codacy pull-request gh <org> <repo> <prNumber> --ignore-all-false-positives
```

Extract issue IDs from JSON (requires `jq` or use Python):

```bash
# With jq
jq '.newIssues[] | {id: .commitIssue.resultDataId, tool: .commitIssue.toolInfo.name, file: .commitIssue.filePath, message: .commitIssue.message}' /tmp/codacy-pr.json

# With Python (no jq required)
python3 -c "
import json
with open('/tmp/codacy-pr.json') as f:
    data = json.load(f)
for issue in data.get('newIssues', []):
    ci = issue['commitIssue']
    print(f\"{ci['resultDataId']} | {ci['toolInfo']['name']:10s} | {ci['filePath']}:{ci['lineNumber']} | {ci['message'][:80]}\")
"
```

### Step 4: Fix Real Issues in Code

Batch fixes by pattern across all affected files. For each fix, verify with `pnpm run lint && pnpm run typecheck && pnpm run test` (adjust for the project's toolchain).

## Workflow: Local Analysis

```bash
# Initialize config with Codacy defaults
codacy-analysis init --default

# Check which tools are available locally
codacy-analysis analyze --inspect --output-format json

# Run full analysis
codacy-analysis analyze --install-dependencies --output-format json

# Run on PR changes only (compares against target branch)
codacy-analysis analyze --pr --install-dependencies --output-format json

# Run on a specific file
codacy-analysis analyze ./src/main.ts --output-format json

# Run specific tools
codacy-analysis analyze --tool ESLint9 --tool Stylelint --output-format json
```

## Known Limitations

### Analysis CLI (Local)

| Tool | Status | Reason |
|------|--------|--------|
| ESLint9, ESLint8, Stylelint, ShellCheck, Trivy, markdownlint, Agentlinter, Jackson Linter | ✅ Works | Bundled or on PATH |
| Bandit, Pylint, Prospector, Lizard | ❌ Fails | Python binary not found (venv creation fails) |
| Semgrep | ❌ Fails | opengrep binary not found |
| SQLint | ❌ Fails | Ruby runtime missing (gem install fails) |
| PMD | ❌ Fails | Java runtime not available |

The Analysis CLI may show "0 issues" even when the Cloud CLI reports many — always cross-reference.

### Cloud CLI

- `--ignore-issue` requires numeric `resultDataId`, NOT the hash-style issue ID
- Suppressions take effect immediately; reanalysis may take a few minutes
- Organization-level coding standards override repo-level tool/pattern settings

## Common Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| `Error: --ignore-issue must be a number` | Used hash ID instead of numeric resultDataId | Use `resultDataId` from JSON output |
| `Issue #NNNNN not found in this pull request` | Wrong PR or stale analysis | Run `--reanalyze` first or check PR number |
| Local analysis = 0 issues, Cloud = many | Cloud runs tools not available locally | Always use Cloud CLI for actual PR data |
| Analysis CLI install fails | Missing Python/Ruby/Java runtime | Use only JS/TS tools locally; skip auto-install |

## Best Practices

### DO:
- Use Cloud CLI as primary tool for PR analysis
- Batch false positive suppressions before fixing code
- Verify fixes with lint + typecheck + test after each batch
- Save issue JSON to file for repeatable triage

### DON'T:
- Rely on local Analysis CLI for full results (it's limited)
- Use hash-style issue IDs for suppression (use numeric resultDataId)
- Suppress issues without verifying they're actually false positives
- Forget to `init --default` before first local analysis
