import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMProviderConfig } from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProvider implements LLMProvider {
  id = 'openrouter';
  name = 'OpenRouter Free';
  config: LLMProviderConfig;

  constructor(config?: Partial<LLMProviderConfig>) {
    this.config = {
      baseURL: OPENROUTER_BASE_URL,
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
      throw new Error(`OpenRouter error: ${error.error?.message || response.statusText}`);
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
      throw new Error(`OpenRouter error: ${error.error?.message || response.statusText}`);
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
export const OPENROUTER_FREE_MODELS = {
  AUTO: 'openrouter/free',
  NEMOTRON_3_SUPER: 'nvidia/nemotron-3-super:free',
  TRINITY_LARGE: 'arcee-ai/trinity-large-preview:free',
  GLM_4_5_AIR: 'z-ai/glm-4.5-air:free',
  GPT_OSS_120B: 'openai/gpt-oss-120b:free',
  QWEN3_CODER: 'qwen/qwen3-coder-480b-a35b:free',
  LLAMA_3_3_70B: 'meta-llama/llama-3.3-70b-instruct:free',
} as const;
