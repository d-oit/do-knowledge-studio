#!/usr/bin/env bash
# Agent guard for hard AGENTS.md rules (#1144).
#
# Registered as a PreToolUse hook in .claude/settings.json. Reads the tool
# payload as JSON on stdin, exits 1 with a reason to block, 0 to allow.
# Matching is substring-based and dependency-free (no jq/python) so the
# hook runs on any machine; patterns err toward allowing reads and blocking
# writes/executions.
#
# Human override: DKS_AGENT_GUARD_OFF=1 (explicit, per-session, never stored).
set -uo pipefail

if [ "${DKS_AGENT_GUARD_OFF:-0}" = "1" ]; then
  echo "agent-guard: bypassed via DKS_AGENT_GUARD_OFF=1" >&2
  exit 0
fi

PAYLOAD="$(cat)"
TOOL=""
if [[ "$PAYLOAD" == *'"tool_name"'* ]]; then
  TOOL="$(printf '%s' "$PAYLOAD" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | cut -d'"' -f4)"
fi

block() {
  echo "agent-guard: DENIED: $1" >&2
  echo "agent-guard: this is a hard AGENTS.md rule; a human can override with DKS_AGENT_GUARD_OFF=1" >&2
  exit 1
}

is_write_tool() {
  case "$TOOL" in
    Write | Edit | ApplyPatch | create | apply_patch) return 0 ;;
  esac
  # Payloads without a tool name (unknown surface): inspect content anyway.
  [ -z "$TOOL" ] && return 0
  return 1
}

# --- 1. Protected config files: edits need explicit human approval ---------
if is_write_tool; then
  for protected in biome.json "eslint.config." .eslintrc biome.jsonc; do
    if [[ "$PAYLOAD" == *"$protected"* ]]; then
      block "edits to $protected require explicit human approval"
    fi
  done
  # New lint suppressions / ignore comments smuggled in via any write.
  for suppression in eslint-disable "biome-ignore" "deepsource-disable" "nosemgrep" "nolint"; do
    if [[ "$PAYLOAD" == *"$suppression"* ]]; then
      block "new '$suppression' suppression requires explicit human approval"
    fi
  done
fi

# --- 2. Irreversible VCS / release operations --------------------------------
if [[ "$PAYLOAD" == *'"command"'* ]] || [[ "$PAYLOAD" == *"gh "* ]] || [[ "$PAYLOAD" == *"git "* ]]; then
  if [[ "$PAYLOAD" == *"gh release create"* ]]; then
    block "'gh release create' is never autonomous (maintainer cuts releases)"
  fi
  if [[ "$PAYLOAD" == *"gh pr merge"* && "$PAYLOAD" == *"--admin"* ]]; then
    block "'gh pr merge --admin' is never allowed without explicit human approval"
  fi
  if [[ "$PAYLOAD" == *"git push"* && "$PAYLOAD" == *"main"* ]]; then
    block "pushing to main is not allowed (branch workflow only)"
  fi
fi

# --- 3. Package manager: pnpm only ------------------------------------------
if [[ "$PAYLOAD" == *'"command"'* ]]; then
  # Strip pnpm first: "pnpm install" contains "npm install" as a substring.
  NO_PNPM="${PAYLOAD//pnpm/}"
  if [[ "$NO_PNPM" == *"npm install"* || "$NO_PNPM" == *"npm i "* || "$NO_PNPM" == *"npm ci"* ]]; then
    block "npm is not used here (pnpm only, pnpm-lock v9)"
  fi
  if [[ "$PAYLOAD" == *"yarn add"* || "$PAYLOAD" == *"yarn install"* ]]; then
    block "yarn is not used here (pnpm only)"
  fi
fi

# --- 4. Root placement: no ad-hoc files in the repository root --------------
if is_write_tool; then
  for prefix in "tmp-" "debug-" "analyze-" "notes-"; do
    if [[ "$PAYLOAD" == *'"file_path"'* && "$PAYLOAD" == *"$prefix"* ]]; then
      # Only root-level paths violate the rule (nested plans/ files are fine).
      if printf '%s' "$PAYLOAD" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -q "\"$prefix"; then
        block "root '$prefix*' files violate placement rules (plans/ or /tmp instead)"
      fi
    fi
  done
fi

exit 0
