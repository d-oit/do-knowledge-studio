# Rust Tools

Validation tools and commands for Rust iterative refinement.

## Test Framework

### cargo test
```bash
# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_name

# Run tests in specific module
cargo test module::

# Run doc tests only
cargo test --doc

# Run with threads
cargo test -- --test-threads=1

# Count passing tests
cargo test 2>&1 | grep "test result" | awk '{print $4}'
```

## Linter

### clippy
```bash
# Run clippy
cargo clippy

# All targets
cargo clippy --all-targets

# Deny warnings
cargo clippy -- -D warnings

# Count warnings
cargo clippy 2>&1 | grep -c "warning:"

# Specific lint level
cargo clippy -- -W clippy::pedantic

# Fix automatically (experimental)
cargo clippy --fix
```

## Formatter

### rustfmt
```bash
# Format code
cargo fmt

# Check formatting without modifying
cargo fmt -- --check

# Verbose output
cargo fmt -- --verbose

# Check if formatted
cargo fmt -- --check && echo "Formatted" || echo "Not formatted"
```

## Build

### cargo build
```bash
# Build
cargo build

# Build release
cargo build --release

# Build all targets
cargo build --all-targets

# Clean build
cargo clean && cargo build

# Check without building
cargo check

# Check is faster for validation loops
cargo check --all-targets
```

## Code Coverage

### tarpaulin
```bash
# Install
cargo install cargo-tarpaulin

# Run coverage
cargo tarpaulin

# HTML output
cargo tarpaulin --out Html

# Set minimum coverage
cargo tarpaulin --fail-under 80

# Get coverage percentage
cargo tarpaulin --out Json | jq '.files | map(.coverage) | add / length'
```

### llvm-cov
```bash
# Install
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov

# Run coverage
cargo llvm-cov

# HTML report
cargo llvm-cov --html

# Set thresholds
cargo llvm-cov --fail-under-lines 80
```

## Security Audit

### cargo-audit
```bash
# Install
cargo install cargo-audit

# Check for vulnerabilities
cargo audit

# Count vulnerabilities
cargo audit --json | jq '.vulnerabilities.count'
```

### cargo-deny
```bash
# Install
cargo install cargo-deny

# Check dependencies
cargo deny check

# Check advisories only
cargo deny check advisories
```

## Documentation

### cargo doc
```bash
# Generate docs
cargo doc

# Open in browser
cargo doc --open

# Check doc warnings
cargo doc --no-deps 2>&1 | grep -c "warning:"
```

## Benchmarks

### criterion
```bash
# Run benchmarks
cargo bench

# Specific benchmark
cargo bench bench_name
```

### cargo-criterion
```bash
# Install
cargo install cargo-criterion

# Run benchmarks
cargo criterion
```

## Common Validation Sequences

### Basic Quality Loop
```bash
# 1. Check compilation
cargo check

# 2. Run tests
cargo test

# 3. Check clippy
cargo clippy

# 4. Check formatting
cargo fmt -- --check

# 5. Count issues
CLIPPY_WARNINGS=$(cargo clippy 2>&1 | grep -c "warning:")
echo "Clippy warnings: $CLIPPY_WARNINGS"
```

### Comprehensive Quality Loop
```bash
# 1. Clean check
cargo check --all-targets

# 2. Tests with coverage
cargo tarpaulin --fail-under 80

# 3. Clippy strict
cargo clippy --all-targets -- -D warnings

# 4. Format check
cargo fmt -- --check

# 5. Security audit
cargo audit

# 6. Doc check
cargo doc --no-deps
```

### Fast Iteration Loop
```bash
# Use 'check' instead of 'build' for speed
# 1. Quick check
cargo check

# 2. Run tests
cargo test

# 3. Count clippy warnings
WARNINGS=$(cargo clippy 2>&1 | grep -c "warning:")
echo "Warnings: $WARNINGS"
```

### Performance Validation
```bash
# Build release
cargo build --release

# Run benchmarks
cargo bench

# Check binary size
ls -lh target/release/binary_name
```

## Iteration Example

```bash
#!/bin/bash
# Iteration validation script for Rust

echo "Iteration N Validation"
echo "====================="

# Quick check (faster than build)
echo "Checking compilation..."
cargo check --all-targets 2>&1 | grep -q "error"
CHECK_EXIT=$?

# Run tests
echo "Running tests..."
TEST_OUTPUT=$(cargo test 2>&1)
TEST_EXIT=$?
TEST_PASSED=$(echo "$TEST_OUTPUT" | grep "test result" | awk '{print $4}')
TEST_TOTAL=$(echo "$TEST_OUTPUT" | grep "test result" | awk '{print $6}')

# Run clippy
echo "Running clippy..."
CLIPPY_OUTPUT=$(cargo clippy 2>&1)
CLIPPY_WARNINGS=$(echo "$CLIPPY_OUTPUT" | grep -c "warning:")

# Check formatting
echo "Checking format..."
cargo fmt -- --check > /dev/null 2>&1
FORMAT_EXIT=$?

# Results
echo ""
echo "Results:"
echo "  Compilation: $([ $CHECK_EXIT -eq 0 ] && echo "Success" || echo "Failed")"
echo "  Tests: $TEST_PASSED/$TEST_TOTAL passing"
echo "  Clippy warnings: $CLIPPY_WARNINGS"
echo "  Format: $([ $FORMAT_EXIT -eq 0 ] && echo "Clean" || echo "Needs formatting")"

# Decision
if [ $CHECK_EXIT -eq 0 ] && [ $TEST_EXIT -eq 0 ] && [ $CLIPPY_WARNINGS -eq 0 ] && [ $FORMAT_EXIT -eq 0 ]; then
    echo "Decision: SUCCESS"
    exit 0
else
    echo "Decision: CONTINUE"
    exit 1
fi
```

## Cargo.toml Configuration

Add these for better validation:

```toml
[profile.dev]
# Faster compilation for iteration
incremental = true

[profile.release]
# Optimize for production
lto = true
codegen-units = 1

[workspace]
# Ensure consistent formatting
resolver = "2"
```

## Makefile Example

Create a `Makefile` for easy validation:

```makefile
.PHONY: check test lint format validate

check:
	cargo check --all-targets

test:
	cargo test

lint:
	cargo clippy --all-targets -- -D warnings

format:
	cargo fmt -- --check

validate: check test lint format
	@echo "All validations passed!"

fix:
	cargo fmt
	cargo clippy --fix --allow-dirty
```

Then run: `make validate`

## CI Configuration

Example GitHub Actions workflow:

```yaml
name: Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          components: rustfmt, clippy
      - run: cargo check --all-targets
      - run: cargo test
      - run: cargo clippy -- -D warnings
      - run: cargo fmt -- --check
```

## Best Practices

### DO:
✓ Use `cargo check` for fast iteration (faster than `cargo build`)
✓ Run `cargo fmt` before committing
✓ Enable clippy in CI with `-D warnings`
✓ Use `--all-targets` for comprehensive checks
✓ Leverage incremental compilation in dev profile
✓ Use `cargo fix` for automated fixes
✓ Cache cargo builds in CI
✓ Run tests with `--nocapture` for debugging

### DON'T:
✗ Ignore clippy warnings
✗ Skip formatting checks
✗ Use `cargo build` when `cargo check` suffices
✗ Commit unformatted code
✗ Disable lints without reason
✗ Skip tests for "quick fixes"
✗ Use `unwrap()` without justification
✗ Ignore compiler warnings

## Performance Tips

### Speed Up Iteration
```bash
# Use check instead of build (much faster)
cargo check

# Use nextest for faster test execution
cargo install cargo-nextest
cargo nextest run

# Enable parallel compilation
export CARGO_BUILD_JOBS=$(nproc)

# Use sccache for build caching
cargo install sccache
export RUSTC_WRAPPER=sccache
```

### Cargo Watch
```bash
# Install cargo-watch
cargo install cargo-watch

# Auto-run tests on change
cargo watch -x test

# Auto-run check and test
cargo watch -x check -x test
```