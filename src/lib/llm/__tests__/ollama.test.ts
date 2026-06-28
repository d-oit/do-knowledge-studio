import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../ollama';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OllamaProvider', () => {
  describe('constructor', () => {
    it('sets default baseURL', () => {
      const provider = new OllamaProvider();
      expect(provider.id).toBe('ollama');
      expect(provider.name).toBe('Ollama (Local)');
      expect(provider.config.baseURL).toBe('http://localhost:11434');
    });

    it('uses custom baseURL', () => {
      const provider = new OllamaProvider({ baseURL: 'http://remote:11434' });
      expect(provider.config.baseURL).toBe('http://remote:11434');
    });
  });

  describe('isConfigured', () => {
    it('always returns true (local)', () => {
      expect(new OllamaProvider().isConfigured()).toBe(true);
    });
  });

  describe('chat', () => {
    it('returns response on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Ollama response' },
          model: 'llama3.2',
          eval_count: 10,
          prompt_eval_count: 5,
        }),
      });

      const provider = new OllamaProvider();
      const result = await provider.chat({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.content).toBe('Ollama response');
      expect(result.model).toBe('llama3.2');
      expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 10 });
    });

    it('returns empty content when no message', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ model: 'm' }),
      });

      const provider = new OllamaProvider();
      const result = await provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });
      expect(result.content).toBe('');
    });

    it('returns undefined usage when eval_count missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { content: 'ok' }, model: 'm' }),
      });

      const provider = new OllamaProvider();
      const result = await provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });
      expect(result.usage).toBeUndefined();
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Connection refused',
        json: () => Promise.resolve({ error: 'Model not found' }),
      });

      const provider = new OllamaProvider();
      await expect(
        provider.chat({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('Ollama error: Model not found');
    });

    it('sends correct body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { content: '' }, model: 'm' }),
      });

      const provider = new OllamaProvider();
      await provider.chat({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.7,
        maxTokens: 500,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          body: expect.stringContaining('"stream":false'),
        })
      );
    });
  });

  describe('chatStream', () => {
    it('yields content chunks and done', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"message":{"content":"Hello"},"done":false}\n'));
          controller.enqueue(encoder.encode('{"message":{"content":" World"},"done":false}\n'));
          controller.enqueue(encoder.encode('{"done":true,"eval_count":20,"prompt_eval_count":10}\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => stream.getReader() },
      });

      const provider = new OllamaProvider();
      const chunks: Array<{ content: string; done: boolean }> = [];
      for await (const chunk of provider.chatStream({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.some(c => c.content === 'Hello')).toBe(true);
      expect(chunks.some(c => c.content === ' World')).toBe(true);
      expect(chunks.some(c => c.done === true)).toBe(true);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Model not available' }),
      });

      const provider = new OllamaProvider();
      const gen = provider.chatStream({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });
      await expect(gen.next()).rejects.toThrow('Ollama error: Model not available');
    });

    it('throws when no response body', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: null });
      const provider = new OllamaProvider();
      const gen = provider.chatStream({ model: 'm', messages: [{ role: 'user', content: 'Hi' }] });
      await expect(gen.next()).rejects.toThrow('No response body');
    });

    it('handles stream ending without done=true', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"message":{"content":"Hi"},"done":false}\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => stream.getReader() },
      });

      const provider = new OllamaProvider();
      const chunks: Array<{ content: string; done: boolean }> = [];
      for await (const chunk of provider.chatStream({
        model: 'm',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.some(c => c.done === true)).toBe(true);
    });
  });
});
