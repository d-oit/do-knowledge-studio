---
name: migration-refactoring
description: Automate complex code migrations and refactorings with safety patterns. Use when upgrading dependencies, migrating frameworks (React class→hooks, Flask→FastAPI), modernizing languages (Python 2→3), or performing large-scale refactories. Includes breaking change analysis, automated fix application, rollback strategies, and cross-file dependency tracking.
license: MIT
---

# Migration & Refactoring

Systematic approach to complex code migrations with safety guardrails and rollback capabilities.

## When to Use

- **Dependency upgrades** - Major version bumps with breaking changes
- **Framework migrations** - React class→hooks, Flask→FastAPI, Django→DRF, etc.
- **Language modernizations** - Python 2→3, JavaScript→TypeScript
- **Large-scale refactoring** - Cross-file changes requiring consistency
- **Database schema evolution** - Migrations with data transformation
- **Monorepo decomposition** - Extracting services from monoliths

## Core Workflow

### Phase 1: Analysis
1. **Identify scope** - What files, modules, and dependencies are affected?
2. **Map dependencies** - Create a dependency graph of cross-file relationships
3. **Find breaking changes** - Analyze changelogs, migration guides, deprecation warnings
4. **Assess risk** - Flag high-risk changes (public APIs, critical paths)

### Phase 2: Planning
1. **Create migration plan** - Ordered sequence of changes
2. **Define checkpoints** - Intermediate states that compile/work
3. **Design rollback strategy** - How to revert if issues arise
4. **Estimate effort** - Time and complexity assessment

### Phase 3: Execution
1. **Execute in phases** - Apply changes incrementally
2. **Validate at each checkpoint** - Test compilation, run tests, verify functionality
3. **Document changes** - Update docs, changelogs, ADRs
4. **Commit incrementally** - Each checkpoint is a commit

### Phase 4: Validation
1. **Run full test suite** - Verify nothing broken
2. **Performance testing** - Ensure no regressions
3. **Code review** - Human validation of changes
4. **Production rollout** - Deploy with monitoring

## Migration Patterns

### Pattern 1: Gradual Migration
```
Old API → Compatibility Layer → New API → Remove Old
```
**When**: Cannot change all call sites at once

### Pattern 2: Feature Flags
```javascript
if (useNewImplementation) {
  return newImplementation();
} else {
  return oldImplementation();
}
```
**When**: High-risk changes needing rollback capability

### Pattern 3: Strangler Fig
```
Monolith → Proxy → New Service
              → Old Monolith
```
**When**: Decomposing monoliths incrementally

### Pattern 4: Parallel Implementation
```
Old System (read-only) → Data Sync → New System (write)
```
**When**: Zero-downtime migrations with data changes

See `references/migration-patterns.md` for detailed implementations.

## Breaking Change Analysis

### Checklist for Upgrades
- [ ] Review CHANGELOG for breaking changes
- [ ] Check deprecation warnings in current version
- [ ] Identify removed/renamed APIs
- [ ] Find changed default behaviors
- [ ] Note environment/dependency changes
- [ ] Review migration guide if available
- [ ] Search for known issues in community

### Common Breaking Changes
| Category | Examples |
|----------|----------|
| API Removal | `function removed()` |
| Signature Changes | `func(a, b)` → `func(a, b, c)` |
| Default Changes | `encoding='utf-8'` → `encoding=None'` |
| Dependency Drops | Dropped Python 3.8 support |
| Return Type Changes | `list` → `generator` |

## Cross-File Dependency Tracking

### Dependency Graph Elements
- **Imports/includes** - File A imports File B
- **Inheritance** - Class A extends Class B
- **Interface implementations** - Class implements Interface
- **Function calls** - Function in A calls function in B

### Tools by Language
- **Python**: `pydeps`, `importlab`
- **JavaScript/TypeScript**: `dependency-cruiser`, `madge`
- **Java**: `jdeps`, `classycle`
- **Go**: `godepgraph`
- **Rust**: `cargo-deps`

See `references/dependency-analysis.md` for detailed usage.

## Safety Patterns

### Snapshot Testing
```python
# Before migration: capture expected outputs
save_snapshot(test_output, "v1_expected.json")

# After migration: compare
assert_matches_snapshot(actual_output, "v1_expected.json")
```

### Property-Based Testing
```python
# Verify invariants hold post-migration
@given(st.data())
def test_migration_preserves_properties(data):
    old_result = old_implementation(data)
    new_result = new_implementation(data)
    assert old_result.property == new_result.property
```

### Canary Deployments
1. Deploy to 1% of traffic
2. Monitor error rates, latency
3. Gradually increase to 100%
4. Rollback if issues detected

See `references/safety-patterns.md` for more patterns.

## Rollback Strategies

### Strategy 1: Git Revert
```bash
# If migration is in single commit
git revert <migration-commit>
```
**Best for**: Small, isolated migrations

### Strategy 2: Feature Flag Disable
```python
USE_NEW_PARSER = False  # Env var or config
```
**Best for**: Gradual rollouts

### Strategy 3: Database Rollback
```sql
-- Migration down script
ALTER TABLE users DROP COLUMN email_normalized;
```
**Best for**: Schema changes with data loss concerns

See `references/rollback-strategies.md` for platform-specific guides.

## Examples

### React Class to Hooks
1. Convert `componentDidMount` + `componentWillUnmount` → `useEffect`
2. Convert `componentDidUpdate` → `useEffect` with dependency array
3. Convert `this.state` → `useState`
4. Convert `this.props` → destructured props
5. Remove `this` bindings

### Python 2 to 3
```bash
# Generate patch
2to3 -w --output-dir=src_py3 src/

# Review changes
# Fix imports, print statements, string handling
```

See `references/language-migrations.md` for framework-specific guides.

## Quality Checklist

- [ ] Breaking changes documented
- [ ] Rollback procedure tested
- [ ] All dependencies mapped
- [ ] Checkpoints defined and validated
- [ ] Test coverage maintained or improved
- [ ] Performance regression testing done
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Monitoring/alerting configured
- [ ] Rollout plan with timings

## References

- `references/migration-patterns.md` - Detailed pattern implementations
- `references/breaking-change-catalog.md` - Common breaking changes by library
- `references/dependency-analysis.md` - Cross-file dependency tracking
- `references/rollback-strategies.md` - Platform-specific rollback guides
- `references/language-migrations.md` - Framework migration guides
- `references/safety-patterns.md` - Testing and safety patterns
