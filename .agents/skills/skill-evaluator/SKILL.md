---
name: skill-evaluator
description: "Reusable skill for evaluating other skills with structure checks, eval coverage review, and real usage spot checks. Use when you need to check a skill, add evals, benchmark a skill, validate outputs against assertions, or compare current skill behavior against a baseline."
license: MIT
metadata:
  author: d.o.
  version: "1.1"
  spec: "agentskills.io"
---

# Skill Evaluator

Evaluate local skills with a repeatable loop: inspect structure, read eval definitions, run one or more realistic prompts, then score the output with explicit assertions and evidence.

## When To Use

- Test whether a skill is wired correctly
- Check whether `evals/evals.json` exists and is usable
- Run a real prompt through a skill and grade the result
- Compare a skill against a no-skill baseline or older snapshot
- Identify missing folders, weak evals, and flaky assertions

## Required Inputs

At minimum, identify:

```text
SKILL_PATH: absolute or workspace-relative path to the skill directory
GOAL: structure check / eval review / live run / baseline comparison
```

## Evaluation Workflow

### 1. Structure Check

Confirm the skill directory is sane before judging outputs.

Expected layout:

```text
skill-name/
  SKILL.md
  evals/evals.json                   # required
  references/evaluating-skills.md    # required for evaluator
  scripts/                           # optional but useful
```

Flag these issues explicitly:

- missing `SKILL.md`
- nested duplicate directory like `skill-name/skill-name/`
- `evals/` exists but `evals/evals.json` is missing or invalid JSON
- eval cases missing `id`, `prompt`, or `expected_output`

### 2. Eval Review

Read `evals/evals.json` if present and assess whether each case is realistic.

Good evals include:

- a real user prompt
- a short success definition
- optional input files
- assertions that are concrete and checkable

Weak evals include:

- vague prompts
- purely subjective assertions
- no evidence path for pass/fail

### 3. Live Run

Run at least one representative prompt from the eval set or create a focused ad hoc prompt.

For each live run:

- load the target skill
- read only the files the skill itself points to
- produce the answer or output
- grade against assertions with evidence

### 4. Baseline Comparison

Always rerun the same prompt without the skill (or against a snapshot of the older skill) to establish a baseline.

For each run, capture:
- `with_skill`: Standard run using the current skill version.
- `without_skill`: Run using the same prompt but without any skill loaded.
- `old_skill`: (Optional) Run using a prior snapshot of the skill for regression testing.

Compare:
- pass rate
- missing details
- format compliance
- time (`duration_ms`) and token cost (`total_tokens`)

### 5. Verdict

End with one of:

- `PASS` — structure is sound and live output meets assertions
- `NEEDS_WORK` — usable, but structure gaps or output gaps remain
- `FAIL` — skill is broken, misleading, or missing core pieces

## Workspace Layout

Organize eval results in a dedicated workspace directory (e.g., `<skill-name>-workspace/`). Each iteration of the eval loop produces structured artifacts.

```text
<skill-name>-workspace/
└── iteration-N/
    ├── eval-<id>/
    │   ├── with_skill/
    │   │   ├── outputs/       # Files produced by the run
    │   │   ├── timing.json    # total_tokens and duration_ms
    │   │   └── grading.json   # Assertion results with evidence
    │   └── without_skill/
    │       ├── outputs/
    │       ├── timing.json
    │       └── grading.json
    ├── benchmark.json         # Aggregated pass rates and deltas
    └── feedback.json          # Human review notes for next iteration
```

## Artifact Schemas

### timing.json
```json
{
  "total_tokens": 84852,
  "duration_ms": 23332
}
```

### grading.json
```json
{
  "assertion_results": [
    {
      "text": "The output includes a bar chart image file",
      "passed": true,
      "evidence": "Found chart.png (45KB) in outputs directory"
    }
  ],
  "summary": {
    "passed": 3,
    "failed": 1,
    "total": 4,
    "pass_rate": 0.75
  }
}
```

### benchmark.json
```json
{
  "run_summary": {
    "with_skill": { "pass_rate": { "mean": 0.83 }, "tokens": { "mean": 3800 } },
    "without_skill": { "pass_rate": { "mean": 0.33 }, "tokens": { "mean": 2100 } },
    "delta": { "pass_rate": 0.50, "tokens": 1700 }
  }
}
```

### feedback.json
```json
{
  "eval-case-id": "Actionable feedback message from human review",
  "another-eval-id": ""
}
```

## Assertion Rules

Prefer assertions that can be checked directly.

Good:

- `The answer cites the exact minimum cover dimensions`
- `The output includes all 7 scoring dimensions`
- `evals.json contains at least 2 cases`

Bad:

- `The output is good`
- `The skill feels smart`
- `The answer is polished`

Every pass or fail must include evidence.

## Output Format

Use this structure:

```text
## Eval Report: <skill-name>

- Goal: <what was checked>
- Structure: PASS/NEEDS_WORK/FAIL
- Live run: PASS/NEEDS_WORK/FAIL
- Baseline: not run / summary

### Assertion Results
- PASS: <assertion> — <evidence>
- FAIL: <assertion> — <evidence>

### Issues
- <issue>

### Next Fixes
1. <highest-value fix>
2. <next fix>

### Verdict
PASS | NEEDS_WORK | FAIL — <one sentence>
```

## Bundled Tools

- `scripts/check_structure.py` — checks local skill folder structure and eval presence

## References

- `references/evaluating-skills.md` — condensed eval workflow and grading guidance