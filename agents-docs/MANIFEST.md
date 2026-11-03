# Agent Surface Manifest

> Canonical source of truth for agent-facing configuration.
> Located at `.agents/manifest.json`.

## Overview

The `manifest.json` file describes all AI agent tools supported by this repository. It defines their directory structures, documentation requirements, and how skills should be integrated.

## Schema

```json
{
  "version": "1.0.0",
  "canonical_instructions": "AGENTS.md",
  "canonical_skills": ".agents/skills",
  "skill_labeler": ".github/labeler.yml",
  "global_docs": ["AGENTS.md", "README.md"],
  "tools": {
    "tool-id": {
      "directory": ".tool-dir",
      "skills_directory": ".tool-dir/skills",
      "symlink_strategy": "relative-directory"
    }
  }
}
```

`instruction_addendum` is optional. A declared tool doc is generated with the
full canonical instruction source followed by its tool-specific addendum, if
present. This avoids depending on client-specific import syntax.

### Fields

- `version`: Manifest schema version.
- `canonical_instructions`: The single shared instruction source (`AGENTS.md`).
- `canonical_skills`: Relative path to the single source of truth for skills.
- `skill_labeler`: Labeler config whose generated skill globs follow declared skill links.
- `global_docs`: Documentation files that apply to all agents.
- `tools`: A map of tool configurations.
  - `directory`: The root directory for tool-specific configuration.
  - `skills_directory`: (Optional) Where skills should be symlinked.
  - `docs`: (Optional) Generated root instruction files.
  - `instruction_addendum`: (Optional) Source of tool-specific instructions.
  - `symlink_strategy`: `none`, `relative-directory`, or `relative-entries`.
    `relative-directory` symlinks the whole directory; `relative-entries`
    creates one relative symlink per canonical skill.

## Management Script

Use `scripts/agent-surface.py` for manifest-managed surfaces:

- `sync`: Creates or repairs declared skill links, generated root instruction
  files, and the skill-labeler block.
- `validate`: Checks skill links, canonical skill metadata, evaluations,
  skill-local links, `AGENTS.md` requirements, generated root docs/labeler globs,
  and generated catalog freshness.

`scripts/setup-skills.sh` creates skill links and runs
`scripts/generate-skills-docs.py`, which updates `agents-docs/AVAILABLE_SKILLS.md`
and `.agents/skills/README.md`. The catalog generator is not an
`agent-surface.py` subcommand; its `--check` mode detects drift without writing.

## Adding a New Tool

1. Update `.agents/manifest.json` with the tool directory, optional skills directory, docs, and link strategy.
2. Run `./scripts/setup-skills.sh` to create missing links and refresh skill catalogs.
3. Run `./scripts/validate-skills.sh` to validate the agent-facing surfaces.
