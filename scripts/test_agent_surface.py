#!/usr/bin/env python3
"""Tests for agent-surface.py"""

import pytest
import json
import os
import tempfile
import importlib.util
from pathlib import Path
from unittest.mock import patch, MagicMock

import sys

# Import agent-surface module with hyphen in name
spec = importlib.util.spec_from_file_location(
    "agent_surface", Path(__file__).parent / "agent-surface.py"
)
agent_surface = importlib.util.module_from_spec(spec)
sys.modules["agent_surface"] = agent_surface
spec.loader.exec_module(agent_surface)

from agent_surface import AgentSurfaceManager, validate_manifest_schema, MANIFEST_SCHEMA


@pytest.fixture
def temp_project():
    """Create a temporary project structure for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        agents_dir = root / ".agents"
        agents_dir.mkdir()

        skills_dir = agents_dir / "skills"
        skills_dir.mkdir()

        skill1 = skills_dir / "test-skill-1"
        skill1.mkdir()
        (skill1 / "SKILL.md").write_text("""---
name: test-skill-1
description: A test skill
category: General
---
# Test Skill 1
""")

        skill2 = skills_dir / "test-skill-2"
        skill2.mkdir()
        (skill2 / "SKILL.md").write_text("""---
name: test-skill-2
description: Another test skill
category: Testing
---
# Test Skill 2
""")

        manifest = {
            "version": "1.0.0",
            "canonical_skills": ".agents/skills",
            "global_docs": ["AGENTS.md"],
            "tools": {
                "claude": {
                    "directory": ".claude",
                    "skills_directory": ".claude/skills",
                    "docs": ["CLAUDE.md"],
                    "symlink_strategy": "relative",
                },
                "cursor": {
                    "directory": ".cursor",
                    "skills_directory": ".cursor/skills",
                    "symlink_strategy": "directory",
                },
                "opencode": {"directory": ".opencode", "symlink_strategy": "none"},
            },
        }

        manifest_path = agents_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2))

        (root / "AGENTS.md").write_text("""# AGENTS.md

### Available Skills

| Skill | Description | Category |
|-------|-------------|----------|

### Other Section
""")

        # Create tool directories
        (root / ".claude").mkdir()
        (root / ".cursor").mkdir()
        (root / ".opencode").mkdir()

        yield root


class TestManifestSchemaValidation:
    def test_valid_manifest(self):
        manifest = {
            "version": "1.0.0",
            "canonical_skills": ".agents/skills",
            "tools": {
                "claude": {"directory": ".claude", "symlink_strategy": "relative"}
            },
        }
        errors = validate_manifest_schema(manifest, Path("/tmp/manifest.json"))
        assert errors == []

    def test_missing_required_field(self):
        manifest = {
            "version": "1.0.0",
        }
        errors = validate_manifest_schema(manifest, Path("/tmp/manifest.json"))
        assert any("tools" in e for e in errors)
        assert any("canonical_skills" in e for e in errors)

    def test_missing_tool_required_field(self):
        manifest = {
            "version": "1.0.0",
            "canonical_skills": ".agents/skills",
            "tools": {
                "claude": {
                    "directory": ".claude",
                }
            },
        }
        errors = validate_manifest_schema(manifest, Path("/tmp/manifest.json"))
        assert any("symlink_strategy" in e for e in errors)

    def test_invalid_symlink_strategy(self):
        manifest = {
            "version": "1.0.0",
            "canonical_skills": ".agents/skills",
            "tools": {
                "claude": {"directory": ".claude", "symlink_strategy": "invalid"}
            },
        }
        errors = validate_manifest_schema(manifest, Path("/tmp/manifest.json"))
        assert any("invalid symlink_strategy" in e for e in errors)


class TestSync:
    def test_sync_creates_directory_symlink(self, temp_project):
        manager = AgentSurfaceManager(temp_project)
        manager.sync()

        cursor_skills = temp_project / ".cursor" / "skills"
        assert cursor_skills.is_symlink()

        target = Path(os.readlink(cursor_skills))
        resolved_target = (
            target
            if target.is_absolute()
            else (cursor_skills.parent / target).resolve()
        )
        assert resolved_target == manager.canonical_skills_dir.resolve()

    def test_sync_creates_relative_symlinks(self, temp_project):
        manager = AgentSurfaceManager(temp_project)
        manager.sync()

        claude_skills = temp_project / ".claude" / "skills"
        assert claude_skills.exists()

        skill_link = claude_skills / "test-skill-1"
        assert skill_link.is_symlink()

        target = Path(os.readlink(skill_link))
        resolved_target = (
            target if target.is_absolute() else (skill_link.parent / target).resolve()
        )
        assert resolved_target == (temp_project / ".agents" / "skills" / "test-skill-1")

    def test_sync_updates_existing_symlinks(self, temp_project):
        manager = AgentSurfaceManager(temp_project)

        claude_skills = temp_project / ".claude" / "skills"
        claude_skills.mkdir(parents=True)

        old_link = claude_skills / "test-skill-1"
        old_link.symlink_to("/some/old/path")

        manager.sync()

        target = Path(os.readlink(old_link))
        resolved_target = (
            target if target.is_absolute() else (old_link.parent / target).resolve()
        )
        assert resolved_target == (temp_project / ".agents" / "skills" / "test-skill-1")


class TestStaleSymlinkCleanup:
    def test_cleanup_removes_stale_symlinks(self, temp_project):
        manager = AgentSurfaceManager(temp_project)

        claude_skills = temp_project / ".claude" / "skills"
        claude_skills.mkdir(parents=True)

        stale_link = claude_skills / "old-skill"
        stale_link.symlink_to("/nonexistent/path")

        manager._cleanup_stale_symlinks(claude_skills)

        assert not stale_link.exists()

    def test_cleanup_removes_symlinks_not_in_canonical(self, temp_project):
        manager = AgentSurfaceManager(temp_project)

        claude_skills = temp_project / ".claude" / "skills"
        claude_skills.mkdir(parents=True)

        other_link = claude_skills / "not-in-canonical"
        other_skill = temp_project / ".agents" / "skills" / "not-in-canonical"
        other_skill.mkdir()
        (other_skill / "SKILL.md").write_text("---")
        other_link.symlink_to(other_skill)

        other_link.unlink()
        other_link.symlink_to("/tmp/some/other/path")

        manager._cleanup_stale_symlinks(claude_skills)

        assert not other_link.exists()


class TestValidate:
    def test_validate_passes_with_valid_project(self, temp_project):
        manager = AgentSurfaceManager(temp_project)
        manager.sync()
        manager.generate_docs()
        (temp_project / "CLAUDE.md").write_text("@AGENTS.md\n\nTest")
        manager.validate()
        # Should not raise

    def test_validate_fails_with_missing_manifest_field(self, temp_project):
        manifest_path = temp_project / ".agents" / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        del manifest["canonical_skills"]
        manifest_path.write_text(json.dumps(manifest))

        with pytest.raises(SystemExit):
            manager = AgentSurfaceManager(temp_project)

    def test_validate_detects_missing_skill_file(self, temp_project):
        from agent_surface import log_error
        import io
        from contextlib import redirect_stderr

        manager = AgentSurfaceManager(temp_project)

        (temp_project / ".agents" / "skills" / "test-skill-1" / "SKILL.md").unlink()

        with redirect_stderr(io.StringIO()) as stderr:
            try:
                manager.validate()
            except SystemExit:
                pass

            assert "Missing SKILL.md" in stderr.getvalue()


class TestUpdateAgentsMd:
    def test_update_agents_md_adds_skills(self, temp_project):
        manager = AgentSurfaceManager(temp_project)
        manager._update_agents_md()

        content = (temp_project / "AGENTS.md").read_text()
        assert "| `test-skill-1` |" in content
        assert "| `test-skill-2` |" in content

    def test_update_agents_md_preserves_other_sections(self, temp_project):
        manager = AgentSurfaceManager(temp_project)
        manager._update_agents_md()

        content = (temp_project / "AGENTS.md").read_text()
        assert "### Other Section" in content


class TestDirectorySymlink:
    def test_directory_symlink_creation(self, temp_project):
        manager = AgentSurfaceManager(temp_project)
        target_dir = temp_project / ".cursor" / "skills"

        manager._sync_directory_symlink(target_dir)

        assert target_dir.is_symlink()
        # Use resolve() on the symlink itself to get the actual target
        resolved = target_dir.resolve()
        assert resolved == manager.canonical_skills_dir.resolve()

    def test_directory_symlink_skip_if_exists_and_correct(self, temp_project):
        manager = AgentSurfaceManager(temp_project)
        target_dir = temp_project / ".cursor" / "skills"

        manager._sync_directory_symlink(target_dir)

        # Call again - should not modify
        manager._sync_directory_symlink(target_dir)

        assert target_dir.is_symlink()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
