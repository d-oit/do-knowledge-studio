---
name: do-web-doc-resolver
description: Python resolver for URLs and queries into compact, LLM-ready markdown. Uses progressive free-first cascade with quality scoring, circuit breakers, layered routing memory, trace-based evaluation, and agent-friendly docs validation. Use when fetching documentation, resolving web URLs, or building context from web sources.
license: MIT
compatibility: Python 3.10+, async/await
allowed-tools: Bash(python:*|do-wdr:*) Read
metadata:
  author: d-oit
  version: "0.2.1"
  source: https://github.com/d-oit/do-web-doc-resolver
---

# Web Doc Resolver Skill

Resolve URLs and queries into compact, LLM-ready markdown using a progressive, free-first cascade with 2026 production patterns.

## When to use

- Fetch and parse documentation from a URL
- Search for technical information across the web
- Build context from web sources for AI agents
- Validate content against agent-docs-spec v0.3.0
- Trace resolution trajectories for debugging

## Quick Start

```bash
python -m scripts.resolve "https://docs.rust-lang.org/book/"
python -m scripts.resolve "Rust async programming" --profile quality --trace --json
```

## Cascade Strategy

**URL**: Cache → llms.txt → Jina → Direct Fetch → Firecrawl → Mistral Browser → DuckDuckGo

**Query**: Cache → Exa MCP → Exa SDK → Tavily → Serper → DuckDuckGo → Mistral Web Search

## Providers (12 total)

| Provider | Type | Free | Latency |
|----------|------|------|---------|
| `llms_txt` | URL | Yes | ~100ms |
| `jina` | URL | Yes | ~300-1500ms |
| `exa_mcp` | Query | Yes | Varies |
| `duckduckgo` | Query | Yes | ~2s |
| `direct_fetch` | URL | Yes | ~500ms |
| `exa`, `tavily`, `serper` | Query | No | ~1s |
| `firecrawl`, `mistral_*` | URL/Query | No | ~2-3s |
| `docling`, `ocr` | URL | No | ~3-5s |

## Execution Profiles

| Profile | Attempts | Paid | Latency | Quality |
|---------|----------|------|---------|---------|
| `free` | 3 | 0 | 6s | 0.70 |
| `fast` | 2 | 1 | 4s | 0.60 |
| `balanced` | 4-6 | 1-2 | 9-12s | 0.65 |
| `quality` | 6-10 | 3-5 | 15-20s | 0.55 |

## Key Features

**Structured Tool Contracts**: Every provider returns `ProviderResult(ok, content, error, meta)` with `ProviderMeta(tool, duration_ms, cache_hit, quality_score, error_type)`.

**Layered Routing Memory**: TTL-based decay (30 days), metadata filtering, recency weighting. See `scripts/routing_memory.py`.

**Trace-Based Evaluation**: Emit `ResolutionTrace` with `TraceStep` per provider. CLI: `--trace --json`.

**Agent-Friendly Docs Validation**: Validates against [agent-docs-spec v0.3.0](https://github.com/agent-ecosystem/agent-docs-spec) — 10 checks across 7 categories.

**Quality Scoring**: Content scored 0.0-1.0. Penalties: too_short(-0.35), missing_links(-0.15), duplicate_heavy(-0.25), noisy(-0.20).

**Circuit Breakers**: 3 failures → 300s cooldown per provider.

## Configuration

```bash
export EXA_API_KEY="" TAVILY_API_KEY="" FIRECRAWL_API_KEY="" MISTRAL_API_KEY=""
export WEB_RESOLVER_MAX_CHARS=8000 WEB_RESOLVER_MIN_CHARS=200
```

## Output

```python
{"source": "jina", "content": "...", "score": 0.87,
 "metrics": {"total_latency_ms": 1234, "provider_metrics": [...], "paid_usage": False},
 "trace": {"trace_id": "...", "steps": [...], "success": True}}  # when --trace
```

## File Structure

```
scripts/
├── resolve.py           # Main orchestrator & CLI
├── models.py            # Data models, enums, trace types
├── providers_impl.py    # 12 provider implementations
├── quality.py           # Content quality scoring
├── docs_validation.py   # Agent-docs-spec v0.3.0 checks
├── routing_memory.py    # Layered memory with TTL decay
├── routing.py           # Budget-aware routing
├── circuit_breaker.py   # Circuit breaker patterns
├── cache_negative.py    # Negative cache
├── synthesis.py         # LLM synthesis gate
└── utils.py             # Utilities
```

## References

| Topic | File |
|-------|------|
| Agent-docs-spec | https://github.com/agent-ecosystem/agent-docs-spec |
| Memory 2026 | https://mem0.ai/blog/state-of-ai-agent-memory-2026 |
| Agent architecture | https://andriifurmanets.com/blogs/ai-agents-2026-practical-architecture-tools-memory-evals-guardrails |
