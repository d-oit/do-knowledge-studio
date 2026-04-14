# Skill Creator - Reference Guide

Complete templates and examples for creating Claude Code skills.

## Skill Templates

### Template 1: Process Skill

For skills that define step-by-step workflows:

```markdown
---
name: skill-name
description: [Action verb] [what it does]. Use this skill when [specific scenarios].
---

# Skill Title

Brief overview of skill purpose and scope.

## When to Use

- [Scenario 1: Specific situation]
- [Scenario 2: Specific situation]
- [Scenario 3: Specific situation]

## Process

### Step 1: [Action]

[Clear instructions for this step]

**Checklist**:
- [ ] Task 1
- [ ] Task 2

### Step 2: [Action]

[Clear instructions for this step]

### Step 3: [Action]

[Clear instructions for this step]

## Examples

### Example 1: [Name]

```
[Example workflow or code]
```

### Example 2: [Name]

```
[Example workflow or code]
```

## Best Practices

### DO:
✓ [Action to take]
✓ [Action to take]

### DON'T:
✗ [Action to avoid]
✗ [Action to avoid]

## Integration

How this skill works with other skills and agents.
```

### Template 2: Knowledge Skill

For skills that provide domain expertise:

```markdown
---
name: skill-name
description: [Domain] expertise and guidance. Use when [specific need for this knowledge].
---

# Skill Title

Overview of the domain and why this knowledge matters.

## Core Concepts

### Concept 1: [Name]

[Explanation in 2-3 sentences]

### Concept 2: [Name]

[Explanation in 2-3 sentences]

## When to Use

- When working with [domain element]
- When needing [specific knowledge]
- When deciding about [domain decision]

## Key Patterns

### Pattern 1: [Name]

[Description and when to use]

```
[Example or diagram]
```

### Pattern 2: [Name]

[Description and when to use]

## Guidelines

### Best Practices
- [Guideline 1]
- [Guideline 2]

### Common Pitfalls
- [Pitfall 1 to avoid]
- [Pitfall 2 to avoid]

## Examples

### Example: [Scenario]

[Detailed example showing concept application]

## Related Skills

- **[skill-name](path)** - How it connects
```

### Template 3: Tool Skill

For skills about tool usage:

```markdown
---
name: skill-name
description: [Tool name] usage and best practices. Use when [tool operation needed].
---

# Tool Name

Overview of the tool and its purpose.

## Installation

```bash
[Installation command]
```

## Basic Usage

### Command 1: [Name]

```bash
[Command syntax]
```

**Options**:
- `--flag`: Description
- `-s`: Description

### Command 2: [Name]

```bash
[Command syntax]
```

## When to Use

- [Use case 1]
- [Use case 2]

## Best Practices

### DO:
✓ [Practice 1]
✓ [Practice 2]

### DON'T:
✗ [Anti-pattern 1]
✗ [Anti-pattern 2]

## Examples

### Example 1: Common Task

```bash
[Command sequence]
```

### Example 2: Advanced Usage

```bash
[Command sequence]
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| [Error] | [Cause] | [Solution] |

## Integration

How this tool integrates with other skills and workflows.
```

## Complete Creation Examples

### Example: Episode Management Skill

```markdown
---
name: episode-management
description: Manage learning episodes with start, log, and complete operations. Use when tracking self-learning sessions, recording patterns, or managing episode lifecycle.
---

# Episode Management

Manage learning episodes for the self-learning memory system.

## When to Use

- Starting a new learning session
- Logging patterns discovered during episode
- Completing episode with summary

## Episode Lifecycle

```
START → LOG (multiple times) → COMPLETE
```

### Start Episode

```bash
python scripts/episode.py start "Learning about async Rust"
```

**Creates**:
- Episode ID (UUID)
- Start timestamp
- Initial state: IN_PROGRESS

### Log Pattern

```bash
python scripts/episode.py log EPISODE_ID "Pattern: Use tokio::spawn for independent tasks"
```

**Records**:
- Pattern text
- Timestamp
- Category (optional)

### Complete Episode

```bash
python scripts/episode.py complete EPISODE_ID "Summary of learnings"
```

**Finalizes**:
- End timestamp
- Summary
- State: COMPLETED

## Best Practices

### DO:
✓ Start episode before learning session
✓ Log patterns as discovered
✓ Complete with meaningful summary

### DON'T:
✗ Skip episode start (no tracking)
✗ Log after long delay (lose context)
✗ Complete without summary (lose value)

## Integration

- **pattern-extraction**: Extracts patterns from logged content
- **memory-storage**: Stores completed episodes
- **skill-creator**: This skill format
```

### Example: Test Debugging Skill

```markdown
---
name: test-debugging
description: Debug and fix failing tests in Rust projects. Use when tests fail and you need to diagnose root causes, fix async/await issues, or handle race conditions.
---

# Test Debugging

Systematic approach to diagnosing and fixing failing tests.

## When to Use

- Test fails unexpectedly
- Flaky test behavior
- Async/await test issues
- Race condition suspected

## Debugging Process

### Step 1: Reproduce

```bash
cargo test -- --nocapture
```

**Goal**: Consistent reproduction

### Step 2: Isolate

- Run single test: `cargo test test_name`
- Remove unrelated code
- Minimize test case

### Step 3: Diagnose

**Common Issues**:
- Async runtime not started
- Missing await
- Shared state without synchronization
- Timing-dependent assertions

### Step 4: Fix

Apply targeted fix based on diagnosis.

### Step 5: Verify

```bash
cargo test -- --test-threads=1
```

## Common Patterns

### Pattern 1: Async Test Missing Runtime

**Symptom**: Panic about no reactor

**Fix**: Add `#[tokio::test]` attribute

### Pattern 2: Race Condition

**Symptom**: Intermittent failures

**Fix**: Use proper synchronization (Mutex, RwLock, channels)

## Best Practices

### DO:
✓ Run tests with --nocapture for output
✓ Isolate failing test first
✓ Check for async issues in Rust
✓ Use test-threads=1 for debugging

### DON'T:
✗ Ignore intermittent failures
✗ Assume test is correct (it might not be)
✗ Fix without understanding root cause
```

## Naming Examples

### Good Names
- `episode-management` - Clear purpose
- `test-debugging` - Specific domain
- `api-integration` - Well-defined scope
- `code-quality` - Focused area
- `documentation` - Clear responsibility

### Bad Names
- `helper` - Too vague
- `stuff` - Not descriptive
- `Episode_Management` - Wrong format (uppercase, underscore)
- `test debugging` - Contains space
- `very-long-skill-name-that-is-hard-to-type` - Too long

## Description Examples

### Good Descriptions

✅ **Specific and actionable**:
```yaml
description: Debug and fix failing tests in Rust projects. Use this skill when tests fail and you need to diagnose root causes, fix async/await issues, or handle race conditions.
```

✅ **Clear when-to-use**:
```yaml
description: Implement new features systematically with proper testing and documentation. Use when adding new functionality to the codebase.
```

✅ **Keyword-rich**:
```yaml
description: Create human-focused GitHub README.md files with 2026 best practices. Use when creating new projects, improving documentation, or making repositories more discoverable.
```

### Bad Descriptions

✗ **Too vague**:
```yaml
description: Helps with testing
```

✗ **Missing when-to-use**:
```yaml
description: Provides guidance on building APIs
```

✗ **Too long** (over 1024 chars):
```yaml
description: [Very long paragraph that goes on and on...]
```

## Validation Checklist

After creating a skill, verify:

### Structure
- [ ] Directory exists at `.agents/skills/skill-name/`
- [ ] SKILL.md file present
- [ ] YAML frontmatter valid
- [ ] Name matches directory name

### YAML Frontmatter
- [ ] `name:` field present and correct
- [ ] `description:` field present
- [ ] Description under 1024 characters
- [ ] Name is lowercase with hyphens only

### Content
- [ ] "When to Use" section present
- [ ] Core process or concepts documented
- [ ] At least one example provided
- [ ] Best practices included
- [ ] Integration with other skills noted

### Quality
- [ ] Clear, concise language
- [ ] Actionable instructions
- [ ] Code examples tested
- [ ] Markdown properly formatted
- [ ] No broken links

## Testing Your Skill

### Manual Test

1. Clear context: `/clear`
2. Ask a question that should trigger the skill
3. Verify skill is invoked appropriately
4. Check guidance is helpful

### Example Test

For `test-debugging` skill:
```
User: "My test is failing with a panic about no reactor"
Expected: Skill invokes and provides async test guidance
```

## Maintenance

### Updating Skills

When updating existing skills:
1. Preserve backward compatibility where possible
2. Update description if scope changes
3. Add new sections without removing old ones
4. Update examples to reflect current best practices
5. Keep git history for tracking changes

### Version Tracking

Consider adding version info for frequently changing skills:
```markdown
---
name: skill-name
version: 1.2.0
last_updated: 2025-03-15
---
```

### Deprecation

If a skill becomes obsolete:
1. Update description to indicate deprecation
2. Point to replacement skill
3. Keep file for backward compatibility
4. Remove after transition period (with notice)

## Project-Specific Skills

### For Rust Self-Learning Memory Project

**Domain-Specific Skills**:
- `episode-management` - Start, log, complete episodes
- `pattern-extraction` - Extract patterns from content
- `memory-storage` - Store and retrieve memories
- `turso-sync` - Sync with Turso database
- `redb-cache` - Manage redb caching

**Naming Convention**:
- `episode-[operation]` for episode-related
- `storage-[operation]` for storage operations
- `pattern-[operation]` for pattern handling
- `memory-[operation]` for memory operations

## Integration with Agent Creator

When creating skills that work with agents:

1. **Reference agents in skill**:
   ```markdown
   ## Integration
   Used by: feature-implementer, debugger agents
   ```

2. **Skill-agent coordination**:
   Ensure skill complements agent capabilities

3. **Invocation clarity**:
   Make clear when skill vs agent is appropriate

## Common Mistakes

### Mistake 1: Vague Description

**Problem**: Claude doesn't know when to invoke
**Fix**: Add specific scenarios and keywords

### Mistake 2: No Examples

**Problem**: Hard to understand usage
**Fix**: Include 2-3 concrete examples

### Mistake 3: Too Long

**Problem**: Exceeds context limits
**Fix**: Move details to reference files

### Mistake 4: Wrong Name Format

**Problem**: Skill not recognized
**Fix**: Use lowercase with hyphens only

### Mistake 5: Missing When-to-Use

**Problem**: Unclear invocation triggers
**Fix**: Add dedicated "When to Use" section

## Advanced Topics

### Skill Dependencies

Skills can reference other skills:
```markdown
## Related Skills
- **[task-decomposition](../task-decomposition/SKILL.md)** - Use before implementing
- **[code-reviewer](../code-reviewer/SKILL.md)** - Use after implementing
```

### Skill Hierarchies

Organize related skills:
```
.agents/skills/
├── episode-*.md (episode management skills)
├── storage-*.md (storage operation skills)
└── pattern-*.md (pattern handling skills)
```

### Cross-References

Link between skills:
```markdown
See also: **[parallel-execution](../parallel-execution/SKILL.md)** for concurrent task patterns.
```

## Metrics

Track skill effectiveness:
- **Invocation rate**: How often skill is used
- **User satisfaction**: Feedback on helpfulness
- **Task success rate**: Tasks completed with skill
- **Context efficiency**: Lines used vs value provided
