# Provider Cascade Reference

## Overview

The resolver auto-detects input type (URL vs query) and runs a free-first cascade optimized for cost and quality.

## Query Resolution Cascade

```
┌─────────────────────────────────────────────────────────────────┐
│                     Query Resolution Flow                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Cache Check (24h TTL)                                       │
│     └─→ Hit: Return cached result                               │
│                                                                  │
│  2. Exa MCP (FREE, no API key)                                  │
│     └─→ Success: Return if quality ≥ 0.65                       │
│     └─→ Fail: Continue to next provider                         │
│                                                                  │
│  3. Exa SDK (paid, EXA_API_KEY)                                 │
│     └─→ Requires API key + budget allows paid                   │
│     └─→ Success: Return if quality ≥ 0.65                       │
│                                                                  │
│  4. Tavily (paid, TAVILY_API_KEY)                               │
│     └─→ Requires API key + budget allows paid                   │
│                                                                  │
│  5. Serper (paid, SERPER_API_KEY)                               │
│     └─→ Requires API key + budget allows paid                   │
│                                                                  │
│  6. DuckDuckGo (FREE, no API key)                               │
│     └─→ Always available fallback                               │
│                                                                  │
│  7. Mistral Web Search (paid, MISTRAL_API_KEY)                  │
│     └─→ Last resort AI-powered search                           │
└─────────────────────────────────────────────────────────────────┘
```

## URL Resolution Cascade

```
┌─────────────────────────────────────────────────────────────────┐
│                      URL Resolution Flow                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Cache Check (24h TTL)                                       │
│     └─→ Hit: Return cached result                               │
│                                                                  │
│  2. Special File Type Detection                                 │
│     ├─→ .pdf, .docx, .pptx → Docling                            │
│     └─→ .png, .jpg, .jpeg → OCR (Tesseract)                     │
│                                                                  │
│  3. llms.txt Probe (FREE)                                       │
│     └─→ Check {origin}/llms.txt for structured docs             │
│     └─→ Success: Return immediately (high quality signal)       │
│                                                                  │
│  4. Jina Reader (FREE)                                          │
│     └─→ https://r.jina.ai/{url}                                 │
│     └─→ Good for most static content                            │
│                                                                  │
│  5. Firecrawl (paid, FIRECRAWL_API_KEY)                         │
│     └─→ Deep extraction with JS rendering                       │
│     └─→ Requires API key + budget allows paid                   │
│                                                                  │
│  6. Direct HTTP Fetch (FREE)                                    │
│     └─→ Simple GET + HTML-to-text extraction                    │
│     └─→ Strips scripts, styles, normalizes whitespace           │
│                                                                  │
│  7. Mistral Browser (paid, MISTRAL_API_KEY)                     │
│     └─→ AI-powered browser agent for complex pages              │
│                                                                  │
│  8. DuckDuckGo Fallback (FREE)                                  │
│     └─→ Search for the URL as a query                           │
└─────────────────────────────────────────────────────────────────┘
```

## Hedging Strategy

The resolver uses adaptive hedging to minimize latency:

1. **P75 Latency Threshold**: If a provider hasn't responded within its learned P75 latency, the next provider is started in parallel.

2. **Routing Memory**: Per-domain provider performance is tracked:
   - Success rate
   - Average latency
   - Average quality score

3. **Provider Ranking**: Providers are ranked by:
   - Success rate (higher is better)
   - Quality score (higher is better)
   - Latency (lower is better)

## Skip Providers

Use `--skip` to exclude specific providers:

```bash
# Skip Exa MCP and Exa SDK
python scripts/resolve.py "query" --skip exa_mcp --skip exa

# Skip all paid providers (free profile)
python scripts/resolve.py "query" --profile free
```

## Quality Thresholds

Content must meet minimum quality to be accepted:

| Profile | Quality Threshold | Max Attempts | Max Paid |
|---------|-------------------|--------------|----------|
| `free` | 0.70 | 3 | 0 |
| `fast` | 0.60 | 2 | 1 |
| `balanced` | 0.65 | 6 | 2 |
| `quality` | 0.55 | 10 | 5 |

## Circuit Breaker

Providers are temporarily disabled after repeated failures:

- **Failure threshold**: 3 consecutive failures
- **Cooldown period**: 300 seconds (5 minutes)
- **Reset**: Successful call resets failure count

## Negative Cache

Thin or low-quality results are cached to avoid re-probing:

- **TTL**: 1800 seconds (30 minutes)
- **Reasons**: `thin_content`, `error`, `timeout`