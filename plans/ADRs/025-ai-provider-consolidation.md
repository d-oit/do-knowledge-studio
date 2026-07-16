# ADR 025: AI Provider Consolidation — OpenRouter + Ollama

**Date**: 2026-07-16  
**Status**: Accepted  
**Supersedes**: ADR 019 (partial — vendor-specific endpoints)  
**Related**: Plan 065

## Context

The AI Harness previously supported three separate vendor APIs (OpenAI, Anthropic, Ollama) via inline `fetch` in the view component. This duplicated request shapes, increased maintenance burden, and blocked free/multi-model cloud use.

## Decision

Consolidate to two providers:

1. **OpenRouter** — single OpenAI-compatible gateway replacing direct OpenAI + Anthropic. One API key, one endpoint, hundreds of models including free routers.
2. **Ollama** — local-first path with CPU-only option via `options.num_gpu: 0`.

Remove as first-class providers: direct `openai`, direct `anthropic` (reachable through OpenRouter model slugs).

## Consequences

### Positive
- Single cloud key path (OpenRouter only)
- Free model access via `openrouter/free` router
- Reduced code surface (one adapter per provider instead of three)
- CPU-only Ollama toggle for shared machines
- AbortController on all fetch calls
- BM25 retrieval for local context augmentation

### Negative
- Anthropic-only features (if any) must be accessed through OpenRouter model slugs
- Free model rate limits require clear user messaging
- Browser CORS to OpenRouter requires user trust in the gateway

### Neutral
- Provider migration on settings load (old openai/anthropic → openrouter)
- `ollamaBaseUrl` configurable for remote Ollama instances
- Web research (Jina Reader) toggled off by default for privacy

## Migration

Old stored settings with `provider: 'openai'` or `provider: 'anthropic'` are automatically migrated to `provider: 'openrouter'` on load. Models are remapped where possible (e.g., `gpt-4o` → `openrouter/free`, `claude-sonnet-4` → `anthropic/claude-sonnet-4`).
