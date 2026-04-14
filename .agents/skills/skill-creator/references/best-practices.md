# Best Practices for Skill Creators

## Start from Real Expertise

A common pitfall is asking an LLM to generate a skill without domain-specific context. The result is vague, generic procedures rather than specific API patterns, edge cases, and project conventions.

**Extract from a Hands-On Task:**
- Complete a real task with an agent, providing context, corrections, and preferences
- Extract the reusable pattern, paying attention to:
  - Steps that worked
  - Corrections you made
  - Input/output formats
  - Context you provided

**Synthesize from Existing Project Artifacts:**
- Internal documentation, runbooks, and style guides
- API specifications, schemas, and configuration files
- Code review comments and issue trackers
- Real-world failure cases and their resolutions

## Refine with Real Execution

Run the skill against real tasks, then feed results back:

- What triggered false positives?
- What was missed?
- What could be cut?

## Spend Context Wisely

Focus on what the agent *wouldn't* know without your skill:
- Project-specific conventions
- Domain-specific procedures
- Non-obvious edge cases
- Particular tools or APIs to use

**Don't explain:** what a PDF is, how HTTP works, or what a database migration does.

## Calibrating Control

**Give freedom** when:
- Multiple approaches are valid
- Task tolerates variation

**Be prescriptive** when:
- Operations are fragile
- Consistency matters
- Specific sequence must be followed

## Effective Instruction Patterns

### Gotchas Sections (highest-value content)

```markdown
## Gotchas
- The `users` table uses soft deletes. Queries must include `WHERE deleted_at IS NULL`.
- The user ID is `user_id` in the database, `uid` in the auth service.
- The `/health` endpoint returns 200 even if the database is down. Use `/ready`.
```

### Templates for Output Format

Provide a template rather than describing format in prose.

### Checklists for Multi-Step Workflows

```markdown
## Workflow
- [ ] Step 1: Analyze
- [ ] Step 2: Create mapping
- [ ] Step 3: Validate
- [ ] Step 4: Execute
```

### Validation Loops

1. Do the work
2. Run validation
3. Fix any issues
4. Repeat until validation passes