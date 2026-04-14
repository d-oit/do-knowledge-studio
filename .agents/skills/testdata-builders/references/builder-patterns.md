# Test Data Builder Patterns

## Factory Pattern

The builder/factory pattern provides a consistent way to create test entities with sensible defaults that can be overridden when needed.

### Basic Builder

```typescript
function makeEntity<T>(defaults: T): (overrides?: Partial<T>) => T {
  return (overrides = {}) => ({ ...defaults, ...overrides });
}

const makeUser = makeEntity({
  id: 'user-1',
  email: 'user-1@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: new Date('2026-01-01'),
});

// Usage
const user = makeUser();
const admin = makeUser({ role: 'admin', email: 'admin@test.com' });
```

### Sequence-Based IDs

```typescript
let _nextId = 1;
const nextId = () => _nextId++;

function makeUser(overrides = {}) {
  const id = nextId();
  return {
    id: `user-${id}`,
    email: `user-${id}@example.com`,
    name: `Test User ${id}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
```

## Best Practices

### DO
- Use deterministic values (no randomness unless seeded)
- Include all required fields
- Provide `withOverrides` pattern
- Keep defaults realistic
- Export types alongside builders

### DON'T
- Use `Math.random()` - breaks snapshot tests
- Create complex nested objects inline
- Hard-code specific business logic
- Skip required fields

## Common Entity Types

- User/Account entities
- Resource/Document entities
- Permission/Grant entities
- Session/Auth entities
- Audit/Log entities
