# Sequential Coordination

Execute agents in order where each task requires previous outputs.

## When to Use

- Strong dependencies between tasks
- Each task needs the previous result
- Order of execution matters
- Risk of conflicts if run concurrently

## Pattern

```
Task: [Overall Goal]

Sequential Chain:
└─ Agent A: [Task 1]
   └─ Agent B: [Task 2, uses A's output]
      └─ Agent C: [Task 3, uses B's output]
```

## Implementation

**Separate messages with explicit context handoff**:

Message 1:
```
Task(subagent_type="feature-implementer", 
     prompt="Implement password reset feature")
```

Message 2 (after completion):
```
Context: Feature implemented in [files]

Task(subagent_type="test-runner",
     prompt="Test the password reset feature")
```

Message 3 (after tests pass):
```
Context: Feature tested, all tests pass

Task(subagent_type="code-reviewer",
     prompt="Review password reset implementation")
```

## Examples

### Example 1: Feature Development
```
Goal: Build and validate new feature

Sequential:
1. feature-implementer → Produces code
2. test-runner → Tests the code
3. code-reviewer → Reviews implementation

Each step requires previous completion
```

### Example 2: Bug Fix Workflow
```
Goal: Fix reported bug

Sequential:
1. debugger → Identifies root cause
2. refactorer → Applies fix
3. test-runner → Verifies fix works
4. code-reviewer → Reviews changes

Cannot skip ahead; each informs the next
```

### Example 3: Performance Optimization
```
Goal: Optimize slow database query

Sequential:
1. debugger → Profiles query performance
2. code-reviewer → Analyzes query logic
3. refactorer → Applies optimizations
4. test-runner → Benchmarks improvements

Each step builds on previous findings
```

## Workflow

### Step 1: Plan the Sequence
Identify correct order:
- What must happen first?
- What information passes between steps?
- Are there any optional steps?

### Step 2: Execute First Agent
Run initial agent with full context:
```
Task(subagent_type="[agent]",
     prompt="[Detailed instructions]",
     description="[What to produce]")
```

### Step 3: Handoff with Context
When passing to next agent, include:
- What the previous agent did
- Key outputs or findings
- Specific task for this agent
- Success criteria

Template:
```
Previous: [Agent X] completed [task]
Output: [Key deliverables]
Location: [Where to find results]

Your task: [Specific instructions]
Success criteria: [How to validate]
```

### Step 4: Validate Before Proceeding
At each transition, check:
- [ ] Previous agent completed successfully
- [ ] Output meets quality criteria
- [ ] Next agent has needed information

### Step 5: Iterate Until Complete
Continue chain until final goal achieved.

## Quality Criteria

- [ ] Each agent completed its task
- [ ] Context properly transferred at each step
- [ ] No steps skipped or reordered
- [ ] Final output meets all requirements

## Common Issues

**Issue**: Later agent missing context
**Solution**: Include more detail in handoff, or have agent read previous outputs

**Issue**: Agent blocked waiting for information
**Solution**: Ensure previous agent produced required outputs

**Issue**: Need to restart sequence
**Solution**: Acceptable; use findings to improve future runs

## Language-Specific Examples

### Python (FastAPI)
```
Sequential API endpoint development:
1. feature-implementer → Create endpoint with validation
2. test-runner → Test with various inputs
3. security-auditor → Check for injection vulnerabilities
4. code-reviewer → Review error handling

Each step validates previous work
```

### JavaScript (Express)
```
Sequential middleware addition:
1. feature-implementer → Add rate limiting middleware
2. test-runner → Test rate limit behavior
3. performance-optimizer → Profile overhead
4. code-reviewer → Review configuration

Cannot test before implementing
```

### Go (Gin)
```
Sequential handler optimization:
1. debugger → Profile handler performance
2. refactorer → Optimize based on profile
3. test-runner → Verify functionality maintained
4. debugger → Confirm performance improvement

Each step informs the next
```

## Handoff Template

Use this template for context transfer:

```
## Context from [Previous Agent]

**Task Completed**: [What was done]

**Key Outputs**:
- Output 1: [Location/Description]
- Output 2: [Location/Description]

**Important Findings**:
- [Key insight or decision]

**Language/Framework Context**:
- Language: [Python/JavaScript/etc.]
- Framework: [Django/React/etc.]
- Version: [3.11/18.x/etc.]

## Task for [Current Agent]

**Goal**: [Specific objective]

**Inputs**: [What to work with from previous step]

**Success Criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

**Expected Output**: [What this agent should produce]
```