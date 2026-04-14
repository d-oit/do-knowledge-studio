---
name: parallel-execution
description: Execute multiple independent tasks simultaneously using parallel agent coordination to maximize throughput and minimize execution time. Use when tasks have no dependencies, results can be aggregated, and agents are available for concurrent work.
---

# Parallel Execution

Execute multiple independent tasks simultaneously to maximize throughput and minimize total execution time.

## When to Use

- Multiple independent tasks (no dependencies)
- Tasks benefit from concurrent execution
- Available agents for parallel work
- Results can be aggregated after completion

## Core Concepts

### Independence

Tasks are independent when:
- ✓ No data dependencies
- ✓ No resource conflicts
- ✓ No ordering requirements
- ✓ Failures are isolated

### Concurrency

**Critical**: Use **single message** with **multiple Task tool calls**

```
Single message:
- Task → Agent A
- Task → Agent B
- Task → Agent C

All start simultaneously.
```

### Synchronization

- Wait for all agents to complete
- Collect and validate results
- Aggregate into final output

## Process

### Step 1: Identify Independent Tasks

Checklist:
- [ ] No data dependencies
- [ ] No shared writes
- [ ] No execution order requirements
- [ ] Failures don't cascade

### Step 2: Agent Assignment

Available: code-reviewer, test-runner, feature-implementer, refactorer, debugger

### Step 3: Launch Parallel Execution

Single message with multiple Task tool calls. All agents start simultaneously.

### Step 4: Monitor Execution

- Track progress every 2-3 minutes
- Note completion times
- Watch for errors

### Step 5: Collect & Validate

As each completes:
1. Collect output
2. Validate against criteria
3. Mark complete/failed

### Step 6: Aggregate Results

```markdown
## Results

1. ✓ Task A - Result
2. ✓ Task B - Result
3. ✓ Task C - Result

Status: ✓ Success
```

## Execution Patterns

### Homogeneous Parallel
Same agent type, different inputs:
```
├─ test-runner: Test module A
├─ test-runner: Test module B
└─ test-runner: Test module C
```

### Heterogeneous Parallel
Different agent types:
```
├─ code-reviewer: Quality analysis
├─ test-runner: Test execution
└─ debugger: Performance profiling
```

### Parallel with Convergence
Parallel execution → Single synthesis:
```
Phase 1: Parallel investigation
Phase 2: Synthesize findings
```

## Synchronization Strategies

- **Wait for All (AND)**: All must complete
- **Wait for Any (OR)**: First success proceeds
- **Wait for Threshold**: N of M must complete

## Error Handling

### Independent Failures
One failing doesn't stop others:
```
├─ Agent A: ✓ Success
├─ Agent B: ✗ Failed
└─ Agent C: ✓ Success

Collect A and C, report B failed
```

### Strategies
1. **Fail Fast**: Stop if any fails
2. **Best Effort**: Collect successes
3. **Retry Failed**: Retry failures

## Performance

### Speedup Calculation

```
Sequential = T1 + T2 + T3
Parallel = max(T1, T2, T3)
Speedup = Sequential / Parallel
```

Example: Tasks 10min, 15min, 8min
- Sequential: 33 min
- Parallel: 15 min (max)
- Speedup: 2.2x

## Best Practices

### DO:
✓ Verify independence first
✓ Use single message with multiple tools
✓ Balance workload
✓ Handle failures gracefully
✓ Validate each result

### DON'T:
✗ Parallelize dependent tasks
✗ Send sequential messages
✗ Overload single agent
✗ Skip validation

## Examples

### Simple Parallel Review
```
├─ code-reviewer: Review code
└─ test-runner: Run tests
Speedup: 2x
```

### Multi-Module Testing
```
├─ test-runner: Test module A
├─ test-runner: Test module B
└─ test-runner: Test module C
Speedup: 3x
```

### Quality Check
```
├─ code-reviewer: Quality
├─ test-runner: Tests
├─ test-runner: Benchmarks
└─ debugger: Memory check
Speedup: 4x
```

## Integration

Used by **agent-coordination** for independent task strategy.

## Summary

Parallel execution maximizes efficiency through concurrent execution, independent validation, and synchronized aggregation.

## Reference Files

- **[references/guide.md](references/guide.md)** - Complete guide with detailed steps, patterns, synchronization strategies, error handling, performance optimization, and troubleshooting
