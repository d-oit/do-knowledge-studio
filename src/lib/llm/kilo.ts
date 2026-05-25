import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMProviderConfig } from './types';

const KILO_BASE_URL = 'https://api.kilo.ai/api/gateway';

export class KiloGatewayProvider implements LLMProvider {
  id = 'kilo';
  name = 'Kilo Gateway Free';
  config: LLMProviderConfig;

  constructor(config?: Partial<LLMProviderConfig>) {
    this.config = {
      baseURL: KILO_BASE_URL,
      ...config,
    };
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Kilo Gateway error: ${error.error?.message || response.statusText}`);
    }

    const data: { choices: Array<{ message?: { content?: string } }>; model?: string; usage?: { prompt_tokens: number; completion_tokens: number } } = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model || request.model,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
    };
  }

  async *chatStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Kilo Gateway error: ${error.error?.message || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            yield { content, done: false };
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      ...(this.config.defaultHeaders || {}),
    };
  }
}

// Free model constants
export const KILO_FREE_MODELS = {
  AUTO: 'kilo-auto/free',
  DOLA_SEED_2_0_PRO: 'bytedance-seed/dola-seed-2.0-pro:free',
  GROK_CODE_FAST: 'x-ai/grok-code-fast-1:optimized:free',
  NEMOTRON_3_SUPER: 'nvidia/nemotron-3-super-120b-a12b:free',
  TRINITY_LARGE: 'arcee-ai/trinity-large-thinking:free',
  OPENROUTER_FREE: 'openrouter/free',
} as const;
