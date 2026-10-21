#!/usr/bin/env python3
"""Path-matching helpers for the do-harness sensor map.

Used by tests/do-harness-path-selection.bats. The BATS suite is a shell file,
so this lives beside the other test helpers rather than in a package.

Provides:
  - matches_pattern(file_path, pattern): whether a repository path matches a
    sensor path pattern.
  - select_sensors(sensors, file_path): the sensor names whose path list
    matches the given file.

The pattern vocabulary is the one the sensor map uses:
  "src/**"          a directory and everything below it
  "src/**/foo.ts"   foo.ts directly under src, at any depth
  "**/foo.ts"       foo.ts at any depth
  "src/*foo.ts"     fnmatch-style, on the whole path or the basename
  "src/foo.ts"      an exact path
"""

import fnmatch
import tomllib
from pathlib import Path


def matches_pattern(file_path: str, pattern: str) -> bool:
    """Whether `file_path` matches a sensor `pattern`."""
    file_path = file_path.lstrip("./")
    pattern = pattern.lstrip("./")
    if pattern.endswith("/**"):
        base = pattern[:-3]
        return file_path == base or file_path.startswith(base + "/")
    if "/**/" in pattern:
        prefix, suffix = pattern.split("/**/", 1)
        return file_path.startswith(prefix + "/") and fnmatch.fnmatch(
            file_path[len(prefix) + 1 :], f"*{suffix}"
        )
    if pattern.startswith("**"):
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(
            Path(file_path).name, pattern[2:].lstrip("/")
        )
    if "*" in pattern:
        return fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(
            Path(file_path).name, pattern
        )
    return file_path == pattern


def load_sensors(harness_path: str = "do-harness.toml") -> dict:
    """Read the sensor map from `harness_path`."""
    with open(harness_path, "rb") as handle:
        return tomllib.load(handle).get("sensors", {})


def select_sensors(sensors: dict, file_path: str) -> list:
    """The names of the sensors whose paths match `file_path`."""
    return [
        name
        for name, data in sensors.items()
        if any(matches_pattern(file_path, pattern) for pattern in data.get("paths", []))
    ]
