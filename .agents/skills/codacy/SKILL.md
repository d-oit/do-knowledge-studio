---
name: codacy
description: "Tool reference under static-analysis-suppression: query Codacy PR analysis, triage issues, suppress false positives, run local analysis."
category: quality
version: 1.1.0
template_version: 0.1.0
license: MIT
compatibility: Node.js 22.23.4+ (cloud CLI 1.15.x engines), npm global install. Requires Codacy repository access for the Cloud CLI. Python 3.x recommended for JSON parsing but not required.
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
# Always latest (2026-11-15: cloud-cli 1.15.0, analysis-cli 0.29.1)
npm i -g @codacy/codacy-cloud-cli@latest @codacy/analysis-cli@latest

# Authenticate (once, covers both CLIs)
codacy login --token <your-api-token>
# Account token: Codacy > My Account > Access Management > API Tokens
# Repository token: Codacy > Repository > Settings > Integrations > Project API token
codacy info   # verify: prints the authenticated user
```

If `npm i -g` fails with `EACCES` on the system prefix, install to a user
prefix and call the binary by path — do not `sudo` an npm global install:

```bash
npm i -g --prefix "$HOME/.local" @codacy/codacy-cloud-cli@latest
"$HOME/.local/bin/codacy" --version
```

**Two token types, different powers.** `codacy login` stores an *account*
API token. A *repository* token is passed per command (`--repository-token`)
or set as `CODACY_PROJECT_TOKEN`, and only authorizes a subset of commands:
`tools`, `tool`, `patterns`, `pattern`, `issues` (including `--overview`),
`repository`, `repository --reanalyze` work; `issues --ignore`, `issues
--ignored`, `issue`, `pull-request(s)`, `findings`/`finding`, `images`, and
`repository --add/--remove/--link-standard` need an account token. Precedence:
`--repository-token` > `CODACY_PROJECT_TOKEN` > `CODACY_API_TOKEN` > stored
credentials (docs.codacy.com/codacy-cloud-cli, 2026-10).

## When to Use Each CLI

| Situation | CLI | Command |
|-----------|-----|---------|
| PR is blocked by Codacy | Cloud | `codacy pull-request ... --output json` |
| Need to suppress false positives | Cloud | `codacy issues ... --ignore -y` (branch bulk) or `--ignore-issue <resultDataId>` (PR, see limitations) |
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

- Every id is numeric (`resultDataId` in `--output json`); the hash-style
  `issueId` field is rejected by every command
- Ignoring only takes effect after the **next analysis** — follow with
  `codacy pull-request <pr> --reanalyze-and-wait` (`-w`), which polls every
  10 s up to 20 min and reports issue deltas
- Data reflects the HEAD commit of a branch; there is no historical view
- **PR-scoped ignore can 404** (`pull-request ... --ignore-issue <id>` →
  `Resource not found (HTTP 404)`; `--reanalyze` → `Failed to request
  reanalysis: Not Found`) while reads on the same PR succeed, on 1.0.0 and
  1.15.0 alike. `codacy issue <id> --ignore` resolves ids against the
  *default branch* HEAD and answers `Result data not found for id N and
  commit C` for results that exist only on the PR commit. When this bites,
  fall back to the branch-scoped bulk form (below) and record the reason.
- **Diagnose a read-only token before chasing endpoint bugs.** If reads
  succeed but *every* write 404s, the token has no write scope and no ignore
  command will ever work. Cheap benign probe:
  `codacy repository gh <org> <repo> --reanalyze` — `Failed to request
  reanalysis: Not Found` alongside a successful `codacy repository` read means
  read-only credentials, not a broken CLI. Confirm the problem is credentials
  before patching config or filing a bug.
- Organization-level coding standards override repo-level tool/pattern
  settings, and a pattern enforced by a standard refuses `--enable/--disable`

### Branch-scoped bulk ignore (the reliable suppression path)

```bash
# Count first — the blast radius is the whole pattern on that branch
codacy issues gh <org> <repo> -b <branch> \
  -p <Pattern_Id> --output json | python3 -c "
import json,sys,collections
iss=json.load(sys.stdin)['issues']
print(len(iss),'issues')
[print(' ',c,f) for f,c in collections.Counter(i['filePath'] for i in iss).most_common()]
"

# Then ignore, with the reason recorded
codacy issues gh <org> <repo> -b <branch> -p <Pattern_Id> \
  --ignore --ignore-reason FalsePositive --ignore-comment "<why>" -y
```

Repo-level `issues` filters are `--branch`, `--patterns`, `--severities`,
`--categories`, `--languages`, `--tools`, `--tags`, `--authors` — there is no
file filter, so verify the file list is entirely tooling/test code before
committing to a bulk ignore. `codacy issues -i` lists what is ignored and
`codacy issue <id> --unignore` reverses it.

## Common Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| `Error: --ignore-issue must be a number` | Used hash ID instead of numeric resultDataId | Use `resultDataId` from JSON output |
| `Issue #NNNNN not found in this pull request` | Wrong PR or stale analysis | Run `--reanalyze` first or check PR number |
| Local analysis = 0 issues, Cloud = many | Cloud runs tools not available locally | Always use Cloud CLI for actual PR data |
| Analysis CLI install fails | Missing Python/Ruby/Java runtime | Use only JS/TS tools locally; skip auto-install |
| `.codacy.yml` disable_rules not taking effect | The prefix does not match the engine that **emitted** the finding | Read `patternInfo.id` from `--output json` and suppress with that exact prefix, in that engine's section |
| `.codacy/codacy.config.json` references `eslint.config.js` | Stale reference | Change to `eslint.config.mjs` |
| Ignore/reanalyze 404s while reads work | Read-only API token (all writes) or the PR-scoped write limitation | `--reanalyze` probe to tell them apart; then a write-capable token, branch-scoped bulk ignore, or the UI |

## Codacy 2026 Configuration

### .codacy.yml Format

```yaml
---
exclude_paths:
  - "dist/**"
  - "node_modules/**"
  - "coverage/**"
  - ".agents/**"
  - "**/__tests__/**"
  - "**/*.test.*"
  - "**/*.spec.*"
engines:
  biome:
    enabled: true
    config: biome.json
  eslint-9:
    enabled: true
    exclude_paths:
      - "**/__tests__/**"
      - "**/*.test.*"
      - "**/*.spec.*"
  opengrep:
    enabled: true
```

**Key 2026 facts (verified against cloud analysis output, not assumed):**
- `.codacy.yml` is the primary config file (NOT `codacy.config.json`)
- Each `engines:` section is independent. A `disable_rules` entry only
  applies to the engine section it sits in, and its prefix must match the
  prefix Codacy actually emits. This repo's cloud analysis reports
  `ESLint8_*` ids even though ESLint 9 config is committed — so an
  FP suppression added only under `eslint-9:` is **inert**. Mirror every
  suppression into `eslint-9:`, `eslint-8:`, and `opengrep:` as needed.
- Prefixes you may see: `ESLint8_*` (legacy engine), `ESLint9_*`,
  `SecurityJs_prod.*` (opengrep/ESLint security plugin),
  `Semgrep_javascript_dos_rule-*` / `Semgrep_*` (opengrep), `Trivy_*`,
  `Agentlinter_*`
- Preview-class patterns are NOT auto-detected false positives, so
  `--ignore-all-false-positives` will not clear them; only
  `potentialIssues` are swept by that flag
- Codacy automatically picks up `.codacy.yml` from the default branch; while
  `.codacy.yml` exists, UI-defined ignore settings are overridden
- In this repo `.codacy.yml` is an ignore/suppression config — AGENTS.md
  forbids editing it without explicit maintainer approval. Suppressing a
  known FP via the CLI does not need approval; editing the file does.

### Tool Names (2026)

Use these names in `.codacy.yml` `engines` section:

| Tool | Config Name |
|------|-------------|
| ESLint 9+ | `eslint-9` |
| ESLint 8 (legacy) | `eslint-8` |
| Biome | `biome` |
| Opengrep | `opengrep` |
| ShellCheck | `shellcheck` |
| Trivy | `trivy` |
| Stylelint | `stylelint` |

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
