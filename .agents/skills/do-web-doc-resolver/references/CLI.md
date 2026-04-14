# CLI Reference

## Python CLI (`scripts/cli.py`)

### Basic Usage

```bash
# Resolve a URL
python scripts/cli.py "https://docs.rs/tokio"

# Resolve a query
python scripts/cli.py "Rust async runtime comparison"

# JSON output
python scripts/cli.py "query" --json

# Specify max characters
python scripts/cli.py "query" --max-chars 5000
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--max-chars` | int | 8000 | Maximum characters in output |
| `--json` | flag | false | Output as JSON |
| `--profile` | string | balanced | Execution profile (free/fast/balanced/quality) |
| `--skip` | string[] | none | Provider(s) to skip |
| `--provider` | string | none | Use specific provider only |
| `--providers-order` | string | none | Comma-separated provider order |
| `--log-level` | string | INFO | Log level (DEBUG/INFO/WARNING/ERROR) |

### Execution Profiles

```bash
# Free-only (no paid APIs)
python scripts/cli.py "query" --profile free

# Fast response (max 4s, 1 paid provider)
python scripts/cli.py "query" --profile fast

# Balanced (default)
python scripts/cli.py "query" --profile balanced

# Quality (max 20s, up to 5 paid providers)
python scripts/cli.py "query" --profile quality
```

### Skip Providers

```bash
# Skip specific providers
python scripts/cli.py "query" --skip exa_mcp --skip exa

# Skip multiple at once
python scripts/cli.py "query" --skip exa --skip tavily --skip serper
```

### Direct Provider Selection

```bash
# Use only DuckDuckGo
python scripts/cli.py "query" --provider duckduckgo

# Custom provider order
python scripts/cli.py "query" --providers-order "exa,jina,duckduckgo"
```

## Rust CLI (`do-wdr` binary)

### Build

```bash
cd cli
cargo build --release
# Binary: cli/target/release/do-wdr
```

### Basic Usage

```bash
# Resolve a URL
do-wdr resolve "https://docs.rs/tokio"

# Resolve a query
do-wdr resolve "Rust async runtime comparison"

# JSON output
do-wdr resolve "query" --json

# Specify max characters
do-wdr resolve "query" --max-chars 5000
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--max-chars` | int | 8000 | Maximum characters in output |
| `--json` | flag | false | Output as JSON |
| `-p, --profile` | string | balanced | Execution profile |
| `--skip` | string | none | Skip providers (comma-separated) |
| `--provider` | string | none | Use specific provider |
| `-o, --output` | string | none | Output file |
| `-v, --verbose` | flag | false | Verbose output (-v, -vv, -vvv) |
| `-h, --help` | flag | false | Show help |

### Utility Commands

```bash
# List providers
do-wdr providers

# Show config
do-wdr config

# Cache statistics
do-wdr cache-stats
```

### Configuration File

The Rust CLI supports a `config.toml` file:

```toml
# ~/.config/do-wdr/config.toml

[defaults]
max_chars = 8000
timeout = 30
profile = "balanced"

[cache]
enabled = true
ttl_hours = 24
path = "~/.cache/do-wdr"

[providers]
# API keys can be set here or via environment variables
# exa_api_key = "your-key"
# tavily_api_key = "your-key"
```

## Python Module API

```python
from scripts.resolve import resolve, resolve_url, resolve_query, resolve_direct, resolve_with_order

# Auto-detect URL vs query
result = resolve("https://example.com")
result = resolve("Python web frameworks")

# Explicit URL resolution
result = resolve_url("https://docs.rs/tokio", max_chars=5000)

# Explicit query resolution
result = resolve_query("Rust web frameworks", skip_providers={"exa_mcp"})

# With profile
from scripts.models import Profile
result = resolve("query", profile=Profile.QUALITY)

# Direct provider call
from scripts.models import ProviderType
result = resolve_direct("query", ProviderType.DUCKDUCKGO)

# Custom provider order
result = resolve_with_order("query", [
    ProviderType.EXA_MCP,
    ProviderType.DUCKDUCKGO
])
```

### Response Structure

```python
{
    "url": "https://example.com/docs",  # Original URL (if URL input)
    "query": "search query",            # Original query (if query input)
    "content": "# Documentation\n\n...", # Markdown content
    "source": "exa_mcp",                # Provider that succeeded
    "score": 0.87,                      # Quality score (0.0-1.0)
    "validated_links": [],              # Validated links (if any)
    "metadata": {},                     # Additional metadata
    "metrics": {                        # Resolution metrics
        "total_latency_ms": 1234,
        "provider_metrics": [...],
        "cascade_depth": 1,
        "paid_usage": False,
        "cache_hit": False
    }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_RESOLVER_MAX_CHARS` | 8000 | Maximum output characters |
| `WEB_RESOLVER_MIN_CHARS` | 200 | Minimum characters for valid result |
| `WEB_RESOLVER_TIMEOUT` | 30 | Request timeout in seconds |
| `WEB_RESOLVER_CACHE_DIR` | ~/.cache/do-web-doc-resolver | Cache directory |
| `WEB_RESOLVER_CACHE_TTL` | 86400 | Cache TTL in seconds (24h) |
| `WEB_RESOLVER_EXA_RESULTS` | 5 | Max Exa results |
| `WEB_RESOLVER_TAVILY_RESULTS` | 5 | Max Tavily results |
| `WEB_RESOLVER_DDG_RESULTS` | 5 | Max DuckDuckGo results |