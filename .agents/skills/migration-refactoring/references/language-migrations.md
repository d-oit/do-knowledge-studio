# Language Migrations

Framework migration guides with 2025-2026 updates for Python 3.12, Node.js 20, and Java 21.

## Overview

This guide provides migration paths for major framework and language upgrades, incorporating the latest features and breaking changes as of 2026.

## Python 3.11 to Python 3.12 (2023 Release)

### Key Migration Areas

**1. distutils Removal (PEP 632)**

The `distutils` package has been completely removed from the standard library.

**Migration:**
```python
# Before (Python 3.11)
from distutils.core import setup
from distutils.extension import Extension
from distutils.command.build_ext import build_ext

setup(
    name='my_package',
    ext_modules=[Extension('my_module', ['my_module.c'])],
    cmdclass={'build_ext': build_ext}
)

# After (Python 3.12) - Option 1: setuptools
from setuptools import setup, Extension
from setuptools.command.build_ext import build_ext

setup(
    name='my_package',
    ext_modules=[Extension('my_module', ['my_module.c'])],
    cmdclass={'build_ext': build_ext}
)

# After (Python 3.12) - Option 2: Modern build backend (recommended)
# pyproject.toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "my_package"
version = "1.0.0"
```

**2. New Type Parameter Syntax (PEP 695)**

More compact and explicit generics with new `type` statement for type aliases.

**Migration:**
```python
# Before (Python 3.11)
from typing import TypeVar, Generic, Callable, ParamSpec, TypeVarTuple, Unpack

T = TypeVar('T')
T_co = TypeVar('T_co', covariant=True)
P = ParamSpec('P')
Ts = TypeVarTuple('Ts')

class Container(Generic[T]):
    def get_item(self) -> T: ...

class Processor(Generic[P, T]):
    def process(self, *args: P.args, **kwargs: P.kwargs) -> T: ...

# Type aliases
from typing import TypeAlias
Vector: TypeAlias = list[float]

# After (Python 3.12) - New syntax
class Container[T]:
    def get_item(self) -> T: ...

class Processor[**P, T]:
    def process(self, *args: P.args, **kwargs: P.kwargs) -> T: ...

# Type statement for aliases
type Vector = list[float]
type Point[T] = tuple[T, T]  # Generic type alias

# ParamSpec and TypeVarTuple
type IntFunc[**P] = Callable[P, int]
type LabeledTuple[*Ts] = tuple[str, *Ts]
type HashableSequence[T: Hashable] = Sequence[T]
type IntOrStrSequence[T: (int, str)] = Sequence[T]
```

**3. F-string Enhancements (PEP 701)**

F-strings now support any valid Python expression, including quote reuse, multi-line expressions, and backslashes.

**Migration:**
```python
# Before - Had to use workarounds
songs = ['Take me back to Eden', 'Alkaline', 'Ascensionism']
f"This is the playlist: {', '.join(songs)}"  # SyntaxError in < 3.12

# After (Python 3.12) - All of these work
# Quote reuse
f"This is the playlist: {", ".join(songs)}"

# Multi-line expressions with comments
f"This is the playlist: {", ".join([
    'Take me back to Eden',  # My favorite
    'Alkaline',              # Great track
    'Ascensionism'           # Awesome
])}"

# Backslashes (previously not allowed in f-strings)
f"Path: {value.replace("\\", "/")}"

# Arbitrary nesting
f"{f"{f"{f"{1+1}"}"}"}"  # Works now

# Unicode escape sequences
f"Value: {"\N{BLACK HEART SUIT}"}"
```

**4. Comprehension Inlining (PEP 709)**

Comprehensions are now inlined, changing behavior of `locals()` and tracebacks.

**Migration:**
```python
# Before (Python 3.11) - Worked fine
[k for k in locals()]  # OK

# After (Python 3.12) - May raise RuntimeError when traced
# Fix: Create copy first
keys = list(locals())
[k for k in keys]  # Always safe

# Note: Tracebacks no longer show comprehensions as separate frames
# This affects debugging and profiling
```

**5. Per-Interpreter GIL (PEP 684)**

Each interpreter can now have its own GIL (C-API only for 3.12, Python API expected in 3.13).

```c
// C API usage (Python 3.12)
#include <Python.h>

PyInterpreterConfig config = {
    .check_multi_interp_extensions = 1,
    .gil = PyInterpreterConfig_OWN_GIL,
};
PyThreadState *tstate = NULL;
PyStatus status = Py_NewInterpreterFromConfig(&tstate, &config);
```

**6. Removed Modules**

```python
# These modules are removed in Python 3.12:
# - asynchat (use asyncio)
# - asyncore (use asyncio)
# - imp (use importlib)
# - smtpd (use aiosmtpd)

# Before
import asynchat
import asyncore
import imp

# After
import asyncio
import importlib
# For SMTP: pip install aiosmtpd
```

### Automated Migration Tools

```bash
# 1. Upgrade with pyupgrade
pyupgrade --py312-plus **/*.py

# 2. Modernize code
pip install modernize
python-modernize -w myproject/

# 3. Type checking with new syntax
pip install mypy>=1.6.0  # Must support PEP 695
mypy --python-version 3.12 myproject/

# 4. Ruff linting (supports PEP 695)
pip install ruff
ruff check --target-version py312 myproject/
```

## Node.js 18 to Node.js 20 (2023 Release)

### Key Changes

**1. Permission Model (Experimental)**

New permission system for resource access control.

**Migration:**
```javascript
// Node.js 20 requires explicit permission flags
// Run your application with permissions:
node --experimental-permission --allow-fs-read=* --allow-fs-write=/tmp app.js

// Or restrict file system access:
node --experimental-permission \
     --allow-fs-read=/app/data \
     --allow-fs-write=/app/logs \
     --allow-child-process \
     app.js

// Check permissions at runtime (Node.js 20+)
if (process.permission.has('fs.read', '/path/to/file')) {
  // Safe to read
}

// Deny specific permissions
process.permission.deny('fs.write', '/etc');  // Added later
```

**2. ESM Loader Hooks Threading**

ESM loader hooks now run in a dedicated thread.

**Migration:**
```javascript
// Custom ESM loader (loader.mjs)
// This now runs in its own thread in Node.js 20
export async function resolve(specifier, context, nextResolve) {
  // Runs in dedicated thread - isolated from main
  return nextResolve(specifier, context);
}

// Run with loader
node --experimental-loader=./loader.mjs app.mjs

// import.meta.resolve() is now synchronous
const resolved = import.meta.resolve('./module.js');
```

**3. V8 11.3 Engine Update**

New JavaScript features:
- `String.prototype.isWellFormed()` and `toWellFormed()`
- Array methods that change by copy (`toSorted`, `toReversed`, etc.)
- Resizable ArrayBuffer and growable SharedArrayBuffer
- RegExp `v` flag with set notation

**Migration:**
```javascript
// New string methods
const str = "Hello\uD800";  // Lone surrogate
console.log(str.isWellFormed());  // false
console.log(str.toWellFormed());  // "Hello\uFFFD" (replacement char)

// Array methods by copy (don't mutate original)
const arr = [3, 1, 2];
const sorted = arr.toSorted();  // [1, 2, 3], arr unchanged
const reversed = arr.toReversed();  // [2, 1, 3], arr unchanged

// Resizable ArrayBuffer
const buffer = new ArrayBuffer(1024, { maxByteLength: 1024 * 1024 });
buffer.resize(2048);  // Grow within max

// RegExp v flag with set notation
const regex = /[\p{Letter}&&[^\p{ASCII}]]/v;  // Non-ASCII letters
```

**4. WASI Version Requirement**

WASI now requires explicit version specification.

**Migration:**
```javascript
// Before (Node.js 18) - version defaulted to preview1
import { WASI } from 'wasi';
const wasi = new WASI({
  args: process.argv,
  env: process.env,
  preopens: { '/sandbox': '/some/real/path' }
});

// After (Node.js 20) - version is required
import { WASI } from 'wasi';
const wasi = new WASI({
  version: 'preview1',  // Required parameter
  args: process.argv,
  env: process.env,
  preopens: { '/sandbox': '/some/real/path' }
});
```

**5. Test Runner Stable**

The built-in test runner is now stable (no longer experimental).

**Migration:**
```javascript
// Before - required --test flag
// node --experimental-test-coverage --test app.test.js

// After (Node.js 20) - stable, coverage built-in
// node --test app.test.js
// node --test --experimental-test-coverage app.test.js

import { test, describe, it } from 'node:test';
import assert from 'node:assert';

describe('My tests', () => {
  it('should pass', () => {
    assert.strictEqual(1 + 1, 2);
  });
});

// Watch mode (Node.js 20+)
// node --test --watch app.test.js
```

**6. Deprecations**

```javascript
// url.parse() with invalid ports now emits warning (will throw in future)
// Before - worked silently
const parsed = url.parse('http://example.com:99999/path');

// After - emits warning, migrate to URL API
const parsed = new URL('http://example.com:99999/path');
// or handle the error

// process.exit() coercion removed
// Before - process.exit('string') coerced to exit code
// After - throws TypeError
process.exit(1);  // Always use numeric exit codes
```

### Migration Tools

```bash
# 1. Check Node.js version compatibility
npm install -g check-node-version
check-node-version --node ">=20"

# 2. Update dependencies for Node.js 20
npm update
npm audit fix

# 3. Test with new version
npm test

# 4. Use corepack for package manager consistency
corepack enable
corepack prepare yarn@stable --activate
```

## Java 17 to Java 21 (LTS Release, September 2023)

### Major New Features (Migration Considerations)

**1. Pattern Matching for switch (JEP 441 - Final)**

After multiple preview releases, pattern matching for switch is now finalized.

**Migration:**
```java
// Before (Java 17) - Chain of if-else with instanceof
static String formatter(Object obj) {
    String formatted = "unknown";
    if (obj instanceof Integer i) {
        formatted = String.format("int %d", i);
    } else if (obj instanceof Long l) {
        formatted = String.format("long %d", l);
    } else if (obj instanceof Double d) {
        formatted = String.format("double %f", d);
    } else if (obj instanceof String s) {
        formatted = String.format("String %s", s);
    }
    return formatted;
}

// After (Java 21) - Pattern matching switch
static String formatterPatternSwitch(Object obj) {
    return switch (obj) {
        case Integer i -> String.format("int %d", i);
        case Long l    -> String.format("long %d", l);
        case Double d  -> String.format("double %f", d);
        case String s  -> String.format("String %s", s);
        case null      -> "null";
        default        -> obj.toString();
    };
}

// Guarded patterns with when clauses
static void testStringNew(String response) {
    switch (response) {
        case null -> { }
        case String s when s.equalsIgnoreCase("YES") -> {
            System.out.println("You got it");
        }
        case String s when s.equalsIgnoreCase("NO") -> {
            System.out.println("Shame");
        }
        case String s -> {
            System.out.println("Sorry?");
        }
    }
}

// Qualified enum constants
sealed interface CardClassification permits Suit, Tarot {}
enum Suit implements CardClassification { CLUBS, DIAMONDS, HEARTS, SPADES }

static void exhaustiveSwitch(CardClassification c) {
    switch (c) {
        case Suit.CLUBS -> System.out.println("Clubs");
        case Suit.DIAMONDS -> System.out.println("Diamonds");
        case Suit.HEARTS -> System.out.println("Hearts");
        case Suit.SPADES -> System.out.println("Spades");
        case Tarot t -> System.out.println("Tarot");
    }
}
```

**2. Virtual Threads (JEP 444)**

Lightweight threads for high-throughput applications - production-ready in Java 21.

**Migration:**
```java
// Before - Platform threads (limited scalability)
try (var executor = Executors.newCachedThreadPool()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return "done";
        });
    }
}  // Limited by OS thread count

// After (Java 21) - Virtual threads
// Option 1: Per-task executor (recommended for most cases)
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return "done";
        });
    }
}

// Option 2: Thread.Builder API
Thread.startVirtualThread(() -> {
    System.out.println("Running on virtual thread: " + 
                       Thread.currentThread());
});

// Option 3: Thread.Builder for custom configuration
Thread vt = Thread.ofVirtual()
    .name("worker-", 0)
    .unstarted(() -> doWork());
vt.start();

// Important: Do NOT pool virtual threads
// Bad:
try (var executor = Executors.newFixedThreadPool(200)) {  // Don't do this
    // ...
}

// Good:
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    // Creates new virtual thread for each task
}
```

**Virtual Thread Considerations:**

```java
// Pinning scenarios to avoid
class BadExample {
    // 1. Synchronized blocks pin the carrier thread
    synchronized void doIO() {  // Don't do heavy I/O here
        makeHttpRequest();  // Blocks carrier thread
    }
    
    // 2. Native methods pin the carrier thread
    native void nativeMethod();  // May pin
}

// Better alternatives
class GoodExample {
    // Use ReentrantLock instead of synchronized for I/O
    private final ReentrantLock lock = new ReentrantLock();
    
    void doIO() {
        lock.lock();
        try {
            makeHttpRequest();  // Virtual thread parks, carrier free
        } finally {
            lock.unlock();
        }
    }
}

// Pinning diagnostics
// Run with: -Djdk.tracePinnedThreads=full
// JFR event: jdk.VirtualThreadPinned (emitted when pinned)
```

**3. Record Patterns (JEP 440)**

Deconstruct records in pattern matching.

**Migration:**
```java
// Before
if (obj instanceof Point p) {
    int x = p.x();
    int y = p.y();
    System.out.println(x + y);
}

// After (Java 21) - Record patterns
if (obj instanceof Point(int x, int y)) {
    System.out.println(x + y);
}

// In switch with nested records
record Point(int x, int y) {}
record ColoredPoint(Point p, Color c) {}

static void printSum(Object obj) {
    switch (obj) {
        case Point(int x, int y) -> 
            System.out.println(x + y);
        case ColoredPoint(Point(int x, int y), Color c) ->
            System.out.println("Colored point sum: " + (x + y));
    }
}
```

**4. Sequenced Collections (JEP 431)**

New interfaces for collections with a defined encounter order.

**Migration:**
```java
// New interfaces: SequencedCollection, SequencedSet, SequencedMap
// Available on: LinkedHashSet, LinkedHashMap, TreeSet, TreeMap

List<String> list = new ArrayList<>();
list.addLast("last");   // New method
list.addFirst("first"); // New method
String first = list.getFirst();  // New method
String last = list.getLast();    // New method

LinkedHashMap<String, Integer> map = new LinkedHashMap<>();
map.putFirst("a", 1);  // New method
map.putLast("z", 26);  // New method
Map.Entry<String, Integer> firstEntry = map.firstEntry();  // New method
Map.Entry<String, Integer> lastEntry = map.lastEntry();    // New method

// Reversed view
List<String> reversed = list.reversed();
for (String s : reversed) {
    // Iterates in reverse order
}
```

**5. String Templates (Preview - JEP 430)**

Embedded expression processing (preview feature in Java 21).

```java
// Preview feature - requires --enable-preview
// String templates with STR processor
String name = "Joan";
String info = STR."My name is \{name}";

// FMT processor for formatted output
String formatted = FMT."My name is %12s\{name}";

// Custom processors
var JSON = StringTemplate.Processor.of(
    (stringTemplate) -> parseJson(stringTemplate)
);

String json = JSON."""
    {
        "name": \{name},
        "age": \{age}
    }
    """;
```

**6. Key Encapsulation Mechanism API (JEP 452)**

Cryptographic API for KEM algorithms.

```java
// Key Encapsulation Mechanism for secure key exchange
KeyPairGenerator kpg = KeyPairGenerator.getInstance("X25519");
KeyPair kp = kpg.generateKeyPair();

KeyEncapsulationMechanism kem = KeyEncapsulationMechanism.getInstance("X25519_Kyber768_Draft00");
kem.init(kp.getPublic());

KeyEncapsulation encap = kem.encapsulate();
SecretKey key = encap.key();  // Shared secret
byte[] encapsulation = encap.encapsulation();  // Send to other party
```

### Java 21 Migration Tools

```bash
# 1. Upgrade with Maven
mvn versions:use-latest-versions

# 2. Use OpenRewrite for automated migrations
# Spring Boot 2.x -> 3.x migration
mvn org.openrewrite.maven:rewrite-maven-plugin:run \
  -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-spring:LATEST \
  -Drewrite.activeRecipes=org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_2

# 3. IDE support - ensure using IntelliJ IDEA 2023.2+ or Eclipse with Java 21 support

# 4. Compile with preview features (for String Templates)
javac --release 21 --enable-preview MyClass.java
java --enable-preview MyClass
```

### Runtime Migration

```java
// Check Java version at runtime
Runtime.Version version = Runtime.version();
if (version.feature() >= 21) {
    // Use new features
} else {
    // Fallback
}

// Feature detection for Virtual Threads
try {
    Thread.class.getMethod("isVirtual");
    // Virtual threads available
    useVirtualThreads();
} catch (NoSuchMethodException e) {
    // Fallback to platform threads
    usePlatformThreads();
}
```

## Migration Planning Templates

### Python 3.12 Migration Checklist

```markdown
## Python 3.12 Migration: [Project Name]

### Pre-Migration
- [ ] Audit distutils usage
- [ ] Check type annotation compatibility
- [ ] Review f-string usage for quote conflicts
- [ ] Test comprehension behavior changes
- [ ] Update CI/CD to Python 3.12

### Breaking Changes
- [ ] Replace distutils with setuptools/modern build backend
- [ ] Update type aliases to new syntax (if using mypy 1.6+)
- [ ] Fix any locals() usage in comprehensions
- [ ] Remove deprecated module imports (asynchat, asyncore, imp)

### Testing
- [ ] Run full test suite
- [ ] Test with new f-string features
- [ ] Verify type checking with mypy 1.6+
- [ ] Profile performance changes

### Deployment
- [ ] Update Docker base images
- [ ] Update requirements.txt/pyproject.toml
- [ ] Update pre-commit hooks
- [ ] Document new features used
```

### Node.js 20 Migration Checklist

```markdown
## Node.js 20 Migration: [Project Name]

### Pre-Migration
- [ ] Check for url.parse() usage
- [ ] Review ESM loader hooks
- [ ] Audit process.exit() calls
- [ ] Check WASI usage

### Breaking Changes
- [ ] Replace url.parse() with URL API
- [ ] Update ESM loaders for threading
- [ ] Fix process.exit() string arguments
- [ ] Add version parameter to WASI constructor

### New Features to Consider
- [ ] Permission model for security
- [ ] Built-in test runner (stable)
- [ ] V8 11.3 features (toSorted, etc.)
- [ ] Corepack for package management

### Testing
- [ ] Test with --experimental-permission
- [ ] Run test suite with node --test
- [ ] Verify native module compatibility
```

### Java 21 Migration Checklist

```markdown
## Java 21 Migration: [Project Name]

### Pre-Migration
- [ ] Check for preview feature usage
- [ ] Review threading architecture
- [ ] Audit synchronized blocks in I/O paths
- [ ] Check instanceof chains

### New Features to Adopt
- [ ] Pattern matching for switch
- [ ] Virtual threads (where applicable)
- [ ] Record patterns
- [ ] Sequenced collections

### Migration Steps
- [ ] Update Maven/Gradle to support Java 21
- [ ] Update Spring Boot to 3.2+ (if applicable)
- [ ] Replace platform thread pools with virtual threads
- [ ] Convert instanceof chains to switch expressions
- [ ] Use record patterns where applicable

### Performance Testing
- [ ] Benchmark virtual thread vs platform thread
- [ ] Monitor pinning with -Djdk.tracePinnedThreads
- [ ] Load test with new threading model
```

## Best Practices (2026)

1. **Test in Parallel**: Run both old and new versions simultaneously during migration
2. **Feature Flags**: Use feature flags to enable new language features gradually
3. **Performance Baseline**: Establish performance baselines before migration
4. **Rollback Plan**: Always have a tested rollback procedure
5. **Gradual Rollout**: Use canary deployments for language/runtime upgrades
6. **Monitor JVM Metrics**: For Java, monitor heap, GC, and virtual thread metrics
7. **Static Analysis**: Use linters to catch deprecated APIs before runtime

## References

- Python 3.12 What's New: https://docs.python.org/3/whatsnew/3.12.html
- PEP 695 - Type Parameter Syntax: https://peps.python.org/pep-0695/
- PEP 701 - Syntactic formalization of f-strings: https://peps.python.org/pep-0701/
- PEP 709 - Comprehension inlining: https://peps.python.org/pep-0709/
- Node.js 20 Release Notes: https://nodejs.org/en/blog/release/v20.0.0
- Node.js Permission Model: https://nodejs.org/api/permissions.html
- Java 21 Release Notes: https://openjdk.org/projects/jdk/21/
- JEP 441 - Pattern Matching for switch: https://openjdk.org/jeps/441
- JEP 444 - Virtual Threads: https://openjdk.org/jeps/444
- JEP 440 - Record Patterns: https://openjdk.org/jeps/440
- JEP 431 - Sequenced Collections: https://openjdk.org/jeps/431
