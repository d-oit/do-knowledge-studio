### LESSON-016: Dependency Synchronization during Major Upgrades (Vite 8)

**Date**: 2026-04-16
**Component**: Build System / Dependencies
**Severity**: Medium

**Issue**: Upgrading Vite to major version 8 causes peer dependency conflicts and build failures if companion plugins and test runners are not updated in sync.

**Symptoms**:
- `npm install` warnings about peer dependency mismatches for `vite`.
- Test runner (`vitest`) failing to start or reporting incompatible API versions.
- React plugin (`@vitejs/plugin-react`) failing to transform files correctly.

**Root Cause**:
1. **Tight Coupling**: Tools like `vitest` and `@vitejs/plugin-react` have strict peer dependency ranges for `vite`.
2. **Major Version Breaking Changes**: Vite 8 introduces changes that require corresponding logic updates in its ecosystem.
3. **Partial Updates**: Updating only the main `vite` package via a Dependabot PR without its companions.

**Solution**:
Synchronize the upgrade across the entire Vite ecosystem:
- Update `vite` to `^8.0.8`
- Update `@vitejs/plugin-react` to `^6.0.1`
- Update `vitest` to `^4.1.4` (or latest compatible)
- Update `happy-dom` to `^20.9.0` for test environment compatibility

**Prevention**:
- When a Dependabot PR suggests a major version upgrade for a core build tool, check for required companion updates.
- Use `npm info <package> peerDependencies` to verify compatibility ranges.
- Consolidate ecosystem updates into a single atomic commit to keep the CI green.

**Tags**: #vite8 #vitest #dependencies #peer-dependencies #build-tooling

**Files Modified**:
- `package.json` - Synchronized ecosystem upgrade

---
