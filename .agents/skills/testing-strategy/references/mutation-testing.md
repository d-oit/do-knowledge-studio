# Mutation Testing

Mutation testing tools and strategies. Updated with 2026 best practices and latest tool versions.

## Overview

This guide covers mutation testing techniques to verify the quality and effectiveness of your test suite. Mutation testing introduces small changes (mutations) to your code and checks if your tests catch them. If tests pass with mutated code, your test coverage has gaps.

## What is Mutation Testing?

**TL;DR**: Mutation testing introduces changes to your code, then runs your unit tests against the changed code. It is expected that your unit tests will now fail. If they don't fail, it might indicate your tests do not sufficiently cover the code.

Bugs, or *mutants*, are automatically inserted into your production code. Your tests are run for each mutant. If your tests *fail* then the mutant is *killed*. If your tests passed, the mutant *survived*. The higher the percentage of mutants killed, the more *effective* your tests are.

### Example

```python
# Original code
# Stryker will find the return statement and decide to change it:
def isUserOldEnough(user):
    return user.age >= 18

# Possible mutations:
# 1. return user.age > 18;    # Changed >= to >
# 2. return user.age < 18;    # Reverse comparison
# 3. return false;            # Constant replacement
# 4. return true;             # Constant replacement

# Test that catches the mutation:
def test_age_boundary():
    assert isUserOldEnough({'age': 18}) is True   # Boundary
    assert isUserOldEnough({'age': 17}) is False  # Just below
    assert isUserOldEnough({'age': 19}) is True   # Just above
```

### Why Not Just Code Coverage?

Code coverage doesn't tell you everything about the effectiveness of your tests. Think about it: when was the last time you saw a test without an assertion, purely to increase the code coverage?

Imagine a sandwich covered with paste. Code coverage would tell you the bread is 80% covered with paste. Mutation testing, on the other hand, would tell you it is actually *chocolate* paste and not... well... something else.

## Tools by Language (2026)

### JavaScript/TypeScript: StrykerJS (v8.x)

StrykerJS is the most popular mutation testing framework for JavaScript, supporting React, Angular, VueJS, Svelte, NodeJS, and TypeScript.

**Installation:**

```bash
# Install Stryker and test runner
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner

# Alternative runners
npm install --save-dev @stryker-mutator/vitest-runner
npm install --save-dev @stryker-mutator/mocha-runner
npm install --save-dev @stryker-mutator/karma-runner
npm install --save-dev @stryker-mutator/jasmine-runner
```

**Configuration (stryker.config.json):**

```json
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/api/schema/stryker-schema.json",
  "mutate": [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/__tests__/**"
  ],
  "testRunner": "jest",
  "reporters": [
    "progress",
    "clear-text",
    "html",
    "json"
  ],
  "coverageAnalysis": "perTest",
  "incremental": true,
  "incrementalFile": ".stryker/incremental.json",
  "mutator": {
    "plugins": []
  },
  "jest": {
    "projectType": "custom",
    "configFile": "jest.config.js"
  },
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 70
  }
}
```

**Running Stryker:**

```bash
# Run mutation testing
npx stryker run

# Run with incremental mode (faster for subsequent runs)
npx stryker run --incremental

# Force full run ignoring incremental
npx stryker run --force

# Run with specific config file
npx stryker run --config stryker.config.json

# Preview plan without running (dry run)
npx stryker run --dry-run

# View HTML report
open reports/mutation/mutation.html
```

**Vitest Configuration (2026):**

```json
{
  "testRunner": "vitest",
  "vitest": {
    "configFile": "vitest.config.ts"
  }
}
```

### Python: Mutmut (Latest)

```bash
# Install
pip install mutmut

# Run mutation testing
mutmut run

# Run with specific paths
mutmut run --paths-to-mutate=src/

# Run only on changed files (faster)
mutmut run --paths-to-mutate $(git diff --name-only HEAD~1 | grep "\.py$")

# View results
mutmut results

# Show surviving mutants
mutmut show 1  # Shows mutant #1
mutmut show all  # Shows all mutants

# Apply a mutant (for testing)
mutmut apply 1

# Generate HTML report
mutmut results --html
```

**Configuration (pyproject.toml):**

```toml
[tool.mutmut]
paths_to_mutate = "src/"
backup = false
runner = "python -m pytest"
tests_dir = "tests/"
mutate_copied_files = false

[tool.mutmut.target]
# Exclude specific files
exclude = [
    "src/**/test_*.py",
    "src/**/__init__.py",
]
```

**Example test that catches mutations:**

```python
# Original function
def is_positive(number):
    return number > 0

# Mutated version that mutmut might create:
# def is_positive(number):
#     return number >= 0  # Mutation: > becomes >=

# Good test that catches this:
def test_is_positive_boundary():
    assert is_positive(1) is True
    assert is_positive(0) is False   # Catches >= mutation!
    assert is_positive(-1) is False
```

### Java: PIT (Latest)

```xml
<!-- pom.xml -->
<plugin>
    <groupId>org.pitest</groupId>
    <artifactId>pitest-maven</artifactId>
    <version>1.15.0</version>
    <configuration>
        <targetClasses>
            <param>com.example.*</param>
        </targetClasses>
        <targetTests>
            <param>com.example.*Test</param>
        </targetTests>
        <mutators>
            <mutator>CONDITIONALS_BOUNDARY</mutator>
            <mutator>NEGATE_CONDITIONALS</mutator>
            <mutator>REMOVE_CONDITIONALS</mutator>
            <mutator>MATH</mutator>
            <mutator>INCREMENTS</mutator>
            <mutator>INVERT_NEGS</mutator>
            <mutator>RETURN_VALS</mutator>
            <mutator>VOID_METHOD_CALLS</mutator>
            <mutator>EMPTY_RETURNS</mutator>
            <mutator>NULL_RETURNS</mutator>
            <mutator>PRIMITIVE_RETURNS</mutator>
            <mutator>TRUE_RETURNS</mutator>
            <mutator>FALSE_RETURNS</mutator>
        </mutators>
        <thresholds>
            <mutationThreshold>70</mutationThreshold>
            <coverageThreshold>50</coverageThreshold>
        </thresholds>
        <timestampedReports>false</timestampedReports>
        <outputFormats>
            <outputFormat>HTML</outputFormat>
            <outputFormat>CSV</outputFormat>
        </outputFormats>
    </configuration>
</plugin>
```

```bash
# Run PIT
mvn org.pitest:pitest-maven:mutationCoverage

# Run with history (incremental)
mvn org.pitest:pitest-maven:mutationCoverage -DwithHistory=true

# View report
open target/pit-reports/*/index.html
```

### C#: Stryker.NET (v4.x)

```bash
# Install globally
dotnet tool install -g dotnet-stryker

# Or as local tool
dotnet new tool-manifest
dotnet tool install dotnet-stryker

# Run
dotnet stryker

# With options
dotnet stryker --break-at 80        # Fail if mutation score < 80%
dotnet stryker --mutation-level Advanced  # Use all mutators
dotnet stryker --since main         # Only test changed code
dotnet stryker --diff               # Enable incremental mode

# Configuration file (stryker-config.json)
{
  "stryker-config": {
    "project": "MyProject.csproj",
    "test-projects": ["MyProject.Tests.csproj"],
    "reporters": ["progress", "html", "json"],
    "mutation-level": "Advanced",
    "break-on-initial-test-failure": true,
    "thresholds": {
      "high": 80,
      "low": 60,
      "break": 70
    }
  }
}
```

### Scala: Stryker4s

```bash
# Add to plugins.sbt
addSbtPlugin("io.stryker-mutator" % "sbt-stryker4s" % "0.16.0")

# Run
sbt stryker

# Configuration (stryker4s.conf in project root)
stryker4s {
  mutate: ["src/main/scala/**/*.scala"]
  test-runner: {
    type: "sbt"
  }
  reporters: ["console", "html"]
  thresholds: {
    high: 80
    low: 60
    break: 70
  }
}
```

## Mutation Operators (2026)

### Arithmetic Operators

```python
# Original
result = a + b

# Possible mutations:
result = a - b    # Addition to subtraction
result = a * b    # Addition to multiplication
result = a / b    # Addition to division
result = a % b    # Addition to modulo
result = a         # Replace with left operand
result = b         # Replace with right operand
```

### Relational Operators (Boundary Mutations)

```python
# Original
if x > 10:

# Mutations:
if x >= 10:  # Boundary shift
if x < 10:   # Reverse comparison
if x <= 10:  # Reverse boundary
if x == 10:  # Equality
if x != 10:  # Inequality
if True:     # Constant replacement
if False:     # Constant replacement
```

### Logical Operators

```python
# Original
if a and b:

# Mutations:
if a or b:       # AND to OR
if not a and b:  # Negate left
if a and not b:  # Negate right
if False:        # Constant
if True:         # Constant
if a:            # Remove right
if b:            # Remove left
```

### Conditional Boundaries (Off-by-One)

```python
# Original
for i in range(10):
    process(i)

# Mutations:
for i in range(9):   # Off by one (decrement)
for i in range(11):  # Off by one (increment)
for i in range(0):   # Empty loop

# Original
while count < max:

# Mutations:
while count <= max:  # Change boundary
while count > max:   # Reverse
while True:          # Infinite loop
while False:         # Never execute
```

### Return Value Mutations

```python
# Original
def get_value():
    return 42

# Mutations:
def get_value():
    return 0      # Replace with 0
    return 1      # Replace with 1
    return -1     # Replace with -1
    return None   # Replace with None
    return ""     # Replace with empty string
    return []     # Replace with empty list
```

### Method Call Mutations

```python
# Original
def process():
    do_something()
    return result

# Mutations:
def process():
    # Remove do_something() call
    return result

# Original
list.append(item)

# Mutation:
# Remove append call (list unchanged)
```

### String Mutations (Stryker 2026)

```javascript
// Original
const message = "Hello, " + name;

// Mutations:
const message = "Hello, " - name;   // Concatenation to subtraction
const message = "Hello, ";          // Remove concatenation
const message = name;               // Remove prefix
```

### Modern Language Features (2026)

```javascript
// Optional chaining mutations
// Original:
const value = obj?.property?.nested;

// Mutations:
const value = obj.property?.nested;  // Remove first ?.
const value = obj?.property.nested;   // Remove second ?.
const value = obj.property.nested;   // Remove both ?.

// Nullish coalescing
// Original:
const value = input ?? defaultValue;

// Mutation:
const value = input || defaultValue;  // ?? to ||
const value = input && defaultValue;  // ?? to &&
const value = input;                   // Remove fallback

// Template literal mutations
// Original:
const msg = `Hello, ${name}!`;

// Mutations:
const msg = `Hello, ${name}`;      // Remove suffix
const msg = `Hello, !`;             // Remove placeholder
const msg = `Hello, !` + name;      // Split
const msg = "";                      // Empty string
```

## Interpreting Results

### Mutation Score

```
Mutation Score = (Killed Mutants / Total Mutants) × 100

Status indicators:
- Killed: Tests failed (good!)
- Survived: Tests passed (bad - coverage gap)
- Timeout: Tests took too long
- Skipped: Couldn't apply mutation
- Ignored: Mutant marked to ignore
- Error: Error during testing
```

### Target Scores (2026 Guidelines)

| Project Type | Minimum | Good | Excellent |
|--------------|---------|------|-----------|
| Greenfield | 70% | 80% | 90%+ |
| Legacy | 50% | 60% | 70%+ |
| Critical Systems | 80% | 90% | 95%+ |
| Libraries/Frameworks | 75% | 85% | 95%+ |

**Important**: 100% mutation score is NOT the goal. Some mutations are equivalent (don't change behavior) and some code is intentionally untested (e.g., error handling for impossible conditions).

### Reading Reports

Stryker HTML Report sections:
- **Overall**: Project-wide mutation score
- **By File**: Per-file breakdown
- **Survived**: Detailed view of surviving mutants
- **Killed**: All killed mutants (for verification)
- **Mutant States**: Timeline of mutant testing

## CI/CD Integration

### GitHub Actions (2026 Best Practices)

```yaml
# .github/workflows/mutation-test.yml
name: Mutation Testing

on:
  push:
    branches: [main]
  pull_request:
    paths:
      - 'src/**'
      - 'tests/**'

jobs:
  mutation-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Needed for incremental mode
      
      # JavaScript/TypeScript with Stryker
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Cache mutation testing results
        uses: actions/cache@v4
        with:
          path: .stryker
          key: stryker-${{ runner.os }}-${{ hashFiles('src/**') }}
          restore-keys: |
            stryker-${{ runner.os }}-
      
      - name: Run mutation tests (incremental)
        run: npx stryker run --incremental
      
      - name: Check mutation score
        run: |
          SCORE=$(cat reports/mutation/mutation.json | jq -r '.metrics.mutationScore')
          echo "Mutation score: $SCORE"
          if (( $(echo "$SCORE < 70" | bc -l) )); then
            echo "::error::Mutation score $SCORE% is below threshold of 70%"
            exit 1
          fi
      
      - name: Upload mutation report
        uses: actions/upload-artifact@v4
        with:
          name: mutation-report
          path: reports/mutation/
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('reports/mutation/mutation.json'));
            const metrics = report.metrics;
            
            const body = `## 🧬 Mutation Test Results
            
            | Metric | Value |
            |--------|-------|
            | **Mutation Score** | ${metrics.mutationScore.toFixed(1)}% |
            | Killed | ${metrics.killed} |
            | Survived | ${metrics.survived} |
            | Timeout | ${metrics.timeout} |
            | Ignored | ${metrics.ignored} |
            
            ${metrics.mutationScore >= 70 ? '✅ **PASSED**' : '❌ **FAILED**'} - Threshold: 70%
            
            <details>
            <summary>View full report</summary>
            
            - Killed: ${metrics.killed} mutants
            - Survived: ${metrics.survived} mutants  
            - Timeout: ${metrics.timeout} mutants
            - No coverage: ${metrics.noCoverage} mutants
            
            </details>
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

### Python with Mutmut

```yaml
# .github/workflows/mutation-python.yml
name: Mutation Testing (Python)

on: [push, pull_request]

jobs:
  mutation-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install mutmut
      
      - name: Run mutation tests
        run: mutmut run
      
      - name: Generate results
        run: |
          mutmut results > mutation-results.txt
          mutmut results --html
      
      - name: Check score
        run: |
          SCORE=$(mutmut results | grep "Mutation score" | awk '{print $3}' | tr -d '%')
          if (( $(echo "$SCORE < 60" | bc -l) )); then
            echo "Mutation score $SCORE% below threshold!"
            exit 1
          fi
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: mutation-report
          path: html/
```

### Quality Gates

```bash
#!/bin/bash
# mutation-gate.sh - Universal quality gate

MIN_SCORE=${1:-70}
TOOL=${2:-stryker}  # stryker, mutmut, pitest, stryker-net

case $TOOL in
  stryker)
    SCORE=$(cat reports/mutation/mutation.json | jq -r '.metrics.mutationScore')
    ;;
  mutmut)
    SCORE=$(mutmut results | grep "Mutation score" | awk '{print $3}' | tr -d '%')
    ;;
  pitest)
    SCORE=$(cat target/pit-reports/*/mutations.xml | grep -o 'mutationScore="[^"]*"' | cut -d'"' -f2)
    ;;
  stryker-net)
    SCORE=$(cat mutation-report.json | jq -r '.MutationScore')
    ;;
esac

echo "Tool: $TOOL"
echo "Minimum required: $MIN_SCORE%"
echo "Actual score: $SCORE%"

if (( $(echo "$SCORE < $MIN_SCORE" | bc -l) )); then
    echo "❌ FAILED: Mutation score below threshold"
    exit 1
else
    echo "✅ PASSED: Mutation score meets threshold"
    exit 0
fi
```

## Incremental Mutation Testing (2026)

### Why Incremental?

Full mutation testing can be slow. Incremental mode only tests:
- New/changed code
- Mutants affected by code changes
- Regression tests for previously surviving mutants

### StrykerJS Incremental Mode

```json
{
  "incremental": true,
  "incrementalFile": ".stryker/incremental.json",
  
  // Force full run when needed
  "force": false  // Set to true for CI, false for local
}
```

**Best Practices:**
- Use `--incremental` for local development (fast feedback)
- Run full run weekly or before releases
- Cache the incremental file in CI
- Force full run on `main` branch merges

### Mutmut Incremental

```bash
# Run only on changed files
mutmut run --paths-to-mutate $(git diff --name-only HEAD~1 | grep "\.py$")

# Or with since flag
mutmut run --since-ref=origin/main
```

### PIT History

```bash
# Enable history tracking
mvn org.pitest:pitest-maven:mutationCoverage -DwithHistory=true

# Faster incremental run
mvn org.pitest:pitest-maven:mutationCoverage -DhistoryInputFile=target/pit-history.txt
```

## Improving Mutation Score

### Common Gaps and Solutions

1. **Boundary Testing**

```python
# Bad - doesn't test boundary
def test_age_verification():
    assert is_adult(25) is True
    assert is_adult(15) is False

# Good - tests boundary
def test_age_verification():
    assert is_adult(18) is True   # Boundary
    assert is_adult(17) is False  # Just below
    assert is_adult(19) is True    # Just above
```

2. **Exception Testing**

```python
# Bad - no exception testing
def test_divide():
    assert divide(10, 2) == 5

# Good - tests exceptions
def test_divide():
    assert divide(10, 2) == 5
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)
    with pytest.raises(TypeError):
        divide("10", 2)
```

3. **State Verification (Not Just Return Values)**

```python
# Bad - only tests return value
def test_add_item():
    cart = Cart()
    assert cart.add("apple") == True

# Good - tests state change
def test_add_item():
    cart = Cart()
    cart.add("apple")
    assert "apple" in cart.items
    assert cart.count == 1
    assert cart.total > 0
```

4. **Negative Testing**

```python
# Test what shouldn't happen
def test_invalid_input_rejected():
    assert process(None) is False
    assert process("") is False
    assert process(-1) is False
```

## Handling Equivalent Mutants

Some mutants are "equivalent" - they don't actually change behavior:

```python
# Original
def calculate(a, b):
    return (a + b) * 2

# This mutation is equivalent:
def calculate(a, b):
    return (a + b) + (a + b)  # Same as * 2
```

### Strategies

1. **Ignore Specific Mutants:**

```javascript
// Stryker: Disable specific mutants
// Stryker disable next-line
const value = expensiveOperation();  // Won't mutate this line

// Or with comment
def calculate(a, b):  # mutmut: ignore
    return (a + b) * 2  # This mutant is equivalent
```

2. **Configure Mutators:**

```json
{
  "mutator": {
    "excludedMutations": [
      "StringLiteral",
      "ArrayDeclaration"
    ]
  }
}
```

3. **Accept Imperfection**: 
   - 100% mutation score is not realistic
   - Focus on improving over time
   - Document known equivalent mutants

## Best Practices (2026)

1. **Start Small**: Focus on critical business logic first
2. **Use Incremental Mode**: For faster feedback during development
3. **Set Realistic Thresholds**: Increase gradually, not all at once
4. **Integrate with CI**: Run on PRs with reasonable thresholds
5. **Focus on Critical Code**: Business logic over boilerplate
6. **Review Surviving Mutants**: Understand why they survived
7. **Document Exceptions**: Track equivalent mutants and exclusions
8. **Team Education**: Train team on writing mutation-killing tests
9. **Balance Speed vs Coverage**: Use full runs periodically, incremental daily
10. **Dashboard Integration**: Track mutation score trends over time

## Stryker Dashboard

Upload results to Stryker Dashboard for tracking:

```bash
# Enable dashboard reporter
npx stryker run --reporters dashboard

# Requires API key in environment
export STRYKER_DASHBOARD_API_KEY=your_key
```

Features:
- Historical trend tracking
- Branch comparison
- PR status badges
- Team visibility

## Resources

- [Stryker Mutator](https://stryker-mutator.io/)
- [StrykerJS Documentation](https://stryker-mutator.io/docs/stryker-js/introduction/)
- [Mutation Testing Elements](https://github.com/stryker-mutator/mutation-testing-elements)
- [Mutmut](https://github.com/mutmut-mutator/mutmut)
- [PIT](https://pitest.org/)
- [Stryker.NET](https://stryker-mutator.io/docs/stryker-net/introduction/)
