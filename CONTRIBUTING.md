# Contributing

> Building better AI agent workflows together.

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](../../README.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Thank you for your interest in contributing! This guide helps you contribute effectively to this AI agent template.

## Quick Start

```bash
# Fork and clone
git clone https://github.com/your-org/your-project.git
cd your-project

# Setup skills symlinks
./scripts/setup-skills.sh

# Install pre-commit hook
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## How to Contribute

### 1. Find or Create an Issue

- Check existing [issues](../../issues) for open tasks
- Look for labels like `good first issue`, `help wanted`, or `priority: high`
- Create a new issue if you found a bug or have a feature idea

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-123-bug-description
```

**Branch naming conventions:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions
- `chore/description` - Maintenance tasks

### 3. Make Your Changes

**Before coding:**
- Read [`AGENTS.md`](../../AGENTS.md) for project standards
- Check [`agents-docs/SKILLS.md`](../../agents-docs/SKILLS.md) for skill authoring
- Review [`agents-docs/HARNESS.md`](../../agents-docs/HARNESS.md) for architecture

**While coding:**
- Follow the code style in [`AGENTS.md`](../../AGENTS.md)
- Keep files under 500 lines (split if needed)
- Write descriptive commit messages (see below)
- Run `./scripts/quality_gate.sh` before committing

### 4. Write Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format. **Note: Conventional Commits are enforced via CI.**

```
type(scope): Brief description (50 chars max)

- Why this change was necessary
- What problem it solves
- Reference issue numbers if applicable
```

**Types:**
- `feat`: New user-facing feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code restructuring (no user impact)
- `perf`: Performance improvements
- `test`: Test additions/changes
- `chore`: Build/dependency updates

**Examples:**
```
feat(skills): Add web-doc-resolver skill for documentation fetching

Users needed reliable documentation access without manual searches.
This skill provides automatic doc resolution with fallback chain.

Fixes #45
```

```
fix(workflows): Update action versions to stable releases

actions/checkout@v5 doesn't exist yet, causing CI failures.
Updated to checkout@v4 and setup-python@v5 for reliability.
```

### 5. Run Quality Gate

```bash
# Run full quality gate
./scripts/quality_gate.sh

# Or skip tests for quick check
SKIP_TESTS=true ./scripts/quality_gate.sh
```

**Quality gate checks:**
- ✓ Skill symlinks intact
- ✓ Shell scripts pass ShellCheck
- ✓ Markdown passes markdownlint
- ✓ YAML syntax valid
- ✓ Tests pass (if not skipped)

### 6. Submit a Pull Request

1. Push your branch: `git push origin feature/your-feature`
2. Open a PR on GitHub
3. Fill out the PR template
4. Link related issues (e.g., `Fixes #123`)
5. Wait for review and address feedback

**PR Checklist:**
- [ ] Branch is up to date with main
- [ ] Quality gate passes
- [ ] Commit messages follow conventions
- [ ] Tests added/updated (if applicable)
- [ ] Documentation updated (if applicable)
- [ ] No unintended whitespace or debug code

## What to Contribute

### Good First Contributions

**Documentation:**
- Fix typos or clarify unclear sections
- Add examples to skills
- Improve quick start guide
- Translate documentation

**Skills:**
- Add new skill for common workflows
- Improve existing skill instructions
- Add skill scripts or templates

**Scripts:**
- Enhance quality gate with new checks
- Add utility scripts for common tasks
- Improve error messages in scripts

**Workflows:**
- Add new GitHub Actions workflows
- Improve CI/CD efficiency
- Add label automation

### Advanced Contributions

**Sub-agents:**
- Create new specialized sub-agents
- Improve agent coordination patterns
- Add agent templates

**Hooks:**
- Add new verification hooks
- Improve hook performance
- Add context-efficient validation

**Architecture:**
- Propose harness improvements
- Add context management patterns
- Optimize skill loading

## Code Style

See [`AGENTS.md`](../../AGENTS.md) for complete style guide. Key points:

**Shell Scripts:**
- Use `shellcheck` for linting
- Use `bats` for testing
- Exit codes: 0 = success, 2 = errors surfaced

**Markdown:**
- Use `markdownlint` for consistency
- Heading hierarchy: H1 → H2 → H3 (no skipping)
- Code blocks with language tags

**YAML:**
- 2-space indentation
- Use `yamllint` for validation
- Consistent key ordering

**Documentation:**
- Human-written (never auto-generated)
- Progressive disclosure (simple → complex)
- Include concrete examples

## Testing

```bash
# Run all tests
./scripts/quality_gate.sh

# Run specific test types
SKIP_CLIPPY=true ./scripts/quality_gate.sh  # Skip Rust clippy
SKIP_TESTS=true ./scripts/quality_gate.sh   # Skip tests

# Validate skills only
./scripts/validate-skills.sh
```

## Documentation Updates

**When updating documentation:**
- Keep `AGENTS.md` under 150 lines (use progressive disclosure)
- Put detailed content in `agents-docs/`
- Update `CHANGELOG.md` for user-facing changes
- Update `README.md` for feature additions

**Documentation structure:**
```
AGENTS.md (single source of truth, concise)
├── agents-docs/ (detailed reference docs)
│   ├── HARNESS.md
│   ├── SKILLS.md
│   ├── SUB-AGENTS.md
│   ├── HOOKS.md
│   └── CONTEXT.md
└── skills/ (progressive disclosure)
    └── <skill>/SKILL.md (≤250 lines)
```

## Labels

Labels help organize issues and PRs:

| Label | Purpose |
|-------|---------|
| `bug` | Something isn't working |
| `feature` | New feature request |
| `documentation` | Documentation improvements |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `priority: high` | Critical, needs attention |
| `status: needs review` | Waiting for review |
| `deps` | Dependency updates |

## Questions?

- **General questions**: Start a [discussion](../../discussions)
- **Bugs**: Open an [issue](../../issues)
- **Chat**: Check if there's a community chat link in README

## Thank You!

Every contribution makes AI agent workflows better. Whether it's a typo fix or a major feature, your help is appreciated! 🎉

---

**Ready to contribute?** Check out [good first issues](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) to get started!
