# Evaluating static-analysis-suppression Skill

## Test Case Design

Design eval prompts that match real PR CI failure scenarios.

Good prompts include:
- A specific tool name (Codacy, DeepSource, ESLint)
- An issue code (JS-0067, R1005, ESLint8_security_detect-object-injection)
- A PR context (blocking merge, failing check)

### should-trigger queries (10)

Vary along these axes:
- Tool: Codacy / DeepSource / ESLint
- Severity: false positive / pre-existing / genuine issue
- Fix method: code rewrite / inline disable / config / admin
- Explicitness: named rule code / generic "it's blocking"

### should-not-trigger queries (4)

Near-misses that share keywords but need something different:
- "fix this lint error" where the error is a genuine code bug (should use standard fix, not suppression)
- Feature requests, documentation tasks, pure refactoring

## Evaluation Procedure

1. **Without skill**: Run should-trigger prompts with no skill loaded.
   - Expected: generic response, no decision tree, no specific rule codes.
2. **With skill**: Load static-analysis-suppression, run same prompts.
   - Expected: follows decision tree, maps to specific rule code, picks correct suppression method, mentions code-before-config order.
3. **Compare pass rates**: Skill should significantly improve on should-trigger sets without false-triggering on should-not-trigger sets.

## Assertion Patterns

Good assertions for this skill:
- `"Identifies <rule-code> as <category>"`
- `"Recommends <fix-method>"`
- `"Mentions <alternative> as fallback"`
- `"Determines this is not a static analysis suppression task"` (should-not-trigger)

## Artifact Layout

```
static-analysis-suppression-workspace/
└── iteration-1/
    ├── eval-PR-42-deepsource-js-0067/
    │   ├── with_skill/
    │   │   ├── outputs/
    │   │   ├── timing.json
    │   │   └── grading.json
    │   └── without_skill/
    │       ├── outputs/
    │       ├── timing.json
    │       └── grading.json
    ├── benchmark.json
    └── feedback.json
```
