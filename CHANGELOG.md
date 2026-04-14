# Changelog

All notable changes to this template will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-04-06

### Fixed
- Corrected `csm` CLI flag from `--output` to `--output-format` in memory-context skill
- Added missing `version` and `template_version` fields to memory-context SKILL.md

## [0.2.1] - 2026-04-03

### Changed
- Bumped version to 0.2.1 across all files

## [0.2.0] - 2026-03-15

### Fixed
- GitHub Actions workflows using non-existent action versions (checkout@v5, setup-python@v6)
- yaml-lint.yml using unstable actionlint version tag
- ci-and-labels.yml using deprecated actions-rust-lang action
- gh-labels-creator.sh interactive prompt blocking CI execution
- Inconsistent branch references between workflow files
- Documentation inconsistencies across multiple files

### Changed
- Standardized action versions to stable releases (checkout@v4, setup-python@v5)
- Replaced deprecated rust-toolchain action with dtolnay/rust-toolchain@stable
- Added --ci flag support to gh-labels-creator.sh for non-interactive CI runs
- Updated README.md version badge to 0.2.0
- Updated all documentation to reference Qwen Code support
- Improved CONTRIBUTING.md with comprehensive guide
- Cleaned up AGENTS_REGISTRY.md formatting

### Added
- develop branch support in ci-and-labels.yml workflow
- .qwen/skills/ symlinks for Qwen Code support
- .github/dependabot.yml with 2026 best practices:
  - GitHub Actions weekly updates (grouped)
  - Docker weekly updates (exclude pre-releases)
  - Terraform monthly updates (grouped providers)
  - Docker Compose and pre-commit monthly updates
- Dependabot security updates auto-merge support
- OpenCode agent format documentation in SUB-AGENTS.md
- Supported AI Agents table in HARNESS.md

## [0.1.0] - 2026-03-14

### Added
- Initial template release
- Core skills:
  - `task-decomposition` - Break complex tasks into atomic goals
  - `code-quality` - Code review and quality checks
  - `test-runner` - Execute and manage tests
  - `shell-script-quality` - ShellCheck + BATS for shell scripts
  - `parallel-execution` - Coordinate parallel agent execution
  - `iterative-refinement` - Progressive improvement loops
  - `agent-coordination` - Multi-agent orchestration
  - `goap-agent` - Goal-oriented action planning
  - `web-search-researcher` - Web research and synthesis
- Sub-agents:
  - `goap-agent` - Complex planning & coordination
  - `loop-agent` - Iterative refinement workflows
  - `analysis-swarm` - Multi-perspective code analysis
  - `agent-creator` - Scaffold new sub-agent definitions
- Scripts:
  - `setup-skills.sh` - Create symlinks for CLI tools
  - `validate-skills.sh` - Validate skill symlinks
  - `quality_gate.sh` - Multi-language quality gate
  - `pre-commit-hook.sh` - Git pre-commit integration
  - `gh-labels-creator.sh` - Initialize GitHub labels
- Documentation:
  - `AGENTS.md` - Single source of truth
  - `agents-docs/HARNESS.md` - Harness engineering overview
  - `agents-docs/SKILLS.md` - Skill authoring guide
  - `agents-docs/SUB-AGENTS.md` - Context isolation patterns
  - `agents-docs/HOOKS.md` - Hook configuration
  - `agents-docs/CONTEXT.md` - Context engineering & back-pressure
- CLI support:
  - Claude Code (`.claude/`)
  - Gemini CLI (`.gemini/`)
  - OpenCode (`.opencode/`)

### Changed
- Skills use canonical source in `.agents/skills/` with symlinks
- Quality gate exits with code 2 to surface errors to agent
- Progressive disclosure for skills (load on demand)

[Unreleased]: https://github.com/your-org/your-project/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/your-project/releases/tag/v0.1.0
