---
name: testing-strategy
description: Design comprehensive testing strategies with modern techniques. Use for test planning, property-based testing, visual regression, load testing, mutation testing, and E2E test generation. Includes coverage analysis, test maintenance strategies, and CI/CD integration.
license: MIT
---

# Testing Strategy

Design and implement comprehensive testing strategies with modern techniques for reliable, maintainable test suites.

## When to Use

- **Test planning** - Designing test strategy for new projects or features
- **Property-based testing** - Generating tests from invariants with Hypothesis/QuickCheck
- **Visual regression testing** - Detecting unintended UI changes
- **Load/Performance testing** - Validating system behavior under load
- **Mutation testing** - Verifying test suite quality by injecting bugs
- **E2E test generation** - Creating Playwright/Cypress tests from user flows
- **Test maintenance** - Strategies for keeping tests healthy over time

## Core Workflow

### Phase 1: Test Planning
1. **Identify test levels** - Unit, integration, E2E, contract, visual
2. **Define coverage goals** - Code coverage targets, critical path identification
3. **Choose frameworks** - Match tools to tech stack and team skills
4. **Design test data** - Fixtures, factories, test databases
5. **Plan CI integration** - When to run which tests

### Phase 2: Implementation
1. **Write unit tests** - Test individual units in isolation
2. **Add integration tests** - Test component interactions
3. **Create E2E tests** - Test complete user workflows
4. **Set up specialized testing** - Performance, visual, contract
5. **Configure CI pipeline** - Parallelization, reporting

### Phase 3: Maintenance
1. **Monitor flaky tests** - Detect and fix instability
2. **Track coverage** - Ensure coverage doesn't regress
3. **Review test value** - Remove obsolete tests, add missing ones
4. **Update test data** - Keep fixtures current with schema changes

## Test Pyramid

```
       /\
      /  \
     / E2E \      <- Few tests, high confidence, slow
    /--------\
   / Integration\  <- Medium number, component testing
  /--------------\
 /     Unit       \ <- Many tests, fast, focused
/------------------\
```

**Recommended Distribution**:
- 70% Unit tests
- 20% Integration tests
- 10% E2E tests

## Property-Based Testing

### Concept
Instead of example-based tests, define properties that should always hold true. Framework generates random inputs to find counterexamples.

### Python with Hypothesis
```python
from hypothesis import given, strategies as st

# Property: reversing a list twice returns original list
@given(st.lists(st.integers()))
def test_double_reversing_restores_list(lst):
    assert list(reversed(list(reversed(lst)))) == lst

# Property: sorting is idempotent
@given(st.lists(st.integers()))
def test_sorting_is_idempotent(lst):
    assert sorted(sorted(lst)) == sorted(lst)

# Property: encode/decode roundtrip
@given(st.text())
def test_json_roundtrip(text):
    import json
    assert json.loads(json.dumps(text)) == text
```

See `references/property-testing-patterns.md` for advanced patterns including stateful testing.

## Visual Regression Testing

### Concept
Capture screenshots of UI components/pages and compare against baselines to detect unintended visual changes.

### Playwright Example
```javascript
const { test, expect } = require('@playwright/test');

test('homepage visual regression', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,
  });
});
```

See `references/visual-testing-guide.md` for Storybook, Chromatic, and multi-browser setups.

## Load Testing

### k6 Example
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('https://api.example.com/orders');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

See `references/load-testing-scenarios.md` for Artillery, JMeter, and advanced patterns.

## Mutation Testing

### Concept
Inject artificial bugs (mutations) into code to verify tests catch them. Measures test suite effectiveness.

### Python with mutmut
```bash
pip install mutmut
mutmut run --paths-to-mutate=src/ --tests-dir=tests/
mutmut results
```

See `references/mutation-testing.md` for Stryker (JS), Pitest (Java), and interpreting results.

## E2E Test Generation

### From User Flows
```javascript
test('user checkout flow', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="search-input"]', 'laptop');
  await page.click('text=MacBook Pro');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('text=Checkout');
  await expect(page.locator('text=Order confirmed')).toBeVisible();
});
```

## Test Maintenance Strategies

### 1. Flaky Test Detection
```yaml
# Retry flaky tests up to 3 times
- name: Run tests
  run: |
    for i in 1 2 3; do
      npm test && break
      echo "Attempt $i failed, retrying..."
      sleep 5
    done
```

### 2. Test Data Factories
```python
class UserFactory(factory.Factory):
    class Meta:
        model = User
    email = factory.Sequence(lambda n: f'user{n}@example.com')
    name = factory.Faker('name')
```

See `references/test-maintenance.md` for coverage tracking and test health metrics.

## CI/CD Integration

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- --testPathPattern=unit
  
  integration-tests:
    needs: unit-tests
    services:
      postgres:
        image: postgres:15
    steps:
      - run: npm run test:integration
  
  e2e-tests:
    needs: integration-tests
    steps:
      - run: npx playwright test
```

## Quality Checklist

- [ ] Unit tests for business logic
- [ ] Integration tests for database/API interactions
- [ ] E2E tests for critical user journeys
- [ ] Property-based tests for invariants
- [ ] Visual regression tests for UI components
- [ ] Load tests for performance-critical endpoints
- [ ] Mutation testing score > 70%
- [ ] Code coverage > 80%
- [ ] Flaky test rate < 5%
- [ ] Test execution time < 10 minutes (CI)

## References

- `references/property-testing-patterns.md` - Advanced property-based testing
- `references/visual-testing-guide.md` - Visual testing platforms
- `references/load-testing-scenarios.md` - Pre-built load test scenarios
- `references/mutation-testing.md` - Mutation testing tools
- `references/test-maintenance.md` - Test health monitoring
