# Configuration Reference

## Environment Variables

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_RESOLVER_MAX_CHARS` | `8000` | Maximum characters in output content |
| `WEB_RESOLVER_MIN_CHARS` | `200` | Minimum characters for valid result |
| `WEB_RESOLVER_TIMEOUT` | `30` | HTTP request timeout in seconds |
| `WEB_RESOLVER_CACHE_DIR` | `~/.cache/do-web-doc-resolver` | Cache directory path |
| `WEB_RESOLVER_CACHE_TTL` | `86400` | Cache TTL in seconds (default: 24h) |

### Provider Limits

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_RESOLVER_EXA_RESULTS` | `5` | Max results from Exa API |
| `WEB_RESOLVER_TAVILY_RESULTS` | `5` | Max results from Tavily API |
| `WEB_RESOLVER_DDG_RESULTS` | `5` | Max results from DuckDuckGo |

### API Keys (Optional)

| Variable | Provider | Free Tier |
|----------|----------|-----------|
| `EXA_API_KEY` | Exa SDK | Yes (limited) |
| `TAVILY_API_KEY` | Tavily | Yes (limited) |
| `SERPER_API_KEY` | Serper | Yes (2500 credits) |
| `FIRECRAWL_API_KEY` | Firecrawl | Yes (limited) |
| `MISTRAL_API_KEY` | Mistral AI | No |

**Note**: Exa MCP, Jina Reader, DuckDuckGo, and direct fetch work without any API keys.

## Rust CLI Configuration (`config.toml`)

Location: `~/.config/do-wdr/config.toml`

```toml
# Default settings
[defaults]
max_chars = 8000
timeout = 30
profile = "balanced"

# Cache configuration
[cache]
enabled = true
ttl_hours = 24
path = "~/.cache/do-wdr"

# Circuit breaker settings
[circuit_breaker]
failure_threshold = 3
cooldown_seconds = 300

# Provider API keys (optional - can also use env vars)
[providers]
# exa_api_key = "your-exa-key"
# tavily_api_key = "your-tavily-key"
# serper_api_key = "your-serper-key"
# firecrawl_api_key = "your-firecrawl-key"
# mistral_api_key = "your-mistral-key"

# Provider-specific settings
[providers.exa]
num_results = 5
use_autoprompt = true

[providers.tavily]
num_results = 5

[providers.duckduckgo]
num_results = 5

# Quality scoring weights
[quality]
min_content_length = 500
duplicate_threshold = 0.5
noise_threshold = 6
```

## Execution Profiles

| Profile | Max Attempts | Max Paid | Max Latency | Quality | Use Case |
|---------|--------------|----------|-------------|---------|----------|
| `free` | 3 | 0 | 6s | 0.70 | Cost-sensitive, free only |
| `fast` | 2 | 1 | 4s | 0.60 | Quick lookups |
| `balanced` | 6 | 2 | 12s | 0.65 | Default, good balance |
| `quality` | 10 | 5 | 20s | 0.55 | Deep research |

### Profile Details

#### Free Profile
- No paid API calls
- Fastest free providers first
- Good for development/testing
- May fail on complex/JS-heavy pages

#### Fast Profile
- Optimized for speed
- 1 paid provider allowed
- Lower quality threshold
- Good for quick lookups

#### Balanced Profile (Default)
- Good cost/quality tradeoff
- Up to 2 paid providers
- Medium latency budget
- Works well for most use cases

#### Quality Profile
- Maximum coverage
- Up to 5 paid providers
- Lowest quality threshold
- Best for important queries

## Quality Scoring

Content is scored on a 0.0-1.0 scale:

### Penalties

| Signal | Penalty | Detection |
|--------|---------|-----------|
| Too short | -0.35 | `< 500 characters` |
| Missing links | -0.15 | No markdown links |
| Duplicate-heavy | -0.25 | `< 50% unique lines` |
| Noisy content | -0.20 | `> 6 noise signals` |

### Noise Signals

- "cookie"
- "subscribe"
- "javascript"
- "log in"
- "sign up"

### Acceptance

Content is accepted if:
- Score ≥ profile threshold
- Not too short (`≥ 500 chars`)

## Circuit Breaker

Prevents cascading failures:

```python
# Default settings
FAILURE_THRESHOLD = 3      # Consecutive failures to trip
COOLDOWN_SECONDS = 300     # 5 minutes cooldown
```

### Behavior

1. Track failures per provider
2. After 3 consecutive failures, trip breaker
3. Provider is skipped for 5 minutes
4. Successful call resets failure count

## Negative Cache

Caches failed/thin results to avoid re-probing:

```python
# Default settings
NEGATIVE_CACHE_TTL = 1800  # 30 minutes
```

### Reasons

- `thin_content`: Content below quality threshold
- `error`: Provider error
- `timeout`: Request timeout

## SSRF Protection

Blocked networks:
- `127.0.0.0/8` (localhost)
- `10.0.0.0/8` (private)
- `172.16.0.0/12` (private)
- `192.168.0.0/16` (private)
- `169.254.0.0/16` (link-local)
- `::1/128` (localhost IPv6)
- `fc00::/7` (unique local)
- `fe80::/10` (link-local IPv6)

Blocked schemes:
- `file://`
- `javascript:`
- `data:`
- `vbscript:`

## Logging

### Log Levels

- `DEBUG`: Detailed provider calls, cache operations
- `INFO`: Provider selection, quality scores (default)
- `WARNING`: Provider failures, circuit breaker trips
- `ERROR`: Resolution failures, configuration errors

### Structured Logging

```bash
# Enable debug logging
python scripts/resolve.py "query" --log-level DEBUG

# JSON structured logs (for logging systems)
WEB_RESOLVER_LOG_FORMAT=json python scripts/resolve.py "query"
```