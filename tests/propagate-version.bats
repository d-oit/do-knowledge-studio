#!/usr/bin/env bash
# tests/propagate-version.bats — BATS tests for scripts/propagate-version.sh
#
# Covers: version propagation to VERSION.md / MIGRATION.md / README badge,
# missing VERSION file, invalid version format, and REPO_ROOT override.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/propagate-version.sh"
  export WORK="$BATS_TEST_TMPDIR/workspace"
  mkdir -p "$WORK/agents-docs"
}

# Write a workspace with the given version and standard derived files.
# $1 = workspace root, $2 = version (default 0.1.1)
seed_workspace() {
  local root="${1:-$WORK}"
  local version="${2:-0.1.1}"
  printf '%s\n' "$version" > "$root/VERSION"
  cat > "$root/agents-docs/VERSION.md" <<'EOF'
1. **Maintainer only**: Edit `VERSION` file directly (the current version is `0.1.0`)
| `VERSION` | `0.1.0` | Manual edit (maintainer) |
EOF
  cat > "$root/agents-docs/MIGRATION.md" <<'EOF'
[![Template Version](https://img.shields.io/badge/version-0.1.0-blue)](VERSION)
Template version: 0.1.0
EOF
}

@test "propagates version to VERSION.md and MIGRATION.md" {
  seed_workspace "$WORK" "0.2.3"
  run env REPO_ROOT="$WORK" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"propagated version 0.2.3"* ]]

  grep -q "the current version is \`0.2.3\`" "$WORK/agents-docs/VERSION.md"
  grep -q '| `VERSION` | `0.2.3` |' "$WORK/agents-docs/VERSION.md"
  grep -q "version-0.2.3-blue" "$WORK/agents-docs/MIGRATION.md"
  grep -q "Template version: 0.2.3" "$WORK/agents-docs/MIGRATION.md"
}

@test "updates the README badge when present" {
  seed_workspace "$WORK" "0.1.1"
  cat > "$WORK/README.md" <<'EOF'
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](VERSION)
EOF
  run env REPO_ROOT="$WORK" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  grep -q "version-0.1.1-blue" "$WORK/README.md"
}

@test "leaves README untouched when no badge exists" {
  seed_workspace "$WORK" "0.1.1"
  printf 'no badge here\n' > "$WORK/README.md"
  run env REPO_ROOT="$WORK" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  grep -q "no badge here" "$WORK/README.md"
}

@test "fails when VERSION file is missing" {
  run env REPO_ROOT="$WORK" bash "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"VERSION file not found"* ]]
}

@test "fails on invalid version format" {
  printf 'not-a-version\n' > "$WORK/VERSION"
  run env REPO_ROOT="$WORK" bash "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"invalid version"* ]]
}

@test "rejects versions containing sed metacharacters" {
  # VERSION is embedded in sed expressions, so the format validation must
  # reject any value that could break out of the s/// expression or inject
  # replacement metacharacters (&, \\, /).
  for bad in '1.2.3&x' '1.2/3' '1.2.3;true' '2.0.0\\evil'; do
    printf '%s\n' "$bad" > "$WORK/VERSION"
    run env REPO_ROOT="$WORK" bash "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *"invalid version"* ]]
  done
}
