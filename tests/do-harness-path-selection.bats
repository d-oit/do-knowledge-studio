#!/usr/bin/env bash
# tests/do-harness-path-selection.bats — BATS tests for do-harness.toml path selection
#
# Verifies:
# - do-harness.toml validity and generic language declaration
# - Sensor completeness (feedback, verification, offline, schema/data, release)
# - Canonical command alignment with package.json and repository scripts
# - Path selection for normal UI, offline-critical, schema/migration, config, and docs changes
# - Alignment between do-harness.toml offline paths and CI workflow path filters
#
# The path-matching vocabulary lives in tests/helpers/do-harness-paths.py, so
# the matcher is defined once rather than copied into every test.

bats_require_minimum_version 1.5.0

setup() {
  export REPO_ROOT="$BATS_TEST_DIRNAME/.."
  export HARNESS_TOML="$REPO_ROOT/do-harness.toml"
  # The inline Python below opens repository files by relative path, so the
  # suite has to run from the repository root. Without this, `cd tests && bats
  # do-harness-path-selection.bats` fails with FileNotFoundError.
  cd "$REPO_ROOT" || return 1
}

@test "do-harness.toml exists and is valid TOML with generic language" {
  [ -f "$HARNESS_TOML" ]
  run python3 -c '
import tomllib
with open("do-harness.toml", "rb") as f:
    data = tomllib.load(f)
assert data.get("language") == "generic"
print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "do-harness.toml defines all required sensors" {
  run python3 -c '
import tomllib
with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

required = ["feedback", "verification", "offline", "schema/data", "release"]
for s in required:
    assert s in sensors, f"Missing sensor: {s}"
    assert "command" in sensors[s], f"Missing command in sensor {s}"
    assert "paths" in sensors[s], f"Missing paths in sensor {s}"
print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "do-harness.toml commands reference valid pnpm scripts or repository scripts" {
  run python3 -c '
import json
import re
import tomllib
from pathlib import Path

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

with open("package.json", "r") as f:
    scripts = json.load(f).get("scripts", {})

pnpm_run_pattern = re.compile(r"pnpm run ([a-zA-Z0-9:_-]+)")
script_file_pattern = re.compile(r"\./(scripts/[a-zA-Z0-9_.-]+\.sh)")

for name, sensor in sensors.items():
    cmd = sensor.get("command", "")
    assert cmd, f"Empty command for {name}"

    # Check pnpm run calls
    for match in pnpm_run_pattern.finditer(cmd):
        script_name = match.group(1)
        assert script_name in scripts, f"Sensor {name} references unknown pnpm script: {script_name}"

    # Check script file executions
    for match in script_file_pattern.finditer(cmd):
        script_path = match.group(1)
        assert Path(script_path).exists(), f"Sensor {name} references missing script file: {script_path}"

print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "every path a sensor claims also has a test the sensor command runs" {
  # A sensor that claims a path but whose command does not run that path's
  # tests verifies nothing for it: the path selection says "run this" and the
  # command then checks something else.
  run python3 -c '
import re
import tomllib

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

command = sensors["schema/data"]["command"]
assert "src/lib/okf/" in command, "schema/data claims src/lib/okf/** but does not run those tests"
for test_file in [
    "src/lib/studio/hydration-quarantine.test.ts",
    "src/lib/studio/seed-data.test.ts",
    "src/lib/studio/seed-state.test.ts",
]:
    assert test_file in command, f"schema/data does not run {test_file}"
print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "the verification sensor runs the BATS suite it claims in its paths" {
  # verification.paths includes tests/** and scripts/**, so its command has to
  # run the BATS suites: `pnpm run test` is vitest over src/ only.
  run python3 -c '
import tomllib

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

command = sensors["verification"]["command"]
assert "bats tests/" in command, "verification does not run the BATS suite it claims"
print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "the release sensor does not build twice" {
  # scripts/verify.sh already runs `pnpm run build`; a separate build in the
  # sensor command doubles the slowest step for no extra coverage.
  run python3 -c '
import tomllib

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

command = sensors["release"]["command"]
assert "pnpm run build" not in command, "release builds twice: verify.sh already runs the build"
assert "./scripts/verify.sh" in command
print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "path selection classifies normal UI changes correctly" {
  run python3 -c '
import sys
sys.path.insert(0, "tests/helpers")
from do_harness_paths import load_sensors, select_sensors

sensors = load_sensors()
matched = select_sensors(sensors, "src/components/studio/editor-view.tsx")

assert "feedback" in matched
assert "verification" in matched
assert "offline" not in matched
assert "schema/data" not in matched
print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "path selection classifies offline-critical changes correctly" {
  run python3 -c '
import sys
sys.path.insert(0, "tests/helpers")
from do_harness_paths import load_sensors, select_sensors

sensors = load_sensors()
offline_files = [
    "public/sw.js",
    "src/components/studio/offline-indicator.tsx",
    "e2e/offline-views.spec.ts"
]

for file_path in offline_files:
    matched = select_sensors(sensors, file_path)
    assert "offline" in matched, f"Expected offline sensor for {file_path}"

print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "path selection classifies schema and migration changes correctly" {
  run python3 -c '
import sys
sys.path.insert(0, "tests/helpers")
from do_harness_paths import load_sensors, select_sensors

sensors = load_sensors()
schema_files = [
    "src/lib/studio/schema.ts",
    "src/lib/studio/migrations.ts",
    "src/lib/sync/bridge.ts"
]

for file_path in schema_files:
    matched = select_sensors(sensors, file_path)
    assert "schema/data" in matched, f"Expected schema/data sensor for {file_path}"
    assert "offline" not in matched, f"Unexpected offline sensor for {file_path}"

print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "path selection skips code sensors for docs-only changes" {
  run python3 -c '
import sys
sys.path.insert(0, "tests/helpers")
from do_harness_paths import load_sensors, select_sensors

sensors = load_sensors()
matched = select_sensors(sensors, "docs/README.md")

assert "feedback" not in matched
assert "offline" not in matched
assert "schema/data" not in matched
print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "do-harness.toml offline paths align with CI workflow offline paths" {
  run python3 -c '
import re
import tomllib

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

offline_paths_harness = set(sensors.get("offline", {}).get("paths", []))

with open(".github/workflows/ci-and-labels.yml", "r") as f:
    content = f.read()

match = re.search(r"offline:\s*\n((?:\s+-\s*[\x27\"][^\x27\"]+[\x27\"]\s*\n)+)", content)
assert match, "Could not find offline block in CI workflow"
lines = match.group(1).strip().splitlines()
ci_offline_paths = set(line.strip().lstrip("-").strip().strip("\x27\"") for line in lines)

assert offline_paths_harness == ci_offline_paths, f"Offline paths mismatch:\nHarness: {offline_paths_harness}\nCI: {ci_offline_paths}"
print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}
