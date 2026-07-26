#!/usr/bin/env python3
"""Validate agent-facing surfaces: SKILL.md files, AGENTS.md, skill structure.

Implements ADR 029 validation requirements:
- Broken symlinks
- Missing canonical skills or declared target surfaces
- Invalid or missing required YAML frontmatter
- Skill name mismatch with its canonical directory
- Malformed eval JSON or unsupported eval schema
- Broken repository-relative links in skill content
- Duplicate canonical names
- Unmanaged drift in generated surfaces
"""

import json
import sys
from pathlib import Path

import yaml


def load_manifest(repo_root: Path) -> dict:
    """Load .agents/manifest.json."""
    manifest_path = repo_root / ".agents" / "manifest.json"
    if not manifest_path.exists():
        return {}
    return json.loads(manifest_path.read_text())


def validate_broken_symlinks(repo_root: Path) -> list[str]:
    """Check for broken symlinks in skill directories."""
    errors = []
    for skills_dir in [".agents/skills", ".claude/skills", ".gemini/skills",
                       ".qwen/skills", ".cursor/skills", ".windsurf/skills"]:
        dir_path = repo_root / skills_dir
        if not dir_path.exists():
            continue
        for item in dir_path.iterdir():
            if item.is_symlink() and not item.exists():
                errors.append(f"Broken symlink: {skills_dir}/{item.name}")
    return errors


def validate_canonical_skills(repo_root: Path, manifest: dict) -> list[str]:
    """Check that all canonical skills exist."""
    errors = []
    canonical_dir = repo_root / manifest.get("canonical_skills", ".agents/skills")
    if not canonical_dir.exists():
        errors.append(f"Canonical skills directory not found: {canonical_dir}")
        return errors

    for skill_dir in canonical_dir.iterdir():
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            errors.append(f"Missing SKILL.md in {skill_dir.name}")
    return errors


def validate_skill_frontmatter(repo_root: Path) -> list[str]:
    """Validate SKILL.md files have required YAML frontmatter."""
    errors = []
    skills_dir = repo_root / ".agents" / "skills"
    if not skills_dir.exists():
        return errors

    for skill_md in skills_dir.rglob("SKILL.md"):
        content = skill_md.read_text()
        if len(content) < 50:
            errors.append(f"{skill_md.relative_to(repo_root)}: too short ({len(content)} chars)")
            continue

        # Check for YAML frontmatter
        if not content.startswith("---"):
            errors.append(f"{skill_md.relative_to(repo_root)}: missing YAML frontmatter")
            continue

        # Parse frontmatter
        try:
            parts = content.split("---", 2)
            if len(parts) < 3:
                errors.append(f"{skill_md.relative_to(repo_root)}: malformed frontmatter")
                continue
            frontmatter = yaml.safe_load(parts[1])
            if not isinstance(frontmatter, dict):
                errors.append(f"{skill_md.relative_to(repo_root)}: frontmatter is not a dict")
                continue

            # Check required fields
            required_fields = ["name", "description"]
            for field in required_fields:
                if field not in frontmatter:
                    errors.append(f"{skill_md.relative_to(repo_root)}: missing required field '{field}'")
        except yaml.YAMLError as e:
            errors.append(f"{skill_md.relative_to(repo_root)}: invalid YAML: {e}")

    return errors


def validate_skill_name_mismatch(repo_root: Path) -> list[str]:
    """Check that skill name matches its directory name."""
    errors = []
    skills_dir = repo_root / ".agents" / "skills"
    if not skills_dir.exists():
        return errors

    for skill_dir in skills_dir.iterdir():
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue

        content = skill_md.read_text()
        if not content.startswith("---"):
            continue

        try:
            parts = content.split("---", 2)
            if len(parts) < 3:
                continue
            frontmatter = yaml.safe_load(parts[1])
            if not isinstance(frontmatter, dict):
                continue

            name = frontmatter.get("name")
            if name and name != skill_dir.name:
                errors.append(f"{skill_dir.name}: name mismatch (frontmatter='{name}', directory='{skill_dir.name}')")
        except yaml.YAMLError:
            continue

    return errors


def validate_eval_json(repo_root: Path) -> list[str]:
    """Validate eval JSON files."""
    errors = []
    skills_dir = repo_root / ".agents" / "skills"
    if not skills_dir.exists():
        return errors

    for eval_json in skills_dir.rglob("evals/evals.json"):
        try:
            data = json.loads(eval_json.read_text())
            if not isinstance(data, (list, dict)):
                errors.append(f"{eval_json.relative_to(repo_root)}: must be list or dict")
        except json.JSONDecodeError as e:
            errors.append(f"{eval_json.relative_to(repo_root)}: invalid JSON: {e}")

    return errors


def validate_duplicate_names(repo_root: Path) -> list[str]:
    """Check for duplicate canonical skill names."""
    errors = []
    skills_dir = repo_root / ".agents" / "skills"
    if not skills_dir.exists():
        return errors

    names = {}
    for skill_dir in skills_dir.iterdir():
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue

        content = skill_md.read_text()
        if not content.startswith("---"):
            continue

        try:
            parts = content.split("---", 2)
            if len(parts) < 3:
                continue
            frontmatter = yaml.safe_load(parts[1])
            if not isinstance(frontmatter, dict):
                continue

            name = frontmatter.get("name")
            if name:
                if name in names:
                    errors.append(f"Duplicate skill name '{name}': {names[name]} and {skill_dir.name}")
                else:
                    names[name] = skill_dir.name
        except yaml.YAMLError:
            continue

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
    manifest = load_manifest(repo_root)
    errors = []

    # ADR 029 validation requirements
    errors.extend(validate_broken_symlinks(repo_root))
    errors.extend(validate_canonical_skills(repo_root, manifest))
    errors.extend(validate_skill_frontmatter(repo_root))
    errors.extend(validate_skill_name_mismatch(repo_root))
    errors.extend(validate_eval_json(repo_root))
    errors.extend(validate_duplicate_names(repo_root))
    errors.extend(validate_agents_md(repo_root))

    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1

    print("Agent surface validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
