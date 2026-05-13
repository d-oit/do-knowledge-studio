# Plan 06: LLM Provider Plugin System

**Priority**: Completed (Foundation for AI Harness)
**Date**: 2026-04-23
**Estimated Effort**: 3-4 hours (done)
**Sources**: Web research - OpenRouter & Kilo Gateway APIs

## Overview
Implemented a plugin/config system for LLM providers supporting **OpenRouter Free** and **Kilo Gateway Free** models. Uses browser-compatible fetch API (no Node.js-only SDKs).

## Files Created
1. `src/lib/llm/types.ts` - Core interfaces (LLMProvider, LLMRequest, LLMResponse)
2. `src/lib/llm/openrouter.ts` - OpenRouter Free provider implementation
3. `src/lib/llm/kilo.ts` - Kilo Gateway Free provider implementation
4. `src/lib/llm/config.ts` - Plugin system config loader/saver (localStorage)
5. `src/lib/llm/index.ts` - Barrel exports

## Key Features
- **OpenAI-compatible API**: Both providers use standard `/chat/completions` endpoint
- **Streaming support**: `chatStream()` returns `AsyncGenerator<LLMStreamChunk>`
- **Config persistence**: Saves provider selection and API keys to localStorage
- **Environment variables**: Supports `VITE_OPENROUTER_API_KEY` and `VITE_KILO_API_KEY`
- **Free model constants**: Exports `OPENROUTER_FREE_MODELS` and `KILO_FREE_MODELS`

## Usage Example
```typescript
import { loadConfig, createProvider } from './lib/llm';

// Load saved config
const config = loadConfig();
const provider = createProvider(config);

// Non-streaming chat
const response = await provider.chat({
  model: 'openrouter/free',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.content);

// Streaming chat
for await (const chunk of provider.chatStream({ ... })) {
  console.log(chunk.content);
}
```

## Next Steps (For AI Harness Integration)
1. Create settings UI for provider selection and API key input
2. Integrate into `AIHarness.tsx`:
   - Load provider on mount
   - Wire up chat input to `chatStream()`
   - Display streaming responses
3. Add Orama context augmentation:
   - Query local search index with user input
   - Inject top results as system prompt context
4. Test with free models:
   - OpenRouter: `openrouter/free` (auto-selects from available free models)
   - Kilo: `kilo-auto/free` (curated free model set)

## Provider Details

### OpenRouter Free
- **Base URL**: `https://openrouter.ai/api/v1`
- **Free Model**: `openrouter/free` (auto-routes to available free models)
- **Popular Free Models**: `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen3-coder-480b-a35b:free`
- **Rate Limits**: Vary by model, check openrouter.ai/free

### Kilo Gateway Free
- **Base URL**: `https://api.kilo.ai/api/gateway`
- **Free Model**: `kilo-auto/free` (curated free set)
- **Popular Free Models**: `arcee-ai/trinity-large-thinking:free`, `nvidia/nemotron-3-super-120b-a12b:free`
- **Rate Limits**: 200 requests/hour per IP (anonymous), higher for authenticated

## Validation
- [x] TypeScript compiles with no errors (`npm run typecheck`)
- [x] Interfaces are strict (no `any` types)
- [x] Streaming and non-streaming methods implemented
- [x] Config persists to localStorage
- [x] Follows AGENTS.md HARD RULES (local-first, strict TS)
