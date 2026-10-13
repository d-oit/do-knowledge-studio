# Plan 164 — Vercel deployment validation, and the doc-lint gate it exposed (2026-10-12)

> Follow-on to Plan 163 (the open-PR/issue sweep). Two findings, both of the same
> shape as the ones that sweep fixed: **a green check that could not fail.**

## 1. Vercel: every deployment was failing, production included

### Symptom

`gh pr checks` showed `Vercel: fail` on every PR. `gh pr checks` alone only says
"fail" — the reason lives in the bot's comment or the commit's deployment status,
which is why this went unread for nine days.

### Evidence

- The Vercel bot's PR comments (#925, #944, #946) carry the provider's own error:

  ```
  Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")
  ```

- Official limits (`https://vercel.com/docs/limits`, *Deployments Created per
  Day*): **Hobby = 100 per 24 h, scoped to the account owner**, with the same name
  in the rate-limit table (`api-deployments-free-per-day`, 100 per 86400 s). The
  same page lists `api-deployments-free-per-hour` (100) and
  `api-deployments-flood` (60 per 5 minutes).
- Deployment history: the last **successful** deployment of any kind is
  `2026-10-03T11:16Z`. Everything after it — 300+ deployments, preview *and*
  production — failed. So the live site has not advanced since 3 October.
- The quota is not per-project: it is owner-scoped, and **production shares it
  with previews**, which is why main's deploys died along with the previews.
- Volume for one day, one repo: **104 deployments on 2026-10-12** — over the cap.

### Why it was invisible

The Vercel check is not ruleset-required (`Codacy Static Code Analysis` is the
only required context), so a red ✗ never blocked a merge — and a check that is red
on every PR trains everyone to ignore it. The cost was a stale production site.

### Fix in this repo (no account access needed)

| Lever | Effect | Where |
|---|---|---|
| `git.deploymentEnabled` | No deployment is *created* for matching branches (official: minimatch patterns, `/docs/project-configuration/git-configuration`) | `vercel.json` — `dependabot/**` disabled: dependency bumps gain nothing from a preview and were the highest-volume class |
| `ignoreCommand` | Official contract: **exit 1 builds, exit 0 ignores the build** (`/docs/project-configuration/vercel-json#ignorecommand`) | `scripts/vercel-ignore-build.sh` — skips a push whose every changed path is `plans/`, `agents-docs/`, `docs/`, `e2e/`, `.agents/`, `.github/` or markdown |

Two guardrails inside the script, both tested:

- **`scripts/` is not skippable.** `scripts/generate-precache-manifest.mjs` runs
  inside `pnpm run build` and writes `public/precache-manifest.json`, which the
  deployed client fetches — skipping it would serve a stale precache list.
- **Unknown state builds.** Vercel clones with `--depth=10`, so a missing previous
  commit must never be read as "nothing changed".

### Verification

`tests/vercel-ignore-build.bats` (6 cases, hermetic temp repo): docs-only skips;
app change builds; **scripts-only builds**; unknown previous commit builds;
missing `VERCEL_GIT_PREVIOUS_SHA` builds; identical commits skip. The scripts-only
case was confirmed to fail when `scripts/` was added to the skip pattern.

`vercel.json` was validated against Vercel's published schema
(`https://openapi.vercel.sh/vercel.json`, draft-04, 0 errors).

### What remains, honestly

The quota window resetting is the only thing that unblocks deploys **today** —
the config cannot create quota that has been spent. From tomorrow the config
reduces demand: dependency bumps stop deploying at all, and doc-only pushes
(which this repository produces in bulk) stop consuming the budget that
production needs.

### Operating rule recorded in the skill

One push = one deployment; a force-push counts again. The behavioural half of the
fix is batching pushes per PR rather than pushing every step — the sweep that
produced this plan made ~40 pushes in a day, most of them docs.

## 2. The doc-lint gate that could not fail

While adding the skill, markdownlint ran against the new file and reported line
length and table-style errors. Investigating why the repository tolerates
thousands of them exposed two defects in `markdownlint.toml`:

1. **Format**: rules were nested under `[tool.markdownlint]`, a Python-tooling
   convention that markdownlint ignores — so every rule ran at its default and the
   two rules the file meant to disable (line length, inline HTML) never applied.
2. **Ids**: the comments named the wrong rules entirely (`MD041` is "first line
   should be a heading", not line length), so even a correct format would have
   disabled the wrong things.

Consequences: the pre-commit hook (which *does* install markdownlint) would block
a doc author with thousands of violations, while the quality gate silently
skipped the same check because `markdownlint` is not on `PATH` and is not a
devDependency.

### The damage mode that nearly shipped

Turning the config on and running `markdownlint --fix` across the corpus
**rewrote meaning**: prose that wraps at ~80 columns often continues on a line
beginning with an issue reference (`#865, #870, …`). Per CommonMark that is an
ordinary paragraph; `MD018` treats it as a heading with a missing space and
"fixes" it to `# 865`, which renders as a real `<h1>`. The first pass converted 43
such lines across 58 files. Reverted, and `MD018` is now off with that reasoning
written into the config.

### What the config enforces now

Disabled with a stated reason: the style rules the repository does not follow
(line length, duplicate headings, inline HTML, emphasis-as-heading, code-fence
language, first-line heading, table pipe spacing), the blank-line placement rules
that would rewrite ~2,600 lines for no rendering difference, and the
heading-shape rules that misfire on the prose above (`MD001`, `MD018`, `MD025`,
`MD026`, `MD028`) plus archive table style (`MD055`/`MD056`).

Enforced: heading style, list indentation, trailing spaces, hard tabs, reversed
links, blank-line runs, blockquote spacing, bare URLs, spaces in
emphasis/links, empty links, proper names, and the single trailing newline.

Result: `markdownlint --config markdownlint.toml '**/*.md'` is **clean** on the
whole corpus. The normalization pass touched 43 markdown files with mechanical
edits only — verified by counting heading lines before and after (621 → 621) and
by confirming no added line in any doc looks like an ATX heading.

The policy itself is recorded as **ADR 042**
(`plans/ADRs/042-documentation-lint-policy.md`), so a future pass that wants to
re-enable a rule has to read why it was disabled first — `MD018` above all.

## 3. Follow-ups

1. **Wire markdownlint into the gate.** The step remains skipped unless the binary
   is on `PATH`; adding `markdownlint-cli` as a devDependency and calling it via
   `pnpm exec` would make it real offline (and would now pass, given §2).
2. **Repair the malformed tables** that `MD055`/`MD056` flagged before they were
   disabled: `DESIGN-SYSTEM.md` (4 rows with an extra cell),
   `agents-docs/WEB_RESEARCH_OPTIMIZATION.md` (1 row with a missing cell),
   `plans/112` (2 rows), `plans/160` (3 rows whose pipes are missing entirely).
   Each needs an editorial decision about what the row meant to say, which is why
   they were not swept mechanically.
3. **Deployment-quota discipline** is now documented in the `vercel-deployment`
   skill and `agents-docs/DEPLOYMENT.md`; the remaining risk is behavioural —
   a push-heavy day can still exhaust the account's 100.
