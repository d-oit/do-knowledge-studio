# Web Search Integration Guide

How to use web search before and during iterative refinement for better results.

## When to Research First

Research before starting iterations when:
- Using unfamiliar validation tools
- Working with new tech stack
- Complex quality criteria
- High-stakes optimization
- Version-specific requirements
- Known problematic patterns

## Pre-Iteration Research

### Research Workflow

```
1. Check environment context for current date
2. Identify research needs
3. Execute targeted searches
4. Configure validators based on findings
5. Start iterations with validated setup
```

### What to Research

#### Validation Tool Best Practices

**Search for**:
```
"[tool name] best practices [current year]"
"[tool name] configuration production [current year]"
"[tool name] common pitfalls"
```

**Example**:
```
Task: Set up pytest for async code testing

Pre-iteration research:
1. Search: "pytest async testing best practices 2025"
2. Search: "pytest-asyncio configuration"
3. Find: Official docs on pytest-asyncio
4. Configure: Enable asyncio mode in pytest.ini
5. Start iterations with proper setup
```

#### Known Issues and Workarounds

**Search for**:
```
"[language] [tool] common issues"
"[tool] false positives"
"[framework] [linter] known problems"
```

**Example**:
```
Task: Fix clippy warnings in Tokio code

Pre-iteration research:
1. Search: "clippy tokio common false positives"
2. Find: Known issues with blocking_await_blocking
3. Configure: Add allowed lints in Cargo.toml
4. Start iterations avoiding known issues
```

#### Version-Specific Information

**Search for**:
```
"[tool] [version] breaking changes"
"[tool] migration guide [old version] to [new version]"
"[tool] [version] changelog"
```

**Example**:
```
Task: Upgrade eslint to v9

Pre-iteration research:
1. Search: "eslint 9 breaking changes"
2. Search: "eslint flat config migration"
3. Find: New config format required
4. Update config before iterations
5. Start iterations with correct config
```

#### Optimal Tool Configuration

**Search for**:
```
"[tool] optimal configuration [use case]"
"[tool] recommended settings [framework]"
"[tool] performance tuning"
```

**Example**:
```
Task: Optimize Jest test performance

Pre-iteration research:
1. Search: "jest performance optimization 2025"
2. Find: maxWorkers, coverage collection tips
3. Configure: Set maxWorkers to 50%
4. Disable coverage until final iteration
5. Start iterations with faster tests
```

## During-Iteration Research

### When to Research During Iterations

Research mid-iteration when:
- Stuck for 2+ iterations (no progress)
- Unexpected validator behavior
- Conflicting recommendations
- Unknown error messages
- Quality regression mystery

### Stuck State Research

```
Iteration 3: No progress (same 5 errors)
Iteration 4: No progress (same 5 errors)

→ STOP and RESEARCH

Research questions:
1. Are these errors known issues?
2. Is there a better approach?
3. Are we using the tool correctly?
4. Is this a version incompatibility?
```

**Search strategy**:
```
"[exact error message]" [tool name]
site:github.com [tool name] [error pattern]
"[tool name]" "known issues" [framework]
```

**Example**:
```
Stuck on: 5 mypy errors about incompatible types

Research:
1. Search: exact error messages
2. Find: GitHub issue about type stub incompatibility
3. Solution: Update type stubs package
4. Resume iterations with fix
```

### Validator Behavior Research

```
Iteration 2: Linter reports 10 warnings
Iteration 3: Fixed 5, but 8 warnings remain (worse?)

→ RESEARCH: Why did warnings increase?

Research:
1. Search: "[linter] cascading errors"
2. Find: Some fixes trigger new warnings
3. Strategy: Fix root causes first
4. Resume with better approach
```

### Alternative Approach Research

```
Iterations 1-5: Slow progress on performance optimization
Current: 320ms → 280ms (only 12% improvement)

→ RESEARCH: Better optimization strategies

Search:
"[framework] performance optimization 2025"
"[use case] performance patterns"
site:[docs] performance tuning
```

## Research Templates

### Template 1: Tool Setup Research

```markdown
## Research: [Tool] Setup for [Use Case]

**Context**: [Current date from environment]

**Goal**: Find optimal configuration for [specific use case]

**Searches**:
1. "[tool] best practices [current year]"
2. "[tool] [framework] integration"
3. "site:[official docs] [specific feature]"

**Key Findings**:
- Finding 1: [with source link]
- Finding 2: [with source link]
- Configuration recommendation: [specific settings]

**Implementation**:
```config
[Tool configuration based on research]
```

**Expected Impact**: [how this improves iterations]
```

### Template 2: Stuck State Research

```markdown
## Research: Stuck at Iteration [N]

**Problem**: [Description of stuck state]
**Error/Issue**: [Specific error or metric]
**Attempts**: [What's been tried]

**Searches**:
1. "[exact error message]" [tool]
2. "site:github.com [tool] [error pattern]"
3. "[tool] troubleshooting [issue]"

**Findings**:
- Root cause: [explanation with source]
- Known issue: [yes/no, link if yes]
- Workaround: [solution with source]

**Action**: [What to do next]
```

### Template 3: Performance Research

```markdown
## Research: Performance Optimization for [Metric]

**Current State**: [metric value]
**Target**: [target value]
**Improvement Needed**: [percentage/delta]

**Searches**:
1. "[framework] performance optimization 2025"
2. "[specific operation] optimization patterns"
3. "site:[docs] performance tuning"

**Findings**:
- Bottleneck identified: [description]
- Optimization technique: [with source]
- Expected improvement: [estimate]

**Implementation Strategy**:
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

## Integration with Iteration Loop

### Enhanced Workflow

```
Step 0: Pre-Iteration Research (Optional)
├─ Research tool best practices
├─ Find optimal configuration
├─ Identify known issues
└─ Set up validated environment

Step 1: Define Configuration
├─ Apply research findings
├─ Use researched best practices
└─ Configure based on findings

Step 2-N: Execute Iterations
├─ Iteration 1
├─ Iteration 2
├─ ...
└─ Iteration N

If Stuck (2-3 iterations no progress):
├─ PAUSE iterations
├─ Research stuck state
├─ Find solution/alternative
├─ Apply research findings
└─ RESUME iterations

Step Final: Report Results
└─ Include research impact in summary
```

## Research Time Budget

### Quick Research (5-10 minutes)
- Single tool configuration question
- Verify syntax/usage
- Check version compatibility

### Standard Research (15-30 minutes)
- Unknown error investigation
- Best practices lookup
- Alternative approach exploration

### Deep Research (30-60 minutes)
- Complex stuck state analysis
- Multiple tool integration
- Architecture decision support

**Rule**: Research time should be < 30% of total iteration time.

## Research Quality Indicators

### Good Research Signs
✓ Found official documentation
✓ Recent sources (within 12-18 months)
✓ Multiple sources agree
✓ Specific, actionable recommendations
✓ Version-specific information

### Poor Research Signs
✗ Only old sources (>2 years)
✗ Conflicting recommendations
✗ Vague or generic advice
✗ No official documentation found
✗ Sources lack credibility

## Example: Complete Research + Iteration

```
Task: Implement feature with 90% test coverage

Phase 1: Pre-Iteration Research (20 minutes)
─────────────────────────────────────────────
Research: pytest coverage best practices 2025

Searches:
1. "pytest coverage best practices 2025"
2. "pytest-cov configuration production"
3. "site:docs.pytest.org coverage"

Findings:
- Use --cov-report=term-missing for clarity
- Configure coverage in pyproject.toml
- Exclude test files from coverage
- Set fail_under threshold

Configuration Applied:
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "--cov=myapp --cov-report=term-missing --cov-fail-under=90"

[tool.coverage.run]
omit = ["tests/*", "*/migrations/*"]

Phase 2: Iterations (30 minutes)
─────────────────────────────────
Iteration 1:
- Write initial tests
- Coverage: 45%
- Continue

Iteration 2:
- Add edge case tests
- Coverage: 68%
- Continue

Iteration 3:
- Add integration tests
- Coverage: 82%
- Continue

Iteration 4:
- Add error path tests
- Coverage: 91%
- SUCCESS ✓

Result:
- 4 iterations
- 50 minutes total (20 research + 30 iteration)
- Research saved time by avoiding:
  * Wrong coverage configuration
  * Unclear coverage reports
  * Missing test files from metrics

Research ROI: +40% efficiency
```

## Best Practices

### DO:
✓ Check environment context for current date before searching
✓ Include current year in searches for best practices
✓ Research before starting complex iterations
✓ Pause and research if stuck 2+ iterations
✓ Use official documentation when available
✓ Apply findings to tool configuration
✓ Document research in iteration notes
✓ Set research time budgets

### DON'T:
✗ Skip research for unfamiliar tools
✗ Use outdated recommendations
✗ Continue stuck iterations without research
✗ Ignore official documentation
✗ Spend more time researching than iterating
✗ Research without applying findings
✗ Use generic advice without verification
✗ Forget to check source publication dates

## Summary

Web search integration enhances iterative refinement:

**Before Iterations**:
- Research tool best practices
- Find optimal configurations
- Identify known issues
- Validate approach

**During Iterations**:
- Research when stuck
- Find solutions to blockers
- Discover alternative approaches
- Verify unexpected behavior

**Result**:
- Faster convergence
- Fewer wasted iterations
- Better validator configuration
- Higher success rate