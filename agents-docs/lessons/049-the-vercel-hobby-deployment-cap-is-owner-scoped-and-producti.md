### LESSON-049: The Vercel Hobby deployment cap is owner-scoped, and production shares it with previews

100 deployments per 24 h (`api-deployments-free-per-day`, verified against
<https://vercel.com/docs/limits>), scoped to the account owner — not per project.
Production and previews draw on the same budget, so a day of preview churn takes
the live site down with it. **One push is one deployment; a force-push is
another.** Here, every deployment failed from 2026-10-03 to 2026-10-13 — previews
*and* production — while PRs remained mergeable, because the `Vercel` check is not
ruleset-required: a ✗ that blocks nothing hides a stale production for nine days.

Free discriminators before asking for account access or guessing: the failure
history across ~20 commits (`commits/{sha}/status` → `failed` for all of them means
repo-wide, not this PR); the **timing** of the failure (a status timestamp equal to
the deployment's own means nothing built, so *creation* was refused — a build, even
a failing one, takes tens of seconds, and an `ignoreCommand` skip reports
`canceled`, not `failure`); and a local `pnpm run build` (a pass rules out a code
break). A refused creation still leaves a deployment record plus an instant
`failure`, so "does a record exist" is *not* a discriminator.

Corollary worth knowing before trusting the fix: while creation is refused, the
levers below **cannot be observed working** — the refusal precedes the ignore step.

Levers, both in `vercel.json`: `git.deploymentEnabled` (never create the
deployment) and `ignoreCommand` (**exit 1 builds, exit 0 skips**) — and the skip
list must never include anything `pnpm run build` consumes or writes, because the
precache manifest it generates is served to clients.

**Tags**: #deployment #vercel #ci

---
