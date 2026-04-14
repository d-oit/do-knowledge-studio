# GOAP Agent - Reference Guide

Detailed guide for Goal-Oriented Action Planning with comprehensive examples, patterns, and advanced topics.

## Phase 1: Task Analysis - Deep Dive

### Initial Assessment Template

```markdown
## Task Analysis

**Primary Goal**: [Clear statement of what success looks like]

**Constraints**:
- Time: [Urgent / Normal / Flexible]
- Resources: [Available agents, tools, data]
- Dependencies: [External systems, prerequisites]

**Complexity Level**:
- Simple: Single agent, <3 steps
- Medium: 2-3 agents, some dependencies
- Complex: 4+ agents, mixed execution modes
- Very Complex: Multiple phases, many dependencies

**Quality Requirements**:
- Testing: [Unit / Integration / E2E]
- Standards: [AGENTS.md compliance, formatting, linting]
- Documentation: [API docs, examples, guides]
- Performance: [Speed, memory, scalability]
```

### Context Gathering Checklist

1. **Codebase Understanding**: Use Explore agent to understand relevant code
2. **Past Patterns**: Check if similar tasks have been done before
3. **Available Resources**: Identify available agents and their capabilities
4. **Current State**: Understand starting conditions and existing implementations

## Phase 2: Task Decomposition - Detailed Examples

### Complete Decomposition Example

```markdown
## Task Decomposition: Implement Authentication System

### Main Goal
Implement secure user authentication with JWT tokens and session management

### Sub-Goals
1. Database Schema - Priority: P0
   - Success Criteria: Tables created, migrations run
   - Dependencies: None
   - Complexity: Low

2. User Model - Priority: P0
   - Success Criteria: CRUD operations working
   - Dependencies: Database Schema
   - Complexity: Medium

3. Auth Middleware - Priority: P0
   - Success Criteria: JWT validation working
   - Dependencies: User Model
   - Complexity: High

4. API Endpoints - Priority: P1
   - Success Criteria: Login/logout/register working
   - Dependencies: Auth Middleware
   - Complexity: Medium

5. Testing - Priority: P1
   - Success Criteria: 90%+ coverage, all tests pass
   - Dependencies: API Endpoints
   - Complexity: Medium

### Atomic Tasks
**Component 1: Database Schema**
- Task 1.1: Design user table schema (Agent: goap-agent, Deps: none)
- Task 1.2: Create migration files (Agent: feature-implementer, Deps: 1.1)
- Task 1.3: Run migrations (Agent: test-runner, Deps: 1.2)

### Dependency Graph
```
Task 1.1 → Task 1.2 → Task 1.3
                      ↓
Task 2.1 → Task 2.2 → Task 3.1 → Task 4.1 → Task 5.1
```
```

### Key Decomposition Principles

- **Atomic**: Each task is indivisible and clear
- **Testable**: Can verify completion
- **Independent where possible**: Minimize dependencies
- **Assigned**: Each task maps to an agent capability

## Phase 3: Strategy Selection - Comprehensive Guide

### Strategy Comparison Matrix

| Strategy | When to Use | Speed | Complexity | Best For |
|----------|-------------|-------|------------|----------|
| **Parallel** | Independent tasks, time-critical | Nx | High | Testing multiple modules |
| **Sequential** | Dependent tasks, order matters | 1x | Low | Linear workflows |
| **Swarm** | Many similar tasks | ~Nx | Medium | Bulk operations |
| **Hybrid** | Mixed requirements | 2-4x | Very High | Complex projects |
| **Iterative** | Progressive refinement | Varies | Medium | Design/prototype cycles |

### Detailed Decision Tree

```
Needs iterative refinement?
├─ Yes (until criteria met or converged) → ITERATIVE
│  └─ Example: UI design, algorithm optimization
│
└─ No → Is time critical?
    ├─ Yes → Can tasks run in parallel?
    │   ├─ Yes → PARALLEL
    │   │   └─ Example: Test all crates simultaneously
    │   └─ No → SEQUENTIAL (prioritize critical path)
    │       └─ Example: Build → Test → Deploy
    │
    └─ No → Are tasks similar?
        ├─ Yes (many similar) → SWARM
        │   └─ Example: Fix 20 similar linting issues
        ├─ No (mixed) → HYBRID
        │   └─ Example: Research (seq) → Implement (parallel) → Test (seq)
        └─ Simple linear → SEQUENTIAL
```

## Phase 4: Agent Assignment - Detailed Matrix

### Complete Agent Capability Reference

| Agent Type | Capabilities | Best For | Limitations |
|------------|--------------|----------|-------------|
| **feature-implementer** | Design, implement, test features | New functionality, API development | May need guidance on architecture |
| **debugger** | Diagnose, fix runtime issues | Bug fixes, performance issues | Requires reproducible issue |
| **test-runner** | Execute tests, diagnose failures | Test validation, regression checks | Can't write new tests |
| **refactorer** | Improve code quality, structure | Code improvements, cleanup | Preserves behavior only |
| **code-reviewer** | Review quality, compliance | Quality assurance, standards | Doesn't implement fixes |
| **loop-agent** | Iterative refinement, convergence | Progressive improvements | Needs clear convergence criteria |

### Assignment Decision Framework

1. **Match capabilities**: What does the task require?
2. **Consider specialization**: Which agent has relevant expertise?
3. **Balance workload**: Distribute evenly across available agents
4. **Plan validation**: Which agent will verify the work?

## Phase 5: Execution Planning - Complete Templates

### Comprehensive Execution Plan Template

```markdown
## Execution Plan: Implement Authentication System

### Overview
- Strategy: Hybrid (Sequential → Parallel → Sequential)
- Total Tasks: 12
- Estimated Duration: 45 minutes
- Quality Gates: 3 checkpoints

### Phase 1: Foundation (Sequential)
**Tasks**:
- Task 1: Design database schema (Agent: goap-agent)
- Task 2: Create migrations (Agent: feature-implementer)
- Task 3: Run migrations (Agent: test-runner)

**Quality Gate**: Database ready, migrations verified

### Phase 2: Implementation (Parallel)
**Tasks**:
- Task 4: Implement user model (Agent: feature-implementer A)
- Task 5: Implement auth middleware (Agent: feature-implementer B)
- Task 6: Implement session management (Agent: feature-implementer C)

**Quality Gate**: All components implemented, unit tests pass

### Phase 3: Integration (Sequential)
**Tasks**:
- Task 7: Wire components together (Agent: feature-implementer)
- Task 8: Integration tests (Agent: test-runner)
- Task 9: Security review (Agent: code-reviewer)

**Quality Gate**: Integration tests pass, security approved

### Overall Success Criteria
- [ ] All 12 tasks complete
- [ ] 3 quality gates passed
- [ ] Tests passing (90%+ coverage)
- [ ] Documentation updated

### Contingency Plans
- If Phase 1 fails → Review schema design, adjust based on errors
- If Phase 2 fails → Debug individual components, retry
- If tests fail → Run debugger agent, apply fixes
```

## Phase 6: Coordinated Execution - Detailed Patterns

### Parallel Execution Pattern

```markdown
**Launching parallel agents:**
- Agent 1 (feature-implementer) → Task A: User model
- Agent 2 (feature-implementer) → Task B: Auth middleware
- Agent 3 (feature-implementer) → Task C: Session management

**Coordination approach:**
1. Send single message with all Task tool calls
2. Monitor each agent's progress independently
3. Wait for all agents to complete
4. Validate each result against success criteria
5. Aggregate results for next phase

**Monitoring during execution:**
- Check progress every 2-3 minutes
- Watch for errors or blockers
- Be ready to intervene if agent is stuck
```

### Sequential Execution Pattern

```markdown
**Phase-by-phase execution:**

Phase 1: Research
  Agent: Explore agent
  Task: Understand current auth implementation
  ↓ Quality Gate: Architecture documented

Phase 2: Design
  Agent: goap-agent
  Task: Design new auth system
  ↓ Quality Gate: Design approved

Phase 3: Implement
  Agent: feature-implementer
  Task: Build auth system
  ↓ Quality Gate: Implementation complete

Phase 4: Validate
  Agent: test-runner + code-reviewer
  Task: Tests and review
  ↓ Quality Gate: Ready for merge
```

### Monitoring Checklist

- [ ] Track agent progress (not started / in progress / complete / failed)
- [ ] Monitor for failures or errors
- [ ] Validate intermediate results against quality gates
- [ ] Adjust plan if blockers discovered
- [ ] Document decisions and rationale

## Phase 7: Result Synthesis - Templates

### Comprehensive Summary Template

```markdown
## Execution Summary: Implement Authentication System

### ✓ Completed Tasks
- Task 1: Database schema design - Success
- Task 2: Migration creation - Success
- Task 3: Migration execution - Success
- Task 4: User model implementation - Success
- Task 5: Auth middleware implementation - Success
- Task 6: Session management - Success
- Task 7: Component integration - Success
- Task 8: Integration tests - Success
- Task 9: Security review - Approved

### 📦 Deliverables
- Database migrations (src/db/migrations/)
- User model (src/models/user.rs)
- Auth middleware (src/middleware/auth.rs)
- Session manager (src/session/mod.rs)
- API endpoints (src/routes/auth.rs)
- Test suite (tests/auth/)
- API documentation (docs/auth.md)

### ✅ Quality Validation
- Tests: Pass (92% coverage)
- Linting: Pass (clippy, fmt)
- Standards: Compliant (AGENTS.md)
- Security: Approved (no vulnerabilities)

### 📊 Performance Metrics
- Duration: 42 minutes (estimated: 45)
- Efficiency: 2.8x speedup (parallel phases)
- Quality gates: 3/3 passed

### 💡 Recommendations
- Consider adding rate limiting to auth endpoints
- Add refresh token rotation for enhanced security
- Document token expiration policies

### 🎓 Lessons Learned
- What worked well: Parallel implementation saved significant time
- What to improve: Start security review earlier in process
- Next time: Add performance benchmarks to quality gates
```

## Common GOAP Patterns - Extended Examples

### Pattern 1: Research → Implement → Validate

```markdown
**Use Case**: New feature with unclear requirements

Phase 1 (Sequential): Research
  - Explore agent → Understand codebase, existing patterns
  - Quality Gate: Architecture and approach documented

Phase 2 (Parallel): Implement
  - feature-implementer (A) → Module 1
  - feature-implementer (B) → Module 2
  - feature-implementer (C) → Module 3
  - Quality Gate: All implementations complete, unit tests pass

Phase 3 (Sequential): Validate
  - test-runner → Integration tests
  - code-reviewer → Final review
  - Quality Gate: Ready for merge

**Total estimated time**: 30-45 minutes
**Best for**: Features with clear modular boundaries
```

### Pattern 2: Investigate → Diagnose → Fix → Verify

```markdown
**Use Case**: Production bug requiring careful analysis

Phase 1: Investigate
  - debugger → Reproduce issue, gather logs
  - Quality Gate: Issue reliably reproduced

Phase 2: Diagnose
  - debugger → Root cause analysis
  - Quality Gate: Root cause identified with evidence

Phase 3: Fix
  - refactorer → Apply targeted fix
  - Quality Gate: Fix implemented, no regressions

Phase 4: Verify
  - test-runner → Regression tests
  - code-reviewer → Code review
  - Quality Gate: Tests pass, approved for deploy

**Total estimated time**: 20-40 minutes
**Best for**: Critical bugs, performance issues
```

### Pattern 3: Audit → Improve → Validate

```markdown
**Use Case**: Code quality improvement initiative

Phase 1: Audit
  - code-reviewer → Comprehensive quality audit
  - Quality Gate: Issues categorized by priority

Phase 2 (Swarm): Improve
  - Multiple refactorer agents working in parallel
  - Work queue: [issue list prioritized]
  - Each agent picks next issue, fixes, moves to next
  - Quality Gate: All P0/P1 issues addressed

Phase 3: Validate
  - test-runner → Full test suite
  - code-reviewer → Final quality check
  - Quality Gate: Quality targets met

**Total estimated time**: 45-90 minutes
**Best for**: Tech debt reduction, pre-release polish
```

## Error Handling & Recovery - Detailed Procedures

### Agent Failure Recovery

```markdown
**Step-by-step recovery process:**

1. **Log failure details**
   - What task was being attempted?
   - What error occurred?
   - At what phase did failure happen?

2. **Assess quality gate status**
   - Did previous phase complete successfully?
   - Are dependent tasks blocked?

3. **Choose recovery strategy:**

   **Retry** (for transient errors):
   - Same agent, same task
   - Example: Network timeout, temporary resource unavailable

   **Reassign** (for agent-specific issues):
   - Different agent, same task
   - Example: Agent lacks specific capability

   **Modify** (for requirements issues):
   - Adjust task definition
   - Example: Task too complex, needs decomposition

   **Escalate** (for blocking issues):
   - Report to user
   - Example: Fundamental requirement conflict

4. **Document and continue**
   - Record what happened
   - Update plan if needed
   - Resume execution
```

### Quality Gate Failure

```markdown
**Recovery procedure:**

1. **Identify failing criteria**
   - Which specific criteria failed?
   - How far from passing?

2. **Diagnose root cause**
   - Implementation issue?
   - Test issue?
   - Criteria too strict?

3. **Choose action:**

   **Re-run previous phase**:
   - Assign fix task to appropriate agent
   - Example: Tests fail → debugger diagnoses → refactorer fixes

   **Adjust criteria** (if appropriate):
   - Only if criteria genuinely incorrect
   - Document rationale

   **Change strategy**:
   - Example: Parallel → Sequential for focused debugging

4. **Re-validate**
   - Run quality gate again
   - Ensure fix didn't break other things
```

### Blocked Dependencies

```markdown
**Unblocking strategies:**

1. **Identify blocking task**
   - Which task is the blocker?
   - Why is it blocked?

2. **Prioritize unblocking**
   - Move blocking task to highest priority
   - Assign best-suited agent

3. **Options:**

   **Re-order plan**:
   - Execute dependency first
   - Adjust downstream tasks

   **Refactor plan**:
   - Remove dependency if possible
   - Find alternative approach

   **Parallel independent work**:
   - Continue with non-blocked tasks
   - Return to blocked task when ready
```

## Advanced Topics

### Dynamic Re-Planning

**When to re-plan:**
- Dependencies change during execution
- Requirements become clearer
- Blockers discovered
- Performance issues found
- Agent failures require strategy change

**Re-planning process:**
1. Pause current execution
2. Document current state (what's complete, what's in progress)
3. Re-analyze with new information
4. Adjust plan (tasks, dependencies, strategy)
5. Communicate changes to all agents
6. Resume with updated plan

### Optimization Techniques

**Critical Path Optimization:**
- Identify longest path through dependency graph
- Parallelize non-critical-path tasks
- Focus best agents on critical path

**Resource Pooling:**
- Share agents across similar tasks
- Batch similar work for efficiency
- Consider agent warm-up costs

**Incremental Delivery:**
- Complete and validate phases incrementally
- Deliver value early
- Get feedback before continuing

**Adaptive Strategy:**
- Monitor progress metrics
- Switch strategies based on actual vs estimated
- Example: Parallel → Sequential if coordination overhead too high

### Multi-Phase Complex Projects

```markdown
**Example: System Migration**

Phase 1: Analysis (2 days)
  - Understand current system
  - Document requirements
  - Design target architecture

Phase 2: Foundation (1 day)
  - Set up new infrastructure
  - Create migration tools
  - Establish testing framework

Phase 3: Parallel Migration (3 days)
  - Team A: Migrate module X
  - Team B: Migrate module Y
  - Team C: Migrate module Z

Phase 4: Integration (1 day)
  - Wire migrated modules together
  - Integration testing
  - Performance validation

Phase 5: Cutover (4 hours)
  - Final data sync
  - Switch traffic
  - Monitor closely

**Key success factors:**
- Clear phase boundaries
- Quality gates between phases
- Rollback plan at each phase
- Communication throughout
```

## Metrics and Measurement

### Planning Quality Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Decomposition clarity | All tasks atomic | Review task descriptions |
| Dependency accuracy | <5% missing deps | Track blocked tasks |
| Time estimate accuracy | ±20% | Compare actual vs estimated |
| Strategy appropriateness | 90%+ success rate | Track strategy changes |
| Quality gate effectiveness | Catch issues early | Defects found per gate |

### Execution Quality Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Task completion rate | 95%+ | Tasks completed / planned |
| Quality gate pass rate | 90%+ first time | Gates passed / total |
| Re-work rate | <10% | Tasks requiring redo |
| Resource utilization | 80%+ | Agent time / available time |
| Parallel speedup | 2-4x | Sequential time / actual time |

### Learning Metrics

- Document what worked well after each execution
- Identify improvement areas
- Update patterns library
- Share knowledge with team
- Track metric trends over time
