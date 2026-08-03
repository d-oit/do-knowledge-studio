---
name: static-analysis-suppression
description: >-
  Suppress false positive or pre-existing issues from static analysis tools on PRs.
  Use when Codacy, DeepSource, or ESLint blocks a PR with inline review comments
  that are false positives, pre-existing (not introduced by the diff), or
  config-level noise (e.g., Qwik-specific Biome rules in a React project).
  Covers all suppression methods: code-level fixes, eslint-disable comments,
  config changes (.codacy.yml, .deepsource.toml), and admin merge override.
version: "1.0"
template_version: "1.0"
metadata:
  source: codified from ~12 sessions of PR CI fix work
  related-skills: codacy, git-github-workflow
allowed-tools: "read grep bash edit write"
---

# Static Analysis Suppression on PRs

Systematic workflow for clearing Codacy, DeepSource, and ESLint blockers
on pull requests. **Fix code before suppressing config.**

## Decision Tree

```
PR blocked by static analysis check?
├── ✓ Code-level fix is simplest/cleanest → fix source code
├── ✓ False positive from external tool?
│   ├── DeepSource: use code rewrite (const → arrow, etc.)
│   ├── Codacy ESLint: use `// eslint-disable-next-line <rule>` inline
│   ├── Codacy Biome/Qwik: check .codacy.yml `engines.biome.config` rules
│   └── Pre-existing complexity: .deepsource.toml analyzer.meta.issue_patterns
├── ✗ Config-only fix (no code change)?
│   ├── Codacy: .codacy.yml `engines.eslint-9` or `exclude_paths`
│   └── DeepSource: .deepsource.toml `[[analyzers.meta.issue_patterns]]` with `skip = true`
└── ✗ All real checks pass, only policy tool blocks?
    → `gh pr merge --admin` override (requires user approval)
```

**2026 Key Changes:**
- Codacy: Use `eslint-9` (NOT `eslint-8`) in `.codacy.yml`
- DeepSource: Use `[[analyzers.meta.issue_patterns]]` (NOT `[analyzers.meta.checks]`)
- Both tools: Fix `.mimocode/` typo (NOT `.mimicode/`) in exclude paths

## Workflow

### 1. Diagnose the blocker

Check which tool is blocking and why:

```bash
gh pr checks <PR#>  # list all status checks
gh pr view <PR#> --json statusCheckRollup  # full detail incl. DeepSource/Codacy
```

Classify the issue:

| Category | Example | Fix method |
|----------|---------|------------|
| Genuine lint error | unused variable, missing type | Fix source code |
| DeepSource code pattern | `function` decl → `const` arrow | Code rewrite |
| DeepSource redundant | `mockResolvedValue(undefined)` | Remove `undefined` arg |
| Codacy ESLint8_* | `security/detect-object-injection` | `disable_rules` in `.codacy.yml` |
| Codacy Biome (Qwik) | `useQwikValidLexicalScope` | `biome.json` or `.deepsource.toml` |
| Pre-existing complexity | `max-complexity "30"` | `.deepsource.toml` `[analyzers.meta]` |
| ESLint disable needed | `react-hooks/refs`, `set-state-in-effect` | `// eslint-disable-next-line` inline |

### 2. Apply suppression

#### Code rewrite (preferred)

DeepSource JS-0067: `export default async function foo() {}`
→ `const foo = (): void => { ... }; export default foo;`

DeepSource JS-0240: `{ type: type }`
→ `{ type }`

DeepSource JS-W1042: `vi.fn().mockResolvedValue(undefined)`
→ `vi.fn().mockResolvedValue()`

DeepSource JS-0098: `void someFunction()`
→ `someFunction()`

#### eslint-disable inline

```ts
// eslint-disable-next-line react-hooks/refs -- hook uses refs inside effects, not for rendering
```

For multiple consecutive lines, use block form:

```ts
/* eslint-disable react-hooks/rules-of-hooks */
useHook(condition);
useHook(other);
/* eslint-enable react-hooks/rules-of-hooks */
```

#### Codacy config (.codacy.yml)

```yaml
engines:
  eslint-9:
    enabled: true
    exclude_paths:
      - "**/__tests__/**"
      - "**/*.test.*"
      - "**/*.spec.*"
```

**Codacy 2026 config format:**
- Use `eslint-9` (NOT `eslint-8`) for ESLint 9+ flat config
- Tool names: `eslint-8`, `eslint-9`, `biome`, `opengrep`, `shellcheck`, `trivy`
- `.codacy.yml` is the primary config file (NOT `codacy.config.json` which is auto-generated)
- Codacy automatically picks up `.codacy.yml` from the default branch
- If `.codacy.yml` exists, UI-defined ignore settings are overridden
- The `disable_rules` format uses `ESLint9_<rule-id>` prefix (e.g., `ESLint9_no-unsafe-finally`)

#### DeepSource config (.deepsource.toml)

```toml
[[analyzers]]
name = "javascript-typescript"
enabled = true

  [analyzers.meta]
  cyclomatic_complexity_threshold = "critical"  # allows up to ~50 complexity
  max_functions = "100"
  plugins = ["react"]
  environment = ["nodejs", "browser"]
  module_system = "es-modules"
  dialect = "typescript"
  skip_doc_coverage = ["function-declaration", "function-expression", "arrow-function-expression"]

  # Suppress specific false-positive rules
  [[analyzers.meta.issue_patterns]]
  pattern = "JS-0067"
  skip = true
```

**DeepSource 2026 config format:**
- `.deepsource.toml` must be committed to the repository's **default branch**
- `cyclomatic_complexity_threshold` options: `low`, `medium`, `high`, `very-high`, `critical`
- `skip_doc_coverage` excludes artifact types from documentation coverage metric
- `issue_patterns` with `skip = true` suppresses specific rules
- The `transformers` section configures external tools (ESLint)
- The `test_runners` section configures test runners (vitest)
- **DCV metric**: The documentation-coverage metric is dashboard-only and cannot be disabled from code. Use `skip_doc_coverage` to exclude artifact types.

### 3. Admin merge (last resort)

When ALL real functional checks pass but a static analysis tool
still blocks (pre-existing issue, known false positive):

```bash
gh pr merge <PR#> --squash --admin --subject "<message>"
```

## Common DeepSource Issue Codes

| Code | Issue | Fix |
|------|-------|-----|
| JS-0067 | `function` decl in module scope | **False positive for ES modules** — suppress in `.deepsource.toml` `[analyzers.meta.checks]` with `JS_0067 = "off"` |
| JS-0240 | `type: type` redundant key | Property shorthand |
| JS-0339 | `!` non-null assertion | Proper type narrowing or optional chaining |
| JS-0357 | Arrow `const` used before decl | Move definition above callers |
| JS-0098 | `void` expression | Remove `void` keyword (but required by `@typescript-eslint/no-floating-promises`) |
| JS-W1042 | `mockResolvedValue(undefined)` | Omit `undefined` argument |
| JS-C1003 | `import * as` namespace | Named imports for actually-used exports |
| JS-R1005 | Complexity exceeds threshold | `.deepsource.toml` `cyclomatic_complexity_threshold` — set to `"critical"` to allow up to ~50 complexity |

## Common Codacy ESLint Issue Codes

| Code | Issue | Fix |
|------|-------|-----|
| `ESLint9_security_detect-object-injection` | `obj[key]` access | Not in local ESLint — `disable_rules` only |
| `ESLint9_no-confusing-void-expression` | Arrow returning void | `{ fn(); }` braces |
| `ESLint9_useImportType` | Value import for type-only | Split `import { foo, type Bar }` |
| `ESLint9_react-hooks/refs` | Ref not in dependency array | `// eslint-disable-next-line` |
| `ESLint9_react-hooks/set-state-in-effect` | setState inside effect | `// eslint-disable-next-line` |

**Note:** Codacy 2026 uses `ESLint9_` prefix for ESLint 9 rules (NOT `ESLint8_`).
