import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMProviderConfig } from './types';

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';

export class OllamaProvider implements LLMProvider {
  id = 'ollama';
  name = 'Ollama (Local)';
  config: LLMProviderConfig;

  constructor(config?: Partial<LLMProviderConfig>) {
    this.config = {
      baseURL: config?.baseURL || OLLAMA_DEFAULT_BASE_URL,
      ...config,
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      throw new Error(`Ollama error: ${error.error || response.statusText}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
      model: string;
      eval_count?: number;
      prompt_eval_count?: number;
    };

    return {
      content: data.message?.content || '',
      model: data.model || request.model,
      usage: data.eval_count !== undefined ? {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count,
      } : undefined,
    };
  }

  async *chatStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch(`${this.config.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      throw new Error(`Ollama error: ${error.error || response.statusText}`);
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
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done: boolean;
            eval_count?: number;
            prompt_eval_count?: number;
          };

          if (parsed.message?.content) {
            yield { content: parsed.message.content, done: false };
          }

          if (parsed.done) {
            yield {
              content: '',
              done: true,
              usage: parsed.eval_count !== undefined ? {
                inputTokens: parsed.prompt_eval_count || 0,
                outputTokens: parsed.eval_count,
              } : undefined,
            };
            return;
          }
        } catch {
          // Expected: incomplete JSON line
        }
      }
    }

    yield { content: '', done: true };
  }
}

export const OLLAMA_MODELS = {
  LLAMA3_2: 'llama3.2',
  LLAMA3_1: 'llama3.1',
  MISTRAL: 'mistral',
  CODELLAMA: 'codellama',
  QWEN2_5: 'qwen2.5',
  GEMMA2: 'gemma2',
} as const;
