#!/usr/bin/env python3
"""Validate agent-facing surfaces: SKILL.md files, AGENTS.md, skill structure."""

import sys
import os
from pathlib import Path


def validate_skills(repo_root: Path) -> list[str]:
    """Validate SKILL.md files have required frontmatter."""
    errors = []
    skills_dir = repo_root / ".agents" / "skills"
    if not skills_dir.exists():
        return errors

    for skill_md in skills_dir.rglob("SKILL.md"):
        content = skill_md.read_text()
        if len(content) < 50:
            errors.append(f"{skill_md.relative_to(repo_root)}: too short ({len(content)} chars)")
    return errors


def validate_agents_md(repo_root: Path) -> list[str]:
    """Validate AGENTS.md exists and has key sections."""
    errors = []
    agents_md = repo_root / "AGENTS.md"
    if not agents_md.exists():
        errors.append("AGENTS.md not found")
        return errors

    content = agents_md.read_text()
    required = ["## Project", "## Hard Rules", "## Development Commands"]
    for section in required:
        if section not in content:
            errors.append(f"AGENTS.md missing section: {section}")
    return errors


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] != "validate":
        print("Usage: agent-surface.py validate")
        return 1

    repo_root = Path(__file__).resolve().parent.parent
    errors = []

    errors.extend(validate_skills(repo_root))
    errors.extend(validate_agents_md(repo_root))

    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1

    print("Agent surface validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
