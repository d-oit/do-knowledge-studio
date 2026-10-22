# Git & Merge Workflow

> Reference doc extracted from `AGENTS.md` (Plan 157 follow-up) to satisfy the
> progressive-disclosure rule. The non-negotiable rules stay in `AGENTS.md`
> Hard Rules; this file holds the procedure and the diagnosis playbooks.

Start from an up-to-date branch:

```bash
git fetch origin
git pull --rebase
git checkout -b feat/<short-name>
```

Never commit directly to `main`.

Use conventional commits:

```bash
git commit -m "feat(scope): short description"
```

After CI passes on a PR, always run a code review before merge:

```bash
# Invoke code-review-assistant skill on the PR
# Review must cover: AGENTS.md compliance, security, a11y, performance, test coverage
# Address all P1/P2 findings before merge
```

If hooks are needed locally:

```bash
./scripts/install-hooks.sh
./scripts/validate-git-hooks.sh
```

Do not finish with failing lint, typecheck, tests, build, or quality gate output.

### GitHub merge-state staleness

After changing branch protection or rulesets, GitHub may report a PR as `BLOCKED` for minutes-to-hours even when every gate is satisfied (see `plans/098-audit-github-merge-state-staleness.md`). Do not treat `BLOCKED` as a real blocker before verifying against the rule endpoints (`gh api repos/<owner>/<repo>/rules/branches/<ref>` and `rulesets/<id>`), not `mergeStateStatus` alone.

1. Confirm the ruleset-required checks (currently `Codacy Static Code Analysis`) are green on the head commit, review threads are resolved, and the configured approvals requirement is met.
2. Re-arm a protected auto-merge: `gh pr merge <PR> --auto --squash --delete-branch`.
3. If still `BLOCKED`, nudge GitHub with an empty-commit push, then close/reopen as last resorts.
4. Never use `--admin` to bypass protections without explicit user approval.
5. `required_linear_history` makes plain merge commits invalid — always squash or rebase on this repo.

### Codacy merge gate

`Codacy Static Code Analysis` is the only ruleset-required status check on `main` (plans/098) and the zero-tolerance rule above applies to every PR. Two non-obvious behaviors (full playbook: `plans/123-codacy-merge-gate-playbook-2026-08-14.md`, LESSON-031, `codacy` skill):

- **A missing check is a transient delay, not a defect.** Codacy can fail to post on a PR head for a while, leaving the PR `BLOCKED` with every other check green (verified 2026-08-14 on PR #678). Diagnose via the source of truth — `gh api repos/<owner>/<repo>/commits/<sha>/check-runs` (Codacy absent) — then nudge with an empty-commit push; Codacy appears and analyzes every subsequent push normally. Do not reconfigure the integration for this.
- **Known false-positive patterns get code-level fixes** (`.codacy.yml` suppressions do NOT cover new PR code — see plans/112):
  | Pattern | Fix |
  |---|---|
  | `Variable Assigned to Object Injection Sink` on constant `Record` lookups | Exhaustive typed `switch` (no dynamic indexing) |
  | `Unnecessary conditional, value is always falsy` on falsy checks of TS non-nullable values (`!arr[i]`, `!document.documentElement`) | Index-bounds check (`i >= arr.length`) or presence check (`typeof x === 'undefined'`) — never falsy-check non-nullables |
  | Void-expression arrow shorthand (`onClick={() => setX(!x)}`) | Braces around the statement body |
  | `user-controlled URLs passed directly to HTTP client libraries` on validated-and-guarded Ollama/local fetch calls | `codacy pull-request ... --ignore-issue <resultDataId> --ignore-reason FalsePositive` via the `codacy` skill Cloud CLI — inline `nosemgrep` and `.codacy.yml` `disable_rules` do not work for Opengrep SARIF findings (LESSON-039) |

Read findings: `gh api repos/<owner>/<repo>/commits/<sha>/check-runs` → Codacy run id → `/check-runs/<id>/annotations`.

For Opengrep false positives that survive inline `nosemgrep` comments, use the `codacy` skill's Cloud CLI: `codacy pull-request gh <owner> <repo> <PR#> --output json` to get `toolInfo.name` and `resultDataId`, then `--ignore-issue <id> --ignore-reason FalsePositive` followed by `--reanalyze`.

## Standing merge authorization

**When a PR is fully clean, merge it. Do not ask.** The maintainer has
pre-authorized this. A redundant confirmation prompt is a defect, not caution:
it costs a round trip and trains the agent that the gate does not decide.

### The four conditions

1. **Every check passes.** No FAILURE, ACTION_REQUIRED, or PENDING on
   `gh pr checks`. This includes `Codacy Static Code Analysis` (the only
   ruleset-required check on `main`) and the e2e job.
2. **Every review thread is resolved.** Zero unresolved, *including outdated
   ones* — `required_review_thread_resolution` counts both, and GitNexus and
   DeepSource re-post stale positional findings as fresh threads on every push
   (LESSON-034). A finding already fixed in the working tree is replied to
   with evidence, then resolved. Never left open.
3. **The `code-review-assistant` pass is complete**, with every P1/P2 finding
   addressed or explicitly declined with a reason.
4. **The local gate is green** — `./scripts/quality_gate.sh`, including any
   structural-change e2e run the diff triggered.

Then:

```bash
gh pr merge <PR> --auto --squash --delete-branch
```

`--auto` is correct. It lands the moment CI clears, without holding a session
open to watch it — which is what a blocked-merge investigation otherwise costs.
Squash is mandatory: `required_linear_history` rejects a merge commit.

### If the approach changed after the PR's first commit

GitHub builds the squash message from the **PR title and the first commit's
message** — not from the final state of the branch. A PR whose approach was
reworked mid-flight (a fix replaced by a different fix, after review) therefore
lands with a commit message that describes the *abandoned* approach while the
diff contains the new one. The history then misleads the next reader, and
`git log` disagrees with the code.

It cannot be repaired afterwards: correcting it needs a force-push to `main`,
which branch protection rejects (`GH013: Changes must be made through a pull
request`), and a follow-up PR cannot rewrite the message of a commit that
already exists.

So do it **before** merging:

1. **Squash the branch locally** into a single commit whose message describes
   the final approach:
   ```bash
   git reset --soft origin/main
   git commit -m "fix(scope): the final approach"
   ```
   For a branch that is already a single commit, `git commit --amend -m "…"`
   is enough.
   (In `git rebase -i`, the **first** commit must stay `pick` and the ones
   folded into it are marked `squash` — marking the first one `squash` fails
   with `error: cannot 'squash' without a previous commit`.)

2. **Force-push the rewritten branch** — squashing changes the commit SHAs, so
   the push must be a force-push:
   ```bash
   git push --force-with-lease
   ```
   `--force-with-lease` rather than `--force`: it refuses if someone else
   pushed to the branch in the meantime. Force-pushing the **PR branch** is
   fine; force-pushing `main` is not (branch protection rejects it).
   Skipping this step leaves the remote branch with its original history, and
   `gh pr merge --squash` then uses the *remote* first commit — the very
   message this procedure exists to avoid.

3. Set the PR title to the final approach:
   `gh pr edit <PR> --title "fix(scope): the final approach"`.

4. Let CI re-run on the rewritten head, then merge with `--auto --squash`.

### When to stop and ask

These are deliberate human decisions, not formalities:

- Codacy reports an issue you believe is a **genuine** false positive and you
  want it reviewed before suppression. (If you have evidence it is a false
  positive, suppress it, re-run `--reanalyze`, and merge — do not ask.)
- A P1/P2 review finding is being **declined** rather than fixed.
- The diff touches a **release**, a **migration**, **auth**, or anything with
  an irreversible or outward-facing effect.
- **Branch protection or a ruleset** is being changed to make the merge pass.
- The maintainer flagged **"hold"** anywhere in the thread.

Never use `gh pr merge --admin` to clear a gate. That approval is never
standing, and a merge that needed `--admin` was a merge that should not have
happened.

### Worked example

PR #837 (Plan 157 + 158, 18 commits) reached merge with 22 review threads
resolved across three GitNexus rounds. The agent replied to each with the
commit that fixed it or the probe that disproved it, resolved, and merged on
squash. Six of those findings were real defects the agent had introduced
itself; none would have been caught by the local unit suite, which was green
throughout.
