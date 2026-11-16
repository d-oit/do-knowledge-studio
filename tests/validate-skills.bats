#!/usr/bin/env bash
# tests/validate-skills.bats — BATS tests for scripts/validate-skills.sh
#
# Covers: delegation to agent-surface.py, REPO_ROOT override, and
# missing Python handling.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/validate-skills.sh"
  export WORK="$BATS_TEST_TMPDIR/workspace"
  mkdir -p "$WORK"
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

run_validate() {
  local root="${1:-$WORK}"
  run env REPO_ROOT="$root" bash "$SCRIPT"
}

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@test "delegates to agent-surface.py" {
  # Create a mock agent-surface.py that just echoes its args
  mkdir -p "$WORK/scripts"
  printf '#!/usr/bin/env bash\necho "called: $*"\n' > "$WORK/scripts/agent-surface.py"
  chmod +x "$WORK/scripts/agent-surface.py"

  run_validate "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"called: validate"* ]]
}

@test "exits non-zero when agent-surface.py fails" {
  mkdir -p "$WORK/scripts"
  printf '#!/usr/bin/env bash\nexit 1\n' > "$WORK/scripts/agent-surface.py"
  chmod +x "$WORK/scripts/agent-surface.py"

  run_validate "$WORK"
  [ "$status" -eq 1 ]
}

@test "prints validation message" {
  mkdir -p "$WORK/scripts"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$WORK/scripts/agent-surface.py"
  chmod +x "$WORK/scripts/agent-surface.py"

  run_validate "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Validating skills"* ]]
}

@test "uses REPO_ROOT override for script location" {
  mkdir -p "$WORK/scripts"
  printf '#!/usr/bin/env bash\necho "REPO=$REPO_ROOT"\n' > "$WORK/scripts/agent-surface.py"
  chmod +x "$WORK/scripts/agent-surface.py"

  run_validate "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"REPO=$WORK"* ]]
}

@test "rejects block-scalar and over-long descriptions (fixture, #1150)" {
  local root="$BATS_TEST_TMPDIR/desc-fixture"
  mkdir -p "$root/.agents/skills/folded" "$root/.agents/skills/toolong" "$root/.agents/skills/fine"
  printf -- '---\nname: folded\ndescription: >\n  Folded text here.\n---\n' > "$root/.agents/skills/folded/SKILL.md"
  python3 -c "print('---\nname: toolong\ndescription: \"' + 'x' * 301 + '\"\n---\n')" > "$root/.agents/skills/toolong/SKILL.md"
  printf -- '---\nname: fine\ndescription: "Short and fine."\n---\n' > "$root/.agents/skills/fine/SKILL.md"

  run python3 - "$root" <<'PYEOF'
import importlib.util
import sys
from pathlib import Path
sys.path.insert(0, "scripts")
spec = importlib.util.spec_from_file_location("agent_surface", "scripts/agent-surface.py")
agent_surface = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent_surface)
validate_skill_frontmatter = agent_surface.validate_skill_frontmatter
errors = validate_skill_frontmatter(Path(sys.argv[1]))
print("\n".join(errors))
assert any("block scalar" in e for e in errors), "folded description not flagged"
assert any("300-char budget" in e for e in errors), "long description not flagged"
assert not any("/fine/" in e for e in errors), "valid skill flagged"
print("DESCRIPTION_RULES_OK")
PYEOF
  [ "$status" -eq 0 ]
  [[ "$output" == *"DESCRIPTION_RULES_OK"* ]]
}

@test "flags dead script refs, passes marked examples and local scripts (fixture, #1148)" {
  local root="$BATS_TEST_TMPDIR/deadref-fixture"
  rm -rf "$root"
  mkdir -p "$root/.agents/skills/demo/scripts" "$root/.agents/skills/demo/references" "$root/scripts"
  touch "$root/.agents/skills/demo/scripts/real.sh"
  touch "$root/.agents/skills/demo/references/guide.md"
  touch "$root/scripts/real-root.sh"
  cat > "$root/.agents/skills/demo/SKILL.md" <<'EOF'
---
name: demo
description: "Demo skill."
---

Run `scripts/missing.sh` now.

Run `scripts/real.sh` and `scripts/real-root.sh` too.

See `references/guide.md` and `references/nope.md`.

```bash
# example - not in this repo
run bash scripts/illustrative.sh
```

```bash example
run bash scripts/also-illustrative.sh
```
EOF

  run python3 - "$root" <<'PYEOF'
import importlib.util
import sys
from pathlib import Path
sys.path.insert(0, "scripts")
spec = importlib.util.spec_from_file_location("agent_surface", "scripts/agent-surface.py")
agent_surface = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent_surface)
errors = agent_surface.validate_dead_skill_refs(Path(sys.argv[1]))
for e in errors:
    print(e)
joined = "\n".join(errors)
assert any("scripts/missing.sh" in e for e in errors), "dead skill-local ref not flagged"
assert any("references/nope.md" in e for e in errors), "dead references/ ref not flagged"
assert not any("real.sh" in e for e in errors), "resolving ref flagged"
assert not any("guide.md" in e for e in errors), "resolving references/ flagged"
assert not any("illustrative" in e for e in errors), "marked example flagged"
print("DEADREF_RULES_OK")
PYEOF
  [ "$status" -eq 0 ]
  [[ "$output" == *"DEADREF_RULES_OK"* ]]
}

@test "no advertised skill uses a block-scalar description" {
  run grep -rn --include=SKILL.md -e '^description: *>' -e '^description: *|' .agents/skills/
  [ "$status" -ne 0 ]
}
