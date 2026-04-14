---
name: triz-solver
description: Systematic problem-solving using TRIZ (Theory of Inventive Problem Solving) principles adapted for software engineering. Use when stuck on complex problems, facing technical contradictions, optimizing system design, or seeking innovative solutions beyond trial-and-error. Prevents solving the wrong problem correctly.
category: innovation-problem-solving
---

# TRIZ Problem Solver

Systematic innovation methodology for software engineering problems.

## When to Use

- Complex problems with apparent trade-offs
- System design contradictions (improving X worsens Y)
- Architecture refactoring decisions
- Seeking innovative solutions beyond incremental improvement
- Agent instruction optimization

## Core Protocol

### Contradiction-First Approach

```
1. STATE the problem in one sentence
2. IDENTIFY contradiction: "Improving [X] causes [Y] to worsen"
3. CHECK if contradiction is real or apparent
4. RESOLVE using separation principles
5. VALIDATE no new contradictions introduced
```

### Ideal Final Result (IFR)

```
"The ideal solution delivers all benefits with zero cost"

1. What is the ideal outcome? (no implementation details)
2. What prevents reaching it? (constraints)
3. Which constraints are real vs assumed?
4. Can the system self-solve without added complexity?
```

## 40 Inventive Principles (Software Edition)

### Top 10 for Software

| # | Principle | Software Analogy | When to Apply |
|---|-----------|------------------|---------------|
| 1 | **Segmentation** | Split into modules/microservices | Monolithic code, complex functions |
| 2 | **Taking out** | Extract concerns, separate interfaces | Mixed responsibilities |
| 3 | **Local quality** | Single-purpose components | Generic implementations |
| 4 | **Asymmetry** | Context-specific solutions | One-size-fits-all antipattern |
| 5 | **Merging** | Combine operations, reduce round-trips | Excessive function calls |
| 6 | **Universality** | Shared interfaces, polymorphism | Duplicate implementations |
| 7 | **Nesting** | Hierarchical structures, inheritance | Flat complex structures |
| 12 | **Inversion** | IoC, reverse data flow, pull vs push | Current approach failing |
| 13 | **Dynamics** | Runtime config, hot-reload, adapters | Static rigid configurations |
| 17 | **Another dimension** | Add abstraction layer | Impasse at current level |

### Extended Reference

See [references/principles.md](references/principles.md) for all 40 principles with software examples.

## Contradiction Matrix (Software)

```
Improving            vs Worsening              → Principle
──────────────────────────────────────────────────────────────
Functionality        vs Complexity             → #1, #9, #15
Performance          vs Maintainability        → #7, #13, #17
Flexibility          vs Simplicity             → #6, #2, #3
Security             vs Usability              → #12, #4, #17
Scalability          vs Resource Cost          → #1, #13, #35
```

## Decision Workflow

### Step 1: Frame Problem

```markdown
Problem: [One sentence]
Current approach: [What you're doing]
Stuck because: [Why it doesn't work]
```

### Step 2: Identify Contradiction

```markdown
Improving: [Parameter that needs improvement]
Worsens: [Parameter that degrades]
Type: [Technical/Physical/Inherent]
```

### Step 3: Apply Resolution

Choose separation strategy:

- **Time**: Different behavior at different stages
- **Space**: Different behavior in different contexts
- **Condition**: Different behavior based on input type
- **System-level**: Add component that resolves both

### Step 4: Validate

```markdown
✓ Original problem solved
✓ No new contradictions introduced
✓ Solution approaches IFR (minimal complexity added)
✓ Tests pass
```

## Examples

### Example 1: Performance vs Maintainability

```
Problem: Caching improves speed but adds staleness complexity
Contradiction: Performance (improve) vs Maintainability (worsen)
Apply: #1 Segmentation → Cache with TTL per data type
Result: Speed improved, staleness bounded, complexity isolated
```

### Example 2: Security vs Usability

```
Problem: Strong auth improves security but hurts UX
Contradiction: Security (improve) vs Usability (worsen)
Apply: #12 Inversion → Risk-based auth (challenge only suspicious)
Result: Security maintained, UX unaffected for legitimate users
```

### Example 3: Agent Instruction Optimization

```
Problem: More instructions improve reliability but consume context
Contradiction: Completeness (improve) vs Token limits (worsen)
Apply: #4 Asymmetry → Heavy knowledge in references/, load lazily
Result: Reliability maintained, context efficiency improved
```

## Integration with Other Skills

- **task-decomposition**: Use TRIZ to identify contradictions before decomposing
- **agent-coordination**: Apply IFR to coordination strategy selection
- **iterative-refinement**: Use contradiction analysis to guide refinement cycles

## Quality Checklist

✓ Contradiction explicitly stated before solution
✓ IFR defined before implementation
✓ Solution verified against contradiction matrix
✓ No new contradictions introduced
✓ Approaches ideal state (minimal added complexity)

## Reference Files

- **[references/principles.md](references/principles.md)** - All 40 TRIZ principles with software examples
- **[references/patterns.md](references/patterns.md)** - Common software contradiction patterns and resolutions
- **[references/evolution.md](references/evolution.md)** - TRIZ evolution trends for system design
