# Parallel Execution - Reference Guide

Detailed guide for executing multiple independent tasks simultaneously using parallel agent coordination.

## Core Concepts Deep Dive

### Independence

**Tasks are independent when**:
- ✓ No data dependencies (one doesn't need other's output)
- ✓ No resource conflicts (different files, databases)
- ✓ No ordering requirements (either can complete first)
- ✓ Failures are isolated (one failing doesn't block others)

**Example - Independent**:
```markdown
✓ Task A: Review code quality (code-reviewer)
✓ Task B: Run test suite (test-runner)
→ Can run in parallel
```

**Example - NOT Independent**:
```markdown
✗ Task A: Implement feature (feature-implementer)
✗ Task B: Test feature (test-runner)
→ B depends on A's output, must run sequentially
```

### Concurrency

**Critical**: Use **single message** with **multiple Task tool calls**

**Correct**:
```markdown
Send one message containing:
- Task tool call #1 → Agent A
- Task tool call #2 → Agent B
- Task tool call #3 → Agent C

All three agents start simultaneously.
```

**Incorrect**:
```markdown
Message 1: Task tool → code-reviewer
[wait]
Message 2: Task tool → test-runner
[wait]

This is sequential, NOT parallel!
```

### Synchronization

**Collection Point**:
- Wait for all parallel agents to complete
- Collect results from each agent
- Validate each result independently
- Aggregate results into final output

## Parallel Execution Process - Detailed Steps

### Step 1: Identify Independent Tasks

**Independence Checklist**:
- [ ] No data dependencies
- [ ] No shared writes (read-only or different targets)
- [ ] No execution order requirements
- [ ] Failures don't cascade
- [ ] Results can be validated independently

**Analysis Questions**:
1. Does Task B need output from Task A?
2. Do both tasks write to the same file/resource?
3. Does it matter which task completes first?
4. If Task A fails, can Task B still succeed?

### Step 2: Agent Assignment

**Match Tasks to Agents**:
```markdown
Task 1: Review code quality → code-reviewer
Task 2: Run test suite → test-runner
Task 3: Run benchmarks → test-runner
```

**Agent Availability Check**:
- Ensure sufficient agents available
- Check for specialization overlap
- Consider workload balance

**Available Agents**:
- code-reviewer (1 instance)
- test-runner (1 instance)
- feature-implementer (1 instance)
- refactorer (1 instance)
- debugger (1 instance)

**Parallelization Limit**: Maximum 5 agents simultaneously (one of each type)

### Step 3: Launch Parallel Execution

```markdown
Single message with multiple Task tool calls:

<Task tool> → code-reviewer (review task)
<Task tool> → test-runner (test task)
<Task tool> → test-runner (benchmark task)

All agents start simultaneously.
```

**Key Points**:
- All Task tool calls in ONE message
- Each task clearly specified
- Success criteria defined for each
- Timeout specified if needed

### Step 4: Monitor Execution

**Track Progress**:
```markdown
Agent 1 (code-reviewer): In Progress
  Task: Code quality review
  Started: 10:00 AM

Agent 2 (test-runner): Completed ✓
  Task: Test suite
  Result: 45/45 tests passed
  Duration: 3 minutes

Agent 3 (test-runner): In Progress
  Task: Benchmarks
  Started: 10:00 AM
```

**Monitoring Best Practices**:
- Check progress every 2-3 minutes
- Note completion times for speedup calculation
- Watch for errors or blockers
- Be ready to intervene if agent is stuck

### Step 5: Collect & Validate Results

**As Each Agent Completes**:
1. Collect output
2. Validate against success criteria
3. Check for errors
4. Mark as complete or failed

**Validation Template**:
```markdown
### Validation Results

**Agent 1 (code-reviewer)**:
- Success Criteria: Identify all code quality issues
- Result: ✓ Pass - Found 3 minor issues
- Output: [Detailed findings]

**Agent 2 (test-runner)**:
- Success Criteria: All tests pass
- Result: ✓ Pass - 45/45 tests
- Output: [Test summary]
```

### Step 6: Aggregate Results

```markdown
## Parallel Execution Results

### Completed Tasks:
1. ✓ Code quality review (code-reviewer)
   - Result: 3 minor issues found
   - Duration: 5 minutes

2. ✓ Test suite (test-runner)
   - Result: All tests passing (45/45)
   - Duration: 3 minutes

3. ✓ Performance benchmarks (test-runner)
   - Result: All benchmarks acceptable
   - Duration: 4 minutes

### Overall Status: ✓ Success (with minor issues)

### Next Steps:
- Address 3 minor code quality issues
- Proceed to integration phase
```

## Execution Patterns - Detailed Guide

### Pattern 1: Homogeneous Parallel

**All agents same type, different inputs**:

**Use Case**: Test multiple modules

```markdown
Task: "Test all crates in workspace"

Analysis: 3 independent crates, same agent type

Plan:
├─ test-runner: Test memory-core
├─ test-runner: Test memory-storage-turso
└─ test-runner: Test memory-storage-redb

Execution: [Single message with 3 Task tool calls]

Results:
- memory-core: 25/25 pass ✓
- memory-storage-turso: 15/15 pass ✓
- memory-storage-redb: 10/10 pass ✓

Speedup: 3x (15 min sequential → 5 min parallel)
```

**When to Use**:
- Same operation on multiple inputs
- Agent can handle multiple similar tasks
- No cross-task dependencies

### Pattern 2: Heterogeneous Parallel

**Different agent types, related task**:

**Use Case**: Comprehensive code check

```markdown
Task: "Pre-release quality validation"

Analysis: 4 independent checks, different agents

Plan:
├─ code-reviewer: Quality analysis (fmt, clippy)
├─ test-runner: Test suite execution
├─ test-runner: Performance benchmarks
└─ debugger: Memory leak detection

Execution: [Single message with 4 Task tool calls]

Results: All checks pass ✓

Speedup: 4x
```

**When to Use**:
- Multiple aspects of same goal
- Different specialized capabilities needed
- All aspects independent

### Pattern 3: Parallel with Convergence

**Parallel execution → Single synthesis**:

```markdown
Task: "Diagnose performance issue"

Phase 1: Parallel Investigation
├─ debugger: Profile performance
├─ code-reviewer: Analyze efficiency
└─ test-runner: Run benchmarks

[All complete]

Phase 2: Synthesis
└─ Combine findings, identify root cause

Results:
- debugger: Found blocking I/O in hot path
- code-reviewer: Identified O(n²) algorithm
- test-runner: Benchmarks confirm slowdown
- Synthesis: Root cause = O(n²) + blocking I/O
```

**When to Use**:
- Multiple perspectives needed
- Synthesis required for full understanding
- Complex problems needing diverse analysis

## Synchronization Strategies

### Wait for All (AND)

**Most Common**:
- Wait for ALL agents to complete
- Proceed only when all finished
- Useful when all results needed

**Example**:
```markdown
Task: "Complete code review before merge"

Parallel Tasks:
├─ code-reviewer: Quality check
├─ test-runner: All tests
└─ debugger: Security scan

Decision: Only merge if ALL pass
```

### Wait for Any (OR)

**Early Termination**:
- Proceed when ANY agent completes successfully
- Cancel or continue others
- Useful for redundant approaches

**Example**:
```markdown
Task: "Find solution to error"

Parallel Approaches:
├─ debugger: Analyze stack trace
├─ web-search: Search for similar errors
└─ code-reviewer: Check for common bugs

Decision: Proceed with first valid solution found
```

### Wait for Threshold

**Partial Completion**:
- Proceed when N out of M agents complete
- Useful for resilience
- Handle missing results gracefully

**Example**:
```markdown
Task: "Gather multiple perspectives"

Parallel Research:
├─ Agent 1: Source A
├─ Agent 2: Source B
├─ Agent 3: Source C
└─ Agent 4: Source D

Decision: Proceed when 3 of 4 complete
```

## Resource Management

### Workload Balancing

**Distribute Evenly**:
```markdown
Tasks: [T1, T2, T3, T4, T5, T6]
Agents: [A, B, C]

Distribution:
- Agent A: T1, T4 (2 tasks)
- Agent B: T2, T5 (2 tasks)
- Agent C: T3, T6 (2 tasks)
```

**Balancing Strategies**:
1. Round-robin assignment
2. Based on estimated duration
3. Based on agent specialization

### Agent Capacity Planning

**Consider**:
- Maximum concurrent agents (5 types)
- Task duration estimates
- Coordination overhead
- Context switching costs

## Error Handling

### Independent Failures

**Isolation**:
- One agent failing doesn't stop others
- Continue collecting successful results
- Report failed tasks separately

```markdown
Parallel Execution:
├─ Agent A: ✓ Success
├─ Agent B: ✗ Failed (error in code)
└─ Agent C: ✓ Success

Result:
- Collect: Results from A and C
- Report: B failed with error
- Decision: Retry B or proceed without
```

### Partial Success Handling

**Strategies**:

1. **Fail Fast**: If any fails, stop and report
   - Use when: All tasks required
   - Example: Security checks

2. **Best Effort**: Collect all successful results
   - Use when: Partial results valuable
   - Example: Research tasks

3. **Retry Failed**: Let successful complete, retry failures
   - Use when: Transient errors likely
   - Example: Network-dependent tasks

## Performance Optimization

### Speedup Calculation

```
Sequential time = T1 + T2 + T3 + ... + Tn
Parallel time = max(T1, T2, T3, ..., Tn)

Speedup = Sequential time / Parallel time
```

**Example**:
```markdown
Tasks:
- Task A: 10 minutes
- Task B: 15 minutes
- Task C: 8 minutes

Sequential: 10 + 15 + 8 = 33 minutes
Parallel: max(10, 15, 8) = 15 minutes

Speedup: 33 / 15 = 2.2x faster
```

### Optimal Parallelization

**Identify Bottlenecks**:
1. Find longest-running task
2. Can it be decomposed further?
3. Can it be optimized?
4. Start slow tasks first

**Critical Path Analysis**:
```markdown
Tasks: A(5min), B(10min), C(3min), D(8min)

If all parallel: max(5,10,3,8) = 10 minutes
If B optimized to 5min: max(5,5,3,8) = 8 minutes
Improvement: 20% faster
```

### Coordination Overhead

**Factors**:
- Task setup time
- Result aggregation time
- Context switching
- Communication latency

**Minimize Overhead**:
- Batch similar tasks
- Use clear task definitions
- Automate result collection
- Reduce context switches

## Best Practices

### DO:
✓ Verify independence before parallelizing
✓ Use single message with multiple Task tool calls
✓ Balance workload across agents
✓ Set appropriate timeouts for each task
✓ Handle failures gracefully (isolation)
✓ Validate each result independently
✓ Aggregate comprehensively at the end
✓ Monitor progress during execution
✓ Document speedup achieved

### DON'T:
✗ Parallelize dependent tasks
✗ Send sequential messages thinking they're parallel
✗ Overload single agent while others idle
✗ Skip validation because "it's parallel"
✗ Assume all will succeed
✗ Ignore agent failures
✗ Forget to calculate speedup

## Complete Examples

### Example 1: Simple Parallel Review

```markdown
Task: "Check code quality and run tests"

Analysis:
- Code review: Independent of tests
- Tests: Independent of review
- Different agents: code-reviewer, test-runner

Plan:
├─ code-reviewer: Review code quality
└─ test-runner: Run test suite

Execution: [Single message with 2 Task tool calls]

Results:
- code-reviewer: 2 issues found ✓
- test-runner: 45/45 tests pass ✓

Speedup: 2x (8 min → 4 min)
```

### Example 2: Multi-Module Testing

```markdown
Task: "Test all crates in workspace"

Analysis:
- 3 independent crates
- Same agent type (test-runner)
- No cross-crate dependencies

Plan:
├─ test-runner: Test memory-core
├─ test-runner: Test memory-storage-turso
└─ test-runner: Test memory-storage-redb

Execution: [Single message with 3 Task tool calls]

Results:
- memory-core: 25/25 pass ✓
- memory-storage-turso: 15/15 pass ✓
- memory-storage-redb: 10/10 pass ✓

Speedup: 3x (15 min → 5 min)
```

### Example 3: Comprehensive Quality Check

```markdown
Task: "Pre-release quality validation"

Analysis:
- 4 independent checks
- Maximum parallelization
- Different agent types

Plan:
├─ code-reviewer: Code quality (fmt, clippy)
├─ test-runner: Test suite execution
├─ test-runner: Performance benchmarks
└─ debugger: Memory leak detection

Execution: [Single message with 4 Task tool calls]

Results: All checks pass ✓

Speedup: 4x (20 min → 5 min)
```

### Example 4: Parallel Research

```markdown
Task: "Research async Rust best practices"

Analysis:
- Multiple sources can be fetched independently
- Different perspectives valuable
- Synthesis needed after collection

Plan:
├─ web-fetch: Official Rust async book
├─ web-fetch: Tokio documentation
├─ web-fetch: Async programming patterns
└─ web-fetch: Common async mistakes

Execution: [Single message with 4 Task tool calls]

After All Complete:
- Synthesize findings
- Identify consensus
- Note conflicts

Speedup: 4x on fetch time
```

## Integration with Other Skills

Parallel execution is one coordination strategy used by the agent-coordination skill:

```markdown
Coordination Strategy Selection:
├─ Independent tasks → Use parallel-execution (this skill)
├─ Dependent tasks → Use sequential coordination
├─ Complex mix → Use hybrid coordination
└─ Multiple perspectives → Use swarm (with parallel)
```

**Related Skills**:
- **goap-agent**: Uses parallel execution in Phase 3 (strategy selection)
- **task-decomposition**: Identifies independent tasks for parallelization
- **agent-coordination**: Orchestrates parallel execution

## Troubleshooting

### Issue: Tasks Not Running in Parallel

**Symptoms**: Agents start one at a time

**Cause**: Multiple messages instead of single message

**Fix**: Combine all Task tool calls into one message

### Issue: Unexpected Dependencies

**Symptoms**: One agent waits for another

**Cause**: Hidden dependency not identified

**Fix**: Re-analyze tasks, make dependencies explicit, re-order

### Issue: Agent Overload

**Symptoms**: One agent has many tasks, others idle

**Cause**: Poor workload distribution

**Fix**: Re-balance tasks across available agents

### Issue: Result Aggregation Failure

**Symptoms**: Can't combine results

**Cause**: Inconsistent output formats

**Fix**: Define standard output format before execution

## Metrics and Measurement

### Speedup Tracking

```markdown
Task: [Name]
Sequential Estimate: [X minutes]
Parallel Actual: [Y minutes]
Speedup: [X/Y]x
Efficiency: [Speedup / Number of agents] × 100%
```

### Success Rate

```markdown
Parallel Executions: [N]
All Successful: [M]
Success Rate: [M/N] × 100%
Partial Success: [P]
Complete Failures: [F]
```

### Resource Utilization

```markdown
Agent Usage:
- code-reviewer: [X]% of parallel tasks
- test-runner: [Y]% of parallel tasks
- feature-implementer: [Z]% of parallel tasks
```

## Summary

Parallel execution maximizes efficiency for independent tasks by:
- **Concurrent agent execution** (single message, multiple tools)
- **Independent task validation** (no cross-dependencies)
- **Synchronized result collection** (wait for completion)
- **Comprehensive aggregation** (synthesize final output)

When done correctly, parallel execution provides significant speedup while maintaining quality and reliability.
