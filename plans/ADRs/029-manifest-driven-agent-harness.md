# ADR 029 — Manifest-Driven Agent Harness and Skill Validation

**Date**: 2026-07-19  
**Status**: Implemented  
**Related**: Plan 071

## Context

Canonical skills live in `.agents/skills`, while `.agents/manifest.json`
declares the client surfaces intended to consume them. Current setup and
validation do not implement that model:

- setup handles only part of the declared client set;
- validation does not read the manifest;
- broken symlinks can pass validation;
- frontmatter, skill directory/name agreement, eval JSON, and configured target
  surfaces are not checked;
- agent docs advertise commands that the harness script does not implement;
- project-specific skills can contradict root architecture rules.

The result is a green harness check that does not prove skills are discoverable
or valid.

## Decision

### 1. `.agents/manifest.json` is the executable source of truth

The manifest defines:

- canonical skills directory;
- supported client surfaces and their target paths;
- link/copy strategy per surface;
- required skill metadata fields;
- eval schema version and optionality policy;
- exclusions for clients or skills that cannot be synchronized.

Setup, validation, and generated documentation read the same manifest. Client
surfaces absent from the manifest are not claimed as supported.

### 2. Setup is idempotent and non-destructive

The setup command regenerates only declared outputs and creates missing managed
links. Re-running setup on a valid checkout produces no diff. Existing matching
links are left intact; broken or mismatched links and conflicting files produce
an actionable failure rather than silently replacing paths that may contain
user-managed content.

### 3. Validation proves usability, not file presence

Validation fails on:

- broken symlinks;
- missing canonical skills or declared target surfaces;
- invalid or missing required YAML frontmatter;
- skill `name` mismatch with its canonical directory;
- malformed eval JSON or unsupported eval schema;
- broken repository-relative links in skill content;
- duplicate canonical names;
- unmanaged drift in generated surfaces;
- project-specific architecture requirements that contradict designated root
  constraints, where a policy fixture exists.

The validator returns non-zero on every error and provides stable, concise
diagnostics suitable for CI.

### 4. The manifest owns generated surfaces; focused generators own output formats

The agent-surface tool exposes only commands it implements:

- `sync` creates or repairs manifest-managed skill links, generated root
  instruction files, and the generated skill-labeler block;
- `validate` checks canonical and target conformance, including generated-surface
  drift.

`scripts/generate-skills-docs.py` renders the skill catalogs and is invoked by
`scripts/setup-skills.sh`; it is not an `agent-surface.py` subcommand.
Documentation must not advertise nonexistent commands such as `generate-docs`.
Root tool instructions contain the canonical `AGENTS.md` text plus only their
declared tool-specific addendum, so supported clients receive the same shared
constraints without depending on client-specific import syntax.

### 5. Skill routing boundaries are explicit

Overlapping workflow skills must state precedence and non-goals in their
descriptions. Project-specific skills inherit root architecture constraints and
must not prescribe SQLite, a backend, or undefined logging/error abstractions
unless an accepted project ADR introduces them.

### 6. Client-specific skill-link scopes are explicit

Claude Code, Gemini CLI, and Qwen Code use relative symlinks for each canonical
skill inside their existing skills directories. Cursor and Windsurf use a
relative directory symlink to `.agents/skills`. The manifest names these scopes
as `relative-entries` and `relative-directory`; sync and validation implement
both explicitly. Copy synchronization is rejected because it creates a second
mutable skill tree.

## Consequences

### Positive

- A passing harness gate means declared agent clients can discover valid skills.
- Setup and validation cannot silently diverge.
- Adding a skill or client requires one manifest change plus tests.
- Generated catalogs reduce root-instruction size and documentation drift.
- Negative fixtures make the quality gate resistant to false green results.

### Negative

- The manifest schema and validator become maintained infrastructure.
- Client-specific link behavior requires fixture coverage across platforms.
- Existing unmanaged surfaces must be classified before synchronization.
- Some overlapping skills may need consolidation or clearer routing metadata.

## Alternatives Considered

1. **Keep ad hoc shell setup scripts.** Rejected: setup and validation continue
   to encode different supported surfaces.
2. **Validate only canonical `SKILL.md` files.** Rejected: it does not prove
   discoverability from any client.
3. **Copy all skills into every client directory.** Rejected: duplication makes
   drift likely and obscures canonical ownership.
4. **Remove all client surfaces except `.agents`.** Viable but rejected for now
   because the repository intentionally advertises multiple agent clients. If
   portability is no longer a goal, narrowing the manifest is preferred over
   pretending broader support.

## Implementation Requirements

- Define and validate a versioned manifest schema.
- Add fixture-based tests for each failure condition.
- Repair the two current broken skill symlinks through the managed setup path.
- Align `.claude`, `.gemini`, `.qwen`, `.cursor`, `.windsurf`, `.opencode`, and
  `.jules` claims with actual manifest support.
- Validate eval files where present and define which skills may omit them.
- Generate or verify repository-relative command references in agent docs.
- Generate and validate root tool instructions from `AGENTS.md` and declared
  addenda; generate skill-labeler globs from the manifest.
- Keep root `AGENTS.md` focused on universal constraints and link to generated
  detail.

## Verification

- A clean checkout can run sync then validate with no diff on a second run.
- A deliberately broken symlink fails validation.
- Invalid frontmatter, name mismatch, malformed eval JSON, missing target, and
  broken link fixtures each fail with a stable diagnostic.
- Every supported client resolves each intended skill to the canonical content.
- Removing a manifest entry removes only managed artifacts.
- CI invokes validation and cannot pass when a negative fixture is introduced
  into the real surface.
