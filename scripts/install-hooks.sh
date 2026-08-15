#!/usr/bin/env bash
# Install git hooks for local development.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(dirname "$SCRIPT_DIR")}"
cd "$REPO_ROOT"

# Resolve the hooks dir via git so linked worktrees (where .git is a file,
# not a directory) point at the common hooks directory.
if command -v git &>/dev/null && git -C "$REPO_ROOT" rev-parse --git-dir &>/dev/null 2>&1; then
  GIT_HOOKS=$(git -C "$REPO_ROOT" rev-parse --git-path hooks 2>/dev/null)
  if [[ "$GIT_HOOKS" != /* ]]; then
    GIT_HOOKS="$REPO_ROOT/$GIT_HOOKS"
  fi
  HOOKS_DIR="$GIT_HOOKS"
else
  HOOKS_DIR="$REPO_ROOT/.git/hooks"
fi

if [ ! -d "$HOOKS_DIR" ]; then
  echo "Not a git repository — skipping hook installation."
  exit 0
fi

# Pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/usr/bin/env bash
# Run quality checks before commit.
echo "Running pre-commit quality gate..."
./scripts/minimal_quality_gate.sh
HOOK
chmod +x "$HOOKS_DIR/pre-commit"

# Commit-msg hook
cat > "$HOOKS_DIR/commit-msg" << 'HOOK'
#!/usr/bin/env bash
# Run commit message validation.
COMMIT_MSG_FILE="$1"

# Check header length
HEADER=$(head -n 1 "$COMMIT_MSG_FILE")
HEADER_LEN=${#HEADER}

if [ "$HEADER_LEN" -gt 120 ]; then
  echo "✖ Error: Commit message header is too long ($HEADER_LEN characters). Maximum is 120."
  echo "Commit header: $HEADER"
  exit 1
fi

# Check conventional commit prefix
if ! echo "$HEADER" | grep -Eq '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|ux)(\(.+\))?: '; then
  echo "✖ Error: Commit message does not match conventional commits format."
  echo "Expected format: type(scope): description (or type: description)"
  echo "Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, ux"
  echo "Commit header: $HEADER"
  exit 1
fi
HOOK
chmod +x "$HOOKS_DIR/commit-msg"

echo "Git hooks installed."
