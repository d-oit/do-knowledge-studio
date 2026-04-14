# TRIZ Swarm Example: Solving a Database Migration Contradiction

Demonstrates using the `triz-solver` skill with `agent-coordination` swarm pattern
and handoff between agents.

## Scenario

A team needs to migrate from PostgreSQL to a new schema version. The migration
improves query performance (adding indexes, denormalizing) but worsens downtime
risk and rollback complexity.

## Setup

```bash
# Skills used:
# - triz-solver: Identify and resolve the contradiction
# - agent-coordination (swarm): Multi-perspective investigation
# - task-decomposition: Break into atomic migration tasks
```

## Step 1: TRIZ Contradiction Analysis

Using the `triz-solver` skill, frame the problem:

```
Problem: Schema migration improves query performance but increases downtime risk
Current approach: Big-bang migration during maintenance window
Stuck because: Larger tables = longer downtime = unacceptable for 24/7 service

Contradiction:
  Improving: Performance (query speed via indexes + denormalization)
  Worsens: Availability (downtime during migration)

Type: Technical contradiction
```

## Step 2: Apply TRIZ Principles

From the contradiction matrix: **Performance vs Availability → #1 Segmentation, #13 Dynamics, #15 Parameter Changes**

Resolution via **Separation in Time** (Principle #13 - Dynamics):

```
Instead of big-bang migration:
1. Deploy new schema alongside old (both active)
2. Dual-write to both schemas
3. Backfill new schema incrementally
4. Switch reads to new schema
5. Remove old schema

Result: Zero-downtime migration via gradual transition
```

## Step 3: Swarm Investigation

Launch 3 parallel agents to validate the approach:

```
Task(subagent_type="general", prompt="Investigate the dual-write approach
for database migration. Focus on data consistency risks during the transition
period. What safeguards are needed?")

Task(subagent_type="general", prompt="Analyze the rollback strategy for a
gradual migration. If we need to abort mid-migration, what's the recovery
path? Focus on the point-of-no-return.")

Task(subagent_type="general", prompt="Estimate the performance overhead of
running both schemas simultaneously. Focus on write amplification and storage
costs during the transition period.")
```

## Step 4: Synthesis (Handoff)

After all agents complete, synthesize findings:

```markdown
## Swarm Results

### Confirmed by All Agents:
- Dual-write is the standard zero-downtime pattern (proven at scale)
- Rollback is safe until old schema removal (point of no return)
- Write amplification is 2x during transition (acceptable for most workloads)

### Agent-Specific Insights:
- Agent 1 (consistency): Use change-data-capture (CDC) for backfill, not batch
- Agent 2 (rollback): Keep old schema for 48h after switch as safety net
- Agent 3 (performance): Monitor write latency; add circuit breaker if >50ms

### Root Cause:
The original contradiction (performance vs availability) was a false binary.
Gradual transition resolves both without compromise.
```

## Step 5: Decompose into Tasks

Using `task-decomposition`, break into atomic tasks:

```markdown
### Migration Plan

1. [P0] Deploy new schema (additive only, no changes to existing)
2. [P0] Add dual-write layer in application code
3. [P1] Start CDC-based backfill of historical data
4. [P1] Add monitoring for write latency and consistency checks
5. [P1] Switch reads to new schema (feature flag)
6. [P2] Remove dual-write after 48h stability
7. [P2] Drop old schema

Dependencies: 1→2→3, 4→2, 5→3+4, 6→5, 7→6
Parallel: Tasks 3 and 4 can run concurrently after task 2
```

## Step 6: Validate (IFR Check)

```
Ideal Final Result: Migration completes with zero downtime, zero data loss,
and instant rollback capability.

Check against IFR:
✓ Zero downtime: Achieved via gradual transition
✓ Zero data loss: Achieved via dual-write + CDC backfill
✓ Instant rollback: Achieved until old schema removal
✓ Minimal complexity: Added dual-write layer (bounded complexity)
```

## Output

The TRIZ-swarm approach transformed a risky big-bang migration into a safe
gradual transition by:

1. **Identifying the real contradiction** (not just "it's hard")
2. **Applying separation in time** (principle #13) to resolve it
3. **Validating with multiple perspectives** (swarm) before committing
4. **Decomposing into atomic tasks** with clear dependencies

## How to Reproduce

```bash
# 1. Load triz-solver skill
skill triz-solver

# 2. Frame your contradiction
# "Improving [X] causes [Y] to worsen"

# 3. Check contradiction matrix for principles
# Apply separation in time/space/condition

# 4. Launch swarm validation
# 3 agents: consistency, rollback, performance

# 5. Synthesize and decompose
# task-decomposition skill for atomic plan
```
