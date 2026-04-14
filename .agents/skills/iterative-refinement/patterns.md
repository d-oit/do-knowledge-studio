# Advanced Patterns

Advanced workflows and convergence detection strategies for iterative refinement.

## Termination Conditions

### Success Criteria Met
```
✓ All tests passing (50/50)
✓ Zero warnings (0)
✓ Performance target met (48ms < 50ms)
→ SUCCESS at iteration 3
```

### Convergence Detected
```
Recent improvements: 9%, 6%, 4% (avg 6.3%)
Threshold: 10%
→ CONVERGED at iteration 7
```

### Max Iterations Reached
```
Iteration 10 of 10
Progress: 60% → 88% (target: 95%)
→ STOP: Max iterations
→ Consider extending or different approach
```

### No Progress (Stuck)
```
Iteration 5: 10 issues
Iteration 6: 10 issues (no change)
Iteration 7: 10 issues (no change)
→ STOP: STUCK
→ Manual intervention needed
```

## Convergence Detection

### How Convergence Works

Convergence = improvements become negligible, indicating diminishing returns.

**Configuration**:
- Threshold: Percentage below which improvement is considered "negligible" (e.g., 10%)
- Window: Number of iterations to average (typically 3)

**Example**:
```
Iterations: 150 → 120 → 100 → 88 → 80 → 75 → 72
Improvements: 20% → 17% → 12% → 9% → 6% → 4%

Last 3 iterations:
- I5: 9% improvement
- I6: 6% improvement  
- I7: 4% improvement
Average: 6.3%

If threshold is 10%: CONVERGED (6.3% < 10%)
```

### When to Use Convergence

**Good for**:
- Performance optimization (unknown optimal point)
- Code complexity reduction (subjective quality)
- Coverage improvement (diminishing test value)
- Refactoring (incremental improvements)

**Not good for**:
- Binary criteria (all tests pass/fail)
- Security fixes (must reach 100%)
- Compliance requirements (must meet standard)

### Convergence Configuration Examples

**Aggressive** (stop early):
- Threshold: 5%
- Window: 2 iterations
- Use when: Time-constrained, "good enough" acceptable

**Standard** (balanced):
- Threshold: 10%
- Window: 3 iterations
- Use when: Normal optimization work

**Conservative** (thorough):
- Threshold: 15%
- Window: 4 iterations
- Use when: Critical systems, want maximum improvement

## Multi-Phase Patterns

### Pattern 1: Test-Fix-Optimize

Three separate loops with different goals:

```
Phase 1: Fix Failures (Criteria-based)
- Success: All tests passing
- Max: 8 iterations
I1: 42/50 → Fix → 48/50
I2: 48/50 → Fix → 50/50 ✓

Phase 2: Improve Quality (Criteria-based)
- Success: 0 linter warnings
- Max: 5 iterations
I1: 12 warnings → Fix → 4 warnings
I2: 4 warnings → Fix → 0 warnings ✓

Phase 3: Optimize Performance (Convergence-based)
- Convergence: <10% over 3 iterations
- Max: 15 iterations
I1: 450ms → 280ms (38%)
I2: 280ms → 165ms (41%)
I3: 165ms → 110ms (33%)
I4: 110ms → 85ms (23%)
I5: 85ms → 72ms (15%)
I6: 72ms → 65ms (10%)
I7: 65ms → 61ms (6%) → CONVERGED ✓
```

### Pattern 2: Quality Gate Loop

Multiple validators must all pass for consecutive iterations:

```
Configuration:
- Success: All validators clean for 2 consecutive iterations
- Max: 8 iterations

I1: Tests 48/50, Linter 5 warnings, Format dirty
    → Clean count: 0

I2: Tests 50/50 ✓, Linter 2 warnings, Format clean ✓
    → Clean count: 0

I3: Tests 50/50 ✓, Linter 0 warnings ✓, Format clean ✓
    → Clean count: 1 (need 2 consecutive)

I4: Tests 50/50 ✓, Linter 0 warnings ✓, Format clean ✓
    → Clean count: 2 → SUCCESS ✓
```

### Pattern 3: Progressive Refinement

Start with quick wins, then deep improvements:

```
Round 1: Quick Fixes (Fixed: 3 iterations)
- Fix obvious issues
- Low-hanging fruit
- Fast validation

Round 2: Deep Analysis (Criteria-based)
- Thorough investigation
- Root cause fixes
- Comprehensive testing

Round 3: Polish (Convergence-based)
- Micro-optimizations
- Style improvements
- Edge case handling
```

### Pattern 4: Fallback Strategy

Try multiple approaches until one succeeds:

```
Strategy A: Automatic fixes (Max: 5 iterations)
- Try automated refactoring
- If success → DONE
- If stuck → Strategy B

Strategy B: Targeted fixes (Max: 8 iterations)
- Manual analysis and fixing
- If success → DONE
- If stuck → Strategy C

Strategy C: Redesign (Max: 10 iterations)
- Architectural changes
- Must succeed or escalate
```

## Advanced Validation Strategies

### Validation with Dependencies

When validation order matters:

```
1. Syntax validation (must pass first)
   - Build/compile must succeed
   - Only then can run tests

2. Functional validation (depends on syntax)
   - Tests must pass
   - Only then check coverage

3. Quality validation (depends on functional)
   - Linter
   - Formatter
   - Complexity metrics
```

### Parallel Validation

When validations are independent:

```
Run in parallel:
- Unit tests
- Integration tests
- Linter
- Security scanner
- Performance benchmark

Aggregate results:
- All must pass for success
- Continue if any fail
```

### Conditional Validation

Skip expensive validations until necessary:

```
Always run:
- Unit tests (fast)
- Linter (fast)

Run only if above pass:
- Integration tests (slow)
- E2E tests (very slow)
- Performance benchmarks (very slow)
```

## Progress Tracking

### Detailed Tracking Table

```markdown
| Iter | Tests   | Warnings | Coverage | Time  | Decision |
|------|---------|----------|----------|-------|----------|
| 1    | 42/50   | 15       | 65%      | 320ms | Continue |
| 2    | 48/50   | 8        | 72%      | 280ms | Continue |
| 3    | 50/50 ✓ | 2        | 81%      | 240ms | Continue |
| 4    | 50/50 ✓ | 0 ✓      | 89%      | 210ms | Continue |
| 5    | 50/50 ✓ | 0 ✓      | 92% ✓    | 195ms | Success  |

Termination: All criteria met at iteration 5
Total improvement: 8 test fixes, 15 warnings removed, +27% coverage, 39% faster
```

### Convergence Analysis

```markdown
## Convergence Tracking

Metric: Response time (ms)
History: [320, 280, 240, 210, 195, 185, 180]

Improvement per iteration:
- I1→I2: 12.5%
- I2→I3: 14.3%
- I3→I4: 12.5%
- I4→I5: 7.1%
- I5→I6: 5.1%
- I6→I7: 2.7%

Last 3 iterations: 7.1%, 5.1%, 2.7%
Average: 5.0%
Threshold: 10%

→ CONVERGED (5.0% < 10%)
```

## Error Handling

### Validator Failure Mid-Loop

```
Iteration 4: Validator fails with error

Response:
1. Check if error is transient (network, timeout)
   → If yes: Retry same iteration
   
2. Check if validator is misconfigured
   → If yes: Fix configuration, retry
   
3. Check if previous change broke validator
   → If yes: Revert iteration 4, adjust approach
   
4. If persistent: Stop loop, report issue
```

### Quality Regression

```
Iteration 3: Validation shows degradation

Quality: 85% → 78% (regression)

Response:
1. Revert changes from iteration 3
2. Analyze what went wrong
3. Adjust approach
4. Retry iteration 3 with fix
5. If regression persists: Stop, investigate
```

### Infinite Loop Prevention

Safety mechanisms:
1. Hard max iterations (default: 20)
2. Timeout per iteration (default: 30 min)
3. Total loop timeout (default: 4 hours)
4. No-progress detection (3 static iterations)
5. Manual stop capability

## Integration Patterns

### With Task Planning

```
Task: Implement feature with quality gates

Plan:
1. Initial implementation
2. Iterative refinement (this skill)
   - Test loop until passing
   - Quality loop until clean
   - Performance loop until converged
3. Final review
```

### With Code Review

```
Workflow:
1. Human review identifies issues
2. Iterative refinement to fix issues
3. Re-review to validate
4. Repeat until approved
```

### With CI/CD

```
Pipeline:
1. Build
2. Iterative test fixing (auto)
3. Quality checks
4. Iterative quality improvements (auto)
5. Deploy if all pass
```

## Best Practices for Advanced Usage

### DO:
✓ Use convergence for optimization tasks
✓ Set minimum iterations to avoid premature convergence
✓ Track multiple metrics simultaneously
✓ Use quality gates for critical systems
✓ Implement fallback strategies for stuck states
✓ Use parallel validation when possible

### DON'T:
✗ Use convergence for binary pass/fail criteria
✗ Set convergence thresholds too low (<3%)
✗ Skip convergence window configuration
✗ Ignore quality regressions
✗ Continue past 20 iterations without review
✗ Use complex patterns when simple ones work