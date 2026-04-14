# Test Data Management Strategy

## Principles

### Determinism
All test data must be deterministic. Random values break snapshot tests and make failures irreproducible.

### Isolation
Each test should create its own data. Never share mutable test data between tests.

### Cleanup
Clean up test data after each test run. Use transactions or teardown functions.

## Strategies

### 1. Inline Builders (Recommended)
```typescript
const user = makeUser({ role: 'admin' });
```

### 2. Fixture Files
For complex data that doesn't fit builder pattern:
```json
{
  "complexEntity": {
    "nested": { "deeply": "configured" }
  }
}
```

### 3. Database Seeding
For integration tests:
```bash
npm run seed -- --scenario=basic-auth
```

## Data Lifecycle

```
Test Start → Create Data → Run Test → Assert → Cleanup
```

Use `beforeEach` for setup, `afterEach` for cleanup.

## Common Pitfalls

- **Shared state**: Tests affecting each other's data
- **Stale fixtures**: Test data not updated with schema changes
- **Over-mocking**: Using mocks when real data would be better
- **Under-mocking**: Using real DB when mocks would be faster
