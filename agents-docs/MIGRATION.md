# Migration Guide

> Step-by-step guide for adopting the AI agent template in existing projects.

[![Template Version](https://img.shields.io/badge/version-0.2.4-blue)](VERSION)

---

## Overview

This template provides a **unified harness for AI coding agents** that enables consistent, high-quality AI-assisted development across multiple CLI tools.

### What This Template Provides

| Component | Purpose | Benefit |
|-----------|---------|---------|
| **AGENTS.md** | Single source of truth for all AI agents | Consistent instructions across Claude, Gemini, OpenCode, etc. |
| **Skills System** | Reusable knowledge modules in `.agents/skills/` | Domain-specific expertise on demand |
| **Quality Gates** | Automated lint, test, format before commits | Prevents bad code from entering codebase |
| **Sub-Agents** | Specialized agent definitions for specific tasks | Context isolation and parallel execution |
| **Hooks** | Pre/post tool execution scripts | Custom validation and automation |
| **Scripts** | Setup, validation, and maintenance utilities | One-command project maintenance |

### Supported AI Agents

- [Claude Code](https://claude.ai/code)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [OpenCode](https://opencode.ai/)
- [Qwen Code](https://github.com/QwenLM/Qwen-Coder)
- Windsurf, Cursor, Copilot Chat

---

## Prerequisites

Before starting migration, ensure you have:

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Git** | 2.30+ | Version control and hook installation |
| **Bash** | 4.0+ | Script execution |
| **One AI CLI tool** | Latest | Primary agent for testing |
| **realpath** | Any | Symlink creation (usually built-in) |

### Optional but Recommended

| Tool | Purpose |
|------|---------|
| `shellcheck` | Bash script validation |
| `bats` | Bash testing framework |
| `markdownlint` | Markdown consistency |

### Verify Prerequisites

```bash
# Check Git
git --version  # Should show 2.30+

# Check Bash
bash --version  # Should show 4.0+

# Check AI CLI (example: Claude Code)
claude --version
```

---

## Step-by-Step Migration Process

### Step 1: Backup Existing Project

Before making any changes, create a backup:

```bash
# Option A: Create a backup branch
cd /path/to/your-project
git checkout -b backup/pre-ai-agents
git push -u origin backup/pre-ai-agents
git checkout main  # or your default branch

# Option B: Create a local archive
cd /path/to/parent-dir
cp -r your-project your-project-backup-$(date +%Y%m%d)
```

### Step 2: Copy Template Files

Download the template files to a temporary location:

```bash
# Option A: Clone the template repository
git clone https://github.com/your-org/your-project.git /tmp/ai-agent-template

# Option B: Download as zip
curl -L -o /tmp/ai-agent-template.zip https://github.com/your-org/your-project/archive/main.zip
unzip /tmp/ai-agent-template.zip -d /tmp/ai-agent-template
```

Copy the essential files to your project:

```bash
# Create directory structure
mkdir -p your-project/.agents/skills
mkdir -p your-project/.claude/skills
mkdir -p your-project/.gemini/skills
mkdir -p your-project/scripts

# Copy core scripts
cp /tmp/ai-agent-template/scripts/setup-skills.sh your-project/scripts/
cp /tmp/ai-agent-template/scripts/validate-skills.sh your-project/scripts/
cp /tmp/ai-agent-template/scripts/quality_gate.sh your-project/scripts/
cp /tmp/ai-agent-template/scripts/pre-commit-hook.sh your-project/scripts/
cp /tmp/ai-agent-template/scripts/validate-skill-format.sh your-project/scripts/

# Make scripts executable
chmod +x your-project/scripts/*.sh
```

### Step 3: Create AGENTS.md

Create the main instruction file at your project root:

```bash
cat > your-project/AGENTS.md << 'EOF'
# AGENTS.md

> Single source of truth for all AI coding agents in this repository.

## Project Overview

[Replace with: Brief description of your project]
[Replace with: Primary language and framework]
[Replace with: Key architectural decisions]

## Setup

```bash
# Install dependencies
[Replace with: your install command - e.g., npm install, cargo build, pip install -r requirements.txt]

# Run the project
[Replace with: your run command - e.g., npm start, cargo run, python main.py]
```

## Code Style

- [Replace with: your style guidelines]
- [Replace with: linting rules]
- [Replace with: testing requirements]

## Testing

```bash
# Run all tests
[Replace with: your test command]
```

## Agent Guidance

### Plan Before Executing
For non-trivial tasks: produce a written plan first, pause, and wait for confirmation
before writing code.

### Context Discipline
- Delegate isolated research and analysis to sub-agents
- Use `/clear` between unrelated tasks
- Load skills only when needed, not upfront
EOF
```

### Step 4: Setup Skills

Copy default skills from the template:

```bash
# Copy example skills (select based on your needs)
cp -r /tmp/ai-agent-template/.agents/skills/task-decomposition your-project/.agents/skills/
cp -r /tmp/ai-agent-template/.agents/skills/shell-script-quality your-project/.agents/skills/

# Copy skill rules
cp /tmp/ai-agent-template/.agents/skills/skill-rules.json your-project/.agents/skills/
```

Create symlinks for CLI tools:

```bash
cd your-project
./scripts/setup-skills.sh
```

Verify the setup:

```bash
./scripts/validate-skills.sh
```

Expected output:
```
✓ All skill symlinks intact
✓ SKILL.md files valid
```

### Step 5: Configure Agents

#### 5.1 Create CLI-Specific Override Files

For Claude Code:

```bash
mkdir -p your-project/.claude
cat > your-project/.claude/CLAUDE.md << 'EOF'
@AGENTS.md

# Claude-Specific Overrides

## Additional Context

- Claude Code is the primary agent for this project
- Use `claude` command for all AI-assisted tasks
EOF
```

For Gemini CLI:

```bash
mkdir -p your-project/.gemini
cat > your-project/.gemini/GEMINI.md << 'EOF'
@AGENTS.md

# Gemini-Specific Overrides

## Additional Context

- Gemini CLI is the secondary agent for this project
- Use `gemini` command for research tasks
EOF
```

#### 5.2 Install Pre-Commit Hook

```bash
cp your-project/scripts/pre-commit-hook.sh your-project/.git/hooks/pre-commit
chmod +x your-project/.git/hooks/pre-commit
```

#### 5.3 Customize Quality Gate

Edit `your-project/scripts/quality_gate.sh` to match your tech stack:

```bash
# Uncomment the section for your language:

# --- Rust ---
# cargo fmt --check || { echo "Run: cargo fmt"; exit 1; }
# cargo clippy -- -D warnings || exit 1
# cargo test || exit 1

# --- TypeScript/JavaScript ---
# pnpm lint || exit 1
# pnpm typecheck || exit 1
# pnpm test || exit 1

# --- Python ---
# ruff check . || exit 1
# black --check . || { echo "Run: black ."; exit 1; }
# pytest || exit 1

# --- Go ---
# gofmt -l . | grep . && { echo "Run: gofmt -w ."; exit 1; }
# go vet ./... || exit 1
# go test ./... || exit 1
```

### Step 6: Update Documentation

#### 6.1 Update README.md

Add a section about AI agent support:

```markdown
## AI Agent Development

This project supports AI-assisted development with Claude Code, Gemini CLI, and OpenCode.

### Quick Start

\`\`\`bash
# Setup skills
./scripts/setup-skills.sh

# Run quality gate
./scripts/quality_gate.sh
\`\`\`

### Available Commands

\`\`\`bash
# Analyze codebase
claude "Analyze this codebase"

# Implement feature
claude "Implement user authentication"

# Review code
claude "Review the changes in src/"
\`\`\`

See [AGENTS.md](AGENTS.md) for detailed instructions.
```

#### 6.2 Create MIGRATION.md (Optional)

If your project will have other contributors migrate to this setup:

```bash
# Document your migration process for future reference
cat > your-project/MIGRATION_NOTES.md << 'EOF'
# Migration Notes

Migration completed on: $(date +%Y-%m-%d)
Template version: 0.2.4

## Changes Made

- Added AGENTS.md with project-specific instructions
- Added .agents/skills/ with [list skills]
- Added scripts/ for quality gates and setup
- Configured pre-commit hooks

## Customizations

- Quality gate configured for: [language/framework]
- Custom skills added: [if any]
- Additional agents configured: [Claude/Gemini/etc.]
EOF
```

### Step 7: Test the Setup

Run the quality gate:

```bash
cd your-project
./scripts/quality_gate.sh
```

Test with an AI agent:

```bash
# With Claude Code
claude "Analyze this codebase and summarize its structure"

# With Gemini CLI
gemini "What are the main components of this project?"

# With OpenCode
opencode "Review the project structure"
```

### Step 8: Commit Changes

```bash
cd your-project
git add .
git commit -m "feat: integrate AI agent template

- Add AGENTS.md for unified agent instructions
- Add .agents/skills/ for reusable knowledge
- Add scripts/ for quality gates and setup
- Configure pre-commit hooks
- Update README with AI agent documentation"
```

---

## Common Migration Scenarios

### Scenario 1: Existing Python Project

```bash
# 1. Backup
git checkout -b backup/pre-ai-agents

# 2. Copy template files
cp -r /tmp/ai-agent-template/.agents/skills/task-decomposition .agents/skills/
cp /tmp/ai-agent-template/scripts/*.sh scripts/

# 3. Customize AGENTS.md
cat >> AGENTS.md << 'EOF'

## Python-Specific Guidelines

- Python 3.10+ required
- Use ruff for linting: ruff check .
- Use black for formatting: black .
- Type hints required on public functions
- pytest for testing with coverage >= 80%
EOF

# 4. Update quality_gate.sh (uncomment Python section)
sed -i 's/^# ruff check/ruff check/' scripts/quality_gate.sh
sed -i 's/^# black --check/black --check/' scripts/quality_gate.sh

# 5. Setup
./scripts/setup-skills.sh
./scripts/quality_gate.sh

# 6. Test
claude "Run the tests and check coverage"
```

### Scenario 2: Existing TypeScript/JavaScript Project

```bash
# 1. Backup
git checkout -b backup/pre-ai-agents

# 2. Copy template files
cp -r /tmp/ai-agent-template/.agents/skills/task-decomposition .agents/skills/
cp -r /tmp/ai-agent-template/.agents/skills/iterative-refinement .agents/skills/
cp /tmp/ai-agent-template/scripts/*.sh scripts/

# 3. Customize AGENTS.md
cat >> AGENTS.md << 'EOF'

## TypeScript-Specific Guidelines

- Strict mode enabled, no implicit any
- ESModules only, no CommonJS
- pnpm as package manager
- ESLint + Prettier for formatting
- Vitest for testing
EOF

# 4. Update quality_gate.sh (uncomment TypeScript section)
sed -i 's/^# pnpm lint/pnpm lint/' scripts/quality_gate.sh
sed -i 's/^# pnpm typecheck/pnpm typecheck/' scripts/quality_gate.sh

# 5. Setup
./scripts/setup-skills.sh
./scripts/quality_gate.sh

# 6. Test
claude "Check for TypeScript errors"
```

### Scenario 3: Existing Rust Project

```bash
# 1. Backup
git checkout -b backup/pre-ai-agents

# 2. Copy template files
cp -r /tmp/ai-agent-template/.agents/skills/task-decomposition .agents/skills/
cp -r /tmp/ai-agent-template/.agents/skills/iterative-refinement .agents/skills/
cp /tmp/ai-agent-template/scripts/*.sh scripts/

# 3. Customize AGENTS.md
cat >> AGENTS.md << 'EOF'

## Rust-Specific Guidelines

- Edition 2021, stable toolchain
- cargo fmt + cargo clippy -- -D warnings must pass
- cargo test for testing
- Documentation required for public APIs
EOF

# 4. Update quality_gate.sh (uncomment Rust section)
sed -i 's/^# cargo fmt --check/cargo fmt --check/' scripts/quality_gate.sh
sed -i 's/^# cargo clippy/cargo clippy/' scripts/quality_gate.sh

# 5. Setup
./scripts/setup-skills.sh
./scripts/quality_gate.sh

# 6. Test
claude "Run cargo clippy and fix any warnings"
```

### Scenario 4: Multi-Language Monorepo

```bash
# 1. Backup
git checkout -b backup/pre-ai-agents

# 2. Copy template files to root
cp -r /tmp/ai-agent-template/.agents/skills/task-decomposition .agents/skills/
cp /tmp/ai-agent-template/scripts/*.sh scripts/

# 3. Create root AGENTS.md with monorepo structure
cat > AGENTS.md << 'EOF'
# AGENTS.md

## Project Overview

Multi-language monorepo with packages in:
- packages/frontend (TypeScript/React)
- packages/backend (Python/FastAPI)
- packages/shared (Rust)

## Setup

```bash
# Install all dependencies
pnpm install  # root dependencies
pnpm -r install  # workspace packages
cd packages/backend && pip install -r requirements.txt
cd packages/shared && cargo build
```

## Nested AGENTS.md

Each package has its own AGENTS.md for package-specific instructions:
- packages/frontend/AGENTS.md
- packages/backend/AGENTS.md
- packages/shared/AGENTS.md

## Code Style

### Global
- Conventional commits required
- PRs must pass quality gate

### Frontend (TypeScript)
- Strict mode, ESModules
- pnpm lint, pnpm typecheck

### Backend (Python)
- ruff + black
- pytest with coverage

### Shared (Rust)
- cargo fmt + cargo clippy
EOF

# 4. Create per-package AGENTS.md files
for pkg in packages/frontend packages/backend packages/shared; do
  cat > "$pkg/AGENTS.md" << EOF
# AGENTS.md for $pkg

@../../AGENTS.md

## Package-Specific Instructions

[Add package-specific guidance here]
EOF
done

# 5. Customize quality_gate.sh for all languages
# Edit scripts/quality_gate.sh to include all language checks

# 6. Setup
./scripts/setup-skills.sh
./scripts/quality_gate.sh
```

### Scenario 5: Minimal Setup (Documentation Only)

For projects that only need basic AI agent support:

```bash
# 1. Just create AGENTS.md
cat > AGENTS.md << 'EOF'
# AGENTS.md

## Project Overview

[Brief description]

## Setup

```bash
[Install command]
```

## Code Style

[Basic guidelines]
EOF

# 2. Test
claude "What does this project do?"
```

---

## Troubleshooting

### Issue: Skills Not Found

**Symptom:**
```
Error: No skills in .agents/skills/
```

**Solution:**
```bash
# Create the skills directory
mkdir -p .agents/skills

# Add at least one skill
cp -r /tmp/ai-agent-template/.agents/skills/task-decomposition .agents/skills/

# Re-run setup
./scripts/setup-skills.sh
```

### Issue: Broken Symlinks After Move

**Symptom:**
```
Error: MISSING symlink: .claude/skills/task-decomposition
```

**Solution:**
```bash
# Re-create all symlinks
./scripts/setup-skills.sh

# Validate
./scripts/validate-skills.sh
```

### Issue: Quality Gate Always Fails

**Symptom:**
```
Error: cargo fmt failed
```

**Solution:**
```bash
# Run the formatter manually first
cargo fmt  # for Rust
black .    # for Python
pnpm lint --fix  # for TypeScript

# Then re-run quality gate
./scripts/quality_gate.sh
```

### Issue: Agent Ignores AGENTS.md

**Symptom:**
Agent doesn't follow instructions from AGENTS.md

**Solution:**
1. Ensure file is at project root: `ls AGENTS.md`
2. Ensure file starts with `# AGENTS.md` header
3. Check file is not in `.gitignore`
4. For Claude Code: ensure `.claude/CLAUDE.md` contains `@AGENTS.md`

### Issue: Pre-Commit Hook Not Running

**Symptom:**
Git commits without running quality gate

**Solution:**
```bash
# Check hook is installed
ls -la .git/hooks/pre-commit

# Ensure it's executable
chmod +x .git/hooks/pre-commit

# Check hook content
cat .git/hooks/pre-commit
```

### Issue: Permission Denied on Scripts

**Symptom:**
```
bash: ./scripts/setup-skills.sh: Permission denied
```

**Solution:**
```bash
chmod +x scripts/*.sh
```

### Issue: realpath Command Not Found

**Symptom:**
```
realpath: command not found
```

**Solution:**
On macOS, install coreutils:
```bash
brew install coreutils
```

Or modify `scripts/setup-skills.sh` to use `readlink -f` instead:
```bash
# Replace realpath --relative-to with:
rel=$(python3 -c "import os.path; print(os.path.relpath('$skill_path', '$target_dir'))")
```

### Issue: Agent Can't Read Skills

**Symptom:**
```
Error: Skill not accessible
```

**Solution:**
1. Check symlinks exist: `ls -la .claude/skills/`
2. Verify target exists: `ls .agents/skills/`
3. For OpenCode: ensure it reads from `.agents/skills/` directly (no symlinks needed)

---

## Before and After

### Before Migration

```
my-project/
├── src/
├── tests/
├── package.json
└── README.md
```

### After Migration (Basic)

```
my-project/
├── AGENTS.md              # New: Agent instructions
├── src/
├── tests/
├── package.json
├── README.md
└── .git/hooks/
    └── pre-commit         # New: Quality gate hook
```

### After Migration (Full)

```
my-project/
├── AGENTS.md              # New
├── CLAUDE.md              # New: Claude overrides
├── src/
├── tests/
├── package.json
├── README.md
├── scripts/               # New
│   ├── setup-skills.sh
│   ├── validate-skills.sh
│   ├── quality_gate.sh
│   └── pre-commit-hook.sh
├── .agents/               # New
│   └── skills/
│       ├── task-decomposition/
│       └── shell-script-quality/
├── .claude/               # New
│   └── skills/ → ../.agents/skills/
└── .git/hooks/
    └── pre-commit
```

---

## Next Steps

After migration:

1. **Train Your Team**: Share this guide and [QUICKSTART.md](QUICKSTART.md)
2. **Customize AGENTS.md**: Add project-specific patterns and conventions
3. **Add More Skills**: Copy additional skills from the template as needed
4. **Create Sub-Agents**: Define specialized agents for common tasks
5. **Monitor Usage**: Track which AI agents and skills are most effective

---

## Resources

| Resource | Purpose |
|----------|---------|
| [README.md](README.md) | Template overview |
| [QUICKSTART.md](QUICKSTART.md) | 5-minute setup guide |
| [AGENTS.md](AGENTS.md) | Agent instruction format |
| [agents-docs/AVAILABLE_SKILLS.md](agents-docs/AVAILABLE_SKILLS.md) | Skill authoring guide |
| [agents-docs/SUB-AGENTS.md](agents-docs/SUB-AGENTS.md) | Sub-agent patterns |
| [agents-docs/HOOKS.md](agents-docs/HOOKS.md) | Hook configuration |

---

**Need Help?** Open an issue on [GitHub](../../issues).
