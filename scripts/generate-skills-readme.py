#!/usr/bin/env python3
"""Auto-generate .agents/skills/README.md skills table from skill definitions."""

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
            if value in (">", ">-", "|"):
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
    output_file = skills_dir / "README.md"

    if not skills_dir.is_dir():
        print("Error: Skills directory not found", file=sys.stderr)
        return 1

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
        skills.append((name, description))

    lines = [
        "# .agents/skills/ - Canonical Skill Source",
        "",
        "This is the **single canonical location** for all skills in this repository.",
        "",
        "Claude Code, Gemini CLI, and Qwen Code use symlinks; OpenCode reads directly from `.agents/skills/`:",
        "",
        "```",
        ".claude/skills/<name>      -> ../../.agents/skills/<name>",
        ".gemini/skills/<name>      -> ../../.agents/skills/<name>",
        ".qwen/skills/<name>        -> ../../.agents/skills/<name>",
        "```",
        "",
        "## Setup",
        "",
        "After cloning, run once to create all symlinks:",
        "",
        "```bash",
        "./scripts/setup-skills.sh",
        "```",
        "",
        "Validate symlinks are intact:",
        "",
        "```bash",
        "./scripts/validate-skills.sh",
        "```",
        "",
        "## Adding a New Skill",
        "",
        "1. Create `.agents/skills/<skill-name>/SKILL.md` (see `agents-docs/SKILLS.md`)",
        "2. Add `reference/` folder for detailed content (optional)",
        "3. Run `./scripts/setup-skills.sh` to create symlinks for all CLI tools",
        "4. The skill is now available in Claude Code, OpenCode, Gemini CLI, and Qwen Code",
        "",
        "## Skills in This Repository",
        "",
        "> Auto-generated from skill definitions. Run `./scripts/generate-skills-readme.py` to regenerate.",
        "",
        "| Skill | Description |",
        "|---|---|",
    ]

    for name, description in skills:
        lines.append(f"| [`{name}/`]({name}/) | {description} |")

    lines.append("")

    output_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Generated {output_file} with {len(skills)} skills")
    return 0


if __name__ == "__main__":
    sys.exit(main())
