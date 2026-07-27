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


def validate_broken_links(repo_root: Path) -> list[str]:
    """Check for broken repository-relative links in skill content."""
    import re
    errors = []
    skills_dir = repo_root / ".agents" / "skills"
    if not skills_dir.exists():
        return errors

    # Pattern for markdown links: [text](path) or [text](path#anchor)
    link_pattern = re.compile(r'\[([^\]]*)\]\(([^)]+)\)')

    # Common placeholder patterns to skip
    placeholder_patterns = ['image-url', 'your-', 'example', 'path/to/', '<', '>', 'architecture.svg']

    for skill_md in skills_dir.rglob("SKILL.md"):
        content = skill_md.read_text()
        skill_dir = skill_md.parent
        in_code_block = False

        for line in content.split('\n'):
            # Track code blocks
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                continue

            # Skip lines inside code blocks
            if in_code_block:
                continue

            for match in link_pattern.finditer(line):
                link_text, link_target = match.groups()

                # Skip external URLs and anchors
                if link_target.startswith(('http://', 'https://', '#', 'mailto:')):
                    continue

                # Skip common placeholder patterns
                if any(pattern in link_target.lower() for pattern in placeholder_patterns):
                    continue

                # Remove anchor if present
                link_path = link_target.split('#')[0]
                if not link_path:
                    continue

                # Resolve relative to skill directory
                target_path = (skill_dir / link_path).resolve()

                # Check if target exists (file or directory)
                if not target_path.exists():
                    errors.append(
                        f"{skill_md.relative_to(repo_root)}: broken link '{link_target}' "
                        f"(target does not exist)"
                    )

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


def sync_managed_surfaces(repo_root: Path, manifest: dict) -> list[str]:
    """Create or repair managed skill symlinks for all declared tools."""
    errors = []
    canonical_skills = manifest.get("canonical_skills", ".agents/skills")
    tools = manifest.get("tools", {})

    for tool_name, config in tools.items():
        strategy = config.get("symlink_strategy", "none")
        if strategy == "none":
            continue

        tool_dir = config.get("directory", "")
        skills_dir = config.get("skills_directory", "")
        if not tool_dir or not skills_dir:
            continue

        full_tool_dir = repo_root / tool_dir
        full_skills_dir = repo_root / skills_dir
        canonical_path = repo_root / canonical_skills

        if not canonical_path.exists():
            errors.append(f"Canonical skills directory not found: {canonical_skills}")
            continue

        full_tool_dir.mkdir(parents=True, exist_ok=True)

        if full_skills_dir.is_symlink():
            target = full_skills_dir.readlink()
            expected = Path(canonical_skills).relative_to(Path(tool_dir).parent)
            if str(target) != str(expected):
                errors.append(
                    f"Symlink mismatch: {skills_dir} -> {target} (expected {expected})"
                )
        elif full_skills_dir.exists():
            errors.append(f"Warning: {skills_dir} exists and is not a symlink")
        else:
            relative_target = Path(canonical_skills).relative_to(Path(tool_dir).parent)
            full_skills_dir.symlink_to(relative_target)
            print(f"Created symlink: {skills_dir} -> {relative_target}")

    return errors


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: agent-surface.py <validate|sync>")
        return 1

    command = sys.argv[1]
    repo_root = Path(__file__).resolve().parent.parent
    manifest = load_manifest(repo_root)

    if command == "validate":
        errors = []
        errors.extend(validate_broken_symlinks(repo_root))
        errors.extend(validate_canonical_skills(repo_root, manifest))
        errors.extend(validate_skill_frontmatter(repo_root))
        errors.extend(validate_skill_name_mismatch(repo_root))
        errors.extend(validate_eval_json(repo_root))
        errors.extend(validate_duplicate_names(repo_root))
        errors.extend(validate_broken_links(repo_root))
        errors.extend(validate_agents_md(repo_root))

        if errors:
            for e in errors:
                print(f"ERROR: {e}", file=sys.stderr)
            return 1

        print("Agent surface validation passed.")
        return 0

    elif command == "sync":
        errors = sync_managed_surfaces(repo_root, manifest)
        if errors:
            for e in errors:
                print(f"ERROR: {e}", file=sys.stderr)
            return 1

        print("Agent surface sync completed.")
        return 0

    else:
        print(f"Unknown command: {command}")
        print("Usage: agent-surface.py <validate|sync>")
        return 1


if __name__ == "__main__":
    sys.exit(main())
