# Breaking Change Catalog

Common breaking changes by library and framework with 2025-2026 updates.

## Overview

This catalog documents common breaking changes organized by technology and provides migration strategies based on the latest stable versions as of 2026.

## JavaScript/Node.js

### Node.js 18 to 20 (2023-2024)

**Key Breaking Changes:**

**1. Permission Model (Experimental)**
- New `--experimental-permission` flag restricts file system, child process, and worker thread access
- Runtime deprecations for `url.parse()` with invalid ports
- WASI version now required (no default)

**Migration:**
```javascript
// Node.js 20 requires explicit permission flags
node --experimental-permission --allow-fs-read=* --allow-fs-write=* app.js

// Update WASI usage
const wasi = new WASI({
  version: 'preview1',  // Now required
  // ... other options
});
```

**2. ESM Loader Hooks**
- Custom ESM loader hooks now run in a dedicated thread
- `import.meta.resolve()` returns synchronously (aligned with browser behavior)

**3. V8 11.3 Update**
- New features: `String.prototype.isWellFormed`, `toWellFormed`
- Resizable ArrayBuffer and growable SharedArrayBuffer
- RegExp `v` flag with set notation

### Express.js 4.x to 5.x

**Breaking Changes:**
- Error handling middleware must take 4 arguments
- Removed `req.param()` method
- Changed behavior of `res.send()` with numbers

**Migration:**
```javascript
// Before (Express 4)
app.use(function(err, req, res) {
  res.status(500).send(err);
});

// After (Express 5)
app.use(function(err, req, res, next) {  // Must have 4 args
  res.status(500).send(err.message);
});
```

### React 17 to 18

**Breaking Changes:**
- Automatic batching enabled by default
- `ReactDOM.render` replaced by `createRoot`
- Strict Mode changes

**Migration:**
```javascript
// Before (React 17)
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// After (React 18)
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

## Python

### Python 3.11 to 3.12 (2023)

**Major Breaking Changes:**

**1. distutils Removal (PEP 632)**
- `distutils` package removed from standard library
- Use `setuptools` or alternative build backends

**Migration:**
```python
# Before (Python 3.11)
from distutils.core import setup
from distutils.extension import Extension

# After (Python 3.12)
from setuptools import setup, Extension
# Or use modern build systems like hatchling, poetry, flit
```

**2. New Type Parameter Syntax (PEP 695)**
- More compact generic syntax
- New `type` statement for type aliases

**Migration:**
```python
# Before (Python 3.11)
from typing import TypeVar, Generic, Callable
T = TypeVar('T')

class Container(Generic[T]):
    def get_item(self) -> T: ...

# After (Python 3.12)
class Container[T]:
    def get_item(self) -> T: ...

# Type aliases
type IntFunc[**P] = Callable[P, int]  # ParamSpec
type Point[T] = tuple[T, T]  # Generic alias
```

**3. F-string Syntax Changes (PEP 701)**
- F-strings now allow any valid Python expression
- Quote reuse, multi-line expressions, comments, backslashes

**Migration:**
```python
# Python 3.12 allows these (previously SyntaxError)
f"This is the playlist: {", ".join(songs)}"
f"Path: {value.replace("\\", "/")}"  # Backslashes now allowed
```

**4. Deprecated Modules Removed**
- `asynchat`, `asyncore` removed (use `asyncio`)
- `imp` module removed (use `importlib`)
- Various `unittest.TestCase` method aliases removed

**5. Comprehension Inlining (PEP 709)**
- Comprehensions no longer create separate function scope
- Changes to `locals()` behavior in comprehensions
- No separate frame in tracebacks

**Migration:**
```python
# Before - could iterate over locals() safely
for k in locals(): ...

# After - may raise RuntimeError when traced
# Fix: Create copy first
keys = list(locals())
for k in keys: ...
```

### Django 3.x to 4.x to 5.x

**Breaking Changes:**
- `django.conf.urls.url()` removed (use `re_path()` or `path()`)
- `django.utils.translation.ugettext()` removed (use `gettext()`)
- CSRF_COOKIE_MASKED setting removed
- Django 5.0: Database-generated columns, simplified password validators

**Migration:**
```python
# Before (Django 3.x)
from django.conf.urls import url
from django.utils.translation import ugettext as _

url(r'^api/', include('api.urls')),
_('Hello')

# After (Django 4.x+)
from django.urls import re_path
from django.utils.translation import gettext as _

re_path(r'^api/', include('api.urls')),
gettext('Hello')
```

### Flask 1.x to 2.x to 3.x

**Breaking Changes:**
- Flask 2.x: `JSONEncoder`/`JSONDecoder` moved to `app.json`
- Flask 3.x: Removed deprecated `app.before_first_request`
- CLI changes in all versions

**Migration:**
```python
# Before (Flask 1.x)
from flask import json

class CustomJSONEncoder(json.JSONEncoder):
    ...

# After (Flask 2.x+)
class CustomJSONProvider(app.json.JSONProvider):
    ...
app.json = CustomJSONProvider(app)
```

## Java

### Spring Boot 2.x to 3.x (2022-2023)

**Breaking Changes:**
- Requires Java 17+ (previously Java 11)
- Jakarta EE namespace change (`javax.*` to `jakarta.*`)
- Configuration properties changes
- GraalVM native image support changes

**Migration:**
```java
// Before (Spring Boot 2.x)
import javax.persistence.Entity;
import javax.validation.constraints.NotNull;

// After (Spring Boot 3.x)
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotNull;
```

### Java 17 to Java 21 (LTS Release, September 2023)

**Major Features (Not Breaking, but Migration Considerations):**

**1. Pattern Matching for switch (JEP 441)**
- Finalized after multiple preview releases
- Type patterns in case labels
- `when` clauses for guards
- Null handling in switch

**Migration Example:**
```java
// Before (Java 17)
static String formatter(Object obj) {
    if (obj instanceof Integer i) {
        return String.format("int %d", i);
    } else if (obj instanceof Long l) {
        return String.format("long %d", l);
    }
    return "unknown";
}

// After (Java 21)
static String formatter(Object obj) {
    return switch (obj) {
        case Integer i -> String.format("int %d", i);
        case Long l    -> String.format("long %d", l);
        case Double d  -> String.format("double %f", d);
        case String s  -> String.format("String %s", s);
        case null      -> "null";
        default        -> obj.toString();
    };
}
```

**2. Virtual Threads (JEP 444)**
- Lightweight threads for high-throughput applications
- `Executors.newVirtualThreadPerTaskExecutor()`
- Considerations for thread-local variables

**Migration Example:**
```java
// Before - Platform threads
try (var executor = Executors.newCachedThreadPool()) {
    IntStream.range(0, 10_000).forEach(i -> {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return i;
        });
    });
}

// After - Virtual threads (Java 21)
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i -> {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return i;
        });
    });
}
```

**3. Record Patterns (JEP 440)**
- Deconstruct records in pattern matching
- Nested record patterns

**Migration Example:**
```java
// Before
if (obj instanceof Point p) {
    int x = p.x();
    int y = p.y();
    System.out.println(x + y);
}

// After (Java 21)
if (obj instanceof Point(int x, int y)) {
    System.out.println(x + y);
}

// In switch
switch (obj) {
    case Point(int x, int y) when x == y -> 
        System.out.println("On diagonal");
    case Point(int x, int y) -> 
        System.out.println("Point at " + x + ", " + y);
}
```

**4. String Templates (Preview in Java 21, JEP 430)**
```java
// String templates (preview)
String name = "Joan";
String info = STR."My name is \{name}";
```

**5. Sequenced Collections (JEP 431)**
```java
// New interfaces for ordered collections
SequencedCollection<String> seq = new ArrayList<>();
seq.addFirst("first");  // New method
seq.addLast("last");    // New method
String first = seq.getFirst();  // New method
String last = seq.getLast();    // New method
```

## Databases

### PostgreSQL 14 to 15 to 16

**Breaking Changes:**
- PostgreSQL 15: `jsonb` subscription operator behavior change with NULLs
- PostgreSQL 16: SQL/JSON standard support, new JSON functions
- Statistics changes in optimizer

**Migration:**
```sql
-- PostgreSQL 15+ - Add explicit NULL handling if needed
SELECT COALESCE(jsonb_column -> 'key', 'null'::jsonb) FROM table;

-- PostgreSQL 16 - New JSON constructor functions
SELECT JSON_OBJECT('key': value);  -- SQL/JSON standard
```

### MongoDB 4.x to 5.x to 7.x

**Breaking Changes:**
- MongoDB 5.0: Removed deprecated operators, aggregation changes
- MongoDB 6.0: Removed legacy API support
- MongoDB 7.0: Atlas Search enhancements, time series improvements

## DevOps Tools

### Kubernetes 1.24 to 1.28+ (2023-2024)

**Breaking Changes:**
- Docker runtime deprecation (dockershim removal in 1.24)
- PodSecurityPolicy removal (replaced by Pod Security Admission)
- Several beta API removals
- Gateway API v1 graduation

**Migration:**
```yaml
# Before - PodSecurityPolicy (removed in 1.25)
apiVersion: policy/v1beta1
kind: PodSecurityPolicy

# After - Pod Security Admission (built-in)
# Configure via namespace labels
apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Terraform 1.0 to 1.5+ (2023-2024)

**Breaking Changes:**
- Terraform 1.1+: Moved `.terraform.lock.hcl` requirements
- Terraform 1.4+: `terraform plan` output format changes
- Terraform 1.5+: `terraform test` framework (experimental)
- Terraform 1.6+: `import` block for generating configuration

**Migration:**
```hcl
# Terraform 1.5+ import blocks (generates configuration)
import {
  to = aws_instance.example
  id = "i-1234567890abcdef0"
}
```

## API Versioning Breaking Changes

### Common API Breaking Change Patterns

| Change Type | Severity | Example |
|-------------|----------|---------|
| **Field removal** | Critical | `user.email` removed without notice |
| **Type change** | High | `user.id` changed from int to string |
| **Format change** | High | Date format changed from ISO 8601 to Unix timestamp |
| **Endpoint removal** | Critical | `/v1/users` endpoint deprecated and removed |
| **Authentication change** | Critical | API key moved from header to query parameter |
| **Default value change** | Medium | Pagination default changed from 100 to 10 |
| **Behavior change** | High | `POST` now returns 201 instead of 200 |
| **Rate limiting change** | Medium | Rate limit reduced from 1000 to 100 req/min |

### API Versioning Strategies

**1. URL Path Versioning**
```
/api/v1/users
/api/v2/users
```

**2. Header Versioning**
```
Accept: application/vnd.api+json;version=2
API-Version: 2
```

**3. Content Negotiation**
```
Accept: application/vnd.myapi.v2+json
```

### Breaking Change Communication Best Practices

1. **Deprecation headers** - Include `Sunset` and `Deprecation` headers
2. **Version lifecycle** - Document support timeline
3. **Migration guides** - Provide detailed upgrade documentation
4. **Compatibility layers** - Support multiple versions during transition
5. **Breaking change window** - Scheduled maintenance for breaking changes

## Detection Strategies (2025-2026)

### Static Analysis

Use tools to detect breaking changes early:

```bash
# Python: pyupgrade with modern checks
pyupgrade --py311-plus **/*.py

# JavaScript/TypeScript: jscodeshift with type-aware transforms
npx jscodeshift -t transforms/ api-migration.js

# Java: OpenRewrite with comprehensive recipes
mvn rewrite:run -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-spring:LATEST

# Python: mypy with strict mode for API compatibility
mypy --strict --warn-return-any --warn-unreachable
```

### Runtime Detection

```python
# Python: Deprecation warnings with action
import warnings
warnings.filterwarnings('default', category=DeprecationWarning)
warnings.filterwarnings('error', category=FutureWarning)  # Fail on future warnings

# JavaScript: Process warnings
process.on('warning', (warning) => {
  console.warn(warning.name);    // 'DeprecationWarning'
  console.warn(warning.message); // 'util.print is deprecated'
});
```

### API Compatibility Testing

```python
# Contract testing with Pact or similar
import pytest
from pact import Consumer, Provider

@pytest.fixture
def pact():
    return Consumer('my-consumer').has_pact_with(Provider('my-provider'))

def test_get_user(pact):
    (pact
     .given('user exists')
     .upon_receiving('a request for user')
     .with_request('GET', '/api/v2/users/1')
     .will_respond_with(200, body={
         'id': 1,
         'name': 'Test User',
         'email': 'test@example.com'
     }))
    
    with pact:
        result = get_user(1)
        assert result['id'] == 1
```

## Breaking Change Severity Matrix

| Severity | Definition | API Change Example | Dependency Example |
|----------|------------|-------------------|-------------------|
| **Critical** | Application won't start | Removed required function | Removed required class |
| **High** | Feature broken, data loss risk | API response format changed | Default behavior changed |
| **Medium** | Behavior changed, workarounds exist | Default value changed | Deprecated feature removal |
| **Low** | Warnings, cosmetic changes | Deprecation notices | Documentation updates |

## Migration Planning Template (2026)

```markdown
## Migration: [Library] [Version]

### Breaking Changes Analysis
- [ ] API surface changes identified
- [ ] Behavior changes documented
- [ ] Deprecation timeline reviewed
- [ ] Security implications assessed

### Impact Assessment
- Services affected: [List]
- Lines of code impacted: [Count]
- Test coverage affected: [Percentage]
- Estimated effort: [Hours/Days/Weeks]
- Risk level: [Critical/High/Medium/Low]

### Migration Strategy
- [ ] Gradual rollout with feature flags
- [ ] Blue-green deployment capability
- [ ] Rollback window defined (max: 4 hours)
- [ ] Data compatibility verified

### Testing Strategy
- [ ] Unit tests updated
- [ ] Integration tests pass
- [ ] Contract tests verified
- [ ] Load tests completed
- [ ] Chaos engineering scenarios tested

### Monitoring Plan
- Error rate threshold: [X%]
- Latency threshold: [X ms]
- Business metric baselines recorded
- Alerting rules configured

### Rollback Plan
- Previous version: [X.Y.Z]
- Rollback time: [X minutes]
- Data compatibility: [Yes/No]
- Rollback validation steps: [List]

### Timeline
- Testing start: [YYYY-MM-DD]
- Staging deployment: [YYYY-MM-DD]
- Production rollout: [YYYY-MM-DD]
- Monitoring period: [X days]
- Completion: [YYYY-MM-DD]
```

## References

- Python 3.12 What's New: https://docs.python.org/3/whatsnew/3.12.html
- Node.js 20 Release Notes: https://nodejs.org/en/blog/release/v20.0.0
- Java 21 Release Notes: https://openjdk.org/projects/jdk/21/
- JEP 441 - Pattern Matching for switch: https://openjdk.org/jeps/441
- JEP 444 - Virtual Threads: https://openjdk.org/jeps/444
- Kubernetes Deprecation Guide: https://kubernetes.io/docs/reference/using-api/deprecation-guide/
