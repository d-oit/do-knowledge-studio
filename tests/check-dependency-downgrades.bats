#!/usr/bin/env bats
# tests/check-dependency-downgrades.bats — BATS tests for the dependency-range guard.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/check-dependency-downgrades.mjs"
  export REPO="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$REPO"
  cd "$REPO" || return 1
  git init -q -b main .
  git config user.email "dependency-guard@example.com"
  git config user.name "Dependency Guard Test"
  git config commit.gpgsign false
  EXPECTED_GUARD_FAILURE_STATUS=1
  EXPECTED_SUCCESS_STATUS=0
  cat > package.json <<'JSON'
{
  "dependencies": {
    "next": "^16.3.8",
    "react": "^19.3.0",
    "@tanstack/react-virtual": "^3.14.13"
  },
  "devDependencies": {
    "typescript": "^6.0.0",
    "vitest": "^4.1.11"
  }
}
JSON
  git add package.json
  git commit -qm "base dependency ranges"
  git checkout -q -b feature
}

@test "rejects lower dependency and devDependency ranges" {
  cat > package.json <<'JSON'
{
  "dependencies": {
    "next": "^16.3.6",
    "react": "^19.3.0",
    "@tanstack/react-virtual": "^3.13.9"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "vitest": "^4.1.11"
  }
}
JSON
  git add package.json
  git commit -qm "lower dependency ranges"

  run node "$SCRIPT" main
  [ "$status" -eq "$EXPECTED_GUARD_FAILURE_STATUS" ]
  [[ "$output" == *"Dependency downgrade: next ^16.3.8 -> ^16.3.6"* ]]
  [[ "$output" == *"Dependency downgrade: @tanstack/react-virtual ^3.14.13 -> ^3.13.9"* ]]
  [[ "$output" == *"Dependency downgrade: typescript ^6.0.0 -> ^5.9.0"* ]]
}

@test "accepts upgrades and removed dependencies" {
  cat > package.json <<'JSON'
{
  "dependencies": {
    "next": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^6.0.1",
    "vitest": "^4.2.0",
    "semver": "^7.8.5"
  }
}
JSON
  git add package.json
  git commit -qm "raise dependency ranges"

  run node "$SCRIPT" main
  [ "$status" -eq "$EXPECTED_SUCCESS_STATUS" ]
  [[ "$output" == *"No dependency downgrades detected against main."* ]]
}

@test "fails closed when a changed range cannot be parsed as semver" {
  cat > package.json <<'JSON'
{
  "dependencies": {
    "next": "latest",
    "react": "^19.3.0"
  },
  "devDependencies": {
    "typescript": "^6.0.0",
    "vitest": "^4.1.11"
  }
}
JSON
  git add package.json
  git commit -qm "use an uncomparable range"

  run node "$SCRIPT" main
  [ "$status" -eq "$EXPECTED_GUARD_FAILURE_STATUS" ]
  [[ "$output" == *"Cannot compare next range"* ]]
  [[ "$output" == *"manual review required"* ]]
}
