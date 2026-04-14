#!/usr/bin/env bash
# Evaluates skill quality by running check_structure.py against .agents/skills.
# Validates eval coverage, frontmatter fields, and directory structure.
# Exit 0 = all pass, Exit 1 = needs work.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/.agents/skills"
EVAL_SCRIPT="$SKILLS_DIR/skill-evaluator/scripts/check_structure.py"

echo "=== Evaluating Skills (agentskills.io spec) ==="
echo ""

if [ ! -f "$EVAL_SCRIPT" ]; then
  echo "ERROR: check_structure.py not found at $EVAL_SCRIPT"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 required but not found in PATH"
  exit 1
fi

# Run the structure/eval checker
python3 "$EVAL_SCRIPT" --path "$SKILLS_DIR"

# Additional checks
echo ""
echo "=== Additional Validations ==="
echo ""

FAILED=0

# Check that evals use expected_output (not should_trigger)
for eval_file in "$SKILLS_DIR"/*/evals/evals.json; do
  [ -f "$eval_file" ] || continue
  skill_name=$(basename "$(dirname "$eval_file")")

  if grep -q '"should_trigger"' "$eval_file"; then
    echo " [FAIL] $skill_name: evals use 'expected_output' not 'should_trigger'"
    FAILED=1
  fi

  if ! grep -q '"expected_output"' "$eval_file"; then
    echo " [FAIL] $skill_name: evals missing 'expected_output' field"
    FAILED=1
  fi

  # Verify required eval fields
  for field in id prompt expected_output assertions; do
    if ! grep -q "\"$field\"" "$eval_file"; then
      echo " [FAIL] $skill_name: evals missing '$field' field"
      FAILED=1
    fi
  done

  # Verify files is a string array, not object array
  if grep -q '"path"' "$eval_file" 2>/dev/null; then
    echo " [FAIL] $skill_name: evals 'files' must be string array of paths, not objects with 'path'/'content'"
    FAILED=1
  fi
done

# Check no SKILL.md has should_trigger references
for skill_md in "$SKILLS_DIR"/*/SKILL.md; do
  [ -f "$skill_md" ] || continue
  skill_name=$(basename "$(dirname "$skill_md")")
  if grep -q 'should_trigger' "$skill_md"; then
    echo " [FAIL] $skill_name: SKILL.md references non-existent 'should_trigger'"
    FAILED=1
  fi
done

echo ""
if [ $FAILED -eq 0 ]; then
  echo "All eval checks passed"
  exit 0
else
  echo "Some checks failed -- fix and re-run"
  exit 1
fi
