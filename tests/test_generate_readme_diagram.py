import sys
import os
import pytest
from pathlib import Path
import importlib.util

# Load the module with hyphens
script_path = Path(__file__).parent.parent / "scripts" / "generate-readme-diagram.py"
spec = importlib.util.spec_from_file_location("generate_readme_diagram", str(script_path))
generate_readme_diagram = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_readme_diagram)

get_updated_content = generate_readme_diagram.get_updated_content
update_readme = generate_readme_diagram.update_readme
START_MARKER = generate_readme_diagram.START_MARKER
END_MARKER = generate_readme_diagram.END_MARKER
ARCH_HEADING = generate_readme_diagram.ARCH_HEADING

def test_replace_between_markers():
    """1. Verify script correctly identifies and replaces content between START and END markers"""
    content = f"Some header\n{START_MARKER}\nOld diagram\n{END_MARKER}\nSome footer"
    updated = get_updated_content(content)
    assert updated is not None
    assert START_MARKER in updated
    assert END_MARKER in updated
    assert "Old diagram" not in updated
    assert "graph TD" in updated
    assert "Some header" in updated
    assert "Some footer" in updated

def test_insert_after_heading():
    """2. Verify script correctly inserts markers and diagram if markers are initially missing but heading exists"""
    content = f"Some header\n{ARCH_HEADING}\nSome content"
    updated = get_updated_content(content)
    assert updated is not None
    assert ARCH_HEADING in updated
    assert START_MARKER in updated
    assert END_MARKER in updated
    assert "graph TD" in updated
    assert "Some content" in updated

def test_missing_heading_gracefully():
    """3a. Verify script handles missing Architecture heading gracefully (returns None/False)"""
    content = "Some random text without heading"
    updated = get_updated_content(content)
    assert updated is None

def test_missing_readme_gracefully(tmp_path):
    """3b. Verify script handles missing README.md gracefully"""
    non_existent_file = tmp_path / "NON_EXISTENT_README.md"
    result = update_readme(str(non_existent_file))
    assert result is False

def test_idempotency():
    content = f"{ARCH_HEADING}\nSome content"
    updated_once = get_updated_content(content)
    updated_twice = get_updated_content(updated_once)
    assert updated_once == updated_twice
