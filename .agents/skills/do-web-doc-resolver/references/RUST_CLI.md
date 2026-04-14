# Rust CLI Reference

## Overview

The Rust CLI (`do-wdr`) is a compiled binary for fast, dependency-free resolution. It implements the same cascade logic as the Python resolver but with better performance and portability.

## Building

```bash
cd cli
cargo build --release

# Binary location
# Linux/macOS: cli/target/release/do-wdr
# Windows: cli/target/release/do-wdr.exe
```

### Build Requirements

- Rust 1.70+ (stable)
- `cargo` package manager

### Optional Features

```toml
# Cargo.toml features
[features]
default = []
semantic-cache = ["dep:chaotic_semantic_memory"]
```

## Architecture

```
cli/
├── Cargo.toml
└── src/
    ├── main.rs           # Entry point
    ├── lib.rs            # Library exports
    ├── cli.rs            # Clap CLI definition
    ├── config.rs         # Configuration loading
    ├── types.rs          # Common types
    ├── error.rs          # Error types
    ├── resolver/         # Cascade orchestrator
    │   ├── mod.rs
    │   ├── cascade.rs    # Provider cascade logic
    │   ├── query.rs      # Query resolution
    │   └── url.rs        # URL resolution
    ├── quality.rs        # Content quality scoring
    ├── compaction.rs     # Content compaction
    ├── synthesis.rs      # AI synthesis
    ├── circuit_breaker.rs # Circuit breaker implementation
    ├── routing.rs        # Provider selection logic
    ├── routing_memory.rs # Per-domain learning
    ├── bias_scorer.rs    # Domain trust scoring
    ├── link_validator.rs # Link validation
    ├── negative_cache.rs # Negative result cache
    ├── semantic_cache.rs # Semantic cache
    ├── metrics.rs        # Metrics tracking
    ├── output.rs         # Output formatting
    └── providers/
        ├── mod.rs        # Provider trait and registry
        ├── exa_mcp.rs    # Exa MCP (free)
        ├── exa_sdk.rs    # Exa SDK
        ├── tavily.rs     # Tavily API
        ├── serper.rs     # Serper API
        ├── duckduckgo.rs # DuckDuckGo (free)
        ├── jina.rs       # Jina Reader (free)
        ├── firecrawl.rs  # Firecrawl API
        ├── direct_fetch.rs # Direct fetch (free)
        ├── llms_txt.rs   # llms.txt probe (free)
        ├── mistral_browser.rs # Mistral browser
        ├── mistral_websearch.rs # Mistral websearch
        ├── docling.rs    # Document processing
        └── ocr.rs        # OCR extraction
```

## Usage

### Basic Commands

```bash
# Resolve URL
do-wdr resolve "https://docs.rs/tokio"

# Resolve query
do-wdr resolve "Rust async runtime"

# JSON output
do-wdr resolve "query" --json

# With options
do-wdr resolve "query" --max-chars 5000 --profile quality
```

### CLI Options

```
USAGE:
    do-wdr [OPTIONS] <COMMAND>

COMMANDS:
    resolve      Resolve a URL or query to markdown documentation
    providers    List available providers
    config       Show configuration
    cache-stats  Show cache statistics

OPTIONS:
    -v, --verbose...     Enable verbose logging (-v, -vv, -vvv)
    -h, --help           Print help
    -V, --version        Print version

RESOLVE OPTIONS:
        --max-chars <NUM>     Maximum characters in output [default: 8000]
        --json                Output as JSON
    -p, --profile <PROFILE>   Execution profile [default: balanced]
                              [possible: free, fast, balanced, quality]
        --skip <PROVIDERS>    Skip providers (comma-separated)
        --provider <NAME>     Use specific provider only
    -o, --output <FILE>       Output file (stdout if not specified)
        --min-chars <NUM>     Minimum characters for valid content
        --skip-cache          Skip semantic cache
        --synthesize          Synthesize multiple results using AI
        --quality-threshold <F>  Quality threshold for content scoring
        --metrics-json        Output metrics as JSON
        --metrics-file <FILE> Save metrics to file
```

### Examples

```bash
# Fast lookup
do-wdr resolve "React hooks tutorial" --profile fast

# Deep research
do-wdr resolve "quantum computing algorithms" --profile quality --max-chars 10000

# Free only
do-wdr resolve "Python async" --profile free

# Skip specific providers
do-wdr resolve "query" --skip exa,tavily

# Use only DuckDuckGo
do-wdr resolve "query" --provider duckduckgo

# Debug output
do-wdr -vv resolve "query"
```

## Configuration

### Config File Location

- Linux/macOS: `~/.config/do-wdr/config.toml`
- Windows: `%APPDATA%\do-wdr\config.toml`

### Example Configuration

```toml
[defaults]
max_chars = 8000
timeout = 30
profile = "balanced"

[cache]
enabled = true
ttl_hours = 24
path = "~/.cache/do-wdr"

[circuit_breaker]
failure_threshold = 3
cooldown_seconds = 300

[providers]
# API keys (optional - can also use env vars)
exa_api_key = "your-key"
tavily_api_key = "your-key"

[providers.exa]
num_results = 5
use_autoprompt = true

[providers.duckduckgo]
num_results = 5
```

## Performance

### Benchmarks

| Metric | Python | Rust |
|--------|--------|------|
| Startup time | ~200ms | ~5ms |
| Memory (idle) | ~50MB | ~5MB |
| Memory (peak) | ~100MB | ~20MB |
| Binary size | N/A | ~15MB |

### Optimization Tips

1. **Use release builds**: `cargo build --release`
2. **Strip binary**: `strip target/release/do-wdr`
3. **LTO**: Enable in `Cargo.toml`:
   ```toml
   [profile.release]
   lto = true
   codegen-units = 1
   ```

## Provider Implementation

### Provider Trait

```rust
pub trait Provider: Send + Sync {
    fn name(&self) -> &str;
    fn is_free(&self) -> bool;
    fn input_type(&self) -> InputType;

    async fn resolve(
        &self,
        input: &str,
        options: ResolveOptions,
    ) -> Result<Option<ResolvedResult>, ProviderError>;
}
```

### Adding a New Provider

1. Create `src/providers/new_provider.rs`
2. Implement `Provider` trait
3. Register in `src/providers/mod.rs`
4. Add to cascade in `src/resolver/cascade.rs`

### Example Provider

```rust
pub struct NewProvider {
    api_key: Option<String>,
}

impl Provider for NewProvider {
    fn name(&self) -> &str {
        "new_provider"
    }

    fn is_free(&self) -> bool {
        false
    }

    fn input_type(&self) -> InputType {
        InputType::Query
    }

    async fn resolve(
        &self,
        input: &str,
        options: ResolveOptions,
    ) -> Result<Option<ResolvedResult>, ProviderError> {
        // Implementation
        Ok(Some(ResolvedResult {
            source: self.name().to_string(),
            content: "...".to_string(),
            url: None,
            query: Some(input.to_string()),
            score: 0.8,
            ..Default::default()
        }))
    }
}
```

## Error Handling

```rust
pub enum ProviderError {
    RateLimited { retry_after: Option<u64> },
    AuthError,
    QuotaExhausted,
    NetworkError(String),
    NotFound,
    Timeout,
    InvalidResponse(String),
    Unknown(String),
}
```

## Testing

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_resolve_url

# Run with output
cargo test -- --nocapture

# Run integration tests (requires API keys)
cargo test --features integration
```
