#!/usr/bin/env bash
# GitHub Actions workflow hygiene gate (Issue #1140).
#
# A check that cannot fail is worse than none (LESSON-046/047). This gate makes
# three workflow rules enforceable instead of prose:
#
#   1. Every `continue-on-error: true` carries an adjacent
#      `# allow-continue-on-error: <reason>` comment, so a deliberate bypass is
#      distinguishable from a forgotten one.
#   2. Every workflow triggered by `push`, `pull_request` or
#      `pull_request_target` declares a `concurrency` group, so repeated pushes
#      do not queue redundant runs (LESSON-048/049).
#   3. Every workflow declares top-level `permissions` (least privilege).
#
# Usage: ./scripts/check-workflow-hygiene.sh [workflowDir]
# Exit 0 when clean; non-zero with one line per violation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
WORKFLOW_DIR="${1:-$REPO_ROOT/.github/workflows}"
ALLOW_MARKER='# allow-continue-on-error:'

problems=0
checked=0

fail() {
  echo "$1" >&2
  problems=$((problems + 1))
}

# Prints the trigger names under `on:`, one per line. Handles the block form
# (`on:` then indented keys) and the inline forms (`on: push`,
# `on: [push, pull_request]`).
triggers_of() {
  awk '
    /^"?on"?:/ {
      line = $0
      sub(/^"?on"?:[[:space:]]*/, "", line)
      if (line != "") {
        gsub(/[][,]/, " ", line)
        print line
        exit
      }
      in_on = 1
      next
    }
    in_on {
      if ($0 ~ /^[^[:space:]]/) exit
      if ($0 ~ /^[[:space:]]{2}[A-Za-z_]+:/) {
        key = $0
        sub(/^[[:space:]]+/, "", key)
        sub(/:.*/, "", key)
        print key
      }
    }
  ' "$1"
}

for file in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
  [ -f "$file" ] || continue
  checked=$((checked + 1))
  rel="${file#"$REPO_ROOT"/}"

  if ! grep -q '^permissions:' "$file"; then
    fail "$rel: missing top-level permissions"
  fi

  triggers="$(triggers_of "$file")"
  needs_concurrency=0
  for trigger in push pull_request pull_request_target; do
    if printf '%s\n' "$triggers" | grep -qx "$trigger"; then
      needs_concurrency=1
    fi
  done

  if [ "$needs_concurrency" -eq 1 ]; then
    if ! grep -q '^concurrency:' "$file"; then
      fail "$rel: triggered by push/pull_request but declares no concurrency group"
    elif ! grep -q '^[[:space:]]\+group:' "$file"; then
      fail "$rel: concurrency block has no group"
    fi
  fi

  while IFS=: read -r lineno _rest; do
    [ -n "$lineno" ] || continue
    if sed -n "${lineno}p" "$file" | grep -qF "$ALLOW_MARKER"; then
      continue
    fi
    previous=$((lineno - 1))
    if [ "$previous" -ge 1 ] && sed -n "${previous}p" "$file" | grep -qF "$ALLOW_MARKER"; then
      continue
    fi
    fail "$rel:$lineno: continue-on-error: true needs an adjacent '$ALLOW_MARKER <reason>' comment"
  done < <(grep -n '^[[:space:]]*continue-on-error:[[:space:]]*true' "$file" || true)
done

if [ "$problems" -gt 0 ]; then
  echo "" >&2
  echo "check-workflow-hygiene: $problems violation(s)" >&2
  exit 1
fi

echo "check-workflow-hygiene: $checked workflow(s) clean"
