# Parallel Coordination

Execute multiple independent agents simultaneously for maximum efficiency.

## When to Use

- Tasks have no dependencies on each other
- Time efficiency is critical
- Results can be collected and merged
- No resource conflicts exist

## Pattern

```
Task: [Overall Goal]

Parallel Execution:
├─ Agent A: [Independent Task 1]
├─ Agent B: [Independent Task 2]
└─ Agent C: [Independent Task 3]

All agents start simultaneously
Collect results when complete
```

## Implementation

**Single message with multiple Task tool calls**:

```
Task(subagent_type="code-reviewer", prompt="Review authentication module")
Task(subagent_type="test-runner", prompt="Run integration test suite")
Task(subagent_type="security-auditor", prompt="Scan for vulnerabilities")
```

All three agents execute at once.

## Examples

### Example 1: Feature Validation
```
Goal: Validate new API endpoint

Parallel:
- code-reviewer: Review implementation quality
- test-runner: Run endpoint tests
- security-auditor: Check for injection vulnerabilities

Quality gate: All checks pass before deployment
```

### Example 2: Multi-Language Codebase
```
Goal: Analyze full-stack application

Parallel:
- code-reviewer (Python backend): Review API logic
- code-reviewer (JavaScript frontend): Review React components
- test-runner: Execute end-to-end tests

Merge findings into comprehensive report
```

### Example 3: Performance Analysis
```
Goal: Identify bottlenecks

Parallel:
- debugger: Profile runtime performance
- code-reviewer: Analyze algorithmic complexity
- test-runner: Run load tests

Synthesize to find optimization targets
```

## Workflow

### Step 1: Verify Independence
Check that tasks truly don't depend on each other:
- Does Task B need Task A's output? → Use Sequential instead
- Could Task A and B conflict? → Coordinate or sequence

### Step 2: Execute in Parallel
Single message invoking all agents:
```
I need you to coordinate these parallel tasks:

1. code-reviewer: [Specific instructions]
2. test-runner: [Specific instructions]  
3. security-auditor: [Specific instructions]

Execute all simultaneously.
```

### Step 3: Collect Results
Wait for all agents to complete before proceeding.

### Step 4: Merge Findings
Combine outputs into cohesive result:
- Identify overlapping findings
- Resolve any conflicts
- Create unified report

## Quality Criteria

Before considering parallel execution successful:
- [ ] All agents completed without errors
- [ ] Results are consistent (no conflicts)
- [ ] Combined findings address the goal
- [ ] No dependencies were missed

## Common Issues

**Issue**: Agents return conflicting recommendations
**Solution**: Review for hidden dependencies; may need sequential execution

**Issue**: One agent blocks waiting for another
**Solution**: Dependencies exist; switch to sequential or hybrid

**Issue**: Results incomplete
**Solution**: Ensure each agent has sufficient context

## Language-Specific Examples

### Python (Django)
```
Parallel validation of Django view:
- code-reviewer: Check view logic and error handling
- test-runner: Run pytest suite for view
- security-auditor: Verify CSRF and authentication

Gate: All pass before merging to main
```

### JavaScript (React)
```
Parallel component analysis:
- code-reviewer: Review component structure
- test-runner: Run Jest tests
- performance-optimizer: Analyze render performance

Gate: No issues found, tests pass, renders < 16ms
```

### Java (Spring)
```
Parallel service validation:
- code-reviewer: Review business logic
- test-runner: Run JUnit tests
- debugger: Check thread safety

Gate: Tests pass, no race conditions detected
```