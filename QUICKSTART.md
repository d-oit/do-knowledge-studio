# Quick Start Guide

> Get started with AI agent-powered development in 5 minutes.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Template Version](https://img.shields.io/badge/version-0.2.4-blue)](VERSION)

## Prerequisites

- Git installed
- One or more CLI coding agents:
  - [Claude Code](https://claude.ai/code) (recommended)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli)
  - [OpenCode](https://opencode.ai/)
  - [Qwen Code](https://github.com/QwenLM/Qwen-Coder)
  - Or any agent that supports the AGENTS.md format

## Step 1: Use This Template

### Option A: GitHub UI

1. Click **"Use this template"** on GitHub
2. Enter your repository name
3. Click **"Create repository"**
4. Clone your new repository:

```bash
git clone https://github.com/your-org/your-project.git
cd your-project
```

### Option B: CLI

```bash
git clone https://github.com/your-org/your-project.git
cd your-project
```

## Step 2: Setup (2 minutes)

```bash
# Create skill symlinks for all CLI tools
./scripts/setup-skills.sh

# Install git pre-commit hook
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

# Validate setup
./scripts/validate-skills.sh
```

Expected output:
```
✓ All skill validations passed
```

## Step 3: Configure for Your Project

Edit `AGENTS.md` to add your project details:

### 1. Update Project Overview

```markdown
## Project Overview

<!-- Replace this section -->
This is a [language] project that [does what].
Primary stack: [frameworks, libraries, tools]
```

### 2. Update Setup Commands

Replace the commands below with your project's actual setup steps:

**Node.js / TypeScript projects:**
```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

**Rust projects:**
```bash
# Build the project
cargo build

# Run the application
cargo run
```

**Python projects:**
```bash
# Install dependencies (virtual environment recommended)
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run the application
python main.py
```

### 3. Add Language-Specific Style

Uncomment and customize the relevant section:

```markdown
<!--
#### Rust
- Edition 2021, stable toolchain
- cargo fmt + cargo clippy -- -D warnings must pass
-->

<!--
#### TypeScript / JavaScript
- Strict mode, ESModules only, no implicit any
-->

<!--
#### Python
- Python 3.10+, async/await
- ruff + black; type hints on public functions
-->
```

## Step 4: Test Your Setup

### With Claude Code

```bash
claude "Analyze this codebase and summarize its structure"
```

### With Gemini CLI

```bash
gemini "What are the main components of this project?"
```

### With OpenCode

```bash
opencode "Review the project structure"
```

## Step 5: Start Coding

### Example: Implement a Feature

```bash
claude "Implement a function that validates user input"
```

The agent will:
1. Read relevant files
2. Implement the feature
3. Run quality gates automatically
4. Commit with proper message format

### Example: Fix a Bug

```bash
claude "Fix the bug in src/handler.py where null values cause crashes"
```

### Example: Refactor Code

```bash
claude "Refactor the authentication module to improve readability"
```

## Verify Everything Works

```bash
# Run quality gate manually
./scripts/quality_gate.sh

# Expected: All checks pass
```

## Next Steps

| Topic | Resource |
|-------|----------|
| Understanding skills | [`agents-docs/SKILLS.md`](agents-docs/SKILLS.md) |
| Creating sub-agents | [`agents-docs/SUB-AGENTS.md`](agents-docs/SUB-AGENTS.md) |
| Configuring hooks | [`agents-docs/HOOKS.md`](agents-docs/HOOKS.md) |
| Context management | [`agents-docs/CONTEXT.md`](agents-docs/CONTEXT.md) |
| Available agents | [`agents-docs/AGENTS_REGISTRY.md`](agents-docs/AGENTS_REGISTRY.md) |

## Troubleshooting

### Skills Not Found

```
Error: MISSING symlink: .claude/skills/task-decomposition
```

**Fix:** Run `./scripts/setup-skills.sh`

### Quality Gate Fails

```
Error: cargo fmt failed
```

**Fix:** Run `cargo fmt` to format code, then retry

### Agent Not Responding

**Fix:** Check agent installation:
- Claude Code: `claude --version`
- Gemini CLI: `gemini --version`
- OpenCode: `opencode --version`

## Common First Tasks

1. **Understand codebase**: "Summarize the project structure"
2. **Find files**: "Where is the authentication logic?"
3. **Add feature**: "Add input validation to the form"
4. **Fix bug**: "Fix the null pointer issue in handler.py"
5. **Write tests**: "Add tests for the user service"
6. **Refactor**: "Improve the code structure in module X"

---

**Need help?** See [`README.md`](README.md) for full documentation.
