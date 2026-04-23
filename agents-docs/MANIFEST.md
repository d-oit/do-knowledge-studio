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
      "symlink_strategy": "relative | none"
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
  - `symlink_strategy`: How to handle skills. `relative` creates symlinks from `skills_directory` back to `canonical_skills`.

## Management Script

Use `scripts/agent-surface.py` to manage the agent surface based on the manifest.

- `sync`: Creates directories and symlinks as defined in the manifest.
- `validate`: Ensures the repository state matches the manifest (no missing symlinks or directories).
- `generate-docs`: Updates `AGENTS.md` and ensures tool-specific documentation starts with `@AGENTS.md`.

## Adding a New Tool

1. Update `.agents/manifest.json` with the new tool definition.
2. Run `./scripts/agent-surface.py sync` to scaffold directories.
3. Run `./scripts/agent-surface.py generate-docs` to create tool-specific documentation.
4. Verify everything with `./scripts/agent-surface.py validate`.
