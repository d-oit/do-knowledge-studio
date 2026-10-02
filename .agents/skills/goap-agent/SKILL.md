---
name: goap-agent
description: Invoke for complex multi-step tasks requiring intelligent planning and multi-agent coordination. Use when tasks need decomposition, dependency mapping, parallel/sequential/swarm/iterative execution strategies, or coordination of multiple specialized agents with quality gates.
---

# GOAP Agent Skill: Goal-Oriented Action Planning

Enable intelligent planning and execution of complex multi-step tasks through systematic decomposition, dependency mapping, and coordinated multi-agent execution.

Always use the plans/ folder for all files.

## Quick Reference

- `execution-strategies.md` - Detailed guide on execution patterns
- `references/guide.md` - Complete examples, templates, and advanced topics

## When to Use This Skill

Use this skill when facing:
- **Complex Multi-Step Tasks**: Tasks requiring 5+ distinct steps
- **Cross-Domain Problems**: Issues spanning multiple areas
- **Optimization Opportunities**: Tasks benefiting from parallel execution
- **Quality-Critical Work**: Projects requiring validation checkpoints

## Core GOAP Methodology

### The GOAP Planning Cycle

```
1. ANALYZE → 2. DECOMPOSE → 3. STRATEGIZE → 4. COORDINATE → 5. EXECUTE → 6. SYNTHESIZE
```

## Phase 1: Task Analysis

```markdown
## Task Analysis

**Primary Goal**: [Clear statement of what success looks like]
**Constraints**: [Time, Resources]
**Complexity**: Simple/Medium/Complex
```

Context: Use Explore agent, check past patterns, identify available agents.

## Phase 2: Task Decomposition

Use **task-decomposition** skill:

```markdown
### Sub-Goals
1. [Component 1] - Priority: P0, Deps: none
2. [Component 2] - Priority: P1, Deps: Component 1
```

Principles: Atomic, Testable, Independent, Assigned

## Phase 3: Strategy Selection

| Strategy | When | Speed |
|----------|------|-------|
| Parallel | Independent tasks | Nx |
| Sequential | Dependent tasks | 1x |
| Swarm | Many similar tasks | ~Nx |
| Hybrid | Mixed requirements | 2-4x |

See **[execution-strategies.md](execution-strategies.md)** for details.

## Phase 4: Agent Assignment

| Agent | Best For |
|-------|----------|
| feature-implementer | New functionality |
| debugger | Bug fixes |
| test-runner | Test validation |
| refactorer | Code improvements |
| code-reviewer | Quality assurance |

## Phase 5: Execution Planning

```markdown
## Execution Plan

- Strategy: [Type]
- Quality Gates: [N checkpoints]

### Phase 1
- Tasks: [List]
- Quality Gate: [Criteria]
```

## Phase 6: Coordinated Execution

**Parallel**: Single message, multiple Task tool calls
**Sequential**: Phases with quality gates between
**Monitor**: Track progress, validate results

## Phase 7: Result Synthesis

```markdown
## Summary

✓ Completed: [Tasks]
📦 Deliverables: [List]
✅ Quality: [Status]
```

## Common Patterns

- **Research → Implement → Validate**
- **Investigate → Diagnose → Fix → Verify**
- **Audit → Improve → Validate**

## Error Handling

- **Agent Failure**: Retry, Reassign, Modify, or Escalate
- **Quality Gate Failure**: Re-run with fixes
- **Blocked**: Re-order or work on independent tasks

## Best Practices

### DO:
✓ Break tasks into atomic units
✓ Define clear quality gates
✓ Match agents to requirements
✓ Monitor and validate incrementally

### DON'T:
✗ Create monolithic tasks
✗ Skip quality gates
✗ Assume independence without verification

## Integration

- **task-decomposition**: Phase 2
- **parallel-execution**: Strategy implementation

## Summary

GOAP enables systematic planning through: Analysis, Decomposition, Strategy, Quality Assurance, and Coordinated Agents.

## Reference Files

- `references/guide.md` - Complete templates, detailed examples, extended patterns, error handling, optimization
- `execution-strategies.md` - Execution pattern details
