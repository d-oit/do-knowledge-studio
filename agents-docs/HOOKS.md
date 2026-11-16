# Agent Hooks

`scripts/agent-guard.sh` enforces the hard AGENTS.md rules mechanically, so a
session that never loads the right paragraph is still stopped before it:

- edits to `biome.json`, `eslint.config.*`, `.eslintrc*`, or any new
  lint-suppression comment (`eslint-disable`, `biome-ignore`, …);
- `gh release create`, `gh pr merge --admin`, pushing to `main`;
- `npm`/`yarn` installs (pnpm only);
- new `tmp-*`/`debug-*`/`analyze-*`/`notes-*` files in the repository root.

## Registration

`.claude/settings.json` wires the guard as a `PreToolUse` hook for
`Write|Edit|Bash`. `agent-surface.py validate` fails when the settings file
and the guard script disagree (missing hook entry, missing script, or the
script not being executable).

## Human override

The maintainer is never blocked: set `DKS_AGENT_GUARD_OFF=1` for the session
to bypass the guard. The bypass is per-process and explicit — never commit
it, never put it in a shell profile.

## The `.example` files

`.claude/hooks/*.example` are kept as documentation for other surfaces. They
add nothing the guard does not already enforce on Claude Code; remove one
only when its surface gains a native hook that calls `agent-guard.sh`.
