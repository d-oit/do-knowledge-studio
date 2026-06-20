# LLM Setup

Knowledge Studio supports multiple LLM providers for AI-powered features (entity extraction, chat, knowledge augmentation).

## Supported Providers

| Provider | API Key Required | Free Tier | Base URL |
|----------|-----------------|-----------|----------|
| OpenRouter | Yes | Yes (limited) | `https://openrouter.ai/api/v1` |
| Kilo Gateway | Yes | Yes | `https://api.kilo.ai/api/gateway` |
| Anthropic | Yes | No | `https://api.anthropic.com/v1` |
| Ollama | No | Yes (local) | `http://localhost:11434` |

## Configuration

### Via the App

1. Open the AI Harness view (click "AI Harness" in the sidebar)
2. Click the settings gear icon
3. Select your provider
4. Enter your API key
5. Select a model (or use the default)

API keys are encrypted at rest using AES-GCM and stored in IndexedDB.

### Via CLI

API keys can also be configured via environment variables (not recommended for production):

```bash
export VITE_LLM_API_KEY="your-api-key"
```

## Provider Setup

### OpenRouter

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Get your API key from the dashboard
3. In the app, select "OpenRouter" as the provider
4. Paste your API key

**Free models available:**
- `google/gemini-2.0-flash-lite-preview-02-05:free`
- `meta-llama/llama-3.3-70b-instruct:free`
- `nvidia/nemotron-3-super:free`
- `qwen/qwen3-coder-480b-a35b:free`

### Kilo Gateway

1. Sign up at [kilo.ai](https://kilo.ai)
2. Get your API key
3. In the app, select "Kilo Gateway" as the provider
4. Paste your API key

**Free models available:**
- `kilo-auto/free`
- `meta-llama/llama-3.1-8b-instruct`

### Anthropic

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Get your API key
3. In the app, select "Anthropic" as the provider
4. Paste your API key

**Available models:**
- `claude-3-5-haiku-20241022` (default, fast)
- `claude-sonnet-4-20250514`
- `claude-opus-4-20250514`

### Ollama (Local)

1. Install Ollama: [ollama.com](https://ollama.com)
2. Pull a model:
   ```bash
   ollama pull llama3.2
   ```
3. Start Ollama:
   ```bash
   ollama serve
   ```
4. In the app, select "Ollama" as the provider
5. No API key needed (uses localhost)

**Available models:**
- `llama3.2` (default)
- `llama3.1`
- `mistral`
- `codellama`
- `qwen2.5`
- `gemma2`

## Features Using LLM

### Entity Extraction

The AI harness can automatically extract entities from text:

1. Open AI Harness
2. Paste text or select an entity
3. Click "Extract Entities"
4. Review and accept extracted entities

### Chat

Ask questions about your knowledge base:

1. Open Chat view
2. Toggle "Augment with Knowledge" to enable RAG
3. Ask a question
4. The AI will search your knowledge base for relevant context

### Knowledge Augmentation

When enabled, chat queries are augmented with relevant entities and claims from your knowledge base using semantic search.

## Troubleshooting

### "API key not configured"

- Ensure you've entered a valid API key in Settings
- Check that the provider is selected as active

### "Rate limit exceeded"

- Free tiers have rate limits
- Switch to a different provider or wait
- The app includes a client-side rate limiter

### "Model not available"

- Check if the model is available for your provider
- Free models may be temporarily unavailable
- Try a different model

### Ollama connection refused

- Ensure Ollama is running: `ollama serve`
- Check the base URL: `http://localhost:11434`
- Verify the model is pulled: `ollama list`

## Security

- API keys are encrypted at rest using AES-GCM (Web Crypto API)
- Keys are stored in IndexedDB (not localStorage)
- Keys are never sent to any server except the configured provider
- All LLM communication uses HTTPS (except local Ollama)
