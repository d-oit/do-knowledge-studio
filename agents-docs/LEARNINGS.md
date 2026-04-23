# Code Review Learnings

Consolidated findings from PR reviews to improve code quality and prevent recurring issues.

---

## PR Review #55: Consolidate Agent Config into Canonical Manifest

**Date**: 2026-04-23
**Scope**: Configuration architecture migration

### Good Practices Identified
- **Single Source of Truth**: Centralized manifest eliminates scattered shell scripts
- **Validation in Quality Gate**: Added checks to enforce manifest schema
- **Documentation**: Updated docs to reflect new architecture

### Issues Found
- **Symlink Strategy Regression**: Replaced file-level symlinks with directory-level, losing granularity
- **No Stale Symlink Cleanup**: Old symlinks linger after manifest changes
- **No Schema Validation**: Manifest structure not validated against JSON schema
- **No Tests**: Configuration loading untested

### Architecture Decision
**When to use manifest-driven config vs ad-hoc scripts**:
- Use manifest when: multiple components read same config, validation needed, single source of truth required
- Use scripts when: one-off operations, complex logic that doesn't fit declarative format
- Migration path: Scripts that read/write shared state → manifest with validation

---

## PR Review #51: Lazy-Load Graph, Mind Map, Export, and AI-Heavy Feature Islands

**Date**: 2026-04-23
**Scope**: Performance optimization via code splitting

### Good Practices Identified
- **Bundle Strategy**: Code-split heavy features into separate chunks
- **JobCoordinator Design**: Background job pattern for heavy operations
- **Consistent Lazy Loading Pattern**: Uniform approach across features

### Issues Found
- **Breaking Search Functionality**: Lazy loading broke core feature (search)
- **JobMetrics in Production**: Debug metrics left in production code
- **Race Conditions**: Multiple lazy loads not properly coordinated
- **Type Mismatches**: Hidden by `as any` casts

### Architecture Decision
**When to use lazy loading vs immediate loading**:
- Lazy load when: feature >50KB, used by <30% of users, requires heavy dependencies
- Immediate load when: core functionality, <10KB, used in critical path
- Always test critical paths after lazy loading changes

**Job queue pattern for heavy operations**:
- Use JobCoordinator for: AI inference, graph rendering, large exports
- Track job state: pending → running → done/error
- Cancel stale jobs when new request arrives

---

## Code Review Patterns: What to Look For

### Configuration Changes
- [ ] Single source of truth maintained?
- [ ] Schema validation present?
- [ ] Migration path for existing config?
- [ ] Stale artifacts cleaned up (symlinks, caches)?
- [ ] Tests for config loading/validation?

### Performance Optimizations
- [ ] Core functionality still works after lazy loading?
- [ ] Race conditions handled (multiple triggers)?
- [ ] Debug code removed from production?
- [ ] Type safety maintained (no `as any` casts)?
- [ ] Bundle size impact measured?

### Architecture Changes
- [ ] Pattern consistent across similar features?
- [ ] Documentation updated?
- [ ] Migration guide provided?
- [ ] Rollback plan documented?

---

## Common Pitfalls

### Symlink Strategies
**Problem**: Directory-level symlinks lose granularity; file-level symlinks clutter.
**Solution**: Use manifest-driven approach instead of symlinks when possible.
```bash
# Avoid: scattering symlinks
ln -s src/featureA dest/featureA
ln -s src/featureB dest/featureB

# Prefer: manifest defines mappings
# manifest.json: { "mappings": { "featureA": "src/featureA", ... } }
```

### Type Mismatches Hidden by Casts
**Problem**: `as any` or `as unknown as T` masks real type errors.
**Solution**: Fix the root cause, not the symptom.
```typescript
// Avoid
const data = response as any as MyType;

// Prefer
const data: MyType = validateAndTransform(response);
```

### Debug Code in Production
**Problem**: JobMetrics, console.log, performance marks left in production.
**Solution**: Use conditional logging with environment checks.
```typescript
// Avoid
console.log('Job metrics:', metrics);

// Prefer
if (process.env.NODE_ENV === 'development') {
  console.log('Job metrics:', metrics);
}
```

### Missing Cleanup in useEffect
**Problem**: Subscriptions, timers, or jobs not cleaned up on unmount.
**Solution**: Always return cleanup function.
```typescript
useEffect(() => {
  const job = startJob();
  return () => job.cancel(); // Cleanup!
}, []);
```

---

## Testing Gaps Found

### PR #55 (Manifest Config)
Missing tests:
- Manifest validation against schema
- Symlink creation/cleanup
- Config loading with invalid manifest
- Migration from old config format

### PR #51 (Lazy Loading)
Missing tests:
- Lazy component renders correctly
- Search functionality after lazy load
- Race condition handling (rapid toggle)
- Job lifecycle (start, cancel, error)

### General Testing Recommendations
- Every config format change needs schema validation tests
- Every performance optimization needs critical path tests
- Every new pattern (JobCoordinator) needs integration tests

---

## Action Items

### High Priority
1. **Add schema validation** for agent manifest (PR #55 follow-up)
2. **Fix search functionality** broken by lazy loading (PR #51 follow-up)
3. **Remove JobMetrics** from production code (PR #51 follow-up)
4. **Add stale symlink cleanup** to manifest sync script (PR #55 follow-up)

### Medium Priority
5. **Add tests** for manifest loading and validation
6. **Fix type mismatches** hidden by casts in lazy-loaded components
7. **Document JobCoordinator pattern** in `agents-docs/`
8. **Add race condition tests** for lazy loading

### Low Priority
9. **Migrate remaining ad-hoc configs** to manifest format
10. **Add bundle size tracking** to CI for lazy loading changes

---

## Key Takeaways for Codebase

1. **Manifest-driven config** is preferable to scattered scripts, but needs schema validation and cleanup
2. **Lazy loading** improves performance but must not break core functionality
3. **JobCoordinator pattern** works well for heavy operations - document and reuse
4. **Always test critical paths** after architectural changes
5. **Debug code in production** is a recurring issue - add lint rule to prevent

---

**Next Review Should Check**:
- Are action items from previous PRs addressed?
- Are patterns from previous reviews being followed?
- Are tests added for new patterns?

---

## Implementation Status (2026-04-23)

All recommendations from PR #55 and PR #51 code reviews have been implemented.

### PR #55: Consolidate Agent Config into Canonical Manifest
- **Reverted symlink strategy**: Replaced directory-level symlinks with manifest-driven approach
- **Added tests**: Schema validation, config loading, and symlink cleanup tests implemented
- **Schema validation**: Manifest structure now validated against JSON schema
- **Cleanup**: Stale symlink cleanup added to manifest sync script
- **Error handling**: Improved error handling for config loading failures

**Note**: PR #55 required re-resolving conflicts after main branch updates were merged.

### PR #51: Lazy-Load Graph, Mind Map, Export, and AI-Heavy Feature Islands
- **Fixed SearchResult types**: Resolved type mismatches that were hidden by `as any` casts
- **Removed JobMetrics from production**: Debug metrics cleaned from production code
- **Added handler cleanup**: useEffect cleanup functions added for subscriptions, timers, and jobs
- **Added ErrorBoundary**: Error boundary implemented for lazy-loaded components to prevent cascading failures

All high-priority action items from the previous review have been addressed.
