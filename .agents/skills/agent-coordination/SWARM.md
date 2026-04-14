# Swarm Coordination

Gather multiple expert perspectives in parallel, synthesize findings, then apply coordinated solution.

## When to Use

- Problem is complex or multifaceted
- Multiple perspectives add value
- Need comprehensive analysis
- Single approach might miss issues

## Pattern

```
Task: [Complex Problem]

Phase 1 - Parallel Investigation:
├─ Expert A: [Perspective 1]
├─ Expert B: [Perspective 2]
└─ Expert C: [Perspective 3]

Phase 2 - Synthesis:
Analyze findings, identify patterns

Phase 3 - Resolution:
Apply coordinated solution
```

## Implementation

### Phase 1: Parallel Investigation
Execute all agents simultaneously:
```
Task(subagent_type="debugger", prompt="Profile runtime performance")
Task(subagent_type="code-reviewer", prompt="Analyze code efficiency")
Task(subagent_type="test-runner", prompt="Run performance benchmarks")
```

### Phase 2: Synthesis
After all complete, analyze:
- Where do findings agree?
- Where do they conflict?
- What patterns emerge?
- What is the root cause?

**Save synthesized analysis to `analysis/` directory** (e.g., `analysis/SWARM_ANALYSIS.md`)

### Phase 3: Resolution
Based on synthesis:
- Prioritize actions
- Apply fixes
- Validate solution

## Examples

### Example 1: Performance Degradation
```
Goal: Diagnose 5x slowdown in API response time

Phase 1 - Investigate (Parallel):
- debugger: Profile CPU and memory usage
- code-reviewer: Review recent changes for inefficiencies
- test-runner: Benchmark each endpoint

Phase 2 - Synthesize:
All three identify new N+1 query in user lookup

Phase 3 - Resolve:
- refactorer: Add query optimization
- test-runner: Verify performance restored
```

### Example 2: Production Bug
```
Goal: Fix intermittent authentication failures

Phase 1 - Investigate (Parallel):
- debugger: Analyze error logs and traces
- code-reviewer: Review auth middleware
- security-auditor: Check for race conditions

Phase 2 - Synthesize:
debugger finds timing pattern, code-reviewer spots token
refresh logic issue, security-auditor confirms race condition

Phase 3 - Resolve:
- refactorer: Add proper locking
- test-runner: Add concurrency tests
```

### Example 3: Code Quality Assessment
```
Goal: Validate release candidate quality

Phase 1 - Assess (Parallel):
- code-reviewer: Check standards compliance
- test-runner: Verify test coverage
- security-auditor: Scan for vulnerabilities

Phase 2 - Synthesize:
Identify 3 critical issues, 7 recommendations

Phase 3 - Resolve:
Prioritize critical fixes before release
```

## Workflow

### Step 1: Identify Experts Needed
What perspectives are valuable?
- Technical domain (performance, security, architecture)
- Testing approach (unit, integration, load)
- Code aspects (logic, structure, documentation)

### Step 2: Execute Swarm Investigation
Launch all agents in parallel with clear scope:
```
Investigate [problem] from your perspective:

Agent 1: [Specific angle to examine]
Agent 2: [Different specific angle]
Agent 3: [Another specific angle]

Focus on [aspect] and report findings.
```

### Step 3: Wait for All Results
Don't proceed until all agents complete.

### Step 4: Synthesize Findings
Analyze results systematically:

**Agreement**: What do multiple agents confirm?
**Conflicts**: Where do findings disagree?
**Patterns**: What themes emerge?
**Root Cause**: What's the underlying issue?

### Step 5: Plan Resolution
Based on synthesis:
- Prioritize issues (critical vs nice-to-have)
- Assign fixes to appropriate agents
- Define validation steps

### Step 6: Execute and Validate
Apply solution, verify it works.

## Synthesis Template

```
## Swarm Analysis Results

### Participating Agents:
- [Agent 1]: [Focus area]
- [Agent 2]: [Focus area]
- [Agent 3]: [Focus area]

### Key Findings:

**Confirmed by Multiple Agents**:
- Finding 1: [Agents A, B agree]
- Finding 2: [Agents B, C agree]

**Conflicting Views**:
- Topic X: Agent A says [view], Agent B says [different view]
- Resolution: [How to reconcile]

**Unique Insights**:
- Agent A only: [Unique finding]
- Agent C only: [Unique finding]

### Root Cause Analysis:
[Synthesized understanding of the problem]

### Recommended Actions:
1. [Priority 1 action - based on findings X, Y]
2. [Priority 2 action - based on finding Z]
3. [Optional improvement - based on insight W]
```

## Quality Criteria

- [ ] All agents completed investigation
- [ ] Findings synthesized comprehensively
- [ ] Agreement and conflicts identified
- [ ] Root cause determined
- [ ] Resolution plan created
- [ ] Solution validated

## Common Issues

**Issue**: Agents return similar findings
**Solution**: Ensure each has distinct focus area

**Issue**: Findings too scattered to synthesize
**Solution**: Provide clearer scope to each agent

**Issue**: Conflicting recommendations
**Solution**: Acceptable; synthesis process resolves conflicts

## Language-Specific Examples

### Python (Django)
```
Swarm: Diagnose memory leak

Phase 1 - Investigate:
- debugger: Profile memory usage over time
- code-reviewer: Review queryset usage and caching
- test-runner: Run load tests with memory monitoring

Phase 2 - Synthesize:
All point to unoptimized queryset in analytics view

Phase 3 - Resolve:
Add select_related and proper pagination
```

### JavaScript (Node.js)
```
Swarm: Optimize API latency

Phase 1 - Investigate:
- debugger: Profile async operations
- code-reviewer: Review promise chains
- performance-optimizer: Analyze event loop blocking

Phase 2 - Synthesize:
Consensus on synchronous file I/O causing delays

Phase 3 - Resolve:
Convert to async file operations
```

### Java (Spring Boot)
```
Swarm: Resolve thread deadlock

Phase 1 - Investigate:
- debugger: Analyze thread dumps
- code-reviewer: Review synchronization blocks
- test-runner: Reproduce with concurrency tests

Phase 2 - Synthesize:
Identify circular lock dependency in service layer

Phase 3 - Resolve:
Refactor to consistent lock ordering
```

## Swarm Variants

### Deep Swarm
More agents, narrower focus each:
```
5+ agents each examining specific subsystem
Better for complex distributed systems
```

### Iterative Swarm
Repeat swarm after each fix:
```
Swarm → Fix → Swarm → Fix → Until clean
Good for incremental quality improvement
```

### Specialized Swarm
All same agent type, different inputs:
```
3x test-runner with different test suites
Comprehensive test coverage validation
```