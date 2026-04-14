# Property-Based Testing Patterns

Advanced patterns for property-based testing with Hypothesis, QuickCheck, and fast-check.

## Stateful Testing

Test stateful systems with model-based testing.

### Python with Hypothesis
```python
from hypothesis import given, strategies as st, settings
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, precondition

class DatabaseMachine(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.database = {}
    
    @rule(key=st.text(min_size=1), value=st.integers())
    def write(self, key, value):
        self.database[key] = value
    
    @rule(key=st.text(min_size=1))
    def read(self, key):
        return self.database.get(key)
    
    @rule(key=st.text(min_size=1))
    def delete(self, key):
        if key in self.database:
            del self.database[key]
    
    @invariant()
    def keys_are_strings(self):
        assert all(isinstance(k, str) for k in self.database.keys())
    
    @invariant()
    def values_are_integers(self):
        assert all(isinstance(v, int) for v in self.database.values())

TestDatabase = DatabaseMachine.TestCase
```

## Custom Strategies

### Composite Strategies
```python
from hypothesis import given, strategies as st

# Custom email strategy
email_strategy = st.builds(
    lambda user, domain: f"{user}@{domain}",
    user=st.text(alphabet="abcdefghijklmnopqrstuvwxyz0123456789.-", min_size=1, max_size=64),
    domain=st.sampled_from(["example.com", "test.org", "mail.net"])
)

# Date range strategy
date_range_strategy = st.tuples(
    st.dates(min_value=date(2020, 1, 1), max_value=date(2024, 12, 31)),
    st.dates(min_value=date(2020, 1, 1), max_value=date(2024, 12, 31))
).filter(lambda x: x[0] <= x[1])
```

### Recursive Data Structures
```python
from hypothesis import given, strategies as st

json_strategy = st.recursive(
    st.one_of(st.none(), st.booleans(), st.integers(), st.text()),
    lambda children: st.one_of(
        st.lists(children),
        st.dictionaries(st.text(), children)
    ),
    max_leaves=10
)

@given(json_strategy)
def test_json_handling(data):
    # Test that your code handles any JSON-like structure
    result = process_json(data)
    assert result is not None
```

## Common Properties

### Roundtrip Properties
```python
@given(st.text())
def test_serialization_roundtrip(text):
    """Serializing then deserializing should restore original."""
    serialized = serialize(text)
    deserialized = deserialize(serialized)
    assert deserialized == text
```

### Idempotence
```python
@given(st.lists(st.integers()))
def test_sorting_idempotent(lst):
    """Sorting twice equals sorting once."""
    once = sorted(lst)
    twice = sorted(once)
    assert once == twice
```

### Commutativity
```python
@given(st.integers(), st.integers())
def test_addition_commutative(a, b):
    """a + b == b + a"""
    assert a + b == b + a
```

### Associativity
```python
@given(st.lists(st.integers()), st.lists(st.integers()), st.lists(st.integers()))
def test_list_concat_associative(a, b, c):
    """(a + b) + c == a + (b + c)"""
    left = (a + b) + c
    right = a + (b + c)
    assert left == right
```

### Inverses
```python
@given(st.integers())
def test_increment_decrement_inverse(x):
    """decrement(increment(x)) == x"""
    assert decrement(increment(x)) == x
```

## Fast-Check (JavaScript)

```javascript
const fc = require('fast-check');

// Property test
test('should always contain its substrings', () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), (a, b) => {
      expect((a + b)).toContain(a);
      expect((a + b)).toContain(b);
    })
  );
});

// Async property test
test('should handle async code', async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), async (text) => {
      const result = await asyncProcess(text);
      expect(result).toBeDefined();
    })
  );
});
```
