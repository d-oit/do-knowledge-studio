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
- Generated instruction and labeler surfaces
"""

import importlib.util
import json
import os
import re
import sys
from pathlib import Path

from agent_surface_generated import (
    sync_generated_surfaces,
    validate_generated_surfaces,
)


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
    import yaml

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
    import yaml
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
    import yaml

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
    """Validate AGENTS.md exists, has key sections, and honors the line cap."""
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

    # Progressive disclosure is only real if the cap is checked. The limit
    # lives in .agents/config.sh so scripts and this validator cannot drift;
    # an unenforced limit reads as a passing check while the file grows.
    max_lines = read_agents_md_line_limit(repo_root)
    if max_lines is not None:
        line_count = len(content.splitlines())
        if line_count > max_lines:
            errors.append(
                f"AGENTS.md is {line_count} lines, over the {max_lines}-line "
                "limit (MAX_LINES_AGENTS_MD in .agents/config.sh). Move detail "
                "into agents-docs/ and link to it — do not raise the limit to "
                "make a growing file pass."
            )
    return errors


def read_agents_md_line_limit(repo_root: Path) -> int | None:
    """Reads MAX_LINES_AGENTS_MD from .agents/config.sh, or None if absent."""
    config = repo_root / ".agents" / "config.sh"
    if not config.exists():
        return None
    pattern = re.compile(r"^\s*readonly\s+MAX_LINES_AGENTS_MD\s*=\s*(\d+)\s*$")
    for line in config.read_text().splitlines():
        match = pattern.match(line)
        if match:
            return int(match.group(1))
    return None




def check_managed_skill_links(
    repo_root: Path, manifest: dict, *, repair: bool
) -> list[str]:
    """Check or repair manifest-declared relative skill links."""
    errors = []
    canonical_skills = manifest.get("canonical_skills", ".agents/skills")
    if not isinstance(canonical_skills, str) or not canonical_skills:
        return ["Manifest canonical_skills must be a non-empty path"]
    canonical_path = repo_root / canonical_skills
    if not canonical_path.is_dir():
        return [f"Canonical skills directory not found: {canonical_skills}"]

    tools = manifest.get("tools", {})
    if not isinstance(tools, dict):
        return ["Manifest tools must be an object"]
    for tool_name, config in tools.items():
        if not isinstance(config, dict):
            errors.append(f"Manifest tool {tool_name!r} must be an object")
            continue
        strategy = config.get("symlink_strategy", "none")
        if strategy == "none":
            continue
        if strategy not in {"relative-directory", "relative-entries"}:
            errors.append(
                f"Unsupported symlink_strategy for {tool_name!r}: {strategy!r}"
            )
            continue

        tool_dir = config.get("directory")
        skills_dir = config.get("skills_directory")
        if not isinstance(tool_dir, str) or not tool_dir:
            errors.append(f"Manifest directory missing for {tool_name!r}")
            continue
        if not isinstance(skills_dir, str) or not skills_dir:
            errors.append(f"Manifest skills_directory missing for {tool_name!r}")
            continue
        full_tool_dir = repo_root / tool_dir
        full_skills_dir = repo_root / skills_dir

        if strategy == "relative-directory":
            if full_skills_dir.is_symlink():
                target = full_skills_dir.resolve()
                if not target.exists():
                    errors.append(f"Broken symlink: {skills_dir} -> {full_skills_dir.readlink()}")
                elif target != canonical_path.resolve():
                    errors.append(f"Symlink mismatch: {skills_dir} -> {full_skills_dir.readlink()}")
            elif full_skills_dir.exists():
                errors.append(f"{skills_dir} exists and is not a directory symlink")
            elif repair:
                full_tool_dir.mkdir(parents=True, exist_ok=True)
                relative_target = os.path.relpath(canonical_path, full_tool_dir)
                full_skills_dir.symlink_to(relative_target)
            else:
                errors.append(f"Missing skill directory symlink: {skills_dir}")
            continue

        if full_skills_dir.is_symlink():
            errors.append(f"{skills_dir} must be a directory containing skill symlinks")
            continue
        if full_skills_dir.exists() and not full_skills_dir.is_dir():
            errors.append(f"{skills_dir} exists and is not a directory")
            continue
        if not full_skills_dir.exists():
            if not repair:
                errors.append(f"Missing skill link directory: {skills_dir}")
                continue
            full_skills_dir.mkdir(parents=True, exist_ok=True)

        for skill in canonical_path.iterdir():
            if not skill.is_dir():
                continue
            link = full_skills_dir / skill.name
            if link.is_symlink():
                if not link.exists():
                    errors.append(f"Broken symlink: {skills_dir}/{skill.name}")
                elif link.resolve() != skill.resolve():
                    errors.append(f"Symlink mismatch: {skills_dir}/{skill.name}")
            elif link.exists():
                errors.append(f"Skill link path exists and is not a symlink: {skills_dir}/{skill.name}")
            elif repair:
                relative_target = os.path.relpath(skill, full_skills_dir)
                link.symlink_to(relative_target)
            else:
                errors.append(f"Missing skill symlink: {skills_dir}/{skill.name}")
    return errors


def sync_managed_surfaces(repo_root: Path, manifest: dict) -> list[str]:
    """Create or repair manifest-managed skill links and generated surfaces."""
    errors = check_managed_skill_links(repo_root, manifest, repair=True)
    errors.extend(sync_generated_surfaces(repo_root, manifest))
    return errors


def _load_skills_docs_generator(repo_root: Path):
    """Import generate-skills-docs.py as a module (in-process, no subprocess).

    The generator's module level only defines constants and functions (main()
    is __main__-guarded), so importing is side-effect free — and avoids the
    shell-out a static analyzer cannot prove is safe.
    """
    script = repo_root / "scripts" / "generate-skills-docs.py"
    spec = importlib.util.spec_from_file_location("generate_skills_docs", script)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_skills_catalog_freshness(repo_root: Path) -> list[str]:
    """Fail when the generated skill catalogs drift from .agents/skills/ on disk.

    The catalogs (agents-docs/AVAILABLE_SKILLS.md, .agents/skills/README.md)
    are the discovery layer for skills; AGENTS.md points agents at skills
    through them. Regeneration is cheap, so drift is a gate failure, not a
    warning — see HAR-1 (verify-before-asserting invisible to discovery).
    """
    script = repo_root / "scripts" / "generate-skills-docs.py"
    if not script.is_file():
        return [f"Skill docs generator missing: {script}"]
    generator = _load_skills_docs_generator(repo_root)
    if generator is None:
        return [f"Skill docs generator not importable: {script}"]
    skills = generator.collect_skills(repo_root / ".agents" / "skills")
    stale = []
    available_file = repo_root / "agents-docs" / "AVAILABLE_SKILLS.md"
    readme_file = repo_root / ".agents" / "skills" / "README.md"
    if not available_file.is_file() or available_file.read_text(encoding="utf-8") != generator.render_available(skills):
        stale.append(available_file)
    if not readme_file.is_file() or readme_file.read_text(encoding="utf-8") != generator.render_readme(skills):
        stale.append(readme_file)
    if stale:
        paths = ", ".join(str(path) for path in stale)
        return [f"Skill catalogs are stale — run ./scripts/setup-skills.sh: {paths}"]
    return []


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: agent-surface.py <validate|sync>")
        return 1

    command = sys.argv[1]
    repo_root = Path(os.environ.get("REPO_ROOT", Path(__file__).resolve().parent.parent)).resolve()
    manifest = load_manifest(repo_root)

    if command == "validate":
        errors = []
        errors.extend(validate_broken_symlinks(repo_root))
        errors.extend(validate_canonical_skills(repo_root, manifest))
        errors.extend(validate_skill_frontmatter(repo_root))
        errors.extend(validate_skill_name_mismatch(repo_root))
        errors.extend(validate_eval_json(repo_root))
        errors.extend(validate_duplicate_names(repo_root))
        errors.extend(check_managed_skill_links(repo_root, manifest, repair=False))
        errors.extend(validate_generated_surfaces(repo_root, manifest))
        errors.extend(validate_skills_catalog_freshness(repo_root))

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
