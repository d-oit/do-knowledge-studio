---
name: vercel-deployment
version: "1.0.0"
description: Diagnose and prevent Vercel deployment failures. Use when a deployment shows "Deployment has failed", when Vercel previews or production are red on every PR, when the live site stops updating, when a deployment hits a plan limit (api-deployments-free-per-day, free-per-hour, flood), or before changing vercel.json, build/install commands, or Git deployment settings.
---

# Vercel Deployment

This repository deploys to Vercel (`vercel.json`, framework `nextjs`). The failure
mode that wasted the most time was not a code error at all: **the Hobby plan's
daily deployment quota was exhausted, so every deployment failed — production
included — while each PR still showed a red ✗.**

## Step 1 — get the real error, never guess

`gh pr checks` shows only `Vercel: fail`. The reason lives in one of three places:

```bash
# 1. The bot's PR comment — usually the clearest text, and it names the API code.
gh pr view <PR> --json comments \
  --jq '.comments[] | select(.author.login | test("vercel")) | .body' | head -40

# 2. The commit's deployment status (works for any commit, no auth needed).
gh api repos/<owner>/<repo>/commits/<sha>/status \
  --jq '.statuses[] | select(.context=="Vercel") | "\(.state) — \(.description)"'

# 3. With an authenticated CLI (a human must run `vercel login` once).
npx vercel inspect <dpl_id> --logs
```

Then check whether it is *every* deployment or one PR:

```bash
# Success/failure history, newest first — a wall of failures means platform-wide.
gh api "repos/<owner>/<repo>/deployments?per_page=100" --jq '.[] | "\(.id) \(.ref[0:8]) \(.environment)"' |
  while read -r id ref env; do
    echo "$(gh api repos/<owner>/<repo>/deployments/$id/statuses --jq '.[0].state') $env $ref"
  done | head -40

# Deployments created per calendar day (the Hobby cap is per day, owner-scoped).
gh api "repos/<owner>/<repo>/deployments?per_page=100&page=$p" --jq '.[] | .created_at[0:10]' |
  sort | uniq -c
```

## Step 2 — know the failure classes

| Observed text | Cause | Action |
|---|---|---|
| `Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")` | Hobby: **100 deployments per 24h, owner-scoped** — so one busy repo starves every other project on the account, and it blocks production too | Reduce deployments *created* (§3). Nothing else fixes it; the window resets on its own |
| `api-deployments-free-per-hour` / `api-deployments-flood` | 100 builds/hour; 60 deployments/5 min | Same remedies; also stop rapid re-pushes |
| `Authorization required to deploy` | A **fork** PR: Vercel doesn't deploy forks unless allowed, and the run can't be resumed from here | Expected for forks; not a defect in the repo |
| A build-step error (install, `next build`, a script exit code) | Real build failure | Reproduce with `pnpm run build`; check Node ≥ 22 (`engines.node`) and pnpm detection |
| `Deployment has failed — run the Vercel CLI command npx vercel inspect <id> --logs` with **no quoted cause** | The provider withheld the reason. Check the **timing**: if the failure status carries the same timestamp as the deployment record (seconds, not minutes), nothing ever built — the *creation* was refused, which is the quota/account-limit signature, and Vercel still records a deployment plus a failure status | Read the real reason with an authenticated `vercel inspect`. Discriminate for free first: an *instant* failure is not a build break, a local `pnpm run build` that succeeds rules out the code, and a `main` where every commit fails (`commits/{sha}/status`, ~20 commits) is platform/account-wide rather than this PR's problem. Note that while creation is refused, `ignoreCommand`/`git.deploymentEnabled` **cannot be observed working** — the refusal happens before the ignore step runs |

Official sources: <https://vercel.com/docs/limits> (table rows *Deployments Created
per Day*, and the `api-deployments-*` rate-limit table),
<https://vercel.com/docs/deployments/troubleshoot-a-build>.

## Step 3 — reduce what gets deployed (the only real fix for quota)

Two documented levers, both in `vercel.json`:

**1. Don't create the deployment at all** — `git.deploymentEnabled` with
minimatch branch patterns (<https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled>).
Dependency-bump branches are the highest-volume, lowest-value previews:

```json
{ "git": { "deploymentEnabled": { "dependabot/**": false } } }
```

**2. Cancel the build for pushes that cannot change the app** — `ignoreCommand`
(<https://vercel.com/docs/project-configuration/vercel-json#ignorecommand>):
**exit 1 → build, exit 0 → ignore the build.** This repo uses
`scripts/vercel-ignore-build.sh`, which skips a push whose every changed path is
`plans/`, `agents-docs/`, `docs/`, `e2e/`, `.agents/`, `.github/` or a markdown
file, and builds everything else.

Two rules for that script, learned the hard way:

- **`scripts/` must NOT be skippable.** `scripts/generate-precache-manifest.mjs`
  runs inside `pnpm run build` and writes `public/precache-manifest.json`, which
  the deployed client fetches — a change there can change the site.
- **Fail closed.** Vercel clones with `--depth=10`, so the previous commit may be
  missing; unknown state must build, never skip.

Verify the decision locally before trusting it — the script takes the same two
environment variables Vercel sets:

```bash
VERCEL_GIT_PREVIOUS_SHA=<prev> VERCEL_GIT_COMMIT_SHA=<sha> bash scripts/vercel-ignore-build.sh; echo $?
```

Check `vercel.json` against Vercel's published schema after any edit:

```bash
curl -sS -o /tmp/vercel-schema.json https://openapi.vercel.sh/vercel.json
python3 - <<'PY'
import json
from jsonschema import Draft4Validator
schema = json.load(open('/tmp/vercel-schema.json'))
doc = json.load(open('vercel.json'))
errors = list(Draft4Validator(schema).iter_errors(doc))
print('VALID' if not errors else errors)
PY
```

## Step 4 — operating discipline (this repo's real cost driver)

- **One push = one deployment.** Pushing five times to the same branch in an hour
  costs five deployments. Batch commits; push when the branch is ready.
- **Force-pushes count again.** Rebasing to stay current, then force-pushing,
  creates a fresh deployment for the same logical change.
- **Production shares the quota with previews.** A day of preview churn can block
  the `main` deploy, and then the live site silently stops advancing — the
  `Production` entries in the history are the ones to check first.
- Before a day of heavy PR work, count the day's deployments (§1). At ~100, stop
  pushing until the window resets rather than burning the budget on retries.
- **A red `Vercel` ✗ is not a merge blocker** — `Codacy Static Code Analysis` is
  the only ruleset-required check — but it is not noise either: it is the signal
  that production is not deploying.

## Step 5 — this repository's deploy contract (do not break)

From `agents-docs/DEPLOYMENT.md` (the authoritative detail):

- **Never add `installCommand`** to `vercel.json`: an override makes Vercel use the
  *oldest* version of that package manager (pnpm 6 for `pnpm install`), which
  cannot read this repo's `lockfileVersion: 9.0` or `pnpm.overrides`. With no
  override Vercel infers pnpm from the lockfile and picks a compatible major
  (<https://vercel.com/docs/package-managers>).
- **Node ≥ 22** (`engines.node`) — the build asserts it; a Node 20 build dies with
  an install-time message.
- `buildCommand` is `pnpm run build` (`next build && generate-precache-manifest`),
  and that script **fails closed** when the build output is incomplete.
- `packageManager` in `package.json` only applies with Corepack enabled on the
  project (`ENABLE_EXPERIMENTAL_COREPACK=1`).

## Anti-patterns

- Re-running a failed deployment repeatedly while the window is exhausted — each
  attempt consumes quota and the error will be identical until the reset.
- Suppressing the Vercel check, or treating it as "always red anyway" — that is
  how production stays stale for days (it did, from 2026-10-03 to 2026-10-12).
- Making the skip list generous to save quota: skipping a build for a path that
  *does* affect the served app (e.g. `scripts/`, `public/`, `next.config.ts`)
  means the site silently serves the previous build.
