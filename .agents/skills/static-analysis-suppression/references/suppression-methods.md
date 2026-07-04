# Suppression Methods Reference

## Code Rewrite (DeepSource)

| Before | After | Rule |
|--------|-------|------|
| `export default async function foo() {}` | `const foo = (): void => {}; export default foo;` | JS-0067 |
| `{ type: type }` | `{ type }` | JS-0240 |
| `vi.fn().mockResolvedValue(undefined)` | `vi.fn().mockResolvedValue()` | JS-W1042 |
| `void someFunction()` | `someFunction()` | JS-0098 |
| `import * as mod from './x'` | `import { usedFn } from './x'` | JS-C1003 |

## eslint-disable Inline

Single line:
```ts
// eslint-disable-next-line <rule> -- <reason>
```

Multi-line block:
```ts
/* eslint-disable <rule> */
...
/* eslint-enable <rule> */
```

## .codacy.yml

```yaml
---
exclude_paths:
  - "dist/**"
  - "node_modules/**"
engines:
  eslint-8:
    enabled: true
    disable_rules:
      - "ESLint8_security_detect-object-injection"
    exclude_paths:
      - "__tests__/**"
```

Note: Codacy YAML requires `---` preamble on line 1 and uses `engines:` not `tools:`.

## .deepsource.toml

```toml
version = "1"

[analyzers]
name = "javascript-typescript"
enabled = true

  [analyzers.meta]
  max_complexity = "30"
  skip_doc_coverage = ["test"]

  [analyzers.meta.checks]
  Biome_lint_correctness_useQwikValidLexicalScope = "off"
```

## Admin Merge

```bash
gh pr merge <PR#> --squash --admin --subject "<commit message>"
```

Only when all functional checks pass but policy tool blocks.

## Common DeepSource Issue Codes

Full mapping across ~12 sessions:

| Code | Severity | Category | Fix |
|------|----------|----------|-----|
| JS-0067 | Minor | Anti Pattern | `function` → `const` arrow + export default |
| JS-0240 | Minor | Anti Pattern | Property shorthand |
| JS-0339 | Major | Bug Risk | Type narrowing, `?.`, null checks |
| JS-0357 | Minor | Anti Pattern | Move definition above callers |
| JS-0098 | Minor | Anti Pattern | Remove `void` keyword |
| JS-W1042 | Minor | Anti Pattern | Omit `undefined` arg |
| JS-C1003 | Minor | Anti Pattern | Named imports |
| R1005 | Minor | Complexity | `.deepsource.toml` or code split |
