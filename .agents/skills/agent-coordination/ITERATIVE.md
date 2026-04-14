# Iterative Coordination

Execute agent repeatedly with feedback until success criteria met or convergence achieved.

## When to Use

- Goal requires progressive refinement
- Success criteria are measurable
- Fixed endpoint isn't predictable
- Need convergence to acceptable state

## Pattern

```
Task: [Goal with criteria]

Configure loop-agent:
- Agent: [Which agent to iterate]
- Max iterations: [Safety limit]
- Success criteria: [When to stop]

Execute:
Iteration 1: [Agent] → [Result] → Check criteria
Iteration 2: [Agent] → [Better result] → Check criteria
Iteration 3: [Agent] → [Success] ✓ → Stop
```

## Implementation

Use `loop-agent` to orchestrate iterations:

```
Task(subagent_type="loop-agent",
     prompt="""
     Goal: Optimize database queries until < 100ms response time
     
     Agent to iterate: performance-optimizer
     Max iterations: 5
     
     Success criteria:
     - Query response time < 100ms
     - All tests pass
     - No functionality changes
     
     After each iteration:
     1. Measure query performance
     2. Run test suite
     3. If criteria met → Stop
     4. Else → Continue with feedback
     """)
```

## Examples

### Example 1: Query Optimization
```
Goal: Optimize slow database query

Configuration:
- Agent: performance-optimizer
- Max iterations: 5
- Success: Query time < 100ms AND tests pass

Iteration 1:
- Apply index → 350ms → Continue

Iteration 2:
- Rewrite join → 120ms → Continue

Iteration 3:
- Add query cache → 85ms → Success ✓
```

### Example 2: Code Quality Refinement
```
Goal: Eliminate all linter warnings

Configuration:
- Agent: refactorer
- Max iterations: 10
- Success: Zero linter warnings AND tests pass

Iteration 1:
- Fix formatting → 23 warnings → Continue

Iteration 2:
- Fix imports → 7 warnings → Continue

Iteration 3:
- Fix naming → 2 warnings → Continue

Iteration 4:
- Fix complexity → 0 warnings → Success ✓
```

### Example 3: Test Coverage Improvement
```
Goal: Achieve 80% test coverage

Configuration:
- Agent: test-runner
- Max iterations: 8
- Success: Coverage ≥ 80% AND all tests pass

Iteration 1:
- Add unit tests → 62% → Continue

Iteration 2:
- Add integration tests → 71% → Continue

Iteration 3:
- Add edge case tests → 78% → Continue

Iteration 4:
- Add error path tests → 83% → Success ✓
```

## Workflow

### Step 1: Define Success Criteria
Make criteria:
- Measurable (not subjective)
- Achievable (not impossible)
- Verifiable (can be checked automatically)

Good criteria:
- "Response time < 100ms"
- "Zero compiler warnings"
- "Test coverage > 80%"

Bad criteria:
- "Code looks better" (not measurable)
- "Perfect optimization" (not achievable)
- "Feels faster" (not verifiable)

### Step 2: Choose Agent and Task
Which agent should iterate?
- performance-optimizer: Speed/memory improvements
- refactorer: Code quality improvements
- test-runner: Coverage/test improvements
- debugger: Bug fixing iterations

### Step 3: Set Max Iterations
Safety limit prevents infinite loops:
- Simple tasks: 3-5 iterations
- Complex tasks: 5-10 iterations
- Very complex: 10-15 iterations

### Step 4: Execute Loop
Run iterations with feedback:

```
loop-agent executes:
1. Run agent on current state
2. Measure against criteria
3. If success → Stop and report
4. If max iterations → Stop and report best attempt
5. Else → Continue with learnings
```

### Step 5: Handle Results
**If succeeded**:
- Validate final state
- Document improvements
- Apply changes

**If max iterations reached**:
- Review progress made
- Decide if partial improvement acceptable
- Or adjust criteria and retry

## Iteration Feedback Template

```
## Iteration [N] Report

### Changes Applied:
- [Change 1]
- [Change 2]

### Measurements:
- Metric 1: [Before] → [After]
- Metric 2: [Before] → [After]

### Success Criteria Check:
- [ ] Criterion 1: [Status]
- [ ] Criterion 2: [Status]

### Decision:
[Continue / Success / Max iterations reached]

### If Continuing:
Focus next iteration on: [Specific improvement area]
```

## Quality Criteria

- [ ] Success criteria clearly defined
- [ ] Max iterations set appropriately
- [ ] Progress tracked across iterations
- [ ] Final state validated
- [ ] Either success achieved or partial improvement documented

## Common Issues

**Issue**: Iterations not converging
**Solution**: Review if criteria achievable; adjust approach or criteria

**Issue**: Oscillating between states
**Solution**: Agent making conflicting changes; provide better guidance

**Issue**: Rapid success in 1-2 iterations
**Solution**: Acceptable; criteria may have been too easy

**Issue**: Hitting max iterations
**Solution**: Either extend limit, adjust criteria, or accept partial progress

## Language-Specific Examples

### Python (Django)
```
Iterative: Optimize view performance

loop-agent configuration:
- Agent: performance-optimizer
- Max: 5 iterations
- Success: View response < 200ms AND tests pass

Iteration 1: Add select_related → 450ms
Iteration 2: Add prefetch_related → 280ms
Iteration 3: Add caching → 150ms
Iteration 4: Optimize serializer → 180ms (slower!)
Iteration 5: Revert serializer, tune cache → 165ms
Max reached, best: Iteration 3 (150ms) ✓
```

### JavaScript (Node.js)
```
Iterative: Reduce bundle size

loop-agent configuration:
- Agent: performance-optimizer
- Max: 7 iterations
- Success: Bundle < 500KB AND app works

Iteration 1: Tree shaking → 820KB
Iteration 2: Code splitting → 650KB
Iteration 3: Dynamic imports → 520KB
Iteration 4: Remove lodash → 480KB ✓ Success
```

### Java (Spring Boot)
```
Iterative: Eliminate memory leaks

loop-agent configuration:
- Agent: debugger
- Max: 10 iterations
- Success: Stable memory over 1 hour run

Iteration 1: Close streams → Leak persists
Iteration 2: Fix cache eviction → Leak persists
Iteration 3: Fix connection pooling → Still slight leak
Iteration 4: Fix event listeners → Stable ✓ Success
```

### Rust
```
Iterative: Pass all clippy warnings

loop-agent configuration:
- Agent: refactorer
- Max: 8 iterations
- Success: Zero clippy warnings

Iteration 1: Fix obvious issues → 15 warnings
Iteration 2: Fix ownership → 8 warnings
Iteration 3: Fix lifetimes → 3 warnings
Iteration 4: Fix remaining → 0 warnings ✓ Success
```

## Loop Patterns

### Test-Fix Loop
```
Common pattern for bug fixing:
1. test-runner: Run tests
2. If failures → debugger: Analyze
3. refactorer: Apply fix
4. Repeat until all pass
```

### Optimize-Benchmark Loop
```
Common pattern for performance:
1. debugger: Profile current state
2. performance-optimizer: Apply optimization
3. test-runner: Benchmark improvement
4. Repeat until target met
```

### Refine-Validate Loop
```
Common pattern for quality:
1. refactorer: Improve code
2. test-runner: Verify functionality
3. code-reviewer: Check quality
4. Repeat until standards met
```

## Configuration Template

```
## Iterative Task Configuration

### Goal:
[Clear objective]

### Agent to Iterate:
[Which agent will execute repeatedly]

### Max Iterations:
[Safety limit, typically 3-15]

### Success Criteria:
Must be measurable and verifiable:
- [ ] Criterion 1: [Specific metric/condition]
- [ ] Criterion 2: [Specific metric/condition]
- [ ] Criterion 3: [Specific metric/condition]

### Measurement Method:
[How to check criteria after each iteration]

### After Each Iteration:
1. [Measure/test action]
2. [Validation action]
3. [Decision logic]

### If Max Iterations Reached:
[What to do with partial progress]
```

## Best Practices

**Clear metrics**: Use objective measurements

**Appropriate limits**: Balance thoroughness vs time

**Track progress**: Log all iterations for analysis

**Provide feedback**: Give agent context from previous attempts

**Accept partial**: Sometimes good enough is better than perfect

**Stop when successful**: Don't over-optimize beyond criteria