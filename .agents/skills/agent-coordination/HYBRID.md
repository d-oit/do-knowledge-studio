# Hybrid Coordination

Combine different coordination strategies across multiple phases with quality gates.

## When to Use

- Complex workflows with multiple phases
- Some phases allow parallelism, others don't
- Need validation between phases
- Mix of dependencies and independent work

## Pattern

```
Task: [Complex Workflow]

Phase 1 [Parallel]:
├─ Agent A: [Independent task]
└─ Agent B: [Independent task]
↓ Quality Gate

Phase 2 [Sequential]:
└─ Agent C: [Needs A+B outputs]
   └─ Agent D: [Needs C output]
↓ Quality Gate

Phase 3 [Parallel]:
├─ Agent E: [Independent validation]
└─ Agent F: [Independent validation]
```

## Implementation

Execute each phase with appropriate strategy, validate between phases:

```
## Phase 1: Assessment (Parallel)
Task(subagent_type="code-reviewer", prompt="Assess current code")
Task(subagent_type="test-runner", prompt="Run existing tests")

[Wait for completion, validate results]

## Phase 2: Implementation (Sequential)
Task(subagent_type="refactorer", prompt="Apply improvements based on assessment")

[Wait for completion, validate results]

## Phase 3: Validation (Parallel)
Task(subagent_type="test-runner", prompt="Verify refactored code")
Task(subagent_type="security-auditor", prompt="Security scan")
```

## Examples

### Example 1: Feature Refactor
```
Goal: Refactor authentication module

Phase 1 - Assessment (Parallel):
- code-reviewer: Analyze current implementation
- test-runner: Run existing auth tests
- security-auditor: Identify vulnerabilities

Gate: All assessments complete, issues documented

Phase 2 - Implementation (Sequential):
- refactorer: Apply security fixes
- refactorer: Improve code structure
- refactorer: Update error handling

Gate: Refactoring complete, code compiles

Phase 3 - Validation (Parallel):
- test-runner: Full test suite
- security-auditor: Re-scan for issues
- performance-optimizer: Verify no regression

Gate: All tests pass, no vulnerabilities, performance OK
```

### Example 2: Database Migration
```
Goal: Migrate database schema

Phase 1 - Planning (Sequential):
- code-reviewer: Review current schema
- debugger: Analyze data dependencies

Gate: Migration plan approved

Phase 2 - Backup and Execute (Sequential):
- test-runner: Verify backup successful
- refactorer: Execute migration script
- test-runner: Validate data integrity

Gate: Migration successful, data verified

Phase 3 - Validation (Parallel):
- test-runner: Integration tests
- performance-optimizer: Query performance
- code-reviewer: Application compatibility

Gate: All validation passes
```

### Example 3: API Redesign
```
Goal: Redesign API endpoints

Phase 1 - Analysis (Swarm):
- code-reviewer: Current API design
- test-runner: Usage patterns from logs
- debugger: Performance bottlenecks

Gate: Requirements clear, design approved

Phase 2 - Implementation (Parallel):
- feature-implementer: New endpoints
- feature-implementer: Backward compatibility layer

Gate: Both implementations complete

Phase 3 - Testing (Sequential):
- test-runner: New endpoint tests
- test-runner: Compatibility tests
- test-runner: Load tests

Gate: All tests pass

Phase 4 - Documentation (Parallel):
- code-reviewer: API documentation
- feature-implementer: Migration guide

Gate: Documentation complete
```

## Workflow

### Step 1: Decompose Into Phases
Break work into logical phases:
- What needs to happen first?
- What can happen in parallel within phases?
- Where are the natural checkpoints?

### Step 2: Choose Strategy Per Phase
For each phase:
- Independent work → Parallel
- Dependencies → Sequential
- Need multiple perspectives → Swarm
- Progressive refinement → Iterative

### Step 3: Define Quality Gates
Between each phase, specify:
- What must be validated?
- What are success criteria?
- What happens if validation fails?

### Step 4: Execute Phase by Phase
Run each phase with chosen strategy.

### Step 5: Validate at Each Gate
Don't proceed until gate passes:
- [ ] All phase tasks complete
- [ ] Outputs meet quality criteria
- [ ] Next phase has needed inputs

### Step 6: Proceed or Handle Failure
- If gate passes → Continue to next phase
- If gate fails → Fix issues, retry

## Quality Gate Template

```
## Quality Gate: [Phase Name]

### Validation Checks:
- [ ] [Check 1]: [How to verify]
- [ ] [Check 2]: [How to verify]
- [ ] [Check 3]: [How to verify]

### Success Criteria:
- [Criterion 1]
- [Criterion 2]

### If Gate Fails:
1. [Action to take]
2. [Retry conditions]

### Proceed When:
All checks pass AND success criteria met
```

## Quality Criteria

- [ ] All phases completed in order
- [ ] All quality gates passed
- [ ] No phases skipped
- [ ] Final deliverables meet requirements

## Common Issues

**Issue**: Gate fails repeatedly
**Solution**: Review criteria for feasibility, adjust if too strict

**Issue**: Later phase blocked
**Solution**: Verify previous phase completed all requirements

**Issue**: Parallel tasks conflict
**Solution**: Check for hidden dependencies, adjust to sequential

## Language-Specific Examples

### Python (Flask)
```
Hybrid: Add authentication to existing API

Phase 1 - Assessment (Parallel):
- code-reviewer: Review current endpoints
- security-auditor: Identify security gaps
- test-runner: Run current tests

Gate: Security requirements documented

Phase 2 - Implementation (Sequential):
- feature-implementer: Add JWT middleware
- refactorer: Update all endpoints
- feature-implementer: Add auth routes

Gate: Code complete, compiles

Phase 3 - Testing (Parallel):
- test-runner: Unit tests
- test-runner: Integration tests
- security-auditor: Penetration testing

Gate: All tests pass, secure
```

### JavaScript (React)
```
Hybrid: Optimize large application

Phase 1 - Profiling (Swarm):
- debugger: Profile render performance
- code-reviewer: Analyze component structure
- performance-optimizer: Bundle size analysis

Gate: Optimization targets identified

Phase 2 - Optimization (Parallel):
- refactorer: Lazy load routes
- refactorer: Memoize expensive components
- performance-optimizer: Code split

Gate: Changes implemented

Phase 3 - Validation (Sequential):
- test-runner: Verify functionality
- performance-optimizer: Measure improvements
- code-reviewer: Final review

Gate: Performance targets met
```

### Go (Echo Framework)
```
Hybrid: Implement rate limiting

Phase 1 - Planning (Sequential):
- code-reviewer: Review current middleware
- debugger: Analyze traffic patterns

Gate: Rate limit strategy defined

Phase 2 - Implementation (Parallel):
- feature-implementer: Rate limiter middleware
- feature-implementer: Storage backend (Redis)

Gate: Components ready

Phase 3 - Testing (Sequential):
- test-runner: Unit tests
- test-runner: Load tests
- debugger: Verify rate limiting works

Gate: Meets requirements

Phase 4 - Deployment (Sequential):
- refactorer: Configure for production
- test-runner: Smoke tests

Gate: Production ready
```

## Planning Template

```
## Hybrid Coordination Plan

### Overall Goal:
[What we're trying to achieve]

### Phase 1: [Name]
**Strategy**: [Parallel/Sequential/Swarm/Iterative]
**Agents**:
- [Agent 1]: [Task]
- [Agent 2]: [Task]

**Quality Gate**:
- [ ] [Validation 1]
- [ ] [Validation 2]

### Phase 2: [Name]
**Strategy**: [Strategy]
**Agents**:
- [Agent]: [Task]

**Quality Gate**:
- [ ] [Validation 1]
- [ ] [Validation 2]

### Phase 3: [Name]
**Strategy**: [Strategy]
**Agents**:
- [Agent 1]: [Task]
- [Agent 2]: [Task]

**Quality Gate**:
- [ ] [Validation 1]
- [ ] [Validation 2]

### Overall Success Criteria:
- [Final criterion 1]
- [Final criterion 2]
```

## Best Practices

**Clear phase boundaries**: Each phase should have distinct purpose

**Meaningful gates**: Don't gate just to gate; validate something important

**Appropriate parallelism**: Only parallelize truly independent work

**Context transfer**: Pass learnings between phases explicitly

**Failure recovery**: Plan for gate failures with retry strategy