## LESSON-063: Codacy `security_detect-non-literal-fs-filename` is syntactic — validated paths still flag

**Problem**: Eight `ESLint8_security_detect-non-literal-fs-filename` findings
fired on dev scripts whose job is reading caller-specified files
(`corpus-fingerprint`, `check-file-size`, `check-doc-consistency`,
`check-lint-config-wiring`). All eight paths were fixed in code — NUL
rejection, extension allowlists (`.json`/`.sh`), repo-root anchoring with
containment checks, and an `agents-docs/lessons/*.md` link allowlist —
and Codacy re-reported the identical eight findings at the new validated
lines. The rule fires on any non-literal first argument to an `fs` call
and does not recognize sanitization, so no code shape can satisfy it for
a tool that reads a path it was handed.

**Solution**: Fix the underlying concern in code (validate every path
before it reaches `fs`, as above), verify behavior is unchanged (bats +
direct runs + eslint), record the pass in `plans/`, and triage the
residual findings per-finding in the Codacy UI as false positives with
the validation as evidence. Do not broaden the fix into a config
suppression (`disable_rules` needs maintainer approval per AGENTS.md) and
do not merge while the check reports `action_required` (zero tolerance).

**Prevention**:
- When a finding survives a genuine code fix, re-read the rule: a
  syntactic rule on a tool's core input is a scanner limitation, not a
  defect. One reanalysis proving persistence is enough evidence — stop
  restructuring code to please the scanner.
- `resolve()` containment is lexical: a symlink inside the walk root still
  reads its outside target. Walk with
  `readdirSync(dir, { withFileTypes: true })` and skip
  `Dirent.isSymbolicLink()` (the Dirent also replaces the `statSync` call),
  and canonicalize before containment checks where a path comes from an
  index or listing (`realpathSync` + compare against the canonical root).
- NUL-byte rejection in Node CLIs is defense-in-depth (execve and
  `child_process` already refuse NUL in real argv); its value is turning
  a runtime `TypeError` into a clean failure, not exploit prevention.
- Path validation that must accept fixture directories (`/tmp` in bats)
  cannot use repo-containment — use shape checks (NUL, extension,
  traversal segments) there, and containment only for repo-scoped walks.

**Files Modified**:
- `scripts/corpus-fingerprint.mjs` - argv path validation (NUL, `.json`, normalize + resolve)
- `scripts/check-lint-config-wiring.mjs` - argv target validation (NUL, `.sh`, normalize + resolve)
- `scripts/check-file-size.mjs` - repo-root anchoring, entry + containment checks
- `scripts/check-doc-consistency.mjs` - lesson-link and citing-file allowlists with containment
