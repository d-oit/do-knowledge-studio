# LLM Provider Setup

The knowledge studio supports multiple LLM providers through a unified abstraction layer. API keys are encrypted at rest using AES-256-GCM.

---

## Supported Providers

### OpenRouter (Default)

Access to 100+ free and paid models through a single API.

**Base URL:** `https://openrouter.ai/api/v1`

**Free Models:**
| Display Name | Model ID |
|-------------|----------|
| Gemini 2.0 Flash Lite | `google/gemini-2.0-flash-lite-preview-02-05:free` |
| OpenRouter Free | `openrouter/free` |
| Nemotron 3 Super | `nvidia/nemotron-3-super:free` |
| Trinity Large | `arcee-ai/trinity-large-preview:free` |
| GLM 4.5 Air | `z-ai/glm-4.5-air:free` |
| GPT-OSS 120B | `openai/gpt-oss-120b:free` |
| Qwen3 Coder | `qwen/qwen3-coder-480b-a35b:free` |
| LLaMA 3.3 70B | `meta-llama/llama-3.3-70b-instruct:free` |

**Setup:**
1. Get an API key from [openrouter.ai](https://openrouter.ai)
2. Open AI Harness → Settings → paste your key

### Kilo Gateway

Free-tier AI gateway with curated models.

**Base URL:** `https://api.kilo.ai/api/gateway`

**Free Models:**
| Display Name | Model ID |
|-------------|----------|
| Kilo Auto | `kilo-auto/free` |
| DoLa Seed 2.0 Pro | `bytedance-seed/dola-seed-2.0-pro:free` |
| Grok Code Fast | `x-ai/grok-code-fast-1:optimized:free` |
| Nemotron 3 Super | `nvidia/nemotron-3-super-120b-a12b:free` |
| Trinity Large | `arcee-ai/trinity-large-thinking:free` |
| OpenRouter Free | `openrouter/free` |

**Setup:**
1. Get an API key from [kilo.ai](https://kilo.ai)
2. Open AI Harness → Settings → select Kilo provider → paste your key

---

## Configuration

### Storage

LLM configuration is stored in `localStorage` under the key `dks:llm-config`. The config includes:
- `activeProvider` — which provider to use (`openrouter` or `kilo`)
- `providers` — per-provider settings (base URL, API key, default model)

### API Key Encryption

API keys are encrypted at rest using **AES-256-GCM** via the Web Crypto API:

1. On first use, a 256-bit encryption key is generated and stored as JWK in `localStorage` under `dks:llm-encryption-key`
2. API keys are encrypted before persisting and decrypted on load
3. Legacy plaintext keys are auto-migrated to encrypted on first load
4. Encrypted values are prefixed with `enc:v1:` for forward-compatible migration

### Loading Config

```typescript
const config = await loadConfig();  // async — decrypts API keys
```

### Saving Config

```typescript
await saveConfig(config);  // async — encrypts API keys before persisting
```

---

## Adding a New Provider

1. Create `src/lib/llm/<provider>.ts` implementing `LLMProvider`:

```typescript
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMProviderConfig } from './types';

export class MyProvider implements LLMProvider {
  id = 'myprovider';
  name = 'My Provider';
  config: LLMProviderConfig;

  constructor(config?: Partial<LLMProviderConfig>) {
    this.config = { baseURL: 'https://api.example.com/v1', ...config };
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    // Implement chat completion
  }

  async *chatStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    // Implement streaming chat
  }
}
```

2. Register in `src/lib/llm/config.ts`:

```typescript
case 'myprovider':
  return new MyProviderProvider(providerConfig);
```

3. Add to `src/lib/llm/index.ts`:

```typescript
export { MyProvider } from './myprovider';

export const PROVIDER_MODELS: Record<string, Record<string, string>> = {
  // ... existing providers
  myprovider: {
    'Model Name': 'model-id',
  },
};
```

4. Add tests in `src/lib/llm/__tests__/`

---

## Architecture

```
AI Harness (UI)
    │
    ▼
useChat → loadConfig() → createProvider(config)
    │
    ▼
┌─────────────────────┐
│  LLMProvider        │  ← Interface: chat(), chatStream()
│  (OpenRouter | Kilo) │
└─────────────────────┘
    │
    ▼
fetch() → Provider API → Streaming response
```

All providers implement the `LLMProvider` interface with:
- `chat(request)` — single response
- `chatStream(request)` — streaming response via AsyncGenerator
- `isConfigured()` — check if API key is set

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/llm/types.ts` | Type definitions (LLMProvider, LLMRequest, etc.) |
| `src/lib/llm/config.ts` | Config loading/saving with encryption |
| `src/lib/llm/encryption.ts` | AES-GCM encryption for API keys |
| `src/lib/llm/openrouter.ts` | OpenRouter provider implementation |
| `src/lib/llm/kilo.ts` | Kilo Gateway provider implementation |
| `src/lib/llm/index.ts` | Barrel exports and model registry |
