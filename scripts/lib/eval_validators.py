"""Validation logic for eval structure and format."""

from __future__ import annotations

import json
from pathlib import Path

from lib.eval_types import EvalResult, EvalStatus


def load_evals_file(evals_path: Path) -> tuple[dict | None, str | None]:
    """Load and parse an evals.json file."""
    try:
        data = json.loads(evals_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, f"File not found: {evals_path}"
    except json.JSONDecodeError as exc:
        return None, f"Invalid JSON: {exc.msg} at line {exc.lineno}"
    except Exception as exc:
        return None, f"Error reading file: {exc}"
    return data, None


def validate_evals_format(data: dict, skill_name: str) -> list[str]:
    """Validate the evals.json format."""
    issues: list[str] = []
    if "skill_name" not in data:
        issues.append("Missing required field: 'skill_name'")
    elif data.get("skill_name") != skill_name:
        issues.append(
            f"Skill name mismatch: expected '{skill_name}', "
            f"got '{data.get('skill_name')}'"
        )
    if "evals" not in data:
        issues.append("Missing required field: 'evals'")
        return issues
    evals = data.get("evals")
    if not isinstance(evals, list):
        issues.append("'evals' must be an array")
        return issues
    if len(evals) == 0:
        issues.append("'evals' array is empty")
    required_fields = {"id", "prompt", "expected_output"}
    for idx, eval_case in enumerate(evals, start=1):
        if not isinstance(eval_case, dict):
            issues.append(f"Eval #{idx} is not an object")
            continue
        missing = required_fields - set(eval_case.keys())
        if missing:
            issues.append(f"Eval #{idx} missing fields: {', '.join(sorted(missing))}")
        if "assertions" in eval_case:
            assertions = eval_case["assertions"]
            if not isinstance(assertions, list):
                issues.append(f"Eval #{idx}: 'assertions' must be an array")
            elif len(assertions) == 0:
                issues.append(f"Eval #{idx}: 'assertions' array is empty")
        if "files" in eval_case:
            files = eval_case["files"]
            if not isinstance(files, list):
                issues.append(f"Eval #{idx}: 'files' must be an array")
            elif not all(isinstance(f, str) for f in files):
                issues.append(f"Eval #{idx}: all 'files' must be strings")
    return issues


def run_structure_check(skill_path: Path) -> EvalResult:
    """Run structure check validation for a skill."""
    issues: list[str] = []
    if not (skill_path / "SKILL.md").is_file():
        issues.append("Missing required file: SKILL.md")
    if (skill_path / skill_path.name).is_dir():
        issues.append(f"Nested duplicate directory: {skill_path.name}/{skill_path.name}/")
    evals_path = skill_path / "evals" / "evals.json"
    if evals_path.exists():
        data, error = load_evals_file(evals_path)
        if error:
            issues.append(f"evals.json error: {error}")
        else:
            format_issues = validate_evals_format(data or {}, skill_path.name)
            issues.extend(format_issues)
    if issues:
        return EvalResult(
            eval_id=0, status=EvalStatus.FAIL,
            message="Structure check failed", details=issues
        )
    return EvalResult(
        eval_id=0, status=EvalStatus.PASS,
        message="Structure check passed",
        details=["SKILL.md exists", "evals.json is valid"]
    )
