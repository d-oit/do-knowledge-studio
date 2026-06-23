# LLM Setup

Knowledge Studio uses LLMs for entity extraction, summarization, and
the AI chat feature in the AI Harness. The provider layer lives in
`src/lib/llm/` and is configured per-user via an in-app wizard —
keys are encrypted at rest with AES-256-GCM (Web Crypto API) and
stored in IndexedDB.

## Supported Providers

| Provider | API Key | Free Tier | Default Base URL | Streaming | Tools |
|----------|---------|-----------|-------------------|-----------|-------|
| OpenRouter | Yes | Yes (rotating free models) | `https://openrouter.ai/api/v1` | Yes | Yes |
| Kilo Gateway | Yes | Yes | `https://api.kilo.ai/api/gateway` | Yes | Yes |
| Anthropic | Yes | No | `https://api.anthropic.com/v1` | Yes | Yes |
| Ollama | No (local) | Yes (self-hosted) | `http://localhost:11434` | Yes | No |

## Configuration

### In-app (recommended)

1. Open the **AI Harness** view from the sidebar.
2. On first launch, the **Settings Wizard** walks you through picking
   a provider, model, and API key. You can also dismiss it and
   configure later via the gear icon in the chat header.
3. After saving, the API key is encrypted with AES-256-GCM and
   written to IndexedDB. The encryption key is a 256-bit JWK stored
   in `localStorage` under `dks:llm-key`.

Keys are encrypted with the `enc:v1:` prefix so the loader can
migrate older plaintext entries automatically on first load.

### Configuration file shape

`LLMConfig` is defined in `src/lib/llm/config.ts`:

```typescript
interface LLMConfig {
  activeProvider: 'openrouter' | 'kilo' | 'anthropic' | 'ollama';
  providers: Record<string, {
    baseURL: string;
    apiKey: string;       // encrypted at rest
    defaultModel: string; // last-used model id
  }>;
}
```

### Environment variables (build-time defaults only)

```bash
# .env (loaded by Vite at build time)
VITE_LLM_API_KEY=sk-...           # Pre-fill default key (NOT recommended for production)
VITE_LLM_BASE_URL=https://...     # Override a provider base URL
```

These are baked into the bundle and visible to anyone with the
deployed build — for personal projects only.

## Provider Setup

### OpenRouter

1. Create an account at [openrouter.ai](https://openrouter.ai).
2. Generate an API key from the dashboard.
3. In the AI Harness settings, pick **OpenRouter**.
4. Paste the API key and save.

**Free models (rotate frequently, see the in-app dropdown for the
current list):**

- `google/gemini-2.0-flash-lite-preview-02-05:free`
- `meta-llama/llama-3.3-70b-instruct:free`
- `nvidia/nemotron-3-super:free`
- `qwen/qwen3-coder-480b-a35b:free`
- `arcee-ai/trinity-large-preview:free`
- `z-ai/glm-4.5-air:free`
- `openai/gpt-oss-120b:free`
- `openrouter/free`

### Kilo Gateway

1. Sign up at [kilo.ai](https://kilo.ai).
2. Generate an API key.
3. Pick **Kilo Gateway** in the AI Harness settings.
4. Paste the key and save.

**Free models:**

- `kilo-auto/free`
- `x-ai/grok-code-fast-1:optimized:free`
- `nvidia/nemotron-3-super-120b-a12b:free`
- `arcee-ai/trinity-large-thinking:free`
- `openrouter/free`

### Anthropic

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. Generate an API key.
3. Pick **Anthropic** in the AI Harness settings.
4. Paste the key and save.

**Available models (paid only):**

- `claude-haiku-3-5-20241022` (fast, default for low-cost tasks)
- `claude-3-5-sonnet-20241022`
- `claude-sonnet-4-20250514`
- `claude-opus-4-20250514`

### Ollama (Local)

1. Install Ollama from [ollama.com](https://ollama.com).
2. Pull a model:
   ```bash
   ollama pull llama3.2
   ```
3. Start the daemon (it runs on `http://localhost:11434`):
   ```bash
   ollama serve
   ```
4. In the AI Harness settings, pick **Ollama**. No API key is
   required — leave the field empty.
5. Adjust the base URL if you run Ollama on a different host/port
   (e.g. a remote dev box).

**Available local models:**

- `llama3.2` (default)
- `llama3.1`
- `mistral`
- `codellama`
- `qwen2.5`
- `gemma2`

## Model Selection

| Use case | Recommended model | Provider |
|----------|-------------------|----------|
| Free experimentation | `kilo-auto/free` or any `:free` OpenRouter model | Kilo / OpenRouter |
| Code extraction | `qwen/qwen3-coder-480b-a35b:free` | OpenRouter |
| High-quality reasoning | `claude-sonnet-4-20250514` | Anthropic |
| Lowest latency | `claude-3-5-haiku-20241022` | Anthropic |
| Fully local | `llama3.2` via Ollama | Ollama |
| Privacy-sensitive | Any Ollama model on your own machine | Ollama |

The default model is set per-provider in `PROVIDER_MODELS`
(`src/lib/llm/index.ts`).

## Features That Use LLMs

### Entity Extraction

The AI Harness can extract structured entities and relationships from
free-text notes. Flow:

1. Open AI Harness → Settings.
2. Confirm the active provider and model.
3. Open a note, click **Extract Entities**.
4. The {@link EntityReviewDialog} shows the candidates; select the
   ones you want and apply.

### Knowledge Augmentation (RAG)

When "Augment with Knowledge" is enabled in the chat composer, every
prompt is enriched with the top-5 Orama search hits. This works fully
locally — no remote retrieval is performed.

### Chat

The chat view is a provider-agnostic wrapper around the configured
provider's streaming chat completions API. Streaming is enabled by
default for OpenRouter, Kilo, Anthropic, and Ollama.

## Encryption Details

API keys are encrypted with AES-256-GCM using the Web Crypto API:

- A 256-bit symmetric key is generated on first launch and stored as
  a JSON Web Key in `localStorage` under `dks:llm-key`.
- Each encrypted value is prefixed with `enc:v1:` so the loader can
  detect and migrate legacy plaintext entries.
- The IV is regenerated per write and prepended to the ciphertext.

To rotate the encryption key, open the browser console and run:

```javascript
localStorage.removeItem('dks:llm-key');
location.reload();
```

The next save re-encrypts under a fresh key.

## Troubleshooting

### "API key not configured"

- Open the AI Harness settings and enter a key for the active
  provider. The key field is per-provider — switching providers does
  not carry the key over.

### "Rate limit exceeded"

- Free tiers throttle aggressively. Either wait, switch to a paid
  model, or rotate to a different free model.
- The client-side `useRateLimiter` hook displays a traffic-light chip
  so you can see your own rate.

### "Model not available"

- The list of `:free` models changes frequently. Refresh the model
  dropdown in the AI Harness settings.
- Some models are temporarily rate-limited or offline — try a
  different one.

### Ollama connection refused

- Make sure the daemon is running: `ollama serve`.
- Confirm the base URL — default is `http://localhost:11434`.
- Verify the model is pulled: `ollama list`.

### Key not loading after browser data clear

- If the encryption key in `localStorage` is wiped but the encrypted
  blob in IndexedDB survives, the loader will fail to decrypt.
  Re-enter the API key in the AI Harness settings.

### Browser blocks the request

- Mixed content (HTTPS page calling an HTTP Ollama endpoint) is
  blocked by default. Run the app on `http://localhost` for local
  Ollama, or expose Ollama over HTTPS via a reverse proxy.
- Some corporate proxies strip the `Authorization` header. Test
  with a different network.

## Security

- API keys are encrypted at rest using AES-256-GCM.
- The encryption key is stored in `localStorage` (not IndexedDB) so
  users can wipe it independently.
- The app only contacts the configured provider's base URL — no
  telemetry or third-party requests.
- All provider traffic uses HTTPS except for local Ollama.
- Chat history is stored in IndexedDB (`chat-persistence.ts`) and
  never leaves the device.
