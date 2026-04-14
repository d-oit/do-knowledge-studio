---
name: test-runner
description: Execute tests, analyze results, and diagnose failures across any testing framework. Use when running test suites, debugging failing tests, or configuring CI/CD testing pipelines.
version: "1.0"
template_version: "0.2"
license: MIT
---

# Test Runner

Expert skill for test execution and failure diagnosis.

## Quick Start

```markdown
Test Checklist:
- [ ] Environment configured
- [ ] Tests run or failures captured
- [ ] Failed tests diagnosed
- [ ] Coverage report generated
```

## When to Use

- Running test suites
- Debugging failing tests
- Setting up CI/CD pipelines
- Analyzing test coverage
- Identifying flaky tests

## Framework Commands

### JavaScript
```bash
jest                    # Run all
jest path/to/test.ts    # Specific file
jest --coverage       # With coverage
jest --watch          # Watch mode
```

### Python
```bash
pytest                  # Run all
pytest tests/test.py    # Specific file
pytest --cov=src        # With coverage
pytest -v              # Verbose
```

### Rust
```bash
cargo test              # Run all
cargo test test_name    # Specific test
cargo test -- --nocapture  # Show output
```

### Go
```bash
go test ./...           # Run all
go test -v ./...        # Verbose
go test -cover ./...    # With coverage
```

### Bash
```bash
bats tests/             # Run all
bats tests/file.bats    # Specific file
```

## Diagnosing Failures

### Step 1: Identify Error Type

| Pattern | Likely Cause | Action |
|---------|--------------|--------|
| `AssertionError: expected X got Y` | Logic error | Check implementation |
| `TimeoutError` | Async issue | Check async/await |
| `ModuleNotFoundError` | Missing dep | Install dependency |
| `panic: runtime error` | Go panic | Check nil/bounds |

### Step 2: Isolate Test
```bash
pytest test.py::test_func -v     # Python
jest --testNamePattern="test"     # Jest
cargo test test_name               # Rust
```

### Step 3: Check Environment
```bash
pip list | grep pytest            # Python
npm list jest                      # Node
./scripts/setup-test-db.sh        # Test data
```

## Coverage Analysis

### Generate Reports
```bash
# Jest
jest --coverage --coverageReporters=text-summary

# Python
pytest --cov=src --cov-report=html

# Rust
cargo tarpaulin --out Html

# Go
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Coverage Targets

| Type | Minimum | Target |
|------|---------|--------|
| New project | 70% | 85% |
| Legacy | 50% | 70% |
| Critical path | 90% | 95% |

## Flaky Test Detection

```bash
# Run multiple times
for i in {1..10}; do pytest || echo "Failed run $i"; done

# Identify patterns:
# - Time-based (timeout issues)
# - State-dependent (order matters)
# - Async race conditions
```

## Best Practices

### DO:
- Run tests locally before commit
- Write edge case tests
- Mock external dependencies
- Keep tests fast (<100ms)
- Clean up test state
- Use descriptive names

### DON'T:
- Skip tests without TODO
- Hardcode timeouts
- Test implementation details
- Share mutable state
- Ignore flaky tests
- Use sleep without reason

## Quality Criteria

- [ ] Tests run or failures diagnosed
- [ ] Coverage meets targets
- [ ] No flaky tests
- [ ] Test environment documented
- [ ] CI/CD configured
- [ ] Clear error messages

## References

- `agents-docs/SKILLS.md` - Skill framework guide
