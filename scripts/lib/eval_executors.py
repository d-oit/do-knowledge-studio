"""Execution logic for command and file validation evals."""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

from lib.eval_types import EvalResult, EvalStatus


def run_command_check(
    eval_case: dict,
    skill_path: Path,
    verbose: bool
) -> EvalResult:
    """Run a command-based evaluation."""
    scripts_dir = skill_path / "scripts"
    if not scripts_dir.is_dir():
        return EvalResult(
            eval_id=eval_case.get("id", 0),
            status=EvalStatus.SKIP,
            message="No scripts directory found"
        )
    start_time = time.time()
    scripts = list(scripts_dir.glob("*.py")) + list(scripts_dir.glob("*.sh"))
    if not scripts:
        return EvalResult(
            eval_id=eval_case.get("id", 0),
            status=EvalStatus.SKIP,
            message="No executable scripts found"
        )
    check_structure = scripts_dir / "check_structure.py"
    if check_structure.exists():
        try:
            result = subprocess.run(
                [sys.executable, str(check_structure), "--path", str(skill_path.parent)],
                capture_output=True, text=True, timeout=30,
                cwd=str(skill_path.parent.parent.parent)
            )
            duration = (time.time() - start_time) * 1000
            if result.returncode == 0:
                return EvalResult(
                    eval_id=eval_case.get("id", 0),
                    status=EvalStatus.PASS,
                    message="Command executed successfully",
                    duration_ms=duration
                )
            return EvalResult(
                eval_id=eval_case.get("id", 0),
                status=EvalStatus.FAIL,
                message="Command failed",
                details=[result.stdout, result.stderr] if result.stderr else [result.stdout],
                duration_ms=duration
            )
        except subprocess.TimeoutExpired:
            return EvalResult(
                eval_id=eval_case.get("id", 0),
                status=EvalStatus.ERROR,
                message="Command timed out after 30 seconds"
            )
        except Exception as exc:
            return EvalResult(
                eval_id=eval_case.get("id", 0),
                status=EvalStatus.ERROR,
                message=f"Command execution error: {exc}"
            )
    return EvalResult(
        eval_id=eval_case.get("id", 0),
        status=EvalStatus.SKIP,
        message="No recognized command found to execute"
    )


def run_file_validation(
    eval_case: dict,
    skill_path: Path,
    verbose: bool
) -> EvalResult:
    """Run file validation for referenced files."""
    files = eval_case.get("files", [])
    if not files:
        return EvalResult(
            eval_id=eval_case.get("id", 0),
            status=EvalStatus.SKIP,
            message="No files to validate"
        )
    missing: list[str] = []
    found: list[str] = []
    for file_path in files:
        full_path = skill_path / file_path
        if not full_path.exists():
            missing.append(file_path)
        else:
            found.append(file_path)
    if missing:
        return EvalResult(
            eval_id=eval_case.get("id", 0),
            status=EvalStatus.FAIL,
            message=f"Missing {len(missing)} file(s)",
            details=[f"Missing: {f}" for f in missing] + [f"Found: {f}" for f in found]
        )
    return EvalResult(
        eval_id=eval_case.get("id", 0),
        status=EvalStatus.PASS,
        message=f"All {len(files)} file(s) validated",
        details=[f"Found: {f}" for f in found]
    )
