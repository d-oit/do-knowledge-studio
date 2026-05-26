import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../../../lib/llm/config', () => ({
  loadConfig: vi.fn().mockReturnValue({
    activeProvider: 'openrouter',
    providers: {
      openai: { apiKey: '', baseUrl: '', model: 'gpt-4o' },
      openrouter: { apiKey: '', baseUrl: '', model: 'google/gemini-2.0-flash-lite-preview-02-05:free' },
    },
  }),
  saveConfig: vi.fn(),
  createProvider: vi.fn().mockReturnValue({
    chatStream: vi.fn().mockImplementation(() => {
      async function* gen() { yield { content: '', done: true }; }
      return gen();
    }),
  }),
  maskApiKey: vi.fn().mockReturnValue('sk-****'),
}));

vi.mock('../../../lib/search', () => ({
  searchKnowledge: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/resolver', () => ({
  resolveUrl: vi.fn().mockResolvedValue({
    url: 'https://example.com',
    title: 'Example',
    content: 'Example content',
    provider: 'web',
    wordCount: 100,
  }),
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import AIHarness from '../AIHarness';

describe('AIHarness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AIHarness />);
    expect(screen.getByText('AI Harness')).toBeDefined();
  });

  it('shows initial assistant message', () => {
    render(<AIHarness />);
    expect(screen.getByText(/AI agent ready to assist/)).toBeDefined();
  });

  it('shows API key warning when no key is configured', () => {
    render(<AIHarness />);
    expect(screen.getByText(/No API key configured/)).toBeDefined();
  });

  it('renders the ask input', () => {
    render(<AIHarness />);
    const input = screen.getByPlaceholderText('Ask the AI agent...');
    expect(input).toBeDefined();
  });
});
