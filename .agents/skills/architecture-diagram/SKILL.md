---
name: architecture-diagram
description: Generate or update a project architecture SVG diagram by scanning the live project structure. Use this skill whenever the user asks to regenerate, refresh, or update the architecture diagram, or when skills, agents, or commands have been added/removed and the diagram is stale. Triggers on phrases like "update the diagram", "regenerate the architecture SVG", "sync the diagram", or "diagram is out of date".
license: MIT
metadata:
  author: d.o.
  version: "1.0"
  platform: agentskills.io
compatibility:
  tools:
    - bash
    - create_file
---

# Architecture Diagram

Generates an architecture SVG diagram by scanning the live project structure.

## When to run

- User asks to update / regenerate / sync the architecture diagram
- Skills, agents, or commands have changed
- First-time setup (diagram doesn't exist yet)

## Execution

### Step 1 — locate project root

Use the bash tool to find the project root (directory containing `.agents/`):

```bash
# From wherever the agent is currently working
pwd
ls .agents/ .opencode/ 2>/dev/null || echo "NOT_FOUND"
```

If `.agents/` is not in the current directory, search upward or ask the user
to confirm the project root before continuing.

### Step 2 — run the generator script

Copy the script from the skill bundle into a temp location and run it from
the project root:

```bash
python /path/to/skill/scripts/generate_diagram.py \
  --root . \
  --out docs/architecture.svg
```

The script auto-discovers:
- Skills  → `.agents/skills/*/SKILL.md` (reads `name:` from frontmatter)
- Agents  → `*/agents/*.md`    (uses filename stem)
- Commands → `*/commands/*.md` (uses filename stem, strips leading `/`)

It writes a self-contained SVG to `--out` (default: `docs/architecture.svg`).

### Step 3 — confirm and report

After the script exits:
1. Tell the user the output path
2. Report counts: N skills · M agents · K commands
3. If counts differ from the last known state, summarise what changed

## Output

`docs/architecture.svg` — a standalone SVG output file, viewBox 680 × auto, compatible
with GitHub README embedding (example: `![Architecture](docs/architecture.svg)`).

## Customisation

The script reads an optional `docs/diagram-config.json` if present:

```json
{
  "title": "Project Architecture",
  "project_name": "My Project",
  "author": "maintainer",
  "pipeline_stages": [
    {"name": "build", "color": "teal"},
    {"name": "test", "color": "blue"},
    {"name": "deploy", "color": "green"}
  ]
}
```

All fields are optional — the script uses sensible defaults when the file is
absent.

## Bundled Scripts

- `scripts/generate_diagram.py` — Main generator script