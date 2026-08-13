#!/usr/bin/env python3
"""Regenerate skill reference tables from `.agents/skills/*/SKILL.md` frontmatter.

Generates two files:
  - `agents-docs/AVAILABLE_SKILLS.md`  - categorized skill reference
  - `.agents/skills/README.md`         - flat alphabetical skill table

Run after adding, removing, or updating skills:

    ./scripts/generate-skills-docs.py

Env:   REPO_ROOT (defaults to the repo root) — used by the BATS suite for
       hermetic testing against a temp workspace. The `--root` flag takes
       precedence over the environment variable.
"""

from pathlib import Path
import argparse
import os
import re
import sys

CANONICAL_CATEGORY_ORDER = [
    "Analysis",
    "General",
    "Innovation Problem Solving",
    "Knowledge Management",
    "Quality",
    "Workflow",
]

CATEGORY_TITLES = {
    "analysis": "Analysis",
    "general": "General",
    "innovation-problem-solving": "Innovation Problem Solving",
    "knowledge-management": "Knowledge Management",
    "quality": "Quality",
    "workflow": "Workflow",
}

README_INTRO = """\
# .agents/skills/ - Canonical Skill Source

This is the **single canonical location** for all skills in this repository.

Claude Code, Gemini CLI, and Qwen Code use symlinks; OpenCode reads directly from `.agents/skills/`:

```
.claude/skills/<name>      -> ../../.agents/skills/<name>
.gemini/skills/<name>      -> ../../.agents/skills/<name>
.qwen/skills/<name>        -> ../../.agents/skills/<name>
```

## Setup

After cloning, run once to create all symlinks:

```bash
./scripts/setup-skills.sh
```

Validate symlinks are intact:

```bash
./scripts/validate-skills.sh
```

## Adding a New Skill

1. Create `.agents/skills/<skill-name>/SKILL.md` (see `agents-docs/AVAILABLE_SKILLS.md`)
2. Add `reference/` folder for detailed content (optional)
3. Run `./scripts/setup-skills.sh` to create symlinks for all CLI tools
4. The skill is now available in Claude Code, OpenCode, Gemini CLI, and Qwen Code

## Skills in This Repository

> Auto-generated from skill definitions. Run `./scripts/generate-skills-docs.py` to regenerate.

| Skill | Description |
|---|---|
"""

AVAILABLE_HEADER = """\
# Available Skills Reference

> Auto-generated from skill definitions in `.agents/skills/`.
> Run `./scripts/generate-skills-docs.py` to regenerate.

"""

AVAILABLE_FOOTER = """\
## Usage

Skills are triggered automatically based on context or loaded explicitly.
See `agents-docs/AVAILABLE_SKILLS.md` for loading skills manually.

## See Also

- `agents-docs/AVAILABLE_SKILLS.md` - Skill authoring guide
- `.agents/skills/skill-rules.json` - Skill validation rules
"""


def extract_frontmatter(skill_file: Path) -> dict[str, str]:
    """Extract YAML frontmatter fields (name, description, category)."""
    content = skill_file.read_text(encoding="utf-8")
    if not content.startswith("---"):
        return {}
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}
    result: dict[str, str] = {}
    lines = match.group(1).split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if ":" in line and not line.startswith(" "):
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # YAML folded/block scalars: join indented continuation lines.
            if value in (">", ">-", "|", "|-"):
                parts = []
                i += 1
                while i < len(lines) and lines[i].startswith(" "):
                    parts.append(lines[i].strip())
                    i += 1
                value = " ".join(parts)
                result[key] = value
                # i already points at the next key line — do not advance again.
                continue
            result[key] = value
        i += 1
    return result


def category_title(category: str | None) -> str:
    """Map a frontmatter category (kebab-case) to a section title."""
    if not category:
        return "General"
    key = category.strip().lower()
    if key in CATEGORY_TITLES:
        return CATEGORY_TITLES[key]
    return " ".join(part.capitalize() for part in key.replace("_", "-").split("-"))


def escape_cell(text: str) -> str:
    """Escape characters that break markdown table cells."""
    return text.replace("|", "\\|").replace("\n", " ").strip()


def collect_skills(skills_dir: Path) -> list[tuple[str, str, str]]:
    """Return (dir_name, description, category) tuples, sorted by name."""
    skills = []
    for skill_path in sorted(skills_dir.iterdir()):
        if not skill_path.is_dir() or skill_path.name.startswith("_"):
            continue
        skill_file = skill_path / "SKILL.md"
        if not skill_file.is_file():
            continue
        fm = extract_frontmatter(skill_file)
        name = fm.get("name", skill_path.name)
        description = fm.get("description", "No description available")
        skills.append((name, escape_cell(description), category_title(fm.get("category"))))
    return skills


def render_available(skills: list[tuple[str, str, str]]) -> str:
    """Render the categorized AVAILABLE_SKILLS.md document."""
    by_category: dict[str, list[tuple[str, str]]] = {}
    for name, description, category in skills:
        by_category.setdefault(category, []).append((name, description))

    order = CANONICAL_CATEGORY_ORDER + sorted(
        set(by_category) - set(CANONICAL_CATEGORY_ORDER)
    )

    sections = []
    for category in order:
        rows = by_category.get(category, [])
        lines = [f"## {category}", "", "| Skill | Description |", "|-------|-------------|"]
        for name, description in rows:
            lines.append(f"| `{name}` | {description} |")
        sections.append("\n".join(lines))

    return AVAILABLE_HEADER + "\n\n".join(sections) + "\n\n" + AVAILABLE_FOOTER


def render_readme(skills: list[tuple[str, str, str]]) -> str:
    """Render the flat alphabetical .agents/skills/README.md table."""
    lines = [README_INTRO.rstrip("\n")]
    for name, description, _category in skills:
        lines.append(f"| [`{name}/`]({name}/) | {description} |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate skill reference tables from .agents/skills/ frontmatter."
    )
    parser.add_argument("--root", help="Repository root (defaults to REPO_ROOT or script location)")
    args = parser.parse_args()

    repo_root = Path(
        args.root
        or os.environ.get("REPO_ROOT")
        or Path(__file__).resolve().parent.parent
    )
    skills_dir = repo_root / ".agents" / "skills"

    if not skills_dir.is_dir():
        print("Error: Skills directory not found", file=sys.stderr)
        return 1

    skills = collect_skills(skills_dir)
    available_file = repo_root / "agents-docs" / "AVAILABLE_SKILLS.md"
    readme_file = skills_dir / "README.md"

    available_file.parent.mkdir(parents=True, exist_ok=True)
    available_file.write_text(render_available(skills), encoding="utf-8")
    readme_file.write_text(render_readme(skills), encoding="utf-8")

    print(f"Generated {available_file} with {len(skills)} skills")
    print(f"Generated {readme_file} with {len(skills)} skills")
    return 0


if __name__ == "__main__":
    sys.exit(main())
