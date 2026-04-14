---
name: triz-analysis
description: Run a systematic TRIZ contradiction audit against a codebase, architecture, or workflow to identify hidden trade-offs and innovation opportunities.
category: analysis
---

# TRIZ Analysis

Systematic innovation audit for software systems, architectures, and workflows.

## When to Use

- Auditing a repository for technical contradictions
- Reviewing a CI/CD pipeline or workflow for hidden trade-offs
- Analyzing an architecture for scalability vs. complexity bottlenecks
- Performing a swarm-based TRIZ audit on a project

## Input Requirements

- **Target Scope**: The specific directory, pipeline, or framework to analyze (e.g., `scripts/`, `CI pipeline`, `agent-coordination skill`).

## Output Convention

All agent-generated analysis must be written to the `analysis/` directory using the following naming convention:
`analysis/triz-<scope>-YYYY-MM-DD.md`

Example: `analysis/triz-scripts-2025-05-20.md`

## Audit Process

1. **SCOPE SCAN**: Examine the target scope for existing "pain points" or "trade-offs".
2. **CONTRADICTION DISCOVERY**: Identify technical contradictions: "Improving [X] in this scope causes [Y] to worsen".
3. **PRINCIPLE MAPPING**: Map discovered contradictions to TRIZ inventive principles.
4. **INNOVATION ROADMAP**: Propose specific architectural or process changes based on TRIZ resolutions.
5. **REPORT**: Document findings in the `analysis/` directory.

## Core Protocol

### Contradiction-First Approach

```
1. SCAN the scope
2. IDENTIFY contradiction: "Improving [X] causes [Y] to worsen"
3. CHECK if contradiction is real or apparent
4. RESOLVE using separation principles
5. DOCUMENT findings in analysis/
```

### Ideal Final Result (IFR) for Audits

```
"The ideal system performs its function with zero overhead"

1. What is the ideal outcome for this scope?
2. What prevents reaching it? (current architecture/process constraints)
3. Which constraints are real vs assumed?
```

## Contradiction Matrix (Software)

| Improving | vs Worsening | → Principle |
|---|---|---|
| Functionality | vs Complexity | #1, #9, #15 |
| Performance | vs Maintainability | #7, #13, #17 |
| Flexibility | vs Simplicity | #6, #2, #3 |
| Security | vs Usability | #12, #4, #17 |
| Scalability | vs Resource Cost | #1, #13, #35 |

## Integration with Other Skills

- **agent-coordination**: Can be orchestrated as a swarm sub-task where multiple agents analyze different parts of the scope.
- **task-decomposition**: Use to break down a large repository audit into smaller, scoped TRIZ analyses.

## Quality Checklist

✓ Target scope clearly defined
✓ Discovered contradictions explicitly stated
✓ Recommendations mapped to TRIZ inventive principles
✓ Findings saved to `analysis/triz-<scope>-YYYY-MM-DD.md`

## Reference Files

- `references/principles.md` - All 40 TRIZ principles with software examples
- `references/patterns.md` - Common software contradiction patterns and resolutions
- `references/evolution.md` - TRIZ evolution trends for system design
