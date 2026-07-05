import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMProviderConfig } from './types';
import { logger } from '../logger';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export class AnthropicProvider implements LLMProvider {
  id = 'anthropic';
  name = 'Anthropic Claude';
  config: LLMProviderConfig;

  constructor(config?: Partial<LLMProviderConfig>) {
    this.config = {
      baseURL: ANTHROPIC_BASE_URL,
      ...config,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const { system, messages } = this.convertMessages(request.messages);

    const response = await fetch(`${this.config.baseURL}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature,
        system,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as { error?: { message?: string } };
      throw new Error(`Anthropic error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
      model: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const textContent = data.content.find(c => c.type === 'text');
    return {
      content: textContent?.text || '',
      model: data.model || request.model,
      usage: data.usage ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      } : undefined,
    };
  }

  async *chatStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const { system, messages } = this.convertMessages(request.messages);

    const response = await fetch(`${this.config.baseURL}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature,
        system,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as { error?: { message?: string } };
      throw new Error(`Anthropic error: ${error.error?.message || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let streamUsage: { inputTokens: number; outputTokens: number } | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);

        try {
          const parsed = JSON.parse(data) as {
            type: string;
            delta?: { type: string; text?: string };
            message?: { usage?: { input_tokens: number; output_tokens: number } };
            usage?: { input_tokens: number; output_tokens: number };
          };

          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield { content: parsed.delta.text, done: false };
          } else if (parsed.type === 'message_delta' && parsed.usage) {
            streamUsage = {
              inputTokens: parsed.usage.input_tokens,
              outputTokens: parsed.usage.output_tokens,
            };
          } else if (parsed.type === 'message_start' && parsed.message?.usage) {
            streamUsage = {
              inputTokens: parsed.message.usage.input_tokens,
              outputTokens: parsed.message.usage.output_tokens,
            };
          } else if (parsed.type === 'message_stop') {
            yield { content: '', done: true, usage: streamUsage };
            return;
          }
        } catch {
          logger.debug('SSE chunk parse skipped (incomplete or invalid JSON)');
        }
      }
    }

    yield { content: '', done: true, usage: streamUsage };
  }

  private convertMessages(messages: LLMRequest['messages']): {
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    let system = '';
    const converted: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n' : '') + msg.content;
      } else {
        converted.push({ role: msg.role, content: msg.content });
      }
    }

    return { system, messages: converted };
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey || '',
      'anthropic-version': '2023-06-01',
      ...(this.config.defaultHeaders || {}),
    };
  }
}

export const ANTHROPIC_MODELS = {
  CLAUDE_SONNET_4: 'claude-sonnet-4-20250514',
  CLAUDE_HAIKU_35: 'claude-3-5-haiku-20241022',
  CLAUDE_SONNET_35: 'claude-3-5-sonnet-20241022',
  CLAUDE_OPUS_4: 'claude-opus-4-20250514',
} as const;
