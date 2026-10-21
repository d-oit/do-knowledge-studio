#!/usr/bin/env bash
# tests/do-harness-path-selection.bats — BATS tests for do-harness.toml path selection
#
# Verifies:
# - do-harness.toml validity and generic language declaration
# - Sensor completeness (feedback, verification, offline, schema/data, release)
# - Canonical command alignment with package.json and repository scripts
# - Path selection for normal UI, offline-critical, schema/migration, config, and docs changes
# - Alignment between do-harness.toml offline paths and CI workflow path filters

bats_require_minimum_version 1.5.0

setup() {
  export REPO_ROOT="$BATS_TEST_DIRNAME/.."
  export HARNESS_TOML="$REPO_ROOT/do-harness.toml"
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
import tomllib, json, re
from pathlib import Path

with open("package.json", "r") as f:
    pkg = json.load(f)
scripts = pkg.get("scripts", {})

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

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

@test "path selection classifies normal UI changes correctly" {
  run python3 -c '
import tomllib, fnmatch
from pathlib import Path

def matches_pattern(file_path: str, pattern: str) -> bool:
    file_path = file_path.lstrip("./")
    pattern = pattern.lstrip("./")
    if pattern.endswith("/**"):
        base = pattern[:-3]
        return file_path == base or file_path.startswith(base + "/")
    elif "/**/" in pattern:
        prefix, suffix = pattern.split("/**/", 1)
        return file_path.startswith(prefix + "/") and fnmatch.fnmatch(file_path[len(prefix)+1:], f"*{suffix}")
    elif pattern.startswith("**"):
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern[2:].lstrip("/"))
    elif "*" in pattern:
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern)
    else:
        return file_path == pattern

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

file_path = "src/components/studio/editor-view.tsx"
matched = [s for s, data in sensors.items() if any(matches_pattern(file_path, p) for p in data.get("paths", []))]

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
import tomllib, fnmatch
from pathlib import Path

def matches_pattern(file_path: str, pattern: str) -> bool:
    file_path = file_path.lstrip("./")
    pattern = pattern.lstrip("./")
    if pattern.endswith("/**"):
        base = pattern[:-3]
        return file_path == base or file_path.startswith(base + "/")
    elif "/**/" in pattern:
        prefix, suffix = pattern.split("/**/", 1)
        return file_path.startswith(prefix + "/") and fnmatch.fnmatch(file_path[len(prefix)+1:], f"*{suffix}")
    elif pattern.startswith("**"):
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern[2:].lstrip("/"))
    elif "*" in pattern:
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern)
    else:
        return file_path == pattern

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

offline_files = [
    "public/sw.js",
    "src/components/studio/offline-indicator.tsx",
    "e2e/offline-views.spec.ts"
]

for file_path in offline_files:
    matched = [s for s, data in sensors.items() if any(matches_pattern(file_path, p) for p in data.get("paths", []))]
    assert "offline" in matched, f"Expected offline sensor for {file_path}"

print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "path selection classifies schema and migration changes correctly" {
  run python3 -c '
import tomllib, fnmatch
from pathlib import Path

def matches_pattern(file_path: str, pattern: str) -> bool:
    file_path = file_path.lstrip("./")
    pattern = pattern.lstrip("./")
    if pattern.endswith("/**"):
        base = pattern[:-3]
        return file_path == base or file_path.startswith(base + "/")
    elif "/**/" in pattern:
        prefix, suffix = pattern.split("/**/", 1)
        return file_path.startswith(prefix + "/") and fnmatch.fnmatch(file_path[len(prefix)+1:], f"*{suffix}")
    elif pattern.startswith("**"):
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern[2:].lstrip("/"))
    elif "*" in pattern:
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern)
    else:
        return file_path == pattern

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

schema_files = [
    "src/lib/studio/schema.ts",
    "src/lib/studio/migrations.ts",
    "src/lib/sync/bridge.ts"
]

for file_path in schema_files:
    matched = [s for s, data in sensors.items() if any(matches_pattern(file_path, p) for p in data.get("paths", []))]
    assert "schema/data" in matched, f"Expected schema/data sensor for {file_path}"
    assert "offline" not in matched, f"Unexpected offline sensor for {file_path}"

print("OK")
'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "path selection skips code sensors for docs-only changes" {
  run python3 -c '
import tomllib, fnmatch
from pathlib import Path

def matches_pattern(file_path: str, pattern: str) -> bool:
    file_path = file_path.lstrip("./")
    pattern = pattern.lstrip("./")
    if pattern.endswith("/**"):
        base = pattern[:-3]
        return file_path == base or file_path.startswith(base + "/")
    elif "/**/" in pattern:
        prefix, suffix = pattern.split("/**/", 1)
        return file_path.startswith(prefix + "/") and fnmatch.fnmatch(file_path[len(prefix)+1:], f"*{suffix}")
    elif pattern.startswith("**"):
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern[2:].lstrip("/"))
    elif "*" in pattern:
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern)
    else:
        return file_path == pattern

with open("do-harness.toml", "rb") as f:
    sensors = tomllib.load(f).get("sensors", {})

file_path = "docs/README.md"
matched = [s for s, data in sensors.items() if any(matches_pattern(file_path, p) for p in data.get("paths", []))]

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
import tomllib, re
from pathlib import Path

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
