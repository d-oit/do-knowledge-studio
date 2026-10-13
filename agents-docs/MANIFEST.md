# Agent Surface Manifest

> Canonical source of truth for agent-facing configuration.
> Located at `.agents/manifest.json`.

## Overview

The `manifest.json` file describes all AI agent tools supported by this repository. It defines their directory structures, documentation requirements, and how skills should be integrated.

## Schema

```json
{
  "version": "1.0.0",
  "canonical_skills": ".agents/skills",
  "global_docs": [
    "AGENTS.md",
    "README.md"
  ],
  "tools": {
    "tool-id": {
      "directory": ".tool-dir",
      "skills_directory": ".tool-dir/skills",
      "docs": [
        "TOOL.md"
      ],
      "symlink_strategy": "relative | directory | none"
    }
  }
}
```

### Fields

- `version`: Manifest schema version.
- `canonical_skills`: Relative path to the single source of truth for skills.
- `global_docs`: Documentation files that apply to all agents.
- `tools`: A map of tool configurations.
  - `directory`: The root directory for tool-specific configuration.
  - `skills_directory`: (Optional) Where skills should be symlinked.
  - `docs`: (Optional) Tool-specific documentation files.
  - `symlink_strategy`: `relative`, `directory`, or `none`. `none` skips the
    skills link; `sync` creates a relative directory symlink for other values.

## Management Script

Use `scripts/agent-surface.py` for manifest-managed surfaces:

- `sync`: Creates missing tool directories and skill links; reports existing
  path or link mismatches rather than replacing them.
- `validate`: Checks skill symlinks, canonical skill metadata, evaluations,
  skill-local links, `AGENTS.md` requirements, and generated catalog freshness.

`scripts/setup-skills.sh` creates links from the manifest and runs
`scripts/generate-skills-docs.py`, which updates `agents-docs/AVAILABLE_SKILLS.md`
and `.agents/skills/README.md`.

## Adding a New Tool

1. Update `.agents/manifest.json` with the tool directory, optional skills directory, docs, and link strategy.
2. Run `./scripts/setup-skills.sh` to create missing links and refresh skill catalogs.
3. Run `./scripts/validate-skills.sh` to validate the agent-facing surfaces.
