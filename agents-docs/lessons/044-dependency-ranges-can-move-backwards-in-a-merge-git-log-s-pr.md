### LESSON-044: Dependency ranges can move backwards in a merge — `git log -S` proves the direction

**Date**: 2026-10-12
**Component**: Dependencies / review
**Severity**: High

**Issue**: `main` shipped for two days with four dependencies **downgraded**:
`next` `^16.3.8`→`^16.3.6` (reverting dependabot's own bump), `react-day-picker`,
`@tanstack/react-virtual`, and `eslint-plugin-react-refresh`. The change arrived
as a side effect of a UI PR regenerating `package.json`/`pnpm-lock.yaml` from a
stale base.

**Symptoms**:
- Two Dependabot jobs red on unrelated PRs (`security_update_not_possible` on
  an alert whose fix was already in the lockfile)
- A dependency upgrade PR conflicting with `main` in `pnpm-lock.yaml`
- Nothing red on the PR that caused it — `pnpm install` succeeds either way

**Root cause**: `pnpm install` reconciles *to the manifest*, and the manifest
had been rewritten from an older commit. A semver range moving down is not a
merge conflict, so neither git nor pnpm objects.

**Prevention**:
- When a PR touches `package.json`, diff the ranges against `main` and treat any
  decrease as a defect to explain, not noise: `git show <sha> -- package.json`.
- `git log -S '"pkg": "^X.Y.Z"' origin/main -- package.json` identifies **which**
  commit changed a range and in which direction — it settled this case in
  seconds.
- Re-generate a lockfile from the current `main` (`git checkout origin/main --
  pnpm-lock.yaml && pnpm install --lockfile-only`), never from a stale branch
  copy.
- If the framework version moved, regenerate committed build-derived artifacts
  too (`public/precache-manifest.json` embeds emitted chunk URLs).

**Tags**: #deps #lockfile #review #regression #pinning

---
