# Task Decomposition - Reference Guide

Comprehensive guide for breaking down complex tasks into atomic, actionable goals.

## Decomposition Framework - Deep Dive

### 1. Requirements Analysis

**Extract Information**:
- Primary objective (what user wants to achieve)
- Implicit requirements (quality, performance, documentation)
- Constraints (time, resources, compatibility)
- Success criteria (how to measure completion)

**Questions to Ask**:
- What is the core goal?
- What are the sub-goals that contribute to the main goal?
- What are the dependencies between sub-goals?
- What could go wrong and how to prevent it?

**Analysis Template**:
```markdown
## Requirements Analysis

**User Request**: [Original request]

**Primary Objective**: 
[Clear statement of main goal]

**Implicit Requirements**:
- Quality: [Standards expected]
- Performance: [Speed, memory requirements]
- Documentation: [API docs, examples needed]

**Constraints**:
- Time: [Deadline if any]
- Resources: [Available tools, agents]
- Compatibility: [Must work with X, Y, Z]

**Success Criteria**:
- [ ] Criterion 1 (measurable)
- [ ] Criterion 2 (measurable)
- [ ] Criterion 3 (measurable)
```

### 2. Goal Hierarchy

**Top-Down Decomposition**:
```
Main Goal: [High-level objective]
├─ Sub-goal 1: [Component 1]
│  ├─ Task 1.1: [Atomic action]
│  └─ Task 1.2: [Atomic action]
├─ Sub-goal 2: [Component 2]
│  ├─ Task 2.1: [Atomic action]
│  └─ Task 2.2: [Atomic action]
└─ Sub-goal 3: [Component 3]
   └─ Task 3.1: [Atomic action]
```

**Atomic Task Criteria**:
- Single, clear action
- Well-defined inputs and outputs
- Can be completed by one agent
- Testable/verifiable completion
- Time-bounded (estimable duration)

**Granularity Guidelines**:
- Too coarse: "Build the system" (not atomic)
- Too fine: "Write import statement" (micromanagement)
- Just right: "Implement user authentication function" (clear, testable)

### 3. Dependency Mapping

**Dependency Types**:

#### Sequential Dependencies
```
Task A → Task B → Task C
(B requires A's output, C requires B's output)
```
**Example**: Design schema → Create tables → Insert data

#### Parallel Independent
```
Task A ─┐
Task B ─┼─ [All can run simultaneously]
Task C ─┘
```
**Example**: Test module A, Test module B, Test module C

#### Converging Dependencies
```
Task A ─┐
Task B ─┼─> Task D (requires A, B, C)
Task C ─┘
```
**Example**: Implement features A, B, C → Integration testing

#### Resource Dependencies
```
Task A (needs resource X)
Task B (needs resource X)
→ Sequential or resource pooling required
```
**Example**: Two tasks writing to same database table

**Dependency Identification Questions**:
1. Does this task need output from another task?
2. Do these tasks share write access to resources?
3. Must these tasks complete in a specific order?
4. Can these tasks run at the same time?

### 4. Success Criteria Definition

For each task, define:

**Input Requirements**:
- What data/state is needed to start
- What resources must be available
- What preconditions must be met

**Output Expectations**:
- What artifacts will be produced
- What state changes will occur
- What metrics define success

**Quality Standards**:
- Performance requirements
- Code quality standards (from AGENTS.md)
- Testing requirements
- Documentation requirements

**Success Criteria Template**:
```markdown
### Task: [Name]

**Inputs**:
- [Required input 1]
- [Required input 2]

**Outputs**:
- [Expected output 1]
- [Expected output 2]

**Success Metrics**:
- [Metric 1]: [Target value]
- [Metric 2]: [Target value]

**Quality Standards**:
- [Standard 1]: [Requirement]
- [Standard 2]: [Requirement]
```

## Decomposition Process - Step by Step

### Step 1: Understand the Goal

```markdown
User Request: [Original request]

Analysis:
- Primary Goal: [Main objective]
- Type: [Implementation/Debug/Refactor/Analysis]
- Domain: [Specific area of codebase]
- Complexity: [Simple/Medium/Complex]
```

**Understanding Checklist**:
- [ ] Core goal is clear
- [ ] Implicit requirements identified
- [ ] Constraints understood
- [ ] Success criteria defined

### Step 2: Identify Major Components

Break main goal into 3-7 major components:

```markdown
Main Goal: Implement batch pattern update feature

Major Components:
1. Database layer (Turso + redb)
2. API layer (public interface)
3. Business logic (batch processing)
4. Testing (unit + integration)
5. Documentation (API docs + examples)
```

**Component Identification Tips**:
- Look for natural boundaries (layers, modules)
- Consider technical concerns (data, logic, interface)
- Include quality tasks (testing, documentation)
- Aim for 3-7 components (not too many, not too few)

### Step 3: Decompose Each Component

For each component, identify atomic tasks:

```markdown
Component: Database layer

Tasks:
1. Design batch schema/structure
   - Input: Pattern data structures
   - Output: Schema definition
   - Success: Supports efficient batch operations

2. Implement Turso batch operations
   - Input: Schema, patterns array
   - Output: Batch insert/update functions
   - Success: Atomic transaction, proper error handling

3. Implement redb batch caching
   - Input: Schema, patterns array
   - Output: Batch cache update functions
   - Success: Fast writes, consistency maintained
```

**Decomposition Questions**:
- What's the first thing needed?
- What follows naturally?
- What can be done in parallel?
- What's the minimum for this component?

### Step 4: Map Dependencies

```markdown
Dependency Graph:

[Design schema] ──┬──> [Implement Turso batch] ──┐
                  │                               ├──> [Write tests]
                  └──> [Implement redb batch] ───┘

[Write tests] ──> [Write documentation]
```

**Mapping Techniques**:
- List all tasks
- Draw arrows for dependencies
- Identify parallel groups
- Find critical path

### Step 5: Assign Priorities

**Priority Levels**:
- **P0 (Critical)**: Must complete for goal achievement
- **P1 (Important)**: Significantly improves quality/functionality
- **P2 (Nice-to-have)**: Enhances but not essential

**Prioritization Factors**:
- Blocks other tasks (critical path)
- High user value
- Risk reduction (address unknowns early)
- Quick wins (early validation)

**Priority Assignment Template**:
```markdown
### Priority Assignment

**P0 (Critical)**:
- Task 1.1: [Reason: blocks all other work]
- Task 1.2: [Reason: core functionality]

**P1 (Important)**:
- Task 2.1: [Reason: quality improvement]
- Task 2.2: [Reason: user value]

**P2 (Nice-to-have)**:
- Task 3.1: [Reason: enhancement only]
```

### Step 6: Estimate Complexity

For each task:
```markdown
Task: [Name]
- Complexity: [Low/Medium/High]
- Effort: [Small/Medium/Large]
- Risk: [Low/Medium/High]
- Dependencies: [List]
```

**Estimation Guidelines**:
- **Low**: <30 minutes, well-understood
- **Medium**: 30 min - 2 hours, some unknowns
- **High**: >2 hours, significant unknowns

## Decomposition Patterns

### Pattern 1: Layer-Based Decomposition

For architectural changes:
```
1. Data/Storage layer
   - Schema design
   - Database implementation
   - Caching layer

2. Business logic layer
   - Core algorithms
   - Validation rules
   - Business rules

3. API/Interface layer
   - Public API design
   - Request handling
   - Response formatting

4. Testing layer
   - Unit tests
   - Integration tests
   - E2E tests

5. Documentation layer
   - API documentation
   - Usage examples
   - Architecture docs
```

**When to Use**: System architecture changes, new feature across layers

### Pattern 2: Feature-Based Decomposition

For new features:
```
1. Core functionality (MVP)
   - Minimum viable implementation
   - Basic happy path
   - Essential error handling

2. Error handling & edge cases
   - Input validation
   - Edge case handling
   - Error messages

3. Performance optimization
   - Bottleneck identification
   - Optimization implementation
   - Performance testing

4. Integration with existing system
   - Wire up to existing code
   - Update configuration
   - Migration if needed

5. Testing & validation
   - Comprehensive tests
   - Quality gates
   - Acceptance criteria

6. Documentation & examples
   - API docs
   - Usage examples
   - Migration guide
```

**When to Use**: New feature development, user-facing functionality

### Pattern 3: Phase-Based Decomposition

For large projects:
```
Phase 1: Research & Design
- Understand requirements
- Research approaches
- Design solution
- Get approval

Phase 2: Foundation & Infrastructure
- Set up tooling
- Create base structures
- Establish patterns
- Build scaffolding

Phase 3: Core Implementation
- Implement main functionality
- Handle edge cases
- Add error handling
- Write unit tests

Phase 4: Integration & Testing
- Integrate with system
- Run integration tests
- Fix integration issues
- Performance validation

Phase 5: Optimization & Polish
- Optimize performance
- Improve error messages
- Refine UX
- Final testing

Phase 6: Documentation & Release
- Write documentation
- Create examples
- Update changelog
- Release/deploy
```

**When to Use**: Large multi-week projects, architectural changes

### Pattern 4: Problem-Solution Decomposition

For debugging/fixing:
```
1. Reproduce issue
   - Understand symptoms
   - Create reproduction steps
   - Verify consistency

2. Diagnose root cause
   - Gather data (logs, traces)
   - Analyze patterns
   - Identify root cause
   - Verify hypothesis

3. Design solution
   - Consider options
   - Evaluate trade-offs
   - Select approach
   - Plan implementation

4. Implement fix
   - Apply targeted fix
   - Add error handling
   - Update related code

5. Verify fix
   - Test reproduction case
   - Run regression tests
   - Check for side effects

6. Prevent regression
   - Add tests for issue
   - Document learnings
   - Update monitoring
```

**When to Use**: Bug fixes, performance issues, production incidents

## Example Decompositions - Complete

### Example 1: Simple Task

```markdown
Request: "Fix failing test in pattern extraction"

Analysis:
- Primary Goal: Make test pass
- Type: Debug/Fix
- Domain: Pattern extraction module
- Complexity: Simple

Decomposition:
1. Run test to observe failure
   - Input: Test file
   - Output: Failure message
   - Success: Clear understanding of failure

2. Identify failure cause
   - Input: Failure message, code
   - Output: Root cause diagnosis
   - Success: Clear root cause identified

3. Apply fix
   - Input: Root cause, code
   - Output: Fixed code
   - Success: Fix implemented

4. Verify test passes
   - Input: Fixed code
   - Output: Test result
   - Success: Test passes

5. Check for similar issues
   - Input: Fixed code pattern
   - Output: List of similar patterns
   - Success: No similar issues or all fixed

Dependencies: Sequential (1→2→3→4→5)
Complexity: Low
Strategy: Single agent, sequential execution
Estimated time: 15-30 minutes
```

### Example 2: Medium Task

```markdown
Request: "Add caching to episode retrieval"

Analysis:
- Primary Goal: Improve retrieval performance with caching
- Type: Feature/Optimization
- Domain: Episode management
- Complexity: Medium

Decomposition:
1. Design cache strategy
   - Input: Current retrieval code, performance requirements
   - Output: Cache design document
   - Success: Clear strategy, handles edge cases

2. Implement cache layer
   - Input: Cache design
   - Output: Cache implementation
   - Success: Cache works, proper invalidation

3. Integrate with retrieval
   - Input: Cache, retrieval code
   - Output: Integrated code
   - Success: Retrieval uses cache transparently

4. Add tests
   - Input: Integrated code
   - Output: Test suite
   - Success: Cache behavior tested, edge cases covered

5. Measure performance
   - Input: Tests, benchmarks
   - Output: Performance metrics
   - Success: Meets performance targets

Dependencies:
- 1 → 2 → 3 (sequential)
- 4 depends on 3
- 5 depends on 3

Strategy: Sequential with parallel testing
Estimated time: 1-2 hours
```

### Example 3: Complex Task

```markdown
Request: "Refactor storage layer to support multiple backends"

Analysis:
- Primary Goal: Enable pluggable storage backends
- Type: Refactor/Architecture
- Domain: Storage layer
- Complexity: High

Major Components:
1. Storage abstraction layer
   - Define Storage trait/interface
   - Create common types
   - Design factory pattern

2. Turso backend implementation
   - Implement Storage trait for Turso
   - Migrate existing Turso code
   - Add Turso-specific tests

3. redb backend implementation
   - Implement Storage trait for redb
   - Create redb operations
   - Add redb-specific tests

4. Backend factory & configuration
   - Create factory function
   - Add configuration options
   - Implement selection logic

5. Migration utilities
   - Create migration scripts
   - Test data integrity
   - Rollback procedures

6. Testing infrastructure
   - Shared test suite for all backends
   - Backend-specific tests
   - Integration tests

7. Documentation
   - Architecture documentation
   - Backend selection guide
   - Migration guide

Strategy: Multi-phase hybrid execution
Coordination: GOAP agent + multiple specialized agents
Estimated time: 1-2 days
```

## Quality Checklist

### Good Decomposition Characteristics

✓ Each task is atomic and actionable
✓ Dependencies are clearly identified
✓ Success criteria are measurable
✓ Complexity is appropriately estimated
✓ All requirements are covered
✓ No task is too large (>4 hours work)
✓ Parallelization opportunities identified
✓ Quality tasks included (testing, documentation)

### Common Pitfalls

✗ Tasks too large or vague
  - Fix: Break down further until atomic

✗ Missing dependencies
  - Fix: Review each task for hidden dependencies

✗ Unclear success criteria
  - Fix: Define specific, measurable outcomes

✗ Over-decomposition (too granular)
  - Fix: Combine micro-tasks into meaningful units

✗ Missing quality/testing tasks
  - Fix: Add explicit testing and validation tasks

✗ No consideration for error handling
  - Fix: Include error handling in each task

✗ Forgetting documentation tasks
  - Fix: Add documentation as explicit tasks

## Tips for Effective Decomposition

### 1. Start with Why
- Understand the true goal behind the request
- Identify implicit requirements
- Consider broader context

### 2. Think Top-Down
- Start with high-level components
- Decompose each component separately
- Stop at appropriate granularity

### 3. Consider the User
- What value does each task provide?
- Can tasks be reordered for faster feedback?
- What's the minimum viable solution?

### 4. Plan for Quality
- Include testing tasks
- Include documentation tasks
- Include review/validation tasks

### 5. Anticipate Issues
- What could go wrong?
- What are the unknowns?
- Where are the risks?

### 6. Enable Parallelization
- Identify truly independent tasks
- Break dependencies where possible
- Consider resource constraints

## Integration with GOAP Agent

The GOAP agent uses task decomposition as its first phase:

```
1. Receive user request
2. Apply decomposition framework (this skill)
3. Create execution plan (agent-coordination skill)
4. Execute with monitoring (parallel-execution skill)
5. Report results
```

**GOAP Integration Points**:
- Decomposition provides tasks for GOAP planning
- Dependencies inform GOAP strategy selection
- Success criteria become GOAP quality gates
- Complexity estimates inform GOAP agent assignment
