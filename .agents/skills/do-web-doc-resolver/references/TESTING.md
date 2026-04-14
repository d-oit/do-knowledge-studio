# Testing Reference

## Overview

The project has three test suites:
1. **Python tests** - Unit and integration tests
2. **Rust tests** - CLI unit and integration tests
3. **E2E tests** - Playwright tests for the web UI

## Python Tests

### Location

```
tests/
├── conftest.py           # Shared fixtures
├── test_resolve.py       # Main resolver tests
├── test_providers.py     # Provider-specific tests
├── test_quality.py       # Quality scoring tests
├── test_routing.py       # Routing logic tests
├── test_circuit_breaker.py # Circuit breaker tests
├── test_utils.py         # Utility function tests
└── test_cache.py         # Caching tests
```

### Running Tests

```bash
# Run all non-live tests (no API keys needed)
python -m pytest tests/ -v -m "not live"

# Run specific test file
python -m pytest tests/test_resolve.py -v

# Run with coverage
python -m pytest tests/ -v --cov=scripts --cov-report=html

# Run live integration tests (requires API keys)
python -m pytest tests/ -m live -v
```

### Test Markers

| Marker | Description | Requirements |
|--------|-------------|--------------|
| `not live` | Unit tests, no external calls | None |
| `live` | Integration tests with real APIs | API keys |
| `slow` | Tests that take > 1s | None |
| `exa` | Exa provider tests | `EXA_API_KEY` |
| `tavily` | Tavily provider tests | `TAVILY_API_KEY` |
| `firecrawl` | Firecrawl tests | `FIRECRAWL_API_KEY` |
| `mistral` | Mistral tests | `MISTRAL_API_KEY` |

### Example Test

```python
import pytest
from scripts.resolve import resolve, resolve_query
from scripts.models import Profile


@pytest.fixture
def mock_exa_mcp(monkeypatch):
    """Mock Exa MCP responses."""
    def mock_resolve(*args, **kwargs):
        from scripts.models import ResolvedResult
        return ResolvedResult(
            source="exa_mcp",
            content="# Test Result\n\nMock content here.",
            query=args[0] if args else kwargs.get("query"),
        )
    monkeypatch.setattr("scripts.providers_impl.resolve_with_exa_mcp", mock_resolve)


def test_resolve_query_basic(mock_exa_mcp):
    """Test basic query resolution."""
    result = resolve_query("test query")
    assert result["source"] == "exa_mcp"
    assert "Test Result" in result["content"]


def test_resolve_url_is_url():
    """Test URL detection."""
    from scripts.utils import is_url
    assert is_url("https://example.com") is True
    assert is_url("not a url") is False


@pytest.mark.live
@pytest.mark.exa
def test_resolve_live_exa():
    """Live test with Exa API."""
    result = resolve("Rust programming language")
    assert result["source"] != "none"
    assert len(result["content"]) > 100
```

### Fixtures (conftest.py)

```python
import pytest
import tempfile
import os


@pytest.fixture
def temp_cache_dir():
    """Create a temporary cache directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        old_dir = os.environ.get("WEB_RESOLVER_CACHE_DIR")
        os.environ["WEB_RESOLVER_CACHE_DIR"] = tmpdir
        yield tmpdir
        if old_dir:
            os.environ["WEB_RESOLVER_CACHE_DIR"] = old_dir
        else:
            del os.environ["WEB_RESOLVER_CACHE_DIR"]


@pytest.fixture
def reset_rate_limits():
    """Reset rate limit state between tests."""
    from scripts.providers_impl import _rate_limits
    _rate_limits.clear()
    yield
    _rate_limits.clear()


@pytest.fixture
def reset_circuit_breakers():
    """Reset circuit breaker state between tests."""
    from scripts.resolve import _circuit_breakers
    _circuit_breakers.breakers.clear()
    yield
    _circuit_breakers.breakers.clear()
```

## Rust Tests

### Running Tests

```bash
# Run all tests
cd cli && cargo test

# Run specific test
cargo test test_resolve_url

# Run with output
cargo test -- --nocapture

# Run integration tests
cargo test --features integration
```

### Test Structure

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_url() {
        assert!(is_url("https://example.com"));
        assert!(!is_url("not a url"));
    }

    #[test]
    fn test_quality_scoring() {
        let content = "# Test\n\nThis is a test with some content.";
        let score = score_content(content);
        assert!(score.score > 0.5);
    }

    #[tokio::test]
    async fn test_resolve_mock() {
        // Mock provider tests
    }
}
```

## E2E Tests (Playwright)

### Location

```
web/tests/e2e/
├── basic.spec.ts       # Basic page loads
├── resolve.spec.ts     # Resolution flow tests
├── settings.spec.ts    # Settings page tests
└── history.spec.ts     # Session history tests
```

### Running Tests

```bash
# Install Playwright
cd web && npm install && npx playwright install chromium

# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/resolve.spec.ts

# Run in headed mode (visible browser)
npx playwright test --headed

# Run against deployed URL
BASE_URL=https://your-app.vercel.app npx playwright test
```

### Example Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Resolver', () => {
  test('should resolve a URL', async ({ page }) => {
    await page.goto('/');

    // Enter URL
    await page.fill('input[name="input"]', 'https://docs.rs/tokio');
    await page.click('button[type="submit"]');

    // Wait for result
    await page.waitForSelector('[data-testid="result"]', { timeout: 30000 });

    // Verify result
    const result = await page.textContent('[data-testid="result"]');
    expect(result).toContain('tokio');
  });

  test('should show error for invalid input', async ({ page }) => {
    await page.goto('/');

    await page.fill('input[name="input"]', '');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error"]')).toBeVisible();
  });
});
```

## Quality Gate

Run all checks before committing:

```bash
# Full quality gate
./scripts/quality_gate.sh

# Individual checks
python -m pytest tests/ -v -m "not live"  # Python tests
cd cli && cargo test && cargo clippy -- -D warnings && cargo fmt --check  # Rust checks
cd web && npm run lint && npm run build   # Web checks
```

### Quality Gate Script

```bash
#!/bin/bash
# scripts/quality_gate.sh

set -e

echo "=== Python Tests ==="
python -m pytest tests/ -v -m "not live"

echo "=== Python Lint ==="
ruff check scripts/ tests/
black --check scripts/ tests/

echo "=== Rust Tests ==="
cd cli && cargo test

echo "=== Rust Lint ==="
cargo clippy -- -D warnings
cargo fmt --check

echo "=== Web Build ==="
cd ../web
npm run lint
npm run build

echo "=== All checks passed! ==="
```

## CI/CD

GitHub Actions workflow runs on every push:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Python tests
        run: python -m pytest tests/ -v -m "not live"

      - name: Rust tests
        run: cd cli && cargo test

      - name: Rust lint
        run: cd cli && cargo clippy -- -D warnings && cargo fmt --check

      - name: Web build
        run: cd web && npm run build
```