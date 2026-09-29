# Agentic Delivery Lifecycle

> Detailed procedure referenced by AGENTS.md. Keep the stage table there; keep
> the mechanics here (progressive disclosure — `MAX_LINES_AGENTS_MD=250`).

## Core Principle

**A change is not done when it builds. It is done when it survives contact with
production.** The stages below exist to force evidence at each boundary rather
than trusting that a green local run predicts a green deploy.

The loop is:

```
production → failure → reproduce → candidate fix → evaluate → adversarial
→ shadow → canary → promote | rollback
```

**Failure is the input, not the exception.** A production incident is the
highest-quality task this repo ever receives: it comes with a real
reproduction, a real user impact, and a real "still broken?" oracle.

## Stage Contract

Every stage has an exit criterion that can be falsified. "Looks good" is not a
criterion.

| # | Stage | Exit criterion | Enforced by |
|---|-------|----------------|--------------|
| 0 | Production | A real user or a monitor hit a defect | issue, CI, Vercel log |
| 1 | Reproduce | A test fails for the *stated* reason before any fix | `pnpm test` red |
| 2 | Candidate fix | Test green; diff scoped to the defect | `git diff` review |
| 3 | Evaluate | `lint` + `typecheck` + `test` + `build` all clean | `./scripts/verify.sh` |
| 3b | Verify | Every claim re-checked against live code; every new test seen failing once | `verify-before-asserting` skill |
| 4 | Adversarial | Someone tried to break it and failed | `code-review-assistant` |
| 5 | Shadow | New path runs beside the old one, emits, changes nothing | feature flag (see below) |
| 6 | Canary | New path serves a small slice with a clean rollback | feature flag + `pnpm run build` |
| 7 | Promote | 100% rollout, then the flag is deleted | `gh pr merge` |
| 7' | Rollback | Flag off ⇒ previous behavior returns immediately | feature flag |

## Stage Details

### 0 → 1 · Production failure → Reproduce

**Never fix a bug you cannot make fail on demand.** A fix for a bug you
could not reproduce is a guess with a commit attached.

1. Capture the exact symptom. Check `agents-docs/TROUBLESHOOTING.md` and
   `agents-docs/LESSONS.md` first — this repo has hit several of these before.
2. Write a failing test that fails for the *stated* reason. Read the assertion
   message: "expected `[]` but got `['stays']`" is a reproduction; "expected
   true but got false" three lines later is not.
3. If the test passes, you have not found the bug yet. Do not proceed to stage 2.

Prefer a throwaway script when the defect is only observable through a running
app (`/tmp`, never the repo root — see AGENTS.md File Placement Rules). Keep a
permanent test only when it would catch a plausible consumer-visible bug.

### 1 → 2 · Reproduce → Candidate fix

- Fix the cause, not the symptom. If the same class of bug could recur
  elsewhere, the fix is incomplete.
- **No scope creep.** Do not add retries, validation, telemetry, or
  abstractions "while you are in there." That is a separate change.
- Match the existing pattern. Reuse an abstraction before introducing one.

### The verification gate (before Evaluate)

Unit tests are not enough, and this repo has the scar to prove it. A slice
default silently overrode the seed state; the chat came up empty on first
load; **2759 unit tests passed** while the app was broken. Only CI's E2E job
caught it, and no local gate ran Playwright at all.

`quality_gate.sh` now runs `pnpm run test:e2e` when the diff touches wiring,
state ownership, or the app entrypoint (`src/lib/studio/{store,hydration,
seed-state,history-snapshot,hydration-quarantine}.ts`, `src/lib/studio/slices/`,
`src/app/{layout,page}.tsx`, `app-shell.tsx`, `playwright.config.ts`). It stays
quiet for ordinary component, test, and doc edits, so it is cheap enough to
leave on. Override with `FORCE_E2E=true` or `SKIP_E2E=true`.

Before calling anything fixed, load the `verify-before-asserting` skill. Its
shortest form: **a test you have not seen fail is not evidence** — re-inject
the defect, watch it fail, restore it.

### 2 → 3 · Candidate → Evaluate

```bash
./scripts/minimal_quality_gate.sh   # lint + typecheck + test (fast loop)
./scripts/quality_gate.sh           # the full gate, pre-commit
```

Warnings are errors. A build with a deprecation notice is a defect, not
progress (AGENTS.md Hard Rules).

### 3 → 4 · Evaluate → Adversarial

Run the `code-review-assistant` skill against the diff. The question is not
"is this correct?" but **"how would I break this?"** Probe for:

- The unguarded index, the falsy check of a non-nullable, the swallowed
  exception, the un-aborted fetch, the listener that is never removed.
- Claims the diff makes that no test would catch if they regressed.
- The fix that works only because of an accident of the current input.

Escalate rather than quietly shipping a risk you can name.

### 4 → 5 · Adversarial → Shadow

**Shadow = run the new path beside the old one, compare, change nothing.**

This repo has no built-in shadow or canary infrastructure. Build it from
existing primitives rather than assuming a platform that is not here:

- **Flag**: there is no flag library. Gate new behavior behind a store field
  or a `localStorage` read with a default, so flipping is a one-line change
  and rollback is deleting the branch.
- **The flag's default is the rollback story.** Default-off is safest: nothing
  changes until someone opts in. Default-on is chosen only when the old path
  is being *deleted*, and then the deletion and the flag land together.
- **Telemetry**: there is no Sentry. Announce shadow mismatches through the
  existing `useAnnouncer` live region and `toast` for manual inspection, and
  record the comparison in `plans/` for post-hoc review. A shadow stage that
  produces no artifact has not run.
- **Local-first constraint**: the app is local-first with no required backend.
  Never introduce shadow/canary machinery that requires a server to work
  offline.

In practice, shadow in this repo means: add the new path, leave the old path
reachable, exercise both over the same input (`e2e/`, `./scripts/verify.sh`),
and record the comparison. If the new path is simply a refactor with identical
behavior, say so explicitly and skip the stage rather than faking one.

### 5 → 6 · Shadow → Canary

**Canary = a narrow slice of real usage with a one-command undo.**

1. Ship behind a default-off flag on a branch/PR — that *is* the canary here;
   Vercel builds a preview per PR (`vercel.json`).
2. Exercise the real surface: `pnpm run dev` plus a browser session, or
   `pnpm run test:e2e` (25 Playwright specs). A unit test proves the function;
   it does not prove the app.
3. Keep the rollback trivial: one flag flip, or one revert.

Production has a single global deployment (see `vercel.json` — no
`preview`/`canary` aliases are configured), so treat "canary" as *a narrow,
observed rollout*, and never claim a gradual ramp that the platform cannot do.

### 6 → 7 · Canary → Promote / Rollback

**Promote** when the canary is clean over a real interval, not one green run:

```bash
gh pr merge <PR> --auto --squash --delete-branch
```

Watch `pr-merge-state-diagnoser.yml` output — `BLOCKED` with all-green
`gh pr checks` is usually staleness or a missing Codacy run, not a real
failure (AGENTS.md merge-state staleness section).

**Rollback** immediately — no debate, no partial revert — when the canary
regresses:

1. Flip the flag off (or revert the merge).
2. Record the incident as a new `LESSONS.md` entry and a `plans/` note.
3. Do not hotfix on top. A rollback that is immediately followed by another
   deploy is not a rollback.

## Workflow Selection

Not every change needs nine stages. Match depth to blast radius.

| Change | Minimum path |
|--------|-------------|
| Docs, comment, dead-code removal | 3 (evaluate) |
| Bug fix with a reproducing test | 1 → 3 → 4 |
| New component / view | 3 → 4 → 6 (canary = PR preview) |
| Persistence, hydration, undo/redo, sync | 3 → 4 → 5 → 6 |
| Schema migration, dependency bump, anything touching the store | 0 → 7, full loop |

**Data-loss bugs start at stage 0.** Do not ship a persistence change that was
never driven against a real corpus in a real browser.

## Harness Guardrails

The harness is the part that makes the loop repeatable. Load only what the
stage needs — every always-loaded instruction is a tax on every step.

| Need | Load |
|------|-------|
| Plan a multi-step change | `goap-agent`, `task-decomposition` |
| Split independent work | `parallel-execution`, `agent-coordination` |
| Fix CI / monitor a PR | `self-fix-loop` skill + `scripts/self-fix-loop.sh` |
| Review a diff adversarially | `code-review-assistant`, `code-quality` |
| Review security posture | `security-code-auditor`, `privacy-first` |
| Accessibility regressions | `accessibility-auditor` |
| Static-analysis blockers | `codacy`, `deepsource`, `static-analysis-suppression` |
| Prove a UI change in a real browser | `agent-browser`, `dogfood` |
| Commit → push → PR → CI | `atomic-commit` |

**Guardrails that must hold at every stage:**

- Never modify `biome.json`, any ESLint config, or lint suppressions without
  explicit human approval (AGENTS.md Hard Rules).
- Never merge with `Codacy Static Code Analysis` in a non-passing state.
- Never bypass branch protection with `--admin` without explicit approval.
- Never run `gh release create` without explicit human instruction.
- Fix at the code level before reaching for a suppression; a suppression hides
  a symptom, a code fix removes the cause.

**Harness engineering discipline** (`agents-docs/HARNESS.md`): add
configuration only after an actual failure. A guardrail that has never fired
on a real incident is untested configuration, and untested configuration is
usually noise.

### Skill map per stage

Load skills per stage, not wholesale — every always-loaded skill is a tax on
every step.

| Stage | Skills |
|-------|--------|
| Plan | `goap-agent`, `task-decomposition` |
| Fan out | `parallel-execution`, `agent-coordination` |
| Reproduce | `test-runner`, `dogfood` |
| Evaluate | `code-quality`, `testing-strategy` |
| Adversarial | `code-review-assistant`, `security-code-auditor` |
| Shadow / Canary | `agent-browser`, `pwa-offline-sync` |
| Promote / repair CI | `atomic-commit`, `self-fix-loop` |
| Analysis blockers | `codacy`, `deepsource`, `static-analysis-suppression` |
| Accessibility regressions | `accessibility-auditor` |

Canonical catalog: `agents-docs/AVAILABLE_SKILLS.md` (regenerate with
`./scripts/generate-skills-docs.py`).

## Progressive Disclosure

- **Stage table and the shortest path table** → `AGENTS.md`.
- **This file** → stage mechanics, harness guardrails.
- **Skills** → `agents-docs/AVAILABLE_SKILLS.md`; canonical copies in
  `.agents/skills/`.
- **Lessons** → `agents-docs/LESSONS.md`; distilled one-liners in AGENTS.md.
- **CI jobs** → `.github/workflows/ci-and-labels.yml`.
- **Scripts** → `agents-docs/SCRIPTS.md`.

## Related

- `agents-docs/WORKFLOW.md` — atomic commit and pre-existing-issue procedures.
- `agents-docs/HOOKS.md` — hook configuration.
- `agents-docs/TROUBLESHOOTING.md` — symptom → cause index.
- `agents-docs/LESSONS.md` — what actually broke, and why.
- `agents-docs/DEPLOYMENT.md` — Vercel requirements and failure causes.
- `agents-docs/GIT-WORKFLOW.md` — merge gates, staleness ladder, Codacy playbook.
