# Dependency Upgrade Task

You are performing a systematic dependency upgrade for this project. Follow these steps to upgrade safely.

## Phase 0 — Audit Current State

1. Read `AGENTS.md` and internalize all rules.
2. Check the current state:
   ```bash
   pnpm outdated
   pnpm audit
   ```
3. Create an upgrade branch:
   ```bash
   git checkout -b chore/upgrade-deps-YYYY-MM-DD
   ```

## Phase 1 — Categorize Upgrades

Group dependencies into risk tiers:

| Tier | Risk | Examples | Strategy |
|------|------|----------|----------|
| P0 | Critical security | Vulnerable packages | Upgrade immediately, separate PR |
| P1 | Patch updates | `~x.y.z` → `~x.y.z+1` | Batch upgrade, quick test |
| P2 | Minor updates | `^x.y` → `^x.y+1` | One at a time, review changelogs |
| P3 | Major updates | `^x` → `^x+1` | Full migration plan, separate PR |

## Phase 2 — Security Fixes (P0)

1. Fix critical vulnerabilities first:
   ```bash
   pnpm audit fix
   ```
2. For unfixable issues, document in `plans/dependency-audit.md`.
3. Run quality gate and commit separately.

## Phase 3 — Batch Patch Upgrades (P1)

1. Upgrade all patch versions together:
   ```bash
   pnpm update
   ```
2. Run quality gate.
3. If any test fails, roll back that specific package and retry.

## Phase 4 — Minor Upgrades (P2)

1. Upgrade each minor version individually:
   ```bash
   pnpm add <package>@latest  # within same major
   ```
2. Run quality gate after each upgrade.
3. Review changelogs for breaking changes (some packages break in minors).
4. Commit after each successful upgrade.

## Phase 5 — Major Upgrades (P3)

1. Create a separate branch per major upgrade.
2. Review the migration guide for each package.
3. Run quality gate and fix all issues.
4. Document migration steps in `plans/dependency-migrations.md`.

## Phase 6 — Final Verification

1. Run full quality gate:
   ```bash
   pnpm run quality_gate
   ```
2. Verify the production build:
   ```bash
   pnpm run build && pnpm run preview
   ```
3. Check bundle size didn't regress significantly.
4. Create PR:
   ```bash
   gh pr create --base main --title "chore: upgrade dependencies" --body "Automated dependency upgrade. See commits for details."
   ```

## Global Constraints

- **Never** upgrade major versions without reviewing migration guides.
- **Never** skip the quality gate.
- **Always** commit upgrades in logical groups.
- **Always** test the production build after upgrading.
- **Always** check `pnpm audit` before and after.
