import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockSearchKnowledge = vi.fn().mockResolvedValue([]);

vi.mock('../../../lib/search', () => ({
  searchKnowledge: (...args: unknown[]): ReturnType<typeof mockSearchKnowledge> => mockSearchKnowledge(...args),
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockLoadConfig = vi.fn();
const mockCreateProvider = vi.fn();
vi.mock('../../../lib/llm/config', () => ({
  loadConfig: (...args: unknown[]): ReturnType<typeof mockLoadConfig> => mockLoadConfig(...args),
  createProvider: (...args: unknown[]): ReturnType<typeof mockCreateProvider> => mockCreateProvider(...args),
}));

vi.mock('../../../lib/motion', () => ({
  scrollIntoViewSmooth: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import Chat from '../Chat';

describe('Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockResolvedValue({
      activeProvider: 'openrouter',
      providers: {
        openrouter: { apiKey: 'k', baseURL: 'https://x', defaultModel: 'm' },
      },
    });
    mockCreateProvider.mockReturnValue({
      isConfigured: () => false,
      chatStream: vi.fn(),
    });
  });

  it('renders without crashing', () => {
    render(<Chat />);
    expect(screen.getByText('Ask your library')).toBeDefined();
  });

  it('renders the ask input field', () => {
    render(<Chat />);
    expect(screen.getByPlaceholderText('Ask anything about your knowledge...')).toBeDefined();
  });

  it('shows local-only badge', () => {
    render(<Chat />);
    expect(screen.getByText('Local search only')).toBeDefined();
  });

  it('shows offline ready badge', () => {
    render(<Chat />);
    expect(screen.getByText('Offline ready')).toBeDefined();
  });

  it('renders suggested prompt buttons', () => {
    render(<Chat />);
    expect(screen.getByText('Summarize recent projects')).toBeDefined();
    expect(screen.getByText('Key people')).toBeDefined();
  });

  it('handleSend non-LLM path: searches and shows response', async () => {
    mockSearchKnowledge.mockResolvedValueOnce([
      { id: '1', title: 'Entity A', type: 'entity', content: 'Content A', score: 1, stage: '' },
    ]);

    render(<Chat />);
    const input = screen.getByPlaceholderText('Ask anything about your knowledge...');
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Based on your local records/)).toBeDefined();
    }, { timeout: 10000 });
    expect(mockSearchKnowledge).toHaveBeenCalledWith('test query', { limit: 5 });
  }, 15000);

  it('handleSend: shows no-match response when empty results', async () => {
    mockSearchKnowledge.mockResolvedValueOnce([]);

    render(<Chat />);
    const input = screen.getByPlaceholderText('Ask anything about your knowledge...');
    fireEvent.change(input, { target: { value: 'unknown topic' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/couldn't find any direct matches/)).toBeDefined();
    }, { timeout: 10000 });
  }, 15000);

  it.skip('handleSend LLM path: streams response when LLM available', async () => {
    const chunks = [
      { content: 'Hello ', done: false },
      { content: 'world', done: false },
      { content: '', done: true },
    ];
    const mockChatStream = vi.fn().mockReturnValue((function* () {
      for (const chunk of chunks) yield chunk;
    })());

    mockCreateProvider.mockReturnValue({
      isConfigured: () => true,
      chatStream: mockChatStream,
    });

    render(<Chat />);
    const input = screen.getByPlaceholderText('Ask anything about your knowledge...');
    fireEvent.change(input, { target: { value: 'hi' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Hello world/)).toBeDefined();
    }, { timeout: 10000 });
  }, 15000);
});
