---
name: agents-md
description: Create AGENTS.md files with production-ready best practices. Use when creating new AGENTS.md or implementing quality gates.
license: MIT
---

# AGENTS.md Best Practices

Create production-ready AGENTS.md files following best practices below.

## Quick Start

**Basic:**
```bash
cat > AGENTS.md << 'EOF'
# AGENTS.md
## Named Constants
readonly MAX_FILE_SIZE=500

## Setup
- Install: npm install
- Test: npm test

## Code Style
- TypeScript strict
- Max line: 100
EOF
```

**Production:** See guide in `agents-docs/` folder

## Core Sections

### 1. Named Constants
```bash
## Named Constants
readonly MAX_FILE_SIZE=500
readonly TIMEOUT_SECONDS=30
readonly MAX_RETRIES=3
```

### 2. Pre-existing Issue Policy
```markdown
## Pre-existing Issues
**Fix ALL before completing:**
- [ ] Lint warnings
- [ ] Test failures
- [ ] Security vulnerabilities
```

### 3. Quality Gate
```markdown
## Quality Gate
```bash
npm run typecheck
npm run lint
npm run test
npm audit
```
```

## Tier Structure

- **Tier 1 (Essential):** Constants, setup, style, testing
- **Tier 2 (Professional):** Add quality gate, atomic commit, security
- **Tier 3 (Enterprise):** Add skills, sub-agents, nested AGENTS.md

See `agents-docs/AVAILABLE_SKILLS.md` for tier details.

## Best Practices

### DO:
- Define named constants at top
- Include pre-existing issue policy
- Specify quality gate commands
- Reference @agents-docs/ for detail

### DON'T:
- Use magic numbers
- Skip pre-existing issues
- Write vague commands ("run tests")
- Duplicate README content

## Quality Criteria

- [ ] Named constants defined
- [ ] Pre-existing issue policy included
- [ ] Quality gate specified
- [ ] < 160 lines (progressive disclosure)

## References

- `agents-docs/AVAILABLE_SKILLS.md` - Skill framework
- `agents-docs/SUB-AGENTS.md` - Sub-agent patterns
- https://agents.md - Official spec
