#!/usr/bin/env python3
"""Automated evaluation runner framework for skills.

This script discovers all skills with evals/evals.json files, runs the defined
test scenarios, and generates comprehensive reports with pass/fail statistics.

Usage:
    python3 scripts/run-evals.py
    python3 scripts/run-evals.py --skill skill-evaluator
    python3 scripts/run-evals.py --verbose --format json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from lib.eval_executors import run_command_check, run_file_validation
from lib.eval_types import EvalReport, EvalResult, EvalStatus, EvalType, SkillEvalResult
from lib.eval_validators import load_evals_file, run_structure_check, validate_evals_format


def run_eval_case(
    eval_case: dict,
    skill_path: Path,
    eval_types: list[EvalType],
    verbose: bool
) -> EvalResult:
    """Run a single eval case."""
    eval_id = eval_case.get("id", 0)
    files = eval_case.get("files", [])
    if EvalType.STRUCTURE in eval_types and eval_id == 0:
        return run_structure_check(skill_path)
    if EvalType.FILE_VALIDATION in eval_types and files:
        return run_file_validation(eval_case, skill_path, verbose)
    if EvalType.COMMAND in eval_types:
        return run_command_check(eval_case, skill_path, verbose)
    return EvalResult(
        eval_id=eval_id, status=EvalStatus.PASS,
        message="Eval case format is valid",
        details=[
            f"Prompt length: {len(eval_case.get('prompt', ''))} chars",
            f"Expected output length: {len(eval_case.get('expected_output', ''))} chars",
            f"Assertions: {len(eval_case.get('assertions', []))}"
        ]
    )


def evaluate_skill(
    skill_path: Path,
    eval_types: list[EvalType],
    verbose: bool
) -> SkillEvalResult:
    """Evaluate a single skill."""
    skill_name = skill_path.name
    result = SkillEvalResult(
        skill_name=skill_name, skill_path=skill_path, status=EvalStatus.PASS
    )
    evals_path = skill_path / "evals" / "evals.json"
    data, error = load_evals_file(evals_path)
    if error:
        result.errors.append(error)
        result.status = EvalStatus.FAIL
        return result
    if data is None:
        result.errors.append("Failed to load evals.json")
        result.status = EvalStatus.FAIL
        return result
    format_issues = validate_evals_format(data, skill_name)
    if format_issues:
        result.errors.extend(format_issues)
        result.status = EvalStatus.FAIL
        return result
    if EvalType.STRUCTURE in eval_types:
        structure_result = run_structure_check(skill_path)
        result.eval_results.append(structure_result)
        result.evals_run += 1
        if structure_result.status == EvalStatus.PASS:
            result.evals_passed += 1
        else:
            result.evals_failed += 1
            result.status = EvalStatus.FAIL
    evals = data.get("evals", [])
    for eval_case in evals:
        eval_result = run_eval_case(eval_case, skill_path, eval_types, verbose)
        result.eval_results.append(eval_result)
        result.evals_run += 1
        if eval_result.status == EvalStatus.PASS:
            result.evals_passed += 1
        elif eval_result.status == EvalStatus.SKIP:
            result.evals_skipped += 1
        else:
            result.evals_failed += 1
            result.status = EvalStatus.FAIL
    return result


def discover_skills(skills_dir: Path, specific_skill: str | None = None) -> list[Path]:
    """Discover all skills with evals/evals.json files."""
    if specific_skill:
        skill_path = skills_dir / specific_skill
        evals_path = skill_path / "evals" / "evals.json"
        if skill_path.is_dir() and evals_path.exists():
            return [skill_path]
        return []
    skills: list[Path] = []
    if not skills_dir.is_dir():
        return skills
    for path in sorted(skills_dir.iterdir()):
        if path.is_dir():
            evals_path = path / "evals" / "evals.json"
            if evals_path.exists():
                skills.append(path)
    return skills


def generate_text_report(report: EvalReport) -> str:
    """Generate a human-readable text report."""
    lines: list[str] = []
    lines.append("=" * 70)
    lines.append("SKILL EVALUATION REPORT")
    lines.append("=" * 70)
    lines.append("")
    lines.append("SUMMARY")
    lines.append("-" * 40)
    lines.append(f"Total skills evaluated: {report.total_skills}")
    lines.append(f"  - Passed: {report.skills_passed}")
    lines.append(f"  - Failed: {report.skills_failed}")
    lines.append("")
    lines.append(f"Total eval scenarios: {report.total_evals}")
    lines.append(f"  - Passed: {report.evals_passed}")
    lines.append(f"  - Failed: {report.evals_failed}")
    lines.append(f"  - Skipped: {report.evals_skipped}")
    lines.append("")
    if report.skills_failed == 0:
        lines.append("OVERALL STATUS: PASS")
    else:
        lines.append("OVERALL STATUS: FAIL")
    lines.append("")
    lines.append("DETAILED RESULTS")
    lines.append("-" * 40)
    for skill_result in report.skill_results:
        status_icon = "PASS" if skill_result.status == EvalStatus.PASS else "FAIL"
        lines.append(f"\n[{status_icon}] {skill_result.skill_name}")
        lines.append(f"  Path: {skill_result.skill_path}")
        lines.append(f"  Evals: {skill_result.evals_run} run, "
                     f"{skill_result.evals_passed} passed, "
                     f"{skill_result.evals_failed} failed, "
                     f"{skill_result.evals_skipped} skipped")
        if skill_result.errors:
            lines.append("  Errors:")
            for error in skill_result.errors:
                lines.append(f"    - {error}")
        for eval_result in skill_result.eval_results:
            if eval_result.status == EvalStatus.PASS:
                icon = "  [PASS]"
            elif eval_result.status == EvalStatus.SKIP:
                icon = "  [SKIP]"
            else:
                icon = "  [FAIL]"
            lines.append(f"    {icon} Eval #{eval_result.eval_id}: {eval_result.message}")
            if eval_result.details:
                for detail in eval_result.details:
                    lines.append(f"            - {detail}")
    lines.append("")
    lines.append("=" * 70)
    return "\n".join(lines)


def generate_json_report(report: EvalReport) -> str:
    """Generate a JSON report."""
    data = {
        "summary": {
            "total_skills": report.total_skills,
            "skills_passed": report.skills_passed,
            "skills_failed": report.skills_failed,
            "total_evals": report.total_evals,
            "evals_passed": report.evals_passed,
            "evals_failed": report.evals_failed,
            "evals_skipped": report.evals_skipped,
            "overall_status": "PASS" if report.skills_failed == 0 else "FAIL"
        },
        "skills": [
            {
                "name": sr.skill_name,
                "path": str(sr.skill_path),
                "status": sr.status.value,
                "evals_run": sr.evals_run,
                "evals_passed": sr.evals_passed,
                "evals_failed": sr.evals_failed,
                "evals_skipped": sr.evals_skipped,
                "errors": sr.errors,
                "evals": [
                    {
                        "id": er.eval_id,
                        "status": er.status.value,
                        "message": er.message,
                        "details": er.details,
                        "duration_ms": er.duration_ms
                    }
                    for er in sr.eval_results
                ]
            }
            for sr in report.skill_results
        ]
    }
    return json.dumps(data, indent=2)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Automated evaluation runner framework for skills",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run all evaluations
  %(prog)s

  # Run evaluations for a specific skill
  %(prog)s --skill skill-evaluator

  # Run with verbose output
  %(prog)s --verbose

  # Output JSON format
  %(prog)s --format json

  # Only run structure checks
  %(prog)s --type structure
        """
    )
    parser.add_argument("--skill", help="Run evaluations for a specific skill only")
    parser.add_argument("--path", default=".agents/skills",
                        help="Path to skills directory (default: .agents/skills)")
    parser.add_argument("--type", choices=[t.value for t in EvalType], action="append",
                        help="Type of evaluation to run (can be specified multiple times)")
    parser.add_argument("--format", choices=["text", "json"], default="text",
                        help="Output format (default: text)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose output")
    parser.add_argument("--output", "-o",
                        help="Write report to file instead of stdout")
    args = parser.parse_args()
    skills_dir = Path(args.path)
    if not skills_dir.is_absolute():
        skills_dir = Path.cwd() / skills_dir
    if not skills_dir.is_dir():
        print(f"Error: Skills directory not found: {skills_dir}", file=sys.stderr)
        return 1
    if args.type:
        eval_types = [EvalType(t) for t in args.type]
    else:
        eval_types = list(EvalType)
    if args.verbose:
        print(f"Discovering skills in: {skills_dir}", file=sys.stderr)
    skill_paths = discover_skills(skills_dir, args.skill)
    if not skill_paths:
        if args.skill:
            print(f"Error: Skill '{args.skill}' not found or has no evals.json",
                  file=sys.stderr)
        else:
            print(f"Error: No skills with evals.json found in {skills_dir}",
                  file=sys.stderr)
        return 1
    if args.verbose:
        print(f"Found {len(skill_paths)} skill(s) with evals", file=sys.stderr)
    report = EvalReport()
    report.total_skills = len(skill_paths)
    for i, skill_path in enumerate(skill_paths, start=1):
        if args.verbose:
            print(f"[{i}/{len(skill_paths)}] Evaluating: {skill_path.name}",
                  file=sys.stderr)
        skill_result = evaluate_skill(skill_path, eval_types, args.verbose)
        report.skill_results.append(skill_result)
        report.total_evals += skill_result.evals_run
        report.evals_passed += skill_result.evals_passed
        report.evals_failed += skill_result.evals_failed
        report.evals_skipped += skill_result.evals_skipped
        if skill_result.status == EvalStatus.PASS:
            report.skills_passed += 1
        else:
            report.skills_failed += 1
    if args.format == "json":
        output = generate_json_report(report)
    else:
        output = generate_text_report(report)
    if args.output:
        output_path = Path(args.output)
        output_path.write_text(output, encoding="utf-8")
        print(f"Report written to: {output_path}", file=sys.stderr)
    else:
        print(output)
    return 0 if report.skills_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
