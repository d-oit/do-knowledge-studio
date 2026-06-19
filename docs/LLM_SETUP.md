# LLM Setup Guide

`do-knowledge-studio` supports multiple LLM providers through a plugin-based architecture. This guide covers setup and configuration for supported providers.

## Supported Providers

### Built-in
- **OpenRouter**: Multi-model router (https://openrouter.ai)
- **Kilo**: AI coding assistant (https://kilo.ai)

### Custom
- Any OpenAI-compatible API endpoint
- Local models via Ollama, LM Studio, etc.

## Quick Start

### 1. Get an API Key

#### OpenRouter
1. Visit https://openrouter.ai/keys
2. Sign in or create an account
3. Generate a new API key
4. Copy the key (starts with `sk-or-v1-`)

#### Kilo
1. Visit https://kilo.ai/settings
2. Sign in or create an account
3. Generate an API key
4. Copy the key

### 2. Configure in Application

1. Open the application
2. Click Settings (gear icon)
3. Navigate to "AI Configuration"
4. Select your provider
5. Paste your API key
6. Click "Save"

The API key is encrypted and stored locally in your browser.

## Configuration

### Environment Variables

You can set default configuration via environment variables:

```bash
# .env.local
VITE_LLM_PROVIDER=openrouter
VITE_LLM_API_KEY=sk-or-v1-...
VITE_LLM_MODEL=anthropic/claude-3.5-sonnet
```

**Note**: API keys in `VITE_*` variables are exposed to the browser. Use the application settings for production keys.

### Programmatic Configuration

```typescript
import { configureLLM } from './lib/llm/config';

configureLLM({
  provider: 'openrouter',
  apiKey: 'sk-or-v1-...',
  model: 'anthropic/claude-3.5-sonnet',
  temperature: 0.7,
  maxTokens: 2000,
});
```

## Provider-Specific Setup

### OpenRouter

OpenRouter provides access to multiple models through a single API.

#### Supported Models
- **Anthropic Claude 3.5 Sonnet**: `anthropic/claude-3.5-sonnet`
- **OpenAI GPT-4 Turbo**: `openai/gpt-4-turbo`
- **Meta Llama 3.1 70B**: `meta-llama/llama-3.1-70b-instruct`
- **Google Gemini Pro 1.5**: `google/gemini-pro-1.5`

#### Configuration
```json
{
  "provider": "openrouter",
  "apiKey": "sk-or-v1-...",
  "model": "anthropic/claude-3.5-sonnet",
  "baseUrl": "https://openrouter.ai/api/v1"
}
```

#### Cost Optimization
- Use `anthropic/claude-3-haiku` for cost-effective operations
- Set `maxTokens` to limit response length
- Enable response caching where available

### Kilo

Kilo is optimized for AI coding assistance.

#### Configuration
```json
{
  "provider": "kilo",
  "apiKey": "your-kilo-key",
  "model": "kilo-coder"
}
```

### Custom OpenAI-Compatible Endpoints

You can use any OpenAI-compatible API, including local models.

#### Ollama (Local)
```json
{
  "provider": "custom",
  "apiKey": "not-needed",
  "baseUrl": "http://localhost:11434/v1",
  "model": "llama3.1"
}
```

#### LM Studio (Local)
```json
{
  "provider": "custom",
  "apiKey": "not-needed",
  "baseUrl": "http://localhost:1234/v1",
  "model": "local-model"
}
```

## Features

### Chat Assistant
Ask questions about your knowledge base. The assistant uses semantic search to find relevant entities and claims.

### Entity Extraction
Automatically extract entities and claims from text using AI.

### Claim Verification
Verify claims against your existing knowledge base.

### Graph Suggestions
Get AI suggestions for entity relationships.

## Rate Limiting

The application includes built-in rate limiting to prevent API quota exhaustion:

- **Default**: 10 requests per minute
- **Configurable**: Adjust in settings
- **Per-provider**: Different limits per provider

### Rate Limit Headers
Check the application console for rate limit information:
```
Rate limit: 10/10 requests remaining (resets in 45s)
```

## Error Handling

### Common Errors

#### 401 Unauthorized
- **Cause**: Invalid or missing API key
- **Solution**: Verify API key in settings

#### 429 Too Many Requests
- **Cause**: Rate limit exceeded
- **Solution**: Wait for rate limit reset or increase limit

#### 500 Internal Server Error
- **Cause**: Provider API issue
- **Solution**: Try again or switch provider

#### Network Error
- **Cause**: No internet connection
- **Solution**: Check connection and retry

### Fallback Strategy

The application supports automatic fallback to alternative providers:
```json
{
  "primary": "openrouter",
  "fallback": ["kilo", "custom"]
}
```

## Security

### API Key Storage
- Keys are encrypted using AES-GCM
- Encryption key derived from browser fingerprint
- Keys never leave your device
- Keys are not logged or transmitted in plain text

### Best Practices
1. **Use the application settings** for API keys (not environment variables)
2. **Rotate keys regularly** (every 90 days recommended)
3. **Use separate keys** for development and production
4. **Monitor usage** through your provider's dashboard
5. **Set spending limits** in your provider account

### Security Auditing

Run the security audit script to check for exposed keys:
```bash
./scripts/audit-vite-env.sh
```

## Privacy

### Data Handling
- Your data never leaves your device
- Only prompts and context are sent to LLM providers
- No telemetry or usage tracking
- You control what data is shared

### Provider Privacy Policies
Review each provider's privacy policy:
- [OpenRouter Privacy](https://openrouter.ai/privacy)
- [Kilo Privacy](https://kilo.ai/privacy)

## Troubleshooting

### API Key Not Working
1. Verify the key is correct (no extra spaces)
2. Check if the key has expired
3. Ensure the key has the required permissions
4. Try regenerating the key

### Slow Responses
1. Check your internet connection
2. Try a smaller/faster model
3. Reduce `maxTokens` setting
4. Enable response streaming

### Incorrect Results
1. Adjust the `temperature` setting (lower = more focused)
2. Provide more context in your queries
3. Use a more capable model
4. Check the prompt templates in settings

## Advanced Configuration

### Custom Prompts
You can customize the system prompts used for each feature:

```json
{
  "prompts": {
    "chat": "You are a helpful assistant with access to a knowledge base...",
    "extraction": "Extract entities and claims from the following text...",
    "verification": "Verify this claim against the knowledge base..."
  }
}
```

### Response Streaming
Enable streaming for real-time responses:
```json
{
  "streaming": true,
  "streamChunkSize": 50
}
```

### Model Parameters
Fine-tune model behavior:
```json
{
  "temperature": 0.7,
  "topP": 0.9,
  "frequencyPenalty": 0.0,
  "presencePenalty": 0.0
}
```

## API Reference

See [LLM API Reference](LLM_API.md) for detailed API documentation.
