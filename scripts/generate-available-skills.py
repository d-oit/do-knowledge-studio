#!/usr/bin/env python3
"""Auto-generate AVAILABLE_AVAILABLE_SKILLS.md from skill definitions.

Reads frontmatter from .agents/skills/*/SKILL.md and regenerates
agents-docs/AVAILABLE_AVAILABLE_SKILLS.md. Run after adding/updating skills.

Usage: ./scripts/generate-available-skills.sh
"""

from pathlib import Path
import re
import sys


def extract_frontmatter(skill_file: Path) -> dict:
    """Extract YAML frontmatter from a SKILL.md file."""
    try:
        content = skill_file.read_text(encoding="utf-8")
    except Exception:
        return {}

    if not content.startswith("---"):
        return {}

    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}

    result = {}
    lines = match.group(1).split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if ":" in line and not line.startswith(" "):
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # Handle YAML folded scalar (> or >-)
            if value in (">", ">-", "|"):
                # Collect continuation lines
                parts = []
                i += 1
                while i < len(lines) and lines[i].startswith("  "):
                    parts.append(lines[i].strip())
                    i += 1
                value = " ".join(parts)
            result[key] = value
        i += 1
    return result


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    skills_dir = repo_root / ".agents" / "skills"
    output_file = repo_root / "agents-docs" / "AVAILABLE_AVAILABLE_SKILLS.md"

    if not skills_dir.is_dir():
        print("Error: Skills directory not found", file=sys.stderr)
        return 1

    # Collect skills by category
    categories: dict[str, list[tuple[str, str]]] = {}

    for skill_path in sorted(skills_dir.iterdir()):
        if not skill_path.is_dir() or skill_path.name.startswith("_"):
            continue

        skill_file = skill_path / "SKILL.md"
        if not skill_file.is_file():
            continue

        fm = extract_frontmatter(skill_file)
        name = fm.get("name", skill_path.name)
        description = fm.get("description", "No description available")
        category = fm.get("category", "general")

        categories.setdefault(category, []).append((name, description))

    # Generate output
    lines = [
        "# Available Skills Reference",
        "",
        "> Auto-generated from skill definitions in `.agents/skills/`",
        "> Do not edit manually. Run `./scripts/generate-available-skills.sh` to regenerate.",
        "",
    ]

    for category in sorted(categories):
        category_display = category.replace("-", " ").title()
        lines.append(f"## {category_display}")
        lines.append("")
        lines.append("| Skill | Description |")
        lines.append("|-------|-------------|")

        for name, description in sorted(categories[category]):
            lines.append(f"| `{name}` | {description} |")
        lines.append("")

    lines.extend([
        "## Usage",
        "",
        "Skills are triggered automatically based on context or loaded explicitly.",
        "See `agents-docs/AVAILABLE_SKILLS.md` for loading skills manually.",
        "",
        "## See Also",
        "",
        "- `agents-docs/AVAILABLE_SKILLS.md` - Skill authoring guide",
        "- `.agents/skills/skill-rules.json` - Skill validation rules",
    ])

    output_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    total = sum(len(v) for v in categories.values())
    print(f"Generated {output_file} with {total} skills")
    return 0


if __name__ == "__main__":
    sys.exit(main())
