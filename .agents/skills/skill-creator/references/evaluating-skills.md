# Evaluating Skill Output Quality

## Designing Test Cases

Store test cases in `evals/evals.json` inside your skill directory. A test case has three parts:
- **Prompt**: a realistic user message.
- **Expected output**: a human-readable description of success.
- **Files** (optional): files the skill needs to work with.
- **Assertions**: verifiable statements about what the output should achieve.

### evals/evals.json
```json
{
  "skill_name": "csv-analyzer",
  "evals": [
    {
      "id": 1,
      "prompt": "I have a CSV of monthly sales data in data/sales_2025.csv. Can you find the top 3 months by revenue and make a bar chart?",
      "expected_output": "A bar chart image showing the top 3 months by revenue, with labeled axes and values.",
      "files": ["evals/files/sales_2025.csv"],
      "assertions": [
        "The output includes a bar chart image file",
        "The chart shows exactly 3 months",
        "Both axes are labeled"
      ]
    }
  ]
}
```

## Running Evals & Baseline Comparison

Run each test case twice: once with the skill and once without it (or with a previous version) to establish a baseline.

## Workspace Structure

Organize eval results in a workspace directory alongside your skill directory. Each pass through the full eval loop gets its own `iteration-N/` directory.

```text
<skill-name>/
├── SKILL.md
└── evals/
    └── evals.json

<skill-name>-workspace/
└── iteration-1/
    ├── eval-top-months-chart/
    │   ├── with_skill/
    │   │   ├── outputs/       # Files produced by the run
    │   │   ├── timing.json    # Tokens and duration
    │   │   └── grading.json   # Assertion results
    │   └── without_skill/
    │       ├── outputs/
    │       ├── timing.json
    │       └── grading.json
    ├── benchmark.json         # Aggregated statistics
    └── feedback.json          # Human review notes
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
    "with_skill": {
      "pass_rate": { "mean": 0.83, "stddev": 0.06 },
      "time_seconds": { "mean": 45.0, "stddev": 12.0 },
      "tokens": { "mean": 3800, "stddev": 400 }
    },
    "without_skill": {
      "pass_rate": { "mean": 0.33, "stddev": 0.10 },
      "time_seconds": { "mean": 32.0, "stddev": 8.0 },
      "tokens": { "mean": 2100, "stddev": 300 }
    },
    "delta": {
      "pass_rate": 0.50,
      "time_seconds": 13.0,
      "tokens": 1700
    }
  }
}
```

### feedback.json
```json
{
  "eval-top-months-chart": "The chart is missing axis labels.",
  "eval-clean-missing-emails": ""
}
```

## Writing Assertions

Assertions are verifiable statements about what the output should contain or achieve.
- **Good**: "The output file is valid JSON", "The report includes at least 3 recommendations".
- **Weak**: "The output is good", "The skill feels smart".

Every pass or fail must include evidence.

## Analyzing Patterns

- **Remove redundant assertions**: Those that always pass in both configurations.
- **Investigate double failures**: Assertions that always fail in both configs (either the assertion, the test case, or the model is at fault).
- **Study skill-only successes**: This is where the skill adds clear value.
- **Tighten instructions for inconsistency**: High stddev in benchmarks suggests ambiguity.

## Human Review & Iteration Loop

1. Review outputs alongside assertion grades.
2. Record actionable feedback in `feedback.json`.
3. Use failed assertions, human feedback, and execution transcripts to propose skill improvements.
4. Rerun all test cases in a new `iteration-N+1/` directory.
