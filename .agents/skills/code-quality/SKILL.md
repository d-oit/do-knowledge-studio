---
name: code-quality
description: Review and improve code quality across any programming language. Use when conducting code reviews, refactoring for best practices, identifying code smells, or improving maintainability.
license: MIT
---

# Code Quality Reviewer

Expert skill for code quality assessment and improvement.

## Quick Check

- [ ] No magic numbers (use named constants)
- [ ] Functions under 50 lines
- [ ] DRY principle followed
- [ ] Error handling implemented
- [ ] Tests cover edge cases
- [ ] No code smells

## When to Use

- Code reviews
- Refactoring
- Identifying code smells
- Pre-commit quality checks
- Legacy modernization

## Core Principles

### DRY
```python
# Bad: Duplicated
def calc_tax_us(p): return p * 0.08
def calc_tax_eu(p): return p * 0.20

# Good: Extract constant
TAX_RATES = {'US': 0.08, 'EU': 0.20}
def calc_tax(p, region): return p * TAX_RATES[region]
```

### Single Responsibility
```javascript
// Bad: One function does everything
function process(data) { validate(data); save(data); notify(data); }

// Good: Separate concerns
validate(data); save(data); notify(data);
```

### No Magic Numbers
```rust
// Bad
if timeout > 30000 { /* ... */ }

// Good
const TIMEOUT_MS: u32 = 30000;
if timeout > TIMEOUT_MS { /* ... */ }
```

## Code Smells

### Bloaters
- Long Method (>50 lines)
- Large Class (>300 lines)
- Long Parameter List (>4 params)

### Object-Orientation Abusers
- Switch Statements (replace with polymorphism)
- Temporary Field
- Refused Bequest

### Dispensables
- Duplicate Code
- Lazy Class
- Dead Code
- Speculative Generality

### Couplers
- Feature Envy
- Inappropriate Intimacy
- Message Chains (obj.getX().getY())

## Quality Criteria

- [ ] No magic numbers
- [ ] Functions under 50 lines
- [ ] Classes under 300 lines
- [ ] DRY followed
- [ ] Error handling complete
- [ ] Tests cover edge cases
- [ ] No code smells

## Best Practices

### DO:
- Use named constants
- Write small functions
- Handle errors explicitly
- Write edge case tests
- Follow language idioms
- Refactor continuously

### DON'T:
- Copy-paste code
- Ignore compiler warnings
- Skip error handling
- Use single-letter names
- Mix abstraction levels
- Return null when possible

## Tools by Language

| Language | Linter | Formatter | Test |
|----------|--------|-----------|------|
| Python | ruff | black | pytest |
| TypeScript | eslint | prettier | jest |
| Rust | clippy | rustfmt | cargo test |
| Go | golangci-lint | gofmt | go test |

## References

- `agents-docs/SKILL.md` - Skill authoring guide
