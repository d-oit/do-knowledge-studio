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

from agent_surface_generated import _repo_path, sync_generated_surfaces, validate_generated_surfaces


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
            # Portable descriptions (#1150): block scalars render as ">"
            # in some loaders, hiding the skill from description matching.
            raw_frontmatter = parts[1]
            if re.search(r'^description:\s*[>|]', raw_frontmatter, re.MULTILINE):
                errors.append(
                    f"{skill_md.relative_to(repo_root)}: description must be a single-line quoted string, not a block scalar (#1150)"
                )
            description = frontmatter.get("description")
            if isinstance(description, str) and len(description) > 300:
                errors.append(
                    f"{skill_md.relative_to(repo_root)}: description is {len(description)} chars, over the 300-char budget (#1150)"
                )
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


EXAMPLE_MARKER_RE = re.compile(
    r"^\s*(?:#{1,6}\s+|(?:<!--|//|--|;|%|\"|')\s*)?example\b",
    re.IGNORECASE,
)
FENCE_RE = re.compile(r"^(`{3,})(.*)$")
REF_TOKEN_RE = re.compile(
    r"(?:^|[\s(\[\"'`>$=/*])"
    r"((?:[a-z0-9][a-z0-9-]*/)?"
    r"(?:scripts|agents-docs|references)/[A-Za-z0-9_][A-Za-z0-9_./-]*)"
)


def validate_dead_skill_refs(repo_root: Path) -> list[str]:
    """Every scripts/agents-docs/references path in a skill must resolve (#1148).

    A skill that tells an agent to run `scripts/foo.sh` that exists nowhere
    fails the agent at runtime. Tokens resolve against the repo root (for
    `scripts/` and `agents-docs/`) or the skill's own directory (for
    `scripts/` and `references/`). Fenced blocks explicitly marked as an
    example — info string containing "example", or a first content line
    like `# example -- not in this repo` — are illustrative and skipped.
    The first-line marker only applies to top-level fences; snippets nested
    inside a template literal (a ```` outer block) inherit the outer fence,
    so mark the outer fence instead. Fence runs are length-aware (````
    closes only on a run at least as long), matching CommonMark so template
    literals containing inner ``` fences keep parity. Cross-skill references
    (`testing-strategy/references/x.md`) resolve against the named skill.
    Globs (`scripts/*.sh`) and bare directory mentions (`scripts/`) are
    not file references and are skipped.
    """
    errors = []
    skills_dir = repo_root / ".agents" / "skills"
    if not skills_dir.is_dir():
        return errors
    skill_names = {
        child.name for child in skills_dir.iterdir() if child.is_dir()
    }
    for md in sorted(skills_dir.rglob("*.md")):
        skill_dir = md.parent
        while skill_dir != skills_dir and skill_dir.parent != skills_dir:
            skill_dir = skill_dir.parent
        lines = md.read_text(encoding="utf-8").split("\n")
        in_fence = False
        fence_is_example = False
        fence_saw_content = False
        fence_len = 0
        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            fence_match = FENCE_RE.match(stripped)
            # Length-aware toggling: a ```` outer block (used for template
            # literals containing inner ``` fences) only closes on a run at
            # least as long — matching CommonMark, so the scanner and the
            # rendered doc agree on what is code and what is prose.
            if fence_match and (
                not in_fence or not fence_match.group(2).strip()
            ):
                run = len(fence_match.group(1))
                if not in_fence:
                    in_fence = True
                    fence_len = run
                    fence_is_example = "example" in stripped.lower()
                    fence_saw_content = False
                elif run >= fence_len:
                    in_fence = False
                    fence_is_example = False
                continue
            if in_fence:
                if not fence_is_example and not fence_saw_content and stripped:
                    fence_saw_content = True
                    if EXAMPLE_MARKER_RE.match(stripped):
                        fence_is_example = True
                if fence_is_example:
                    continue
            for match in REF_TOKEN_RE.finditer(line):
                ref = match.group(1).rstrip(".,:;)")
                if ref.endswith(("/", ".", ",")):
                    continue
                basename = ref.rsplit("/", 1)[-1]
                if not basename or "*" in basename or "." not in basename:
                    continue
                first = ref.partition("/")[0]
                if first in skill_names:
                    # Cross-skill reference, e.g.
                    # `testing-strategy/references/mutation-testing.md`.
                    ok = (skills_dir / ref).exists()
                elif ref.startswith("scripts/"):
                    sub = ref[len("scripts/"):]
                    ok = (repo_root / "scripts" / sub).exists() or (
                        skill_dir / "scripts" / sub
                    ).exists()
                elif ref.startswith("references/"):
                    ok = (skill_dir / ref).exists()
                else:
                    ok = (repo_root / ref).exists()
                if not ok:
                    errors.append(
                        f"{md.relative_to(repo_root)}:{lineno}: dead reference "
                        f"'{ref}' resolves neither at the repo root nor in "
                        f"{skill_dir.name}/ (#1148)"
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


def validate_agent_guard(repo_root: Path) -> list[str]:
    """The PreToolUse guard and its registration must agree (#1144)."""
    errors = []
    guard = repo_root / "scripts" / "agent-guard.sh"
    settings = repo_root / ".claude" / "settings.json"
    if not guard.is_file():
        return ["Agent guard missing: scripts/agent-guard.sh"]
    if not os.access(guard, os.X_OK):
        errors.append("Agent guard is not executable: scripts/agent-guard.sh")
    if not settings.is_file():
        errors.append("Claude hook settings missing: .claude/settings.json")
        return errors
    try:
        payload = json.loads(settings.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f".claude/settings.json is not valid JSON: {exc}"]
    pre_tool = (payload.get("hooks") or {}).get("PreToolUse") or []
    commands = [
        hook.get("command", "")
        for entry in pre_tool
        for hook in (entry.get("hooks") or [])
    ]
    if not any("agent-guard.sh" in command for command in commands):
        errors.append(".claude/settings.json does not register scripts/agent-guard.sh as a PreToolUse hook")
    return errors


def validate_eval_presence(repo_root: Path) -> list[str]:
    """Every advertised skill ships evals (#1149).

    Edits to a skill without evals cannot be regression-tested, so the
    skill-evaluator has nothing to benchmark. Redirect stubs keep their
    evals directories; only names listed in EVAL_ALLOWLIST with a recorded
    reason are exempt.
    """
    # skill name -> reason for exemption. Empty: no advertised skill is
    # exempt today. Add entries only with maintainer approval in plans/.
    EVAL_ALLOWLIST: dict[str, str] = {}
    errors = []
    skills_dir = repo_root / ".agents" / "skills"
    if not skills_dir.is_dir():
        return errors
    for skill in sorted(skills_dir.iterdir()):
        if not skill.is_dir():
            continue
        if (skill / "evals").is_dir():
            continue
        if skill.name in EVAL_ALLOWLIST:
            continue
        errors.append(
            f"Advertised skill {skill.name} has no evals/ directory (#1149); "
            "add evals or record an exemption in EVAL_ALLOWLIST"
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
    canonical_path, error = _repo_path(repo_root, canonical_skills, "canonical_skills")
    if error:
        return [error]
    if canonical_path is None or not canonical_path.is_dir():
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
        if (
            not isinstance(strategy, str)
            or strategy not in {"relative-directory", "relative-entries"}
        ):
            errors.append(
                f"Unsupported symlink_strategy for {tool_name!r}: {strategy!r}"
            )
            continue

        tool_dir = config.get("directory")
        skills_dir = config.get("skills_directory")
        full_tool_dir, error = _repo_path(
            repo_root, tool_dir, f"Tool directory for {tool_name!r}"
        )
        if error or full_tool_dir is None:
            errors.append(error or f"Manifest directory missing for {tool_name!r}")
            continue
        full_skills_dir, error = _repo_path(
            repo_root, skills_dir, f"Skill directory for {tool_name!r}"
        )
        if error or full_skills_dir is None:
            errors.append(error or f"Manifest skills_directory missing for {tool_name!r}")
            continue
        if full_tool_dir.is_symlink() and not full_tool_dir.exists():
            errors.append(f"Tool directory is a broken symlink: {tool_dir}")
            continue
        if full_tool_dir.exists() and not full_tool_dir.is_dir():
            errors.append(f"Tool directory exists and is not a directory: {tool_dir}")
            continue
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
                relative_target = os.path.relpath(
                    canonical_path.resolve(), full_skills_dir.parent.resolve()
                )
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

        if repair:
            # Prune symlinks left behind by skills moved out of the canonical
            # directory (#1147): a moved skill must stop being advertised.
            # Only broken symlinks are removed; real files are never touched.
            for stale in full_skills_dir.iterdir():
                if stale.is_symlink() and not stale.exists():
                    stale.unlink()
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
                relative_target = os.path.relpath(skill.resolve(), full_skills_dir.resolve())
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
        errors.extend(validate_broken_links(repo_root))
        errors.extend(validate_agents_md(repo_root))
        errors.extend(validate_agent_guard(repo_root))
        errors.extend(validate_dead_skill_refs(repo_root))
        errors.extend(validate_eval_presence(repo_root))
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
