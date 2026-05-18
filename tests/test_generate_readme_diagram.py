import sys
import os
from pathlib import Path

# Add scripts directory to sys.path
sys.path.append(str(Path(__file__).parent.parent / "scripts"))

from generate_readme_diagram import get_updated_content, START_MARKER, END_MARKER, ARCH_HEADING

def test_replace_between_markers():
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
    content = f"Some header\n{ARCH_HEADING}\nSome content"
    updated = get_updated_content(content)
    assert updated is not None
    assert ARCH_HEADING in updated
    assert START_MARKER in updated
    assert END_MARKER in updated
    assert "graph TD" in updated
    assert "Some content" in updated

def test_missing_heading_and_markers():
    content = "Some random text without heading"
    updated = get_updated_content(content)
    assert updated is None

def test_idempotency():
    content = f"{ARCH_HEADING}\nSome content"
    updated_once = get_updated_content(content)
    updated_twice = get_updated_content(updated_once)
    assert updated_once == updated_twice
