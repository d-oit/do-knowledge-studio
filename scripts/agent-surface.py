#!/usr/bin/env python3
import json
import os
import sys
import re
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional

# ============================================================================
# LOGGING UTILITIES
# ============================================================================


def log_info(msg):
    print(f"\033[0;34m[INFO]\033[0m {msg}")


def log_success(msg):
    print(f"\033[0;32m[PASS]\033[0m {msg}")


def log_error(msg):
    print(f"\033[0;31m[ERROR]\033[0m {msg}", file=sys.stderr)


def log_warn(msg):
    print(f"\033[1;33m[WARN]\033[0m {msg}")


# ============================================================================
# MANIFEST SCHEMA VALIDATION
# ============================================================================

MANIFEST_SCHEMA = {
    "required_fields": ["version", "canonical_skills", "tools"],
    "tool_required_fields": ["directory", "symlink_strategy"],
    "valid_strategies": ["relative", "directory", "none"],
}


def validate_manifest_schema(
    manifest: Dict[str, Any], manifest_path: Path
) -> List[str]:
    errors = []

    for field in MANIFEST_SCHEMA["required_fields"]:
        if field not in manifest:
            errors.append(f"Manifest missing required field: {field}")

    if "tools" in manifest:
        for tool_name, tool_config in manifest["tools"].items():
            for field in MANIFEST_SCHEMA["tool_required_fields"]:
                if field not in tool_config:
                    errors.append(f"Tool '{tool_name}' missing required field: {field}")

            if "symlink_strategy" in tool_config:
                strategy = tool_config["symlink_strategy"]
                if strategy not in MANIFEST_SCHEMA["valid_strategies"]:
                    errors.append(
                        f"Tool '{tool_name}' has invalid symlink_strategy: {strategy}"
                    )

    return errors


# ============================================================================
# AGENT SURFACE MANAGER
# ============================================================================


class AgentSurfaceManager:
    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.manifest_path = root_dir / ".agents" / "manifest.json"
        if not self.manifest_path.exists():
            log_error(f"Manifest not found: {self.manifest_path}")
            sys.exit(1)
        with open(self.manifest_path, "r") as f:
            self.manifest = json.load(f)

        schema_errors = validate_manifest_schema(self.manifest, self.manifest_path)
        if schema_errors:
            for err in schema_errors:
                log_error(f"Manifest schema: {err}")
            sys.exit(1)

        self.canonical_skills_dir = root_dir / self.manifest["canonical_skills"]
        self.max_skill_lines = 250

    # ------------------------------------------------------------------------
    # SYNC COMMAND
    # ------------------------------------------------------------------------

    def sync(self):
        log_info("Syncing agent surface...")
        for tool_name, config in self.manifest["tools"].items():
            tool_dir = self.root_dir / config["directory"]
            if not tool_dir.exists():
                log_info(f"Creating directory for {tool_name}: {config['directory']}")
                tool_dir.mkdir(parents=True, exist_ok=True)

            skills_dir_rel = config.get("skills_directory")
            if skills_dir_rel:
                skills_dir = self.root_dir / skills_dir_rel
                skills_dir.mkdir(parents=True, exist_ok=True)

                strategy = config.get("symlink_strategy", "relative")
                if strategy == "directory":
                    self._sync_directory_symlink(skills_dir)
                elif strategy == "relative":
                    self._cleanup_stale_symlinks(skills_dir)
                    self._sync_symlinks(skills_dir)
        log_success("Sync complete.")

    def _sync_directory_symlink(self, target_dir: Path):
        if not self.canonical_skills_dir.exists():
            return

        try:
            if target_dir.is_symlink():
                current_target = Path(os.readlink(target_dir))
                if current_target.resolve() == self.canonical_skills_dir.resolve():
                    return
                log_info(
                    f"Updating directory symlink: {target_dir} -> {self.canonical_skills_dir}"
                )
                target_dir.unlink()
            elif target_dir.exists():
                log_info(f"Removing existing directory for symlink: {target_dir}")
                import shutil

                shutil.rmtree(target_dir)

            target_dir.parent.mkdir(parents=True, exist_ok=True)

            rel_target = Path(
                os.path.relpath(self.canonical_skills_dir, target_dir.parent)
            )
            log_info(f"Creating directory symlink: {target_dir} -> {rel_target}")
            os.symlink(str(rel_target), str(target_dir))

        except OSError as e:
            log_error(f"Failed to create directory symlink {target_dir}: {e}")

    def _cleanup_stale_symlinks(self, target_dir: Path):
        if not target_dir.exists():
            return

        for item in target_dir.iterdir():
            if item.is_symlink():
                try:
                    target = Path(os.readlink(item))
                    resolved_target = (
                        target
                        if target.is_absolute()
                        else (item.parent / target).resolve()
                    )

                    if not resolved_target.exists() or not str(
                        resolved_target
                    ).startswith(str(self.canonical_skills_dir)):
                        log_info(f"Removing stale symlink: {item}")
                        item.unlink()
                except OSError as e:
                    log_warn(f"Failed to check symlink {item}: {e}")

    def _sync_symlinks(self, target_dir: Path):
        if not self.canonical_skills_dir.exists():
            return

        for skill_path in self.canonical_skills_dir.iterdir():
            if not skill_path.is_dir() or skill_path.name.startswith("_"):
                continue

            if not (skill_path / "SKILL.md").exists():
                continue

            link_name = target_dir / skill_path.name
            try:
                rel_target = skill_path.relative_to(target_dir)
            except ValueError:
                rel_target = Path(os.path.relpath(skill_path, target_dir))

            if link_name.exists():
                if link_name.is_symlink():
                    try:
                        current_target = Path(os.readlink(link_name))
                        if current_target == rel_target:
                            continue
                        else:
                            log_info(f"Updating symlink: {link_name} -> {rel_target}")
                            link_name.unlink()
                    except OSError as e:
                        log_error(f"Failed to read symlink {link_name}: {e}")
                        continue
                else:
                    log_warn(f"Path exists but is not a symlink: {link_name}")
                    continue

            try:
                log_info(f"Creating symlink: {link_name} -> {rel_target}")
                link_name.symlink_to(rel_target)
            except OSError as e:
                log_error(f"Failed to create symlink {link_name}: {e}")

    # ------------------------------------------------------------------------
    # VALIDATE COMMAND
    # ------------------------------------------------------------------------

    def validate(self):
        log_info("Validating agent surface...")

        schema_errors = validate_manifest_schema(self.manifest, self.manifest_path)
        if schema_errors:
            for err in schema_errors:
                log_error(f"Manifest schema: {err}")
            sys.exit(2)

        errors = 0

        errors += self._validate_canonical_skills()

        for tool_name, config in self.manifest["tools"].items():
            tool_dir = self.root_dir / config["directory"]
            if not tool_dir.exists():
                log_error(
                    f"Tool directory missing for {tool_name}: {config['directory']}"
                )
                errors += 1
                continue

            skills_dir_rel = config.get("skills_directory")
            if skills_dir_rel:
                skills_dir = self.root_dir / skills_dir_rel
                strategy = config.get("symlink_strategy", "relative")
                if strategy == "directory":
                    errors += self._validate_directory_symlink(tool_name, skills_dir)
                elif strategy == "relative":
                    errors += self._validate_tool_symlinks(skills_dir)

            for doc_name in config.get("docs", []):
                doc_path = self.root_dir / doc_name
                if not doc_path.exists():
                    log_error(f"Missing doc for {tool_name}: {doc_name}")
                    errors += 1
                else:
                    content = doc_path.read_text()
                    if not content.startswith("@AGENTS.md"):
                        log_error(f"{doc_name} must start with @AGENTS.md")
                        errors += 1

        errors += self._validate_docs_drift()

        if errors > 0:
            log_error(f"Validation failed with {errors} errors.")
            sys.exit(2)
        log_success("Validation passed.")

    def _validate_directory_symlink(self, tool_name: str, target_dir: Path) -> int:
        errors = 0
        if not target_dir.exists():
            log_error(f"Tool {tool_name}: skills directory missing: {target_dir}")
            return 1

        if not target_dir.is_symlink():
            log_error(f"Tool {tool_name}: {target_dir} is not a directory symlink")
            return 1

        try:
            current_target = target_dir.resolve()
            expected_target = self.canonical_skills_dir.resolve()
            if current_target != expected_target:
                log_error(
                    f"Tool {tool_name}: symlink points to {current_target}, expected {expected_target}"
                )
                errors += 1
        except OSError as e:
            log_error(f"Tool {tool_name}: Failed to read symlink {target_dir}: {e}")
            errors += 1

        return errors

    def _validate_canonical_skills(self) -> int:
        errors = 0
        if not self.canonical_skills_dir.exists():
            log_error(
                f"Canonical skills directory missing: {self.canonical_skills_dir}"
            )
            return 1

        for skill_path in self.canonical_skills_dir.iterdir():
            if not skill_path.is_dir() or skill_path.name.startswith("_"):
                continue

            skill_name = skill_path.name
            skill_md = skill_path / "SKILL.md"

            if not skill_md.exists():
                log_error(f"Skill {skill_name}: Missing SKILL.md")
                errors += 1
                continue

            content = skill_md.read_text()

            if not re.search(r"^---\n(.*?)\n---", content, re.DOTALL):
                log_error(f"Skill {skill_name}: Missing frontmatter in SKILL.md")
                errors += 1
            else:
                if "name:" not in content:
                    log_error(f"Skill {skill_name}: Missing 'name:' in frontmatter")
                    errors += 1
                if "description:" not in content:
                    log_error(
                        f"Skill {skill_name}: Missing 'description:' in frontmatter"
                    )
                    errors += 1

            line_count = len(content.splitlines())
            if line_count > self.max_skill_lines:
                log_error(
                    f"Skill {skill_name}: SKILL.md exceeds {self.max_skill_lines} lines ({line_count})"
                )
                errors += 1

        rules_path = self.canonical_skills_dir / "skill-rules.json"
        if rules_path.exists():
            try:
                json.loads(rules_path.read_text())
            except json.JSONDecodeError:
                log_error("skill-rules.json is not valid JSON")
                errors += 1

        return errors

    def _validate_tool_symlinks(self, target_dir: Path) -> int:
        errors = 0
        for skill_path in self.canonical_skills_dir.iterdir():
            if not skill_path.is_dir() or skill_path.name.startswith("_"):
                continue
            if not (skill_path / "SKILL.md").exists():
                continue

            link_name = target_dir / skill_path.name
            if not link_name.exists():
                log_error(f"Missing symlink: {link_name}")
                errors += 1
            elif not link_name.is_symlink():
                log_error(f"Path exists but is not a symlink: {link_name}")
                errors += 1
        return errors

    def _validate_docs_drift(self) -> int:
        errors = 0
        agents_md_path = self.root_dir / "AGENTS.md"
        if not agents_md_path.exists():
            return 0

        content = agents_md_path.read_text()
        skills = []
        for skill_path in sorted(self.canonical_skills_dir.iterdir()):
            if not skill_path.is_dir() or skill_path.name.startswith("_"):
                continue
            if not (skill_path / "SKILL.md").exists():
                continue
            skills.append(skill_path.name)

        for skill_name in skills:
            if f"| `{skill_name}` |" not in content:
                log_error(f"Skill `{skill_name}` is missing from AGENTS.md table")
                errors += 1

        return errors

    # ------------------------------------------------------------------------
    # GENERATE-DOCS COMMAND
    # ------------------------------------------------------------------------

    def generate_docs(self):
        log_info("Generating agent documentation...")
        self._update_agents_md()
        self._update_tool_docs()
        log_success("Documentation updated.")

    def _update_tool_docs(self):
        for tool_name, config in self.manifest["tools"].items():
            docs = config.get("docs", [])
            for doc_name in docs:
                doc_path = self.root_dir / doc_name
                if not doc_path.exists():
                    log_info(f"Generating {doc_name} for {tool_name}")
                    content = f"@AGENTS.md\n\n<!-- {tool_name.capitalize()} -specific instructions only. Do not duplicate content from AGENTS.md. -->\n"
                    doc_path.write_text(content)
                else:
                    content = doc_path.read_text()
                    if not content.startswith("@AGENTS.md"):
                        log_warn(
                            f"{doc_name} does not start with @AGENTS.md - Prepending..."
                        )
                        doc_path.write_text("@AGENTS.md\n\n" + content)

    def _infer_category(self, skill_name: str) -> str:
        s = skill_name.lower()
        if any(x in s for x in ["security", "privacy", "audit"]):
            return "Security"
        if any(x in s for x in ["test", "quality", "check"]):
            return "Quality"
        if any(x in s for x in ["doc", "readme"]):
            return "Documentation"
        if "api" in s:
            return "API Development"
        if any(
            x in s
            for x in [
                "coordination",
                "parallel",
                "goap",
                "decomposition",
                "intent",
                "classifier",
            ]
        ):
            return "Coordination"
        if any(x in s for x in ["db", "database", "devops", "cicd", "pipeline"]):
            return "DevOps"
        if any(x in s for x in ["ui", "ux"]):
            return "UI/UX"
        if "skill" in s:
            return "Meta"
        if any(x in s for x in ["search", "web"]):
            return "Research"
        if any(x in s for x in ["migration", "refactor"]):
            return "Migration"
        if "accessibility" in s:
            return "Accessibility"
        if any(x in s for x in ["shell", "script"]):
            return "Code Quality"
        return "General"

    def _extract_skill_info(self, skill_dir: Path):
        skill_md = skill_dir / "SKILL.md"
        skill_name = skill_dir.name
        name = skill_name
        description = "No description available"
        category = self._infer_category(skill_name)

        if skill_md.exists():
            content = skill_md.read_text()
            fm_match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
            if fm_match:
                fm = fm_match.group(1)
                for line in fm.split("\n"):
                    if ":" in line:
                        k, v = line.split(":", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k == "name":
                            name = v
                        if k == "description":
                            description = v
                        if k == "category":
                            category = v

        return name, description, category

    def _update_agents_md(self):
        agents_md_path = self.root_dir / "AGENTS.md"
        if not agents_md_path.exists():
            return

        lines = agents_md_path.read_text().split("\n")
        start_line = -1
        end_line = -1

        for i, line in enumerate(lines):
            if line.startswith("### Available Skills"):
                start_line = i
            elif start_line != -1 and line.startswith("### "):
                end_line = i
                break

        if start_line == -1:
            log_error("Could not find '### Available Skills' section in AGENTS.md")
            return

        if end_line == -1:
            end_line = len(lines)

        skills = []
        for skill_path in sorted(self.canonical_skills_dir.iterdir()):
            if not skill_path.is_dir() or skill_path.name.startswith("_"):
                continue
            if not (skill_path / "SKILL.md").exists():
                continue
            skills.append(self._extract_skill_info(skill_path))

        new_table = [
            "### Available Skills",
            "",
            "| Skill | Description | Category |",
            "|-------|-------------|----------|",
        ]
        for name, desc, cat in skills:
            desc = desc.replace("\n", " ").strip()
            new_table.append(f"| `{name}` | {desc[:60]} | {cat} |")
        new_table.append("")

        new_lines = lines[:start_line] + new_table + lines[end_line:]
        agents_md_path.write_text("\n".join(new_lines))
        log_info("Updated AGENTS.md skill table.")


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manage agent-facing surfaces.")
    parser.add_argument("command", choices=["sync", "validate", "generate-docs"])
    args = parser.parse_args()

    manager = AgentSurfaceManager(Path(os.getcwd()))
    if args.command == "sync":
        manager.sync()
    elif args.command == "validate":
        manager.validate()
    elif args.command == "generate-docs":
        manager.generate_docs()
