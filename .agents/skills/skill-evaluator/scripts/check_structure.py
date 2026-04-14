#!/usr/bin/env python3
"""Check local skill directory structure and eval coverage."""
from __future__ import annotations

import json
import sys
from pathlib import Path


def load_evals(evals_path: Path) -> tuple[dict | None, str | None]:
    try:
        data = json.loads(evals_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, "missing evals/evals.json"
    except json.JSONDecodeError as exc:
        return None, f"invalid evals/evals.json: {exc.msg}"
    return data, None


def check_eval_fields(data: dict) -> list[str]:
    issues: list[str] = []
    evals = data.get("evals")
    if not isinstance(evals, list):
        return ["evals.json missing top-level 'evals' array"]
    if len(evals) < 2:
        issues.append(f"only {len(evals)} eval case(s); recommend at least 2")
    for idx, case in enumerate(evals, start=1):
        missing = [
            field for field in ("id", "prompt", "expected_output")
            if field not in case
        ]
        if missing:
            issues.append(f"eval #{idx} missing fields: {', '.join(missing)}")
    return issues


def check_skill(skill_dir: Path) -> dict:
    issues: list[str] = []
    has_skill_md = (skill_dir / "SKILL.md").is_file()
    has_references = (skill_dir / "references").is_dir()
    has_scripts = (skill_dir / "scripts").is_dir()
    has_evals = (skill_dir / "evals").is_dir()
    nested_duplicate = (skill_dir / skill_dir.name).is_dir()

    if nested_duplicate:
        issues.append(
            f"nested duplicate directory present: `{skill_dir.name}/{skill_dir.name}/`"
        )

    if not has_skill_md:
        issues.append("missing SKILL.md")

    eval_count = 0
    if has_evals:
        evals_data, evals_error = load_evals(skill_dir / "evals" / "evals.json")
        if evals_error:
            issues.append(evals_error)
        elif evals_data is not None:
            eval_count = (
                len(evals_data.get("evals", []))
                if isinstance(evals_data.get("evals"), list)
                else 0
            )
            issues.extend(check_eval_fields(evals_data))

    return {
        "skill": skill_dir.name,
        "has_skill_md": has_skill_md,
        "has_references": has_references,
        "has_scripts": has_scripts,
        "has_evals": has_evals,
        "eval_count": eval_count,
        "issues": issues,
        "status": "PASS" if has_skill_md and not issues else "NEEDS_WORK",
    }


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Check skill structure")
    parser.add_argument("--path", default=".agents/skills", help="Skills directory")
    args = parser.parse_args()

    skills_dir = Path(args.path)
    if not skills_dir.is_dir():
        print(f"Skills directory not found: {skills_dir}")
        return 1

    results = [
        check_skill(path)
        for path in sorted(skills_dir.iterdir())
        if path.is_dir()
    ]

    print(f"# Skill Structure Report\n")
    print(f"Checked {len(results)} skills in `{skills_dir}`\n")

    for result in results:
        print(f"## {result['skill']} -- {result['status']}")
        print(f"- SKILL.md: {'yes' if result['has_skill_md'] else 'no'}")
        print(f"- references/: {'yes' if result['has_references'] else 'no'}")
        print(f"- scripts/: {'yes' if result['has_scripts'] else 'no'}")
        print(f"- evals/: {'yes' if result['has_evals'] else 'no'}")
        if result["has_evals"]:
            print(f"- eval count: {result['eval_count']}")
        if result["issues"]:
            print("- issues:")
            for issue in result["issues"]:
                print(f"  - {issue}")
        print()

    needs_work = [result for result in results if result["status"] != "PASS"]
    print(
        f"Summary: {len(results) - len(needs_work)} PASS, {len(needs_work)} NEEDS_WORK"
    )
    return 0 if not needs_work else 1


if __name__ == "__main__":
    sys.exit(main())
