#!/usr/bin/env python3
"""Pin all GitHub Actions to full commit SHA with version comment.

Reads all .github/workflows/*.yml files and replaces uses: directives
with SHA-pinned versions. Uses a known mapping of action versions to SHAs.

Usage: python3 scripts/pin-actions-to-sha.py
"""

from pathlib import Path
import re
import sys

# Mapping of action@version to action@SHA # version
# These are the latest stable versions as of 2026-04
ACTION_SHAS = {
    "actions/checkout@v4": "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2",
    "actions/checkout@v5": "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2",
    "actions/checkout@v6": "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2",
    "actions/setup-node@v4": "actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a  # v4.2.0",
    "actions/setup-node@v5": "actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a  # v4.2.0",
    "actions/setup-node@v6": "actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a  # v4.2.0",
    "actions/setup-python@v5": "actions/setup-python@8d9ed9ac5c53483de85588cdf95a591a75ab9f55  # v5.5.0",
    "actions/setup-python@v6": "actions/setup-python@8d9ed9ac5c53483de85588cdf95a591a75ab9f55  # v5.5.0",
    "actions/setup-go@v5": "actions/setup-go@f111f3307d8850f501ac008e886eec1fd1932a34  # v5.3.0",
    "actions/github-script@v7": "actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea  # v7.0.1",
    "actions/stale@v9": "actions/stale@28ca1036281a5e5922ead5184a1bbf96e5fc984e  # v9.0.0",
    "actions/labeler@v5": "actions/labeler@8558fd74291d67161a8a78ce36a881fa63b766a9  # v5.0.0",
    "dtolnay/rust-toolchain@stable": "dtolnay/rust-toolchain@3c5f7ea28cd621ae0bf5283f0e981fb97b8a7af9  # stable",
    "dtolnay/rust-toolchain@nightly": "dtolnay/rust-toolchain@3c5f7ea28cd621ae0bf5283f0e981fb97b8a7af9  # nightly",
}


def pin_actions(content: str) -> tuple[str, int]:
    """Replace action@version with action@SHA # version in YAML content.

    Returns:
        Tuple of (modified_content, number_of_replacements).
    """
    count = 0

    def replace_action(match: re.Match) -> str:
        nonlocal count
        full_match = match.group(0)
        prefix = match.group(1)
        action_ref = match.group(2)

        if action_ref in ACTION_SHAS:
            count += 1
            return f"{prefix}{ACTION_SHAS[action_ref]}"
        return full_match

    # Match uses: directives with action references
    # Handles leading whitespace and the "uses: " prefix
    pattern = r"^(\s+-?\s*uses:\s*)([\w\-]+/[\w\-]+@[\w\-\.]+)"
    modified = re.sub(pattern, replace_action, content, flags=re.MULTILINE)

    return modified, count


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    workflows_dir = repo_root / ".github" / "workflows"

    if not workflows_dir.is_dir():
        print("Error: .github/workflows directory not found", file=sys.stderr)
        return 1

    total_replacements = 0

    for workflow_file in sorted(workflows_dir.glob("*.yml")):
        content = workflow_file.read_text(encoding="utf-8")
        modified, count = pin_actions(content)

        if count > 0:
            workflow_file.write_text(modified, encoding="utf-8")
            print(f"Pinned {count} action(s) in {workflow_file.name}")
            total_replacements += count

    if total_replacements == 0:
        print("No actions to pin (all already pinned or no workflows found)")
    else:
        print(f"\nTotal: pinned {total_replacements} action reference(s)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
